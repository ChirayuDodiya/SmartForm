import { describe, it, expect } from 'vitest';
import { normalizeText, tokenize } from '../normalizer';
import { matchField } from '../matcher';
import { suggestAliases } from '../aliases';
import { PersonalField, AliasMapping, DocumentRecord, FieldSignals } from '../../types';

describe('Normalizer', () => {
  it('converts camelCase and snake_case to separated clean words', () => {
    expect(normalizeText('firstName')).toBe('first name');
    expect(normalizeText('family_name')).toBe('family name');
    expect(normalizeText('user-email-address')).toBe('user email address');
  });

  it('removes punctuation, required markers, and common prefixes', () => {
    expect(normalizeText('* Please enter your First Name: ')).toBe('first name');
    expect(normalizeText('Your Surname (required)')).toBe('surname');
    expect(normalizeText('Upload your CV/Resume!')).toBe('upload cv resume');
  });

  it('tokenizes correctly', () => {
    expect(tokenize('GitHub Profile URL')).toEqual(['github', 'profile', 'url']);
  });
});

describe('Alias Suggestions', () => {
  it('suggests standard aliases for canonical keys like Surname', () => {
    const suggestions = suggestAliases('Surname');
    expect(suggestions).toContain('family name');
    expect(suggestions).toContain('last name');
    expect(suggestions).toContain('lastname');
  });

  it('suggests aliases for First Name', () => {
    const suggestions = suggestAliases('First Name');
    expect(suggestions).toContain('given name');
    expect(suggestions).toContain('fname');
  });

  it('suggests canonical key and aliases when typing an alias variant like Last Name', () => {
    const suggestions = suggestAliases('Last Name');
    expect(suggestions).toContain('Surname');
    expect(suggestions).toContain('family name');
  });
});

