import {
  PersonalField,
  AliasMapping,
  DocumentRecord,
  AppSettings
} from '../types';
import { BUILTIN_ALIAS_GROUPS } from '../engine/aliases';
import { generateEmbedding } from '../engine/vector';

const DB_NAME = 'SmartFormVaultDB';
const DB_VERSION = 1;

export const DEFAULT_SETTINGS: AppSettings = {
  activeProfile: 'Personal',
  autoShowSuggestions: true,
  confirmBeforeOverwrite: true,
  enableDynamicForms: true,
  promptToSaveNewFields: true,
  disabledSites: []
};

const DEFAULT_INITIAL_FIELDS: PersonalField[] = [
  {
    id: 'init-fname',
    key: 'First Name',
    category: 'Personal',
    description: "User's given first name for personal identification and official applications.",
    embedding: generateEmbedding("User's given first name for personal identification and official applications. First Name"),
    values: [{ id: 'val-1', label: 'Primary', value: 'Alex', isDefault: true }],
    updatedAt: Date.now()
  },
  {
    id: 'init-lname',
    key: 'Surname',
    category: 'Personal',
    description: "User's family surname or last name for identity records and applications.",
    embedding: generateEmbedding("User's family surname or last name for identity records and applications. Surname"),
    values: [{ id: 'val-2', label: 'Primary', value: 'Morgan', isDefault: true }],
    updatedAt: Date.now()
  },
  {
    id: 'init-email',
    key: 'Email',
    category: 'Personal',
    description: "User's electronic mail address for contact and correspondence.",
    embedding: generateEmbedding("User's electronic mail address for contact and correspondence. Email"),
    values: [
      { id: 'val-3', label: 'Personal', value: 'alex.morgan@example.com', isDefault: true },
      { id: 'val-4', label: 'Work/College', value: 'alex@university.edu' }
    ],
    updatedAt: Date.now()
  },
  {
    id: 'init-phone',
    key: 'Phone',
    category: 'Personal',
    description: "User's mobile or telephone number for voice calls and text messages.",
    embedding: generateEmbedding("User's mobile or telephone number for voice calls and text messages. Phone"),
    values: [{ id: 'val-5', label: 'Mobile', value: '+1 (555) 019-2834', isDefault: true }],
    updatedAt: Date.now()
  },
  {
    id: 'init-linkedin',
    key: 'LinkedIn',
    category: 'Job Applications',
    description: "User's LinkedIn professional profile link for career and networking.",
    embedding: generateEmbedding("User's LinkedIn professional profile link for career and networking. LinkedIn"),
    values: [{ id: 'val-6', label: 'Profile', value: 'https://linkedin.com/in/alex-morgan', isDefault: true }],
    updatedAt: Date.now()
  },
  {
    id: 'init-github',
    key: 'GitHub',
    category: 'Job Applications',
    description: "User's GitHub developer profile link displaying code repositories and projects.",
    embedding: generateEmbedding("User's GitHub developer profile link displaying code repositories and projects. GitHub"),
    values: [{ id: 'val-7', label: 'Profile', value: 'https://github.com/alexmorgan', isDefault: true }],
    updatedAt: Date.now()
  }
];

function notifyVaultUpdated() {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: 'VAULT_UPDATED' }, () => {
      if (chrome.runtime.lastError) { /* ignore */ }
    });
  }
}

class SmartFormDatabase {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private openDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        return reject(new Error('IndexedDB is not supported in this environment'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains('fields')) {
          db.createObjectStore('fields', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('documents')) {
          db.createObjectStore('documents', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('aliases')) {
          db.createObjectStore('aliases', { keyPath: 'id' });
        }
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });

    return this.dbPromise;
  }

