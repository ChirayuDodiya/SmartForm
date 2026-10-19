import { describe, it, expect } from 'vitest';
import { formatSuggestedFieldName, formatSuggestedCategory, isDropdownOrSelect } from '../../content/detector';
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