describe('Matching Engine', () => {
  const sampleFields: PersonalField[] = [
    {
      id: 'f1',
      key: 'First Name',
      category: 'Personal',
      values: [{ id: 'v1', label: 'Default', value: 'Alex' }],
      updatedAt: Date.now()
    },
    {
      id: 'f2',
      key: 'Surname',
      category: 'Personal',
      values: [{ id: 'v2', label: 'Default', value: 'Morgan' }],
      updatedAt: Date.now()
    },
    {
      id: 'f3',
      key: 'Email',
      category: 'Personal',
      values: [
        { id: 'v3a', label: 'Personal', value: 'alex.morgan@example.com' },
        { id: 'v3b', label: 'College', value: 'alex@university.edu' }
      ],
      updatedAt: Date.now()
    },
    {
      id: 'f4',
      key: 'GitHub',
      category: 'Job Applications',
      values: [{ id: 'v4', label: 'Profile', value: 'https://github.com/alexmorgan' }],
      updatedAt: Date.now()
    }
  ];

  const sampleAliases: AliasMapping[] = [
    {
      id: 'a1',
      canonicalKey: 'Surname',
      alias: 'Second Name',
      isBuiltIn: false
    }
  ];

  const sampleDocuments: DocumentRecord[] = [
    {
      id: 'd1',
      displayName: 'Backend Resume',
      originalFilename: 'resume_backend.pdf',
      category: 'Resume',
      mimeType: 'application/pdf',
      size: 1024,
      data: 'base64...',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'd2',
      displayName: 'Full Stack Resume',
      originalFilename: 'resume_fullstack.pdf',
      category: 'Resume',
      mimeType: 'application/pdf',
      size: 2048,
      data: 'base64...',
      createdAt: Date.now(),
      updatedAt: Date.now()
    },
    {
      id: 'd3',
      displayName: 'AWS Certification',
      originalFilename: 'aws_cert.pdf',
      category: 'Certificate',
      mimeType: 'application/pdf',
      size: 512,
      data: 'base64...',
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  ];

  it('matches exact canonical keys with 100 confidence', () => {
    const signals: FieldSignals = {
      name: 'firstName',
      id: 'fname',
      placeholder: '',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: '',
      labelText: 'First Name',
      surroundingText: '',
      inputType: 'text'
    };

    const match = matchField('input-1', signals, { fields: sampleFields, userAliases: sampleAliases });
    expect(match).not.toBeNull();
    expect(match?.matchedCanonicalKey).toBe('First Name');
    expect(match?.matchType).toBe('exact');
    expect(match?.confidence).toBe(100);
    expect(match?.candidates[0].value).toBe('Alex');
  });

  it('matches built-in alias "Family Name" and "Last Name" to Surname', () => {
    const signals: FieldSignals = {
      name: 'family_name',
      id: 'lname',
      placeholder: 'Enter your family name',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: '',
      labelText: 'Family Name',
      surroundingText: '',
      inputType: 'text'
    };

    const match = matchField('input-2', signals, { fields: sampleFields, userAliases: sampleAliases });
    expect(match).not.toBeNull();
    expect(match?.matchedCanonicalKey).toBe('Surname');
    expect(match?.matchType).toBe('builtin_alias');
    expect(match?.candidates[0].value).toBe('Morgan');
  });

  it('matches user custom alias "Second Name" to Surname', () => {
    const signals: FieldSignals = {
      name: 'secondName',
      id: 'second_name',
      placeholder: '',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: '',
      labelText: 'Second Name',
      surroundingText: '',
      inputType: 'text'
    };

    const match = matchField('input-3', signals, { fields: sampleFields, userAliases: sampleAliases });
    expect(match).not.toBeNull();
    expect(match?.matchedCanonicalKey).toBe('Surname');
    expect(match?.matchType).toBe('user_alias');
    expect(match?.confidence).toBe(95);
  });

  it('matches semantic equivalent "Email Address" to Email and returns multiple candidates', () => {
    const signals: FieldSignals = {
      name: 'user_email',
      id: 'email_field',
      placeholder: 'name@domain.com',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: '',
      labelText: 'Email Address',
      surroundingText: '',
      inputType: 'email'
    };

    const match = matchField('input-4', signals, { fields: sampleFields, userAliases: sampleAliases });
    expect(match).not.toBeNull();
    expect(match?.matchedCanonicalKey).toBe('Email');
    expect(match?.candidates.length).toBe(2);
    expect(match?.candidates[0].value).toBe('alex.morgan@example.com');
    expect(match?.candidates[1].value).toBe('alex@university.edu');
  });

  it('matches semantic equivalent "GitHub Profile URL" to GitHub', () => {
    const signals: FieldSignals = {
      name: 'github_url',
      id: 'github_input',
      placeholder: 'https://github.com/...',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: '',
      labelText: 'GitHub Profile URL',
      surroundingText: '',
      inputType: 'url'
    };

    const match = matchField('input-5', signals, { fields: sampleFields, userAliases: sampleAliases });
    expect(match).not.toBeNull();
    expect(match?.matchedCanonicalKey).toBe('GitHub');
  });

  it('matches document upload fields to relevant documents', () => {
    const signals: FieldSignals = {
      name: 'cv_file',
      id: 'resume_input',
      placeholder: '',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: '',
      labelText: 'Upload Your CV',
      surroundingText: '',
      inputType: 'file'
    };

    const match = matchField('file-input-1', signals, {
      fields: sampleFields,
      userAliases: sampleAliases,
      documents: sampleDocuments
    });

    expect(match).not.toBeNull();
    expect(match?.matchType).toBe('document_category');
    expect(match?.matchedCanonicalKey).toBe('Resume');
    expect(match?.candidates.length).toBe(2);
    expect(match?.candidates.map(c => c.label)).toContain('Backend Resume');
    expect(match?.candidates.map(c => c.label)).toContain('Full Stack Resume');
  });

  it('matches supporting document upload to Certificate category', () => {
    const signals: FieldSignals = {
      name: 'supporting_doc',
      id: 'cert_input',
      placeholder: '',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: '',
      labelText: 'Attach Supporting Document / Certificate',
      surroundingText: '',
      inputType: 'file'
    };

    const match = matchField('file-input-2', signals, {
      fields: sampleFields,
      userAliases: sampleAliases,
      documents: sampleDocuments
    });

    expect(match).not.toBeNull();
    expect(match?.matchedCanonicalKey).toBe('Certificate');
    expect(match?.candidates[0].label).toBe('AWS Certification');
  });

  it('NEVER matches or autofills password inputs (Security Floor)', () => {
    const signals: FieldSignals = {
      name: 'user_password',
      id: 'password_field',
      placeholder: '••••••••',
      ariaLabel: '',
      ariaLabelledBy: '',
      autocomplete: 'current-password',
      labelText: 'Password',
      surroundingText: '',
      inputType: 'password' as any
    };

    const match = matchField('pwd-input', signals, { fields: sampleFields, userAliases: sampleAliases });
    expect(match).toBeNull();
  });
});
