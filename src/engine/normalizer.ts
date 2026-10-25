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

/**
 * Normalizes a URL, domain, or hostname into a clean root domain
 * e.g. "https://leetcode.com/problem" -> "leetcode.com"
 * e.g. "www.leetcode.com" -> "leetcode.com"
 */
export function extractRootDomain(input: string): string {
  if (!input) return '';
  let str = input.trim().toLowerCase();
  str = str.replace(/^[a-z]+:\/\//, '');
  str = str.split('/')[0].split('?')[0].split('#')[0];
  str = str.split(':')[0];
  str = str.replace(/^www\./, '');
  return str;
}

/**
 * Checks if a current host or URL is matched by any excluded site in the list.
 * Matches exact domain, subdomains, and root domains.
 */
export function isSiteExcluded(currentHost: string, disabledSites: string[]): boolean {
  if (!disabledSites || !Array.isArray(disabledSites) || disabledSites.length === 0) {
    return false;
  }
  const cleanCurrent = extractRootDomain(currentHost);
  if (!cleanCurrent) return false;

  return disabledSites.some(site => {
    const cleanSite = extractRootDomain(site);
    if (!cleanSite) return false;
    return cleanCurrent === cleanSite ||
           cleanCurrent.endsWith('.' + cleanSite) ||
           cleanSite.endsWith('.' + cleanCurrent);
  });
}
