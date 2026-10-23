export interface FieldValueItem {
  id: string;
  label: string; // e.g. "Primary", "Work", "Mobile", "Personal"
  value: string;
  isDefault?: boolean;
}

export interface PersonalField {
  id: string;
  key: string; // Canonical key, e.g., "First Name", "Surname", "Email"
  category: string; // e.g., "Personal", "Job Applications", "Academic"
  description?: string; // AI-generated or user-provided semantic description
  embedding?: number[]; // Local vector embedding for semantic matching
  values: FieldValueItem[];
  updatedAt: number;
}

export interface AliasMapping {
  id: string;
  canonicalKey: string; // Maps to canonical field key
  alias: string;        // Alternative alias, e.g., "Family Name", "Last Name"
  isBuiltIn?: boolean;  // True if provided by SmartForm defaults
}

export type DocumentCategory = 
  | 'Resume'
  | 'Cover Letter'
  | 'Certificate'
  | 'Portfolio'
  | 'Other';

export interface DocumentRecord {
  id: string;
  displayName: string;      // User friendly name, e.g. "Backend Resume"
  originalFilename: string; // e.g. "resume_backend.pdf"
  category: DocumentCategory;
  mimeType: string;
  size: number;
  data: string;             // Base64 encoded file content for IndexedDB storage
  createdAt: number;
  updatedAt: number;
}

export type DetectedInputType = 
  | 'text'
  | 'email'
  | 'tel'
  | 'url'
  | 'date'
  | 'file'
  | 'select'
  | 'textarea'
  | 'checkbox'
  | 'other';

export interface FieldSignals {
  name: string;
  id: string;
  placeholder: string;
  ariaLabel: string;
  ariaLabelledBy: string;
  autocomplete: string;
  labelText: string;
  surroundingText: string;
  inputType: DetectedInputType;
  cleanNameKeyword?: string;
  cleanIdKeyword?: string;
}

export type MatchType = 
  | 'exact' 
  | 'user_alias' 
  | 'builtin_alias' 
  | 'semantic' 
  | 'vector_embedding'
  | 'autocomplete' 
  | 'document_category';

export interface MatchCandidate {
  id: string;
  label: string;
  value: string;
  documentId?: string;
}

export interface FieldMatch {
  fieldId: string;
  matchedCanonicalKey: string;
  matchType: MatchType;
  confidence: number; // 0 to 100
  reason: string;
  candidates: MatchCandidate[];
  documentCategory?: DocumentCategory;
}

export interface AppSettings {
  activeProfile: string;
  autoShowSuggestions: boolean;
  confirmBeforeOverwrite: boolean;
  enableDynamicForms: boolean;
  promptToSaveNewFields: boolean;
}

export interface SmartFormBackup {
  version: number;
  exportedAt: string;
  fields: PersonalField[];
  aliases: AliasMapping[];
  documents: Omit<DocumentRecord, 'data'>[]; // optionally include or exclude data
  documentsWithData?: DocumentRecord[];
  settings: AppSettings;
}
