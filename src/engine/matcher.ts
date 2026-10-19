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

export interface MatchOptions {
  fields: PersonalField[];
  userAliases: AliasMapping[];
  documents?: DocumentRecord[];
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
    const normalizedKey = normalizeText(field.key);
    for (const signal of normalizedSignals) {
      if (signal === normalizedKey) {
        return buildFieldMatch(fieldId, field, 'exact', 100, `Matched via exact key: "${field.key}"`);
      }
    }
  }

  // 3. User-Configured Alias Match (Confidence: 95)
  for (const userAlias of options.userAliases) {
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
    if (canonicalKey) {
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
    const keyTokens = tokenize(field.key);
    for (const signal of normalizedSignals) {
      const signalTokens = tokenize(signal);
      
      // If every token of the key is contained in the signal, and signal is specific
      const allTokensMatch = keyTokens.length > 0 && keyTokens.every(k => signalTokens.includes(k));
      if (allTokensMatch) {
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
    const field = options.fields.find(f => normalizeText(f.key) === normalizeText(group.canonicalKey));
    if (!field) continue;

    for (const alias of group.aliases) {
      const aliasTokens = tokenize(alias);
      for (const signal of normalizedSignals) {
        const signalTokens = tokenize(signal);
        if (aliasTokens.length > 0 && aliasTokens.every(k => signalTokens.includes(k))) {
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
