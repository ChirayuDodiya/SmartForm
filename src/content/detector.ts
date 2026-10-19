import { FieldSignals, DetectedInputType, FieldMatch } from '../types';
import { matchField, MatchOptions } from '../engine/matcher';

export interface ScannedElement {
  id: string;
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  signals: FieldSignals;
  match: FieldMatch | null;
}

let elementCounter = 0;


export function cleanRawText(raw: string): string {
  let text = (raw || '').trim();

  // Strip duplicate consecutive word sequences (e.g. LinkedIn's "First nameFirst name" or "Email address Email address")
  text = text.replace(/([A-Za-z0-9\s]{2,30}?)\s*\1+/i, '$1').trim();

  // Strip common accessibility and filler noise: "Required", "Optional", asterisks, colons
  text = text.replace(/\b(required|optional|please enter|enter your|type your)\b/gi, '').replace(/[*:#]/g, '').trim();

  return text;
}

export function cleanLabelElementText(labelEl: Element): string {
  // If the label contains an aria-hidden span (which LinkedIn uses for the visible text):
  const ariaHiddenSpan = labelEl.querySelector('span[aria-hidden="true"]');
  if (ariaHiddenSpan && ariaHiddenSpan.textContent?.trim()) {
    return cleanRawText(ariaHiddenSpan.textContent);
  }

  // Clone to avoid mutating live DOM
  const clone = labelEl.cloneNode(true) as HTMLElement;
  // Remove visually hidden / screen reader duplicate spans
  clone.querySelectorAll('.visually-hidden, .sr-only, [class*="visually-hidden"], [class*="sr-only"]').forEach(e => e.remove());
  clone.querySelectorAll('input, select, textarea').forEach(e => e.remove());

  let text = clone.textContent || '';
  if (!text.trim()) {
    text = labelEl.textContent || '';
  }

  return cleanRawText(text);
}

export function isDropdownOrSelect(el: HTMLElement): boolean {
  if (!el) return false;

  const tag = el.tagName.toLowerCase();
  if (tag === 'select') return true;

  // ARIA role check (combobox, listbox)
  const role = el.getAttribute('role')?.toLowerCase();
  if (role === 'combobox' || role === 'listbox') return true;

  // aria-haspopup="listbox" or "true" or "menu"
  const ariaHasPopup = el.getAttribute('aria-haspopup')?.toLowerCase();
  if (ariaHasPopup === 'listbox' || ariaHasPopup === 'true' || ariaHasPopup === 'menu') return true;

  // aria-autocomplete="list" or HTML5 datalist attribute
  if (el.getAttribute('aria-autocomplete') === 'list') return true;
  if (el.hasAttribute('list')) return true;

  // Dropdown wrappers (LinkedIn .fb-dropdown, custom UI select/combobox containers)
  if (el.closest('.fb-dropdown, [class*="dropdown"], [class*="select__control"], [class*="combobox"], [role="combobox"], [class*="ant-select"], [class*="MuiSelect"], [class*="select2"], [class*="choices"]')) {
    return true;
  }

  return false;
}

export function isMediaOrEntertainmentSite(): boolean {
  if (typeof window === 'undefined' || !window.location) return false;
  const host = (window.location.hostname || '').toLowerCase();
  const path = (window.location.pathname || '').toLowerCase();

  // If user is explicitly in account settings, billing, or checkout on these platforms, allow SmartForm
  if (path.includes('/account') || path.includes('/billing') || path.includes('/checkout') || path.includes('/settings') || path.includes('/signup') || path.includes('/login')) {
    return false;
  }

  // Pure entertainment/streaming/media platforms
  const mediaHosts = [
    'youtube.com',
    'spotify.com',
    'music.youtube.com',
    'soundcloud.com',
    'netflix.com',
    'twitch.tv',
    'vimeo.com',
    'dailymotion.com',
    'disneyplus.com',
    'hulu.com',
    'primevideo.com'
  ];

  return mediaHosts.some(m => host === m || host.endsWith('.' + m));
}

export function isSearchInput(el: HTMLElement, signals?: FieldSignals): boolean {
  if (!el) return false;

  // 1. Native input type="search"
  const isInput = el.tagName?.toLowerCase() === 'input';
  const typeAttr = ((el as any).type || el.getAttribute?.('type') || '').toLowerCase();
  if (isInput && typeAttr === 'search') return true;

  // 2. ARIA role="searchbox" or role="search"
  const role = el.getAttribute?.('role')?.toLowerCase();
  if (role === 'searchbox' || role === 'search') return true;

  // 3. Search form wrapper or container
  if (typeof el.closest === 'function') {
    if (el.closest('form[role="search"], [role="search"], [role="searchbox"], form[action*="search"], [data-testid*="search"]')) {
      return true;
    }

    // 4. Common search class patterns (e.g. YouTube ytd-searchbox, Spotify search-input, etc.)
    if (el.closest('.search, .search-box, .searchbox, .search-bar, [class*="searchbox"], [class*="searchBar"], [class*="search-bar"], [class*="search-input"], ytd-searchbox, #search-form')) {
      return true;
    }
  }

  // 5. Explicit search attribute values
  const name = (signals?.name || el.getAttribute?.('name') || '').toLowerCase();
  const id = (signals?.id || el.getAttribute?.('id') || '').toLowerCase();
  const placeholder = (signals?.placeholder || el.getAttribute?.('placeholder') || '').toLowerCase();
  const ariaLabel = (signals?.ariaLabel || el.getAttribute?.('aria-label') || '').toLowerCase();
  const testId = (el.getAttribute?.('data-testid') || '').toLowerCase();

  // Common search field query names
  const searchNames = ['q', 'query', 'search', 'keyword', 'keywords', 'search_query', 's', 'searchbox', 'search_term', 'term'];
  if (searchNames.includes(name) || searchNames.includes(id)) {
    return true;
  }

  if (testId.includes('search')) {
    return true;
  }

  // Common search placeholders / labels (including Spotify's "What do you want to play?")
  const searchPhrases = [
    'search',
    'search here',
    'search query',
    'search or jump to',
    'what do you want to play',
    'what do you want to listen to',
    'find songs',
    'find artist',
    'find music',
    'find video'
  ];

  for (const phrase of searchPhrases) {
    if (placeholder.includes(phrase) || ariaLabel.includes(phrase)) {
      return true;
    }
  }

  const combined = `${name} ${id} ${placeholder} ${ariaLabel}`.toLowerCase();
  if (combined.includes('search') && !combined.includes('research')) {
    return true;
  }

  return false;
}

export function extractSignals(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): FieldSignals {
  const name = el.getAttribute('name') || '';
  const id = el.getAttribute('id') || '';
  const placeholder = el.getAttribute('placeholder') || '';
  const ariaLabel = el.getAttribute('aria-label') || '';
  const ariaLabelledBy = el.getAttribute('aria-labelledby') || '';
  const autocomplete = el.getAttribute('autocomplete') || '';
  
  let inputType: DetectedInputType = 'text';
  if (el.tagName.toLowerCase() === 'select' || isDropdownOrSelect(el)) {
    inputType = 'select';
  } else if (el.tagName.toLowerCase() === 'textarea') {
    inputType = 'textarea';
  } else if (el.tagName.toLowerCase() === 'input') {
    const rawType = (el as HTMLInputElement).type?.toLowerCase() || 'text';
    if (rawType === 'password') inputType = 'other'; // NEVER autofill password
    else if (['email', 'tel', 'url', 'date', 'file', 'checkbox'].includes(rawType)) {
      inputType = rawType as DetectedInputType;
    } else {
      inputType = 'text';
    }
  }

  // 1. Find associated label text via for=id
  let labelText = '';
  if (id) {
    try {
      const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (labelEl) {
        labelText = cleanLabelElementText(labelEl);
      }
    } catch {
      const allLabels = document.getElementsByTagName('label');
      for (let i = 0; i < allLabels.length; i++) {
        if (allLabels[i].getAttribute('for') === id) {
          labelText = cleanLabelElementText(allLabels[i]);
          break;
        }
      }
    }
  }

  // 2. Wrapping label
  if (!labelText) {
    const parentLabel = el.closest('label');
    if (parentLabel) {
      labelText = cleanLabelElementText(parentLabel);
    }
  }

  // 3. ARIA labelledby (supports space-separated multiple IDs)
  if (!labelText && ariaLabelledBy) {
    const ids = ariaLabelledBy.split(/\s+/).filter(Boolean);
    const texts: string[] = [];
    for (const labelId of ids) {
      const item = document.getElementById(labelId);
      if (item) texts.push(cleanLabelElementText(item));
    }
    labelText = texts.join(' ').trim();
  }

  // 4. Surrounding contextual text and parent form block headers (supports LinkedIn .fb-single-line-text, etc.)
  let surroundingText = '';
  const parentContainer = el.closest(
    '.fb-single-line-text, .fb-dropdown, .fb-multiline-text, .jobs-easy-apply-form-section, .form-group, .field, [class*="form-"], [class*="input-"], div'
  );
  if (parentContainer) {
    if (!labelText) {
      const labelInside = parentContainer.querySelector('label, [class*="label"], legend, span[class*="title"], strong');
      if (labelInside && labelInside !== el && !labelInside.contains(el)) {
        labelText = cleanLabelElementText(labelInside);
      }
    }
    const heading = parentContainer.querySelector('h1, h2, h3, h4, h5, h6, strong');
    if (heading && heading !== el) {
      surroundingText = heading.textContent || '';
    }
  }

  const NON_PERSONAL_INDICATORS = [
    'repo', 'repository', 'project', 'package', 'branch', 'commit',
    'file', 'filename', 'folder', 'directory', 'cluster', 'hostname',
    'database', 'table', 'column', 'schema', 'variable', 'domain',
    'server', 'workspace', 'tenant', 'playlist', 'song', 'track', 'artist', 'album'
  ];

  // Extract clean keyword from compound URN names or IDs (e.g. LinkedIn's urn:li:...:firstName or ...-firstName)
  let cleanIdKeyword = '';
  if (id) {
    const parts = id.split(/[-_:,()]+/).filter(p => p.length > 1 && isNaN(Number(p)));
    const lastPart = parts[parts.length - 1] || '';
    if (lastPart.toLowerCase() === 'name' && parts.length > 1) {
      const prev = parts[parts.length - 2].toLowerCase();
      if (NON_PERSONAL_INDICATORS.includes(prev)) {
        cleanIdKeyword = `${prev} name`;
      } else {
        cleanIdKeyword = lastPart;
      }
    } else {
      cleanIdKeyword = lastPart;
    }
  }

  let cleanNameKeyword = '';
  if (name) {
    const parts = name.split(/[-_:,()]+/).filter(p => p.length > 1 && isNaN(Number(p)));
    const lastPart = parts[parts.length - 1] || '';
    if (lastPart.toLowerCase() === 'name' && parts.length > 1) {
      const prev = parts[parts.length - 2].toLowerCase();
      if (NON_PERSONAL_INDICATORS.includes(prev)) {
        cleanNameKeyword = `${prev} name`;
      } else {
        cleanNameKeyword = lastPart;
      }
    } else {
      cleanNameKeyword = lastPart;
    }
  }

  return {
    name,
    id,
    placeholder,
    ariaLabel: cleanRawText(ariaLabel),
    ariaLabelledBy,
    autocomplete,
    labelText: labelText.trim(),
    surroundingText: surroundingText.trim(),
    inputType,
    cleanNameKeyword,
    cleanIdKeyword
  };
}

export function scanPage(options: MatchOptions): ScannedElement[] {
  // If on entertainment/media platform (YouTube, Spotify, etc.) browsing media, do not scan
  if (isMediaOrEntertainmentSite()) {
    return [];
  }

  const elements = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea'
    )
  );

  const scanned: ScannedElement[] = [];

  for (const el of elements) {
    // SECURITY FLOOR: Never inspect or touch passwords!
    if ((el as HTMLInputElement).type === 'password') {
      continue;
    }

    // Skip dropdowns and search inputs from form scanning
    if (isDropdownOrSelect(el) || isSearchInput(el)) {
      continue;
    }

    // Assign internal tracking ID
    let fieldId = el.getAttribute('data-smartform-id');
    if (!fieldId) {
      fieldId = `sf-field-${++elementCounter}`;
      el.setAttribute('data-smartform-id', fieldId);
    }

    const signals = extractSignals(el);

    // Skip search inputs if detected via signals
    if (isSearchInput(el, signals)) {
      continue;
    }

    const match = matchField(fieldId, signals, options);

    scanned.push({
      id: fieldId,
      element: el,
      signals,
      match
    });
  }

  return scanned;
}

