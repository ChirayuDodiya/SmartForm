import { describe, it, expect } from 'vitest';
import { 
  formatSuggestedFieldName, 
  formatSuggestedCategory, 
  isDropdownOrSelect,
  isSearchInput,
  isMediaOrEntertainmentSite
} from '../../content/detector';
import { suggestAliases } from '../aliases';
import { FieldSignals } from '../../types';

describe('New Field Auto-Detection & Saver Logic', () => {
  it('formats field names from label text and strips asterisks or colons', () => {
    const signals: FieldSignals = {
      name: 'emergency_contact',
      id: 'emergency_contact_input',
      placeholder: 'Enter contact name',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: '',
      labelText: 'Emergency Contact Person: *',
      surroundingText: '',
      inputType: 'text'
    };

    const suggested = formatSuggestedFieldName(signals);
    expect(suggested).toBe('Emergency Contact Person');
  });

  it('formats field names from placeholder when label is empty', () => {
    const signals: FieldSignals = {
      name: 'discord',
      id: 'discord_field',
      placeholder: 'Enter your Discord Username',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: '',
      labelText: '',
      surroundingText: '',
      inputType: 'text'
    };

    const suggested = formatSuggestedFieldName(signals);
    expect(suggested).toBe('Discord Username');
  });

  it('formats field names from snake_case input name attribute when no label exists', () => {
    const signals: FieldSignals = {
      name: 'favorite_programming_language',
      id: '',
      placeholder: '',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: '',
      labelText: '',
      surroundingText: '',
      inputType: 'text'
    };

    const suggested = formatSuggestedFieldName(signals);
    expect(suggested).toBe('Favorite Programming Language');
  });

  it('preserves matched canonical key when field was recognized', () => {
    const signals: FieldSignals = {
      name: 'custom_input',
      id: '',
      placeholder: '',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: '',
      labelText: 'Phone',
      surroundingText: '',
      inputType: 'tel'
    };

    const suggested = formatSuggestedFieldName(signals, 'Phone');
    expect(suggested).toBe('Phone');
  });

  it('categorizes fields based on contextual keyword cues', () => {
    const jobSignals: FieldSignals = {
      name: 'linkedin_profile',
      id: '',
      placeholder: '',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: '',
      labelText: 'LinkedIn URL',
      surroundingText: '',
      inputType: 'url'
    };
    expect(formatSuggestedCategory('LinkedIn', jobSignals)).toBe('Job Applications');

    const academicSignals: FieldSignals = {
      name: 'gpa_score',
      id: '',
      placeholder: '',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: '',
      labelText: 'Undergraduate Cumulative GPA',
      surroundingText: '',
      inputType: 'text'
    };
    expect(formatSuggestedCategory('GPA', academicSignals)).toBe('Academic');

    const personalSignals: FieldSignals = {
      name: 'emergency_phone',
      id: '',
      placeholder: '',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: '',
      labelText: 'Emergency Contact Phone',
      surroundingText: '',
      inputType: 'tel'
    };
    expect(formatSuggestedCategory('Emergency Contact Phone', personalSignals)).toBe('Personal');
  });

  it('automatically suggests aliases when creating a field matching known groups', () => {
    const aliases = suggestAliases('GitHub');
    expect(aliases).toContain('github profile');
    expect(aliases).toContain('github url');
  });
});

describe('Dropdown and Select Exclusion Logic', () => {
  function createMockElement(
    tag: string,
    attrs: Record<string, string> = {},
    parentClasses: string[] = []
  ): any {
    return {
      tagName: tag.toUpperCase(),
      getAttribute: (attr: string) => attrs[attr] || null,
      hasAttribute: (attr: string) => attr in attrs,
      closest: (selector: string) => {
        for (const cls of parentClasses) {
          if (selector.includes(cls)) return {};
        }
        return null;
      }
    };
  }

  it('identifies native <select> elements as dropdowns', () => {
    const el = createMockElement('select');
    expect(isDropdownOrSelect(el)).toBe(true);
  });

  it('identifies elements with role="combobox" or role="listbox" as dropdowns', () => {
    const combobox = createMockElement('input', { role: 'combobox' });
    const listbox = createMockElement('div', { role: 'listbox' });
    expect(isDropdownOrSelect(combobox)).toBe(true);
    expect(isDropdownOrSelect(listbox)).toBe(true);
  });

  it('identifies elements with aria-haspopup="listbox" or "menu"', () => {
    const el1 = createMockElement('input', { 'aria-haspopup': 'listbox' });
    const el2 = createMockElement('input', { 'aria-haspopup': 'menu' });
    const el3 = createMockElement('input', { 'aria-haspopup': 'true' });
    expect(isDropdownOrSelect(el1)).toBe(true);
    expect(isDropdownOrSelect(el2)).toBe(true);
    expect(isDropdownOrSelect(el3)).toBe(true);
  });

  it('identifies inputs inside dropdown wrappers (LinkedIn .fb-dropdown, ant-select, etc.)', () => {
    const linkedInDropdownInput = createMockElement('input', {}, ['fb-dropdown']);
    expect(isDropdownOrSelect(linkedInDropdownInput)).toBe(true);

    const muiSelectInput = createMockElement('input', {}, ['MuiSelect']);
    expect(isDropdownOrSelect(muiSelectInput)).toBe(true);
  });

  it('identifies HTML5 datalist and aria-autocomplete="list"', () => {
    const elList = createMockElement('input', { list: 'countries' });
    const elAuto = createMockElement('input', { 'aria-autocomplete': 'list' });
    expect(isDropdownOrSelect(elList)).toBe(true);
    expect(isDropdownOrSelect(elAuto)).toBe(true);
  });

  it('does NOT mark standard inputs or textareas as dropdowns', () => {
    const normalInput = createMockElement('input', { type: 'text', name: 'firstName' });
    const textarea = createMockElement('textarea', { name: 'bio' });
    expect(isDropdownOrSelect(normalInput)).toBe(false);
    expect(isDropdownOrSelect(textarea)).toBe(false);
  });
});

