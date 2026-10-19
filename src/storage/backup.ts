import { db } from './db';
import { SmartFormBackup } from '../types';

/**
 * Creates a JSON backup object of all local vault data.
 */
export async function createBackup(includeFileData = true): Promise<SmartFormBackup> {
  const fields = await db.getFields();
  const aliases = await db.getAliases();
  const rawDocs = await db.getDocuments();
  const settings = await db.getSettings();

  const documents = rawDocs.map(doc => {
    if (!includeFileData) {
      const { data: _, ...meta } = doc;
      return meta;
    }
    return doc;
  });

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    fields,
    aliases,
    documents: documents as any,
    settings
  };
}

/**
 * Downloads the backup as a local JSON file.
 */
export async function downloadBackupFile(includeFileData = true): Promise<void> {
  const backup = await createBackup(includeFileData);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `smartform_backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Validates and restores vault data from a backup JSON string.
 */
export async function restoreBackup(jsonString: string): Promise<{
  success: boolean;
  importedFields: number;
  importedAliases: number;
  importedDocs: number;
  error?: string;
}> {
  try {
    const data: SmartFormBackup = JSON.parse(jsonString);

    if (!data || typeof data !== 'object') {
      return { success: false, importedFields: 0, importedAliases: 0, importedDocs: 0, error: 'Invalid JSON data' };
    }

    if (!Array.isArray(data.fields)) {
      return { success: false, importedFields: 0, importedAliases: 0, importedDocs: 0, error: 'Backup does not contain fields array' };
    }

    let importedFields = 0;
    for (const field of data.fields) {
      if (field.id && field.key && Array.isArray(field.values)) {
        await db.saveField(field);
        importedFields++;
      }
    }

    let importedAliases = 0;
    if (Array.isArray(data.aliases)) {
      for (const alias of data.aliases) {
        if (alias.id && alias.canonicalKey && alias.alias) {
          await db.saveAlias(alias);
          importedAliases++;
        }
      }
    }

    let importedDocs = 0;
    if (Array.isArray(data.documents)) {
      for (const doc of data.documents) {
        if (doc.id && doc.displayName && doc.category) {
          // preserve existing data if not provided in metadata-only backup
          const existing = await db.getDocument(doc.id);
          const fullDoc = {
            ...doc,
            data: (doc as any).data || existing?.data || ''
          };
          await db.saveDocument(fullDoc as any);
          importedDocs++;
        }
      }
    }

    if (data.settings) {
      await db.saveSettings(data.settings);
    }

    return {
      success: true,
      importedFields,
      importedAliases,
      importedDocs
    };
  } catch (err: any) {
    return {
      success: false,
      importedFields: 0,
      importedAliases: 0,
      importedDocs: 0,
      error: err.message || 'Failed to parse JSON backup'
    };
  }
}
