import {
  PersonalField,
  AliasMapping,
  DocumentRecord,
  FieldSignals,
  FieldMatch,
  MatchCandidate,
  DocumentCategory
} from '../types';
import { normalizeText, tokenize } from './normalizer';
import {
  BUILTIN_ALIAS_GROUPS,
  DOCUMENT_CATEGORY_KEYWORDS,
  AUTOCOMPLETE_TO_CANONICAL
} from './aliases';
import { generateEmbedding, cosineSimilarity } from './vector';
import { describeWebField } from './ai';

export interface MatchOptions {
  fields: PersonalField[];
  userAliases: AliasMapping[];
  documents?: DocumentRecord[];
}

export const PERSONAL_NAME_CANONICALS = new Set(['First Name', 'Surname', 'Full Name']);
export const VECTOR_MATCH_THRESHOLD = 0.72;

/**
 * Detects if a field is explicitly for non-human/non-personal entities
 * (repositories, projects, packages, databases, servers, playlists, etc.).
 * Personal names should NEVER match these fields.
 */
export function isNonPersonalEntityField(signals: FieldSignals): boolean {
  const combined = [
    signals.labelText,
    signals.name,
    signals.id,
    signals.placeholder,
    signals.ariaLabel,
    signals.cleanNameKeyword,
    signals.cleanIdKeyword
  ].join(' ').toLowerCase();

  // If explicitly referencing human name terms (first, last, given, family, surname, applicant, candidate), it is personal!
  if (/\b(first|last|given|family|surname|applicant|candidate|person|personal)\b/i.test(combined)) {
    return false;
  }

  // Common non-human technical, project, repository, software, or media entities
  const nonPersonalRegex = /\b(repo|repository|project|package|branch|commit|filename|folder|directory|cluster|hostname|database|table|column|schema|variable|domain|server|workspace|tenant|playlist|song|track|artist|album|service|resource|pipeline|secret|token)\b/i;

  return nonPersonalRegex.test(combined);
}

/**
 * Matches a detected form field's signals to saved personal fields or documents.
 * Prioritizes: Exact key -> User alias -> Built-in alias -> Autocomplete -> Semantic / File.
 */
