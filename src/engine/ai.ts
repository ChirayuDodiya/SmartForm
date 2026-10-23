import { FieldSignals } from '../types';

export interface FieldMetadataResult {
  description: string;
  category: string;
}

/**
 * Checks if the browser's native built-in AI (Chrome Prompt API / Gemini Nano) is available.
 */
export async function isBuiltInAIAvailable(): Promise<boolean> {
  try {
    const ai = (typeof window !== 'undefined' && (window as any).ai) || 
               (typeof globalThis !== 'undefined' && (globalThis as any).ai);
    if (!ai || !ai.languageModel) {
      return false;
    }
    const capabilities = await ai.languageModel.capabilities();
    return capabilities && (capabilities.available === 'readily' || capabilities.available === 'after-download');
  } catch {
    return false;
  }
}

/**
 * Creates a language model session using Chrome's Built-in AI.
 */
async function getLanguageModelSession(systemPrompt: string): Promise<any | null> {
  try {
    const ai = (typeof window !== 'undefined' && (window as any).ai) || 
               (typeof globalThis !== 'undefined' && (globalThis as any).ai);
    if (!ai || !ai.languageModel) return null;
    return await ai.languageModel.create({ systemPrompt });
  } catch {
    return null;
  }
}

/**
 * Generates a concise semantic description and appropriate category for a vault field.
 * Uses Chrome Built-in AI (Gemini Nano) when enabled, with an intelligent on-device fallback.
 */
export async function generateFieldMetadata(
  fieldName: string,
  sampleValue?: string
): Promise<FieldMetadataResult> {
  const cleanName = (fieldName || '').trim();
  const cleanVal = (sampleValue || '').trim();

  // 1. Try Browser Built-in AI (Chrome Gemini Nano)
  try {
    const hasAI = await isBuiltInAIAvailable();
    if (hasAI) {
      const session = await getLanguageModelSession(
        'You are an autofill assistant. Given a form field name, respond with a JSON object containing "description" (one clear sentence explaining what this field is for) and "category" (one of: Personal, Job Applications, Academic, or Financial).'
      );

      if (session) {
        const prompt = `Field Name: "${cleanName}"${cleanVal ? `, Sample Value: "${cleanVal}"` : ''}`;
        const rawResponse = await session.prompt(prompt);
        session.destroy?.();

        // Parse JSON output
        const jsonMatch = rawResponse.match(/\{[\s\S]*?\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.description && parsed.category) {
            return {
              description: parsed.description.trim(),
              category: parsed.category.trim()
            };
          }
        }
      }
    }
  } catch (err) {
    console.debug('[SmartForm AI] Built-in AI prompt skipped, using heuristic describer:', err);
  }

  // 2. Deterministic Semantic Fallback
  return generateFallbackMetadata(cleanName, cleanVal);
}

/**
 * Generates a semantic description of an input field found on a webpage.
 * Used at filling time to compare with stored field descriptions.
 */
export async function describeWebField(signals: FieldSignals): Promise<string> {
  const label = signals.labelText || signals.ariaLabel || '';
  const placeholder = signals.placeholder || '';
  const name = signals.cleanNameKeyword || signals.name || '';
  const id = signals.cleanIdKeyword || signals.id || '';

  // 1. Try Browser Built-in AI if available
  try {
    const hasAI = await isBuiltInAIAvailable();
    if (hasAI) {
      const session = await getLanguageModelSession(
        'You are a web form analyzer. In one short descriptive sentence, describe what kind of personal data or entity this input field is requesting.'
      );

      if (session) {
        const prompt = `Label: "${label}", Placeholder: "${placeholder}", Input Name: "${name}", ID: "${id}"`;
        const desc = await session.prompt(prompt);
        session.destroy?.();
        if (desc && desc.trim().length > 5) {
          return desc.trim();
        }
      }
    }
  } catch {
    // Fall back to rule-based describer
  }

  // 2. Deterministic Semantic Description Fallback
  return generateFallbackWebFieldDescription(signals);
}

/**
 * High-accuracy fallback metadata generator.
 */
