import { DocumentCategory } from '../types';
import { normalizeText } from './normalizer';

export interface BuiltinAliasGroup {
  canonicalKey: string;
  category: string;
  aliases: string[];
}

export const BUILTIN_ALIAS_GROUPS: BuiltinAliasGroup[] = [
  {
    canonicalKey: 'First Name',
    category: 'Personal',
    aliases: [
      'first name',
      'given name',
      'forename',
      'fname',
      'first_name',
      'firstname',
      'first',
      'user first name'
    ]
  },
  {
    canonicalKey: 'Surname',
    category: 'Personal',
    aliases: [
      'surname',
      'family name',
      'last name',
      'second name',
      'lastname',
      'lname',
      'family_name',
      'user last name'
    ]
  },
  {
    canonicalKey: 'Full Name',
    category: 'Personal',
    aliases: [
      'full name',
      'name',
      'complete name',
      'candidate name',
      'applicant name',
      'fullname',
      'your name'
    ]
  },
  {
    canonicalKey: 'Email',
    category: 'Personal',
    aliases: [
      'email',
      'e-mail',
      'email address',
      'e-mail address',
      'user email',
      'contact email',
      'electronic mail',
      'mail'
    ]
  },
  {
    canonicalKey: 'Phone',
    category: 'Personal',
    aliases: [
      'phone',
      'telephone',
      'mobile',
      'mobile number',
      'cell',
      'cell phone',
      'phone number',
      'contact phone',
      'contact number',
      'mobile phone number',
      'tel'
    ]
  },
  {
    canonicalKey: 'LinkedIn',
    category: 'Job Applications',
    aliases: [
      'linkedin',
      'linkedin url',
      'linkedin profile',
      'linkedin profile url',
      'linkedin link'
    ]
  },
  {
    canonicalKey: 'GitHub',
    category: 'Job Applications',
    aliases: [
      'github',
      'github url',
      'github profile',
      'github profile url',
      'github link'
    ]
  },
  {
    canonicalKey: 'Portfolio',
    category: 'Job Applications',
    aliases: [
      'portfolio',
      'website',
      'personal website',
      'portfolio url',
      'personal site',
      'homepage',
      'personal portfolio website'
    ]
  },
  {
    canonicalKey: 'Address',
    category: 'Personal',
    aliases: [
      'address',
      'street address',
      'mailing address',
      'postal address',
      'home address',
      'address line 1',
      'residence',
      'street'
    ]
  },
  {
    canonicalKey: 'City',
    category: 'Personal',
    aliases: ['city', 'town', 'municipality', 'current city']
  },
  {
    canonicalKey: 'State',
    category: 'Personal',
    aliases: ['state', 'province', 'region']
  },
  {
    canonicalKey: 'Postal Code',
    category: 'Personal',
    aliases: ['postal code', 'zip code', 'zip', 'postcode', 'pincode', 'pin code']
  },
  {
    canonicalKey: 'Country',
    category: 'Personal',
    aliases: ['country', 'nation', 'nationality']
  }
];

export const DOCUMENT_CATEGORY_KEYWORDS: Record<DocumentCategory, string[]> = {
  'Resume': [
    'resume',
    'cv',
    'curriculum vitae',
    'upload cv',
    'upload resume',
    'upload your cv',
    'attach resume',
    'cv file',
    'resume file',
    'attach cv',
    'upload your resume'
  ],
  'Cover Letter': [
    'cover letter',
    'motivation letter',
    'letter of motivation',
    'attach cover letter',
    'upload cover letter'
  ],
  'Certificate': [
    'certificate',
    'certification',
    'supporting document',
    'diploma',
    'degree certificate',
    'license',
    'credentials',
    'attach supporting document'
  ],
  'Portfolio': [
    'work sample',
    'portfolio file',
    'project sample',
    'case study',
    'design portfolio'
  ],
  'Other': [
    'attachment',
    'additional file',
    'document',
    'file upload'
  ]
};

export const AUTOCOMPLETE_TO_CANONICAL: Record<string, string> = {
  'given-name': 'First Name',
  'family-name': 'Surname',
  'name': 'Full Name',
  'email': 'Email',
  'tel': 'Phone',
  'tel-national': 'Phone',
  'street-address': 'Address',
  'address-line1': 'Address',
  'address-level2': 'City',
  'address-level1': 'State',
  'postal-code': 'Postal Code',
  'country-name': 'Country',
  'url': 'Portfolio'
};

/**
 * Suggests common aliases for a newly entered or selected canonical field.
 */
export function suggestAliases(canonicalKey: string): string[] {
  const normalizedKey = normalizeText(canonicalKey);
  const group = BUILTIN_ALIAS_GROUPS.find(
    g => normalizeText(g.canonicalKey) === normalizedKey
  );

  if (!group) {
    return [];
  }

  // Filter out the exact key itself from alias suggestions
  return group.aliases.filter(alias => normalizeText(alias) !== normalizedKey);
}