export function matchField(
  fieldId: string,
  signals: FieldSignals,
  options: MatchOptions
): FieldMatch | null {
  // CRITICAL SECURITY FLOOR: NEVER match or autofill password fields!
  if (signals.inputType === 'other' || signals.name.toLowerCase().includes('password') || signals.id.toLowerCase().includes('password')) {
    if (signals.inputType as string === 'password') {
      return null;
    }
  }

  // 1. Handle File Upload Inputs (Document Matching)
  if (signals.inputType === 'file') {
    return matchDocumentField(fieldId, signals, options.documents || []);
  }

  const isNonPersonal = isNonPersonalEntityField(signals);

  // Collect all searchable textual signals from the DOM element
  const signalTexts = [
    signals.labelText,
    signals.ariaLabel,
    signals.placeholder,
    signals.cleanNameKeyword,
    signals.cleanIdKeyword,
    signals.name,
    signals.id,
    signals.surroundingText
  ].filter((t): t is string => Boolean(t && t.trim()));

  const normalizedSignals = signalTexts.map(t => normalizeText(t)).filter(Boolean);

  if (normalizedSignals.length === 0 && !signals.autocomplete) {
    return null;
  }

  // 2. Exact Canonical Key Match (Confidence: 100)
  for (const field of options.fields) {
    if (isNonPersonal && PERSONAL_NAME_CANONICALS.has(field.key)) continue;
    const normalizedKey = normalizeText(field.key);
    for (const signal of normalizedSignals) {
      if (signal === normalizedKey) {
        return buildFieldMatch(fieldId, field, 'exact', 100, `Matched via exact key: "${field.key}"`);
      }
    }
  }

  // 3. User-Configured Alias Match (Confidence: 95)
  for (const userAlias of options.userAliases) {
    if (isNonPersonal && PERSONAL_NAME_CANONICALS.has(userAlias.canonicalKey)) continue;
    const normalizedAlias = normalizeText(userAlias.alias);
    for (const signal of normalizedSignals) {
      if (signal === normalizedAlias) {
        const field = options.fields.find(f => normalizeText(f.key) === normalizeText(userAlias.canonicalKey));
        if (field) {
          return buildFieldMatch(
            fieldId,
            field,
            'user_alias',
            95,
            `Matched via custom alias: "${userAlias.alias}" → ${field.key}`
          );
        }
      }
    }
  }

  // 4. Built-in Alias Match (Confidence: 90)
  for (const group of BUILTIN_ALIAS_GROUPS) {
    if (isNonPersonal && PERSONAL_NAME_CANONICALS.has(group.canonicalKey)) continue;
    const field = options.fields.find(f => normalizeText(f.key) === normalizeText(group.canonicalKey));
    if (!field) continue;

    for (const alias of group.aliases) {
      const normalizedAlias = normalizeText(alias);
      for (const signal of normalizedSignals) {
        if (signal === normalizedAlias) {
          return buildFieldMatch(
            fieldId,
            field,
            'builtin_alias',
            90,
            `Matched via alias: "${alias}" → ${field.key}`
          );
        }
      }
    }
  }

  // 5. HTML Autocomplete Attribute Match (Confidence: 85)
  if (signals.autocomplete) {
    const autoToken = signals.autocomplete.toLowerCase().trim();
    const canonicalKey = AUTOCOMPLETE_TO_CANONICAL[autoToken];
    if (canonicalKey && (!isNonPersonal || !PERSONAL_NAME_CANONICALS.has(canonicalKey))) {
      const field = options.fields.find(f => normalizeText(f.key) === normalizeText(canonicalKey));
      if (field) {
        return buildFieldMatch(
          fieldId,
          field,
          'autocomplete',
          85,
          `Matched via autocomplete="${autoToken}" → ${field.key}`
        );
      }
    }
  }

  // 6. Semantic / Partial Token Match (Confidence: 75)
  // Check if signal tokens strongly contain the canonical key or known alias tokens
  for (const field of options.fields) {
    if (isNonPersonal && PERSONAL_NAME_CANONICALS.has(field.key)) continue;
    const keyTokens = tokenize(field.key);
    for (const signal of normalizedSignals) {
      const signalTokens = tokenize(signal);
      
      // If every token of the key is contained in the signal, and signal is specific
      const allTokensMatch = keyTokens.length > 0 && keyTokens.every(k => signalTokens.includes(k));
      if (allTokensMatch) {
        // Prevent generic single-token 'name' from matching arbitrary phrases without personal qualifiers
        if (keyTokens.length === 1 && keyTokens[0] === 'name') {
          const hasPersonalModifier = signalTokens.some(t =>
            ['full', 'first', 'last', 'given', 'family', 'middle', 'your', 'candidate', 'applicant', 'legal', 'person', 'contact', 'customer', 'user'].includes(t)
          );
          if (!hasPersonalModifier) continue;
        }

        return buildFieldMatch(
          fieldId,
          field,
          'semantic',
          75,
          `Matched via semantic similarity: "${signal}" → ${field.key}`
        );
      }
    }
  }

  // Also check built-in aliases for semantic containment (e.g. "user_email" -> contains "email")
  for (const group of BUILTIN_ALIAS_GROUPS) {
    if (isNonPersonal && PERSONAL_NAME_CANONICALS.has(group.canonicalKey)) continue;
    const field = options.fields.find(f => normalizeText(f.key) === normalizeText(group.canonicalKey));
    if (!field) continue;

    for (const alias of group.aliases) {
      const aliasTokens = tokenize(alias);
      for (const signal of normalizedSignals) {
        const signalTokens = tokenize(signal);
        if (aliasTokens.length > 0 && aliasTokens.every(k => signalTokens.includes(k))) {
          // Prevent generic single-token 'name' from matching arbitrary compound phrases without personal qualifiers
          if (aliasTokens.length === 1 && aliasTokens[0] === 'name') {
            const hasPersonalModifier = signalTokens.some(t =>
              ['full', 'first', 'last', 'given', 'family', 'middle', 'your', 'candidate', 'applicant', 'legal', 'person', 'contact', 'customer', 'user'].includes(t)
            );
            if (!hasPersonalModifier) continue;
          }

          return buildFieldMatch(
            fieldId,
            field,
            'semantic',
            70,
            `Matched via semantic similarity: "${signal}" → ${field.key}`
          );
        }
      }
    }
  }

  // 7. Vector Embedding & AI Description Matching (Confidence: 72..95)
  // Generates semantic description of the web field, embeds it, and compares cosine similarity with stored field descriptions
  const webDesc = buildQuickWebFieldDescription(signals);
  const webEmbedding = generateEmbedding(webDesc);

  let bestVectorField: PersonalField | null = null;
  let highestSimilarity = 0;

  for (const field of options.fields) {
    if (isNonPersonal && PERSONAL_NAME_CANONICALS.has(field.key)) continue;

    const fieldEmbedding = field.embedding && field.embedding.length > 0
      ? field.embedding
      : generateEmbedding(`${field.description || ''} ${field.key}`);

    const sim = cosineSimilarity(webEmbedding, fieldEmbedding);
    if (sim > highestSimilarity) {
      highestSimilarity = sim;
      bestVectorField = field;
    }
  }

  if (bestVectorField && highestSimilarity >= VECTOR_MATCH_THRESHOLD) {
    const confidence = Math.round(highestSimilarity * 100);
    return buildFieldMatch(
      fieldId,
      bestVectorField,
      'vector_embedding',
      confidence,
      `Matched via AI vector embedding (${confidence}% similarity): "${webDesc}" → "${bestVectorField.description || bestVectorField.key}"`
    );
  }

  return null;
}