function generateFallbackMetadata(fieldName: string, sampleValue?: string): FieldMetadataResult {
  const norm = fieldName.toLowerCase().trim();
  const val = (sampleValue || '').toLowerCase().trim();

  // Name variations
  if (/^(first\s*name|given\s*name|forename|fname)$/i.test(norm)) {
    return {
      description: "User's given first name for personal identification and official applications.",
      category: 'Personal'
    };
  }
  if (/^(last\s*name|surname|family\s*name|lname)$/i.test(norm)) {
    return {
      description: "User's family surname or last name for identity records and applications.",
      category: 'Personal'
    };
  }
  if (/^(full\s*name|complete\s*name|your\s*name|applicant\s*name)$/i.test(norm)) {
    return {
      description: "User's full legal name including first name and surname.",
      category: 'Personal'
    };
  }

  // Contact
  if (/email|e-mail/i.test(norm) || val.includes('@')) {
    return {
      description: "User's electronic mail address for contact and correspondence.",
      category: 'Personal'
    };
  }
  if (/phone|mobile|cell|telephone/i.test(norm) || /^\+?[\d\s\-()]{7,}$/.test(val)) {
    return {
      description: "User's mobile or telephone number for voice calls and text messages.",
      category: 'Personal'
    };
  }

  // Web & Portfolio
  if (/linkedin/i.test(norm) || val.includes('linkedin.com')) {
    return {
      description: "User's LinkedIn professional profile link for career and networking.",
      category: 'Job Applications'
    };
  }
  if (/github/i.test(norm) || val.includes('github.com')) {
    return {
      description: "User's GitHub developer profile link displaying code repositories and projects.",
      category: 'Job Applications'
    };
  }
  if (/portfolio|website|homepage/i.test(norm) || val.startsWith('http')) {
    return {
      description: "User's personal portfolio website URL showcasing work samples and achievements.",
      category: 'Job Applications'
    };
  }

  // Location / Address
  if (/address|street|residence/i.test(norm)) {
    return {
      description: "User's physical street address and residential location.",
      category: 'Personal'
    };
  }
  if (/city|town/i.test(norm)) {
    return {
      description: "City or municipality of user's residence.",
      category: 'Personal'
    };
  }
  if (/state|province|region/i.test(norm)) {
    return {
      description: "State or province of user's residence.",
      category: 'Personal'
    };
  }
  if (/zip|postal|pincode/i.test(norm)) {
    return {
      description: "Postal code or ZIP code for geographical mailing routing.",
      category: 'Personal'
    };
  }

  // Academic
  if (/gpa|grade|score/i.test(norm)) {
    return {
      description: "User's academic grade point average (GPA) or academic evaluation score.",
      category: 'Academic'
    };
  }
  if (/university|college|school|degree|major/i.test(norm)) {
    return {
      description: "User's higher education institution, degree title, or academic major.",
      category: 'Academic'
    };
  }

  // Default custom field
  return {
    description: `User's stored personal data for "${fieldName}".`,
    category: 'Personal'
  };
}

/**
 * High-accuracy fallback web field describer.
 */
function generateFallbackWebFieldDescription(signals: FieldSignals): string {
  const combined = [
    signals.labelText,
    signals.placeholder,
    signals.name,
    signals.id,
    signals.cleanNameKeyword,
    signals.cleanIdKeyword
  ].filter(Boolean).join(' ').toLowerCase();

  // Software & Code Repositories
  if (/\b(repo|repository|project|package|branch|commit|codebase)\b/i.test(combined)) {
    return "Git code repository, project name, or software package identifier.";
  }

  // Database & Infrastructure
  if (/\b(database|table|column|schema|sql|hostname|server|cluster)\b/i.test(combined)) {
    return "Database table, schema, backend host, or server infrastructure name.";
  }

  // Media & Music
  if (/\b(song|track|playlist|artist|album|video|audio)\b/i.test(combined)) {
    return "Media title, playlist name, music track, or audio artist.";
  }

  // Search Bars
  if (/\b(search|query|find|filter)\b/i.test(combined)) {
    return "Search query bar for filtering content.";
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

  const primaryLabel = signals.labelText || signals.placeholder || signals.name || signals.id || 'Field';
  return `Web form field for ${primaryLabel}.`;
}