describe('Search Input and Media Site Exclusion Logic', () => {
  function createMockElement(
    tag: string,
    attrs: Record<string, string> = {},
    parentClasses: string[] = []
  ): any {
    return {
      tagName: tag.toUpperCase(),
      type: attrs.type || (tag.toLowerCase() === 'input' ? 'text' : undefined),
      getAttribute: (attr: string) => attrs[attr] || null,
      hasAttribute: (attr: string) => attr in attrs,
      closest: (selector: string) => {
        for (const cls of parentClasses) {
          if (selector.includes(cls)) return {};
        }
        if (attrs.role && selector.includes(`[role="${attrs.role}"]`)) return {};
        if (attrs['data-testid'] && selector.includes(`[data-testid*="${attrs['data-testid']}"]`)) return {};
        return null;
      }
    };
  }

  it('identifies native type="search" as a search input', () => {
    const el = createMockElement('input', { type: 'search' });
    expect(isSearchInput(el)).toBe(true);
  });

  it('identifies role="searchbox" and role="search" as search inputs', () => {
    const el1 = createMockElement('input', { role: 'searchbox' });
    const el2 = createMockElement('input', { role: 'search' });
    expect(isSearchInput(el1)).toBe(true);
    expect(isSearchInput(el2)).toBe(true);
  });

  it('identifies YouTube search bar by id, name, or ytd-searchbox class', () => {
    const ytInput = createMockElement('input', { id: 'search', name: 'search_query', placeholder: 'Search' }, ['ytd-searchbox']);
    expect(isSearchInput(ytInput)).toBe(true);
  });

  it('identifies Spotify search bar by data-testid and "What do you want to play?" placeholder', () => {
    const spotifyInput = createMockElement('input', {
      'data-testid': 'search-input',
      role: 'searchbox',
      placeholder: 'What do you want to play?'
    });
    expect(isSearchInput(spotifyInput)).toBe(true);
  });

  it('identifies inputs wrapped in search forms or search-box classes', () => {
    const wrappedInput = createMockElement('input', {}, ['search-box']);
    expect(isSearchInput(wrappedInput)).toBe(true);
  });

  it('does NOT flag ordinary form inputs as search inputs', () => {
    const nameInput = createMockElement('input', { name: 'firstName', id: 'fname', placeholder: 'First Name' });
    const emailInput = createMockElement('input', { name: 'email', type: 'email', placeholder: 'you@domain.com' });
    expect(isSearchInput(nameInput)).toBe(false);
    expect(isSearchInput(emailInput)).toBe(false);
  });

  it('correctly identifies media platforms and allows their settings/account pages', () => {
    const originalWindow = globalThis.window;

    // Simulate YouTube watch page
    (globalThis as any).window = { location: { hostname: 'www.youtube.com', pathname: '/watch' } };
    expect(isMediaOrEntertainmentSite()).toBe(true);

    // Simulate Spotify player
    (globalThis as any).window = { location: { hostname: 'open.spotify.com', pathname: '/search' } };
    expect(isMediaOrEntertainmentSite()).toBe(true);

    // Simulate Spotify account page (should allow)
    (globalThis as any).window = { location: { hostname: 'www.spotify.com', pathname: '/account/overview' } };
    expect(isMediaOrEntertainmentSite()).toBe(false);

    // Simulate normal website (e.g. greenhouse job application)
    (globalThis as any).window = { location: { hostname: 'boards.greenhouse.io', pathname: '/company/jobs/123' } };
    expect(isMediaOrEntertainmentSite()).toBe(false);

    // Restore window
    (globalThis as any).window = originalWindow;
  });
});