/**
 * Generates a quick contextual description of the web form field.
 */
export function buildQuickWebFieldDescription(signals: FieldSignals): string {
  const label = signals.labelText || signals.ariaLabel || '';
  const placeholder = signals.placeholder || '';
  const name = signals.cleanNameKeyword || signals.name || '';
  const id = signals.cleanIdKeyword || signals.id || '';
  const combined = [label, placeholder, name, id].filter(Boolean).join(' ').toLowerCase();

  // Software & Code Repositories
  if (/\b(repo|repository|project|package|branch|commit|codebase)\b/i.test(combined)) {
    return "Git code repository, project name, or software package identifier.";
  }

  // Database & Systems
  if (/\b(database|table|column|schema|sql|hostname|server|cluster)\b/i.test(combined)) {
    return "Database table, schema, backend host, or server infrastructure name.";
  }

  // Media & Music
  if (/\b(song|track|playlist|artist|album|video|audio)\b/i.test(combined)) {
    return "Media title, playlist name, music track, or audio artist.";
  }

  // Personal Names
  if (/\b(first\s*name|given\s*name|forename|fname)\b/i.test(combined)) {
    return "Candidate's given first name for personal identification and job application.";
  }
  if (/\b(last\s*name|surname|family\s*name|lname)\b/i.test(combined)) {
    return "Candidate's family surname or last name for official records.";
  }
  if (/\b(full\s*name|complete\s*name|your\s*name|applicant\s*name)\b/i.test(combined)) {
    return "Candidate's full legal name including first and last names.";
  }

  // Contact
  if (/\b(email|e-mail|mail)\b/i.test(combined)) {
    return "Personal or business email address for contact and communications.";
  }
  if (/\b(phone|mobile|cell|telephone|tel)\b/i.test(combined)) {
    return "Contact telephone or mobile phone number.";
  }

  // Professional Links
  if (/linkedin/i.test(combined)) {
    return "LinkedIn public member profile URL for candidate background.";
  }
  if (/github/i.test(combined)) {
    return "GitHub developer profile URL showing open-source projects.";
  }
  if (/portfolio|website/i.test(combined)) {
    return "Candidate's personal portfolio or website showcasing projects.";
  }

  // Address
  if (/\b(address|street|residence)\b/i.test(combined)) {
    return "Mailing address and street location.";
  }

  return `Web form field for ${label || placeholder || name || id || 'personal input'}.`;
}