  // --- Initialization & Default Seeding ---
  async ensureInitialized(): Promise<void> {
    const fields = await this.getFields();
    if (fields.length === 0) {
      for (const field of DEFAULT_INITIAL_FIELDS) {
        await this.saveField(field);
      }
    } else {
      // Backfill description and vector embedding for any existing fields missing them
      for (const field of fields) {
        if (!field.description || !field.embedding || field.embedding.length === 0) {
          const matchDefault = DEFAULT_INITIAL_FIELDS.find(df => df.key.toLowerCase() === field.key.toLowerCase());
          field.description = field.description || matchDefault?.description || `User's stored personal data for "${field.key}".`;
          field.embedding = generateEmbedding(field.description + ' ' + field.key);
          await this.saveField(field);
        }
      }
    }

    const aliases = await this.getAliases();
    if (aliases.length === 0) {
      for (const group of BUILTIN_ALIAS_GROUPS) {
        for (const alias of group.aliases) {
          if (alias.toLowerCase() !== group.canonicalKey.toLowerCase()) {
            await this.saveAlias({
              id: `builtin-${group.canonicalKey}-${alias}`.replace(/\s+/g, '-').toLowerCase(),
              canonicalKey: group.canonicalKey,
              alias: alias,
              isBuiltIn: true
            });
          }
        }
      }
    }
  }

  // --- Personal Fields CRUD ---
  async getFields(): Promise<PersonalField[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('fields', 'readonly');
      const store = tx.objectStore('fields');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveField(field: PersonalField): Promise<void> {
    // Ensure embedding is computed from description and key
    if (!field.embedding || field.embedding.length === 0) {
      const textToEmbed = `${field.description || ''} ${field.key}`.trim();
      if (textToEmbed) {
        field.embedding = generateEmbedding(textToEmbed);
      }
    }

    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('fields', 'readwrite');
      const store = tx.objectStore('fields');
      field.updatedAt = Date.now();
      const request = store.put(field);
      request.onsuccess = () => {
        notifyVaultUpdated();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteField(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('fields', 'readwrite');
      const store = tx.objectStore('fields');
      const request = store.delete(id);
      request.onsuccess = () => {
        notifyVaultUpdated();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // --- Aliases CRUD ---
  async getAliases(): Promise<AliasMapping[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('aliases', 'readonly');
      const store = tx.objectStore('aliases');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async saveAlias(alias: AliasMapping): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('aliases', 'readwrite');
      const store = tx.objectStore('aliases');
      const request = store.put(alias);
      request.onsuccess = () => {
        notifyVaultUpdated();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteAlias(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('aliases', 'readwrite');
      const store = tx.objectStore('aliases');
      const request = store.delete(id);
      request.onsuccess = () => {
        notifyVaultUpdated();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // --- Documents CRUD ---
  async getDocuments(): Promise<DocumentRecord[]> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('documents', 'readonly');
      const store = tx.objectStore('documents');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  async getDocument(id: string): Promise<DocumentRecord | null> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('documents', 'readonly');
      const store = tx.objectStore('documents');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async saveDocument(doc: DocumentRecord): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('documents', 'readwrite');
      const store = tx.objectStore('documents');
      doc.updatedAt = Date.now();
      const request = store.put(doc);
      request.onsuccess = () => {
        notifyVaultUpdated();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDocument(id: string): Promise<void> {
    const db = await this.openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('documents', 'readwrite');
      const store = tx.objectStore('documents');
      const request = store.delete(id);
      request.onsuccess = () => {
        notifyVaultUpdated();
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // --- App Settings (using chrome.storage.local with localStorage fallback) ---
  async getSettings(): Promise<AppSettings> {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get(['smartform_settings'], (result) => {
          if (result && result.smartform_settings) {
            resolve({ ...DEFAULT_SETTINGS, ...result.smartform_settings });
          } else {
            resolve(DEFAULT_SETTINGS);
          }
        });
      });
    }

    try {
      const local = localStorage.getItem('smartform_settings');
      if (local) return { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
    } catch {
      // ignore
    }
    return DEFAULT_SETTINGS;
  }

  async saveSettings(settings: Partial<AppSettings>): Promise<void> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ smartform_settings: updated }, () => {
          notifyVaultUpdated();
          resolve();
        });
      });
    }

    try {
      localStorage.setItem('smartform_settings', JSON.stringify(updated));
      notifyVaultUpdated();
    } catch {
      // ignore
    }
  }
}

export const db = new SmartFormDatabase();
