/**
 * Normalizes field labels, placeholders, names, and attributes
 * into clean, comparable strings.
 */
export function normalizeText(text: string | null | undefined): string {
  if (!text) return '';

  return text
    // Preserve well-known compound names before camelCase split
    .replace(/\bGitHub\b/gi, 'github')
    .replace(/\bLinkedIn\b/gi, 'linkedin')
    .replace(/\bGitLab\b/gi, 'gitlab')
    .replace(/\bBitBucket\b/gi, 'bitbucket')
    // Convert camelCase or PascalCase to space-separated words (e.g. firstName -> first name)
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Replace underscores, hyphens, slashes with spaces
    .replace(/[_\-\/\\:]+/g, ' ')
    // Remove punctuation, required indicators (*), parentheses, brackets
    .replace(/[\*\(\)\[\]\{\}\.,:;!?'"~`@#\$%\^&+=|<>]/g, ' ')
    // Convert to lowercase
    .toLowerCase()
    // Remove common filler words in form labels
    .replace(/\b(please\s+enter|enter\s+your|enter|your|type\s+here|provide|optional|required)\b/gi, ' ')
    // Normalize extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes text into individual words, useful for fuzzy or partial semantic checks.
 */
export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  return normalized.split(' ').filter(word => word.length > 0);
}
