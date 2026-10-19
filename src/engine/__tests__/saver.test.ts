import { describe, it, expect } from 'vitest';
import { formatSuggestedFieldName, formatSuggestedCategory } from '../../content/detector';
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