/**
 * Asynchronous vector matching that uses Chrome Built-in AI to describe web fields if available.
 */
export async function matchFieldWithAIVector(
  fieldId: string,
  signals: FieldSignals,
  options: MatchOptions
): Promise<FieldMatch | null> {
  // First run standard fast heuristic matching
  const fastMatch = matchField(fieldId, signals, options);
  if (fastMatch) return fastMatch;

  const isNonPersonal = isNonPersonalEntityField(signals);
  const webDesc = await describeWebField(signals);
  const webEmbedding = generateEmbedding(webDesc);

  let bestVectorField: PersonalField | null = null;
  let highestSimilarity = 0;

  for (const field of options.fields) {
    if (isNonPersonal && PERSONAL_NAME_CANONICALS.has(field.key)) continue;

    const fieldEmbedding = field.embedding && field.embedding.length > 0
      ? field.embedding
      : generateEmbedding(`${field.description || ''} ${field.key}`);

    const sim = cosineSimilarity(webEmbedding, fieldEmbedding);
    if (sim > highestSimilarity) {
      highestSimilarity = sim;
      bestVectorField = field;
    }
  }

  if (bestVectorField && highestSimilarity >= VECTOR_MATCH_THRESHOLD) {
    const confidence = Math.round(highestSimilarity * 100);
    return buildFieldMatch(
      fieldId,
      bestVectorField,
      'vector_embedding',
      confidence,
      `Matched via AI vector embedding (${confidence}% similarity): "${webDesc}" → "${bestVectorField.description || bestVectorField.key}"`
    );
  }

  return null;
}

/**
 * Handles matching file upload inputs with stored documents by category.
 */
function matchDocumentField(
  fieldId: string,
  signals: FieldSignals,
  documents: DocumentRecord[]
): FieldMatch | null {
  const signalTexts = [
    signals.labelText,
    signals.ariaLabel,
    signals.name,
    signals.id,
    signals.surroundingText
  ].filter(Boolean);

  const normalizedSignals = signalTexts.map(t => normalizeText(t)).filter(Boolean);

  let targetCategory: DocumentCategory = 'Resume'; // Default for typical job uploads
  let matchedKeyword = '';

  categoryLoop:
  for (const [category, keywords] of Object.entries(DOCUMENT_CATEGORY_KEYWORDS) as [DocumentCategory, string[]][]) {
    for (const kw of keywords) {
      const normKw = normalizeText(kw);
      for (const sig of normalizedSignals) {
        if (sig.includes(normKw) || normKw.includes(sig)) {
          targetCategory = category;
          matchedKeyword = kw;
          break categoryLoop;
        }
      }
    }
  }

  // Filter user's saved documents matching this category
  const matchingDocs = documents.filter(doc => doc.category === targetCategory);
  
  // If no documents match this category specifically, fall back to all documents so user can still choose
  const availableDocs = matchingDocs.length > 0 ? matchingDocs : documents;

  if (availableDocs.length === 0) {
    return null;
  }

  const candidates: MatchCandidate[] = availableDocs.map(doc => ({
    id: doc.id,
    label: doc.displayName,
    value: doc.originalFilename,
    documentId: doc.id
  }));

  return {
    fieldId,
    matchedCanonicalKey: targetCategory,
    matchType: 'document_category',
    confidence: matchedKeyword ? 90 : 60,
    reason: matchedKeyword 
      ? `Matched document category "${targetCategory}" via keyword "${matchedKeyword}"`
      : `Suggested documents for file upload field`,
    candidates,
    documentCategory: targetCategory
  };
}

function buildFieldMatch(
  fieldId: string,
  field: PersonalField,
  matchType: FieldMatch['matchType'],
  confidence: number,
  reason: string
): FieldMatch {
  const candidates: MatchCandidate[] = field.values.map(val => ({
    id: val.id,
    label: val.label ? `${val.label}: ${val.value}` : val.value,
    value: val.value
  }));

  return {
    fieldId,
    matchedCanonicalKey: field.key,
    matchType,
    confidence,
    reason,
    candidates
  };
}