export function formatSuggestedFieldName(signals: FieldSignals, matchedCanonicalKey?: string): string {
  if (matchedCanonicalKey) return matchedCanonicalKey;

  let text = signals.labelText || signals.ariaLabel || '';
  if (!text && signals.placeholder) {
    text = signals.placeholder.replace(/^(please\s+enter\s+your|please\s+enter|enter\s+your|type\s+your|input\s+your|enter|type|input|your)\s+/i, '');
  }
  if (!text) {
    text = signals.name || signals.id || '';
  }

  // Clean unwanted punctuation and marks
  text = text.replace(/[*:#]/g, '').trim();

  // Convert camelCase, snake_case, kebab-case to separated words
  text = text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim();

  if (text) {
    text = text
      .split(/\s+/)
      .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  return text.substring(0, 35) || 'Custom Field';
}

export function formatSuggestedCategory(fieldName: string, signals: FieldSignals): string {
  const combined = `${fieldName} ${signals.name} ${signals.id} ${signals.labelText}`.toLowerCase();
  if (/resume|cv|portfolio|github|linkedin|salary|job|experience|company|employer|position|role|employment/.test(combined)) {
    return 'Job Applications';
  }
  if (/gpa|degree|university|college|school|academic|major|minor|graduation|course|education|transcript/.test(combined)) {
    return 'Academic';
  }
  return 'Personal';
}
