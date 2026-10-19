import React, { useState, useEffect, useRef } from 'react';
import { db } from '../storage/db';
import { downloadBackupFile, restoreBackup } from '../storage/backup';
import { AppSettings } from '../types';
import { 
  Download, 
  Upload, 
  AlertTriangle, 
  CheckCircle2, 
  Sliders,
  Lock
} from 'lucide-react';

export default function SettingsBackupTab() {
  const [settings, setSettings] = useState<AppSettings>({
    activeProfile: 'Personal',
    autoShowSuggestions: true,
    confirmBeforeOverwrite: true,
    enableDynamicForms: true,
    promptToSaveNewFields: true
  });
  const [includeFileData, setIncludeFileData] = useState(true);
  const [importStatus, setImportStatus] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const s = await db.getSettings();
    setSettings(s);
  }

  async function updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await db.saveSettings({ [key]: value });
  }

  async function handleExport() {
    await downloadBackupFile(includeFileData);
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = reader.result as string;
        const result = await restoreBackup(text);
        if (result.success) {
          setImportStatus(
            `Successfully restored ${result.importedFields} fields, ${result.importedAliases} aliases, and ${result.importedDocs} documents!`
          );
          setErrorStatus(null);
          await loadSettings();
        } else {
          setErrorStatus(result.error || 'Failed to restore backup');
          setImportStatus(null);
        }
      } catch (err: any) {
        setErrorStatus(err.message || 'Error processing backup file');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Privacy Guarantee Card */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-xs">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-emerald-950 text-base">Privacy & Local-First Architecture</h3>
            <p className="text-xs text-emerald-800 mt-1 leading-relaxed">
              SmartForm is built with strict privacy guarantees. All your personal vault data, custom aliases, and uploaded documents 
              stay strictly on this device in browser-local storage (<code>IndexedDB</code> &amp; <code>chrome.storage.local</code>). 
              SmartForm makes zero network requests to external servers, cloud databases, or AI APIs.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-emerald-800">
              <span className="bg-emerald-100/80 px-2.5 py-1 rounded-md">✓ Zero Cloud Storage</span>
              <span className="bg-emerald-100/80 px-2.5 py-1 rounded-md">✓ No Password Access</span>
              <span className="bg-emerald-100/80 px-2.5 py-1 rounded-md">✓ No Form Auto-Submissions</span>
            </div>
          </div>
        </div>
      </div>

      {/* Preferences Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
          <Sliders className="w-5 h-5 text-sky-600" />
          <h3 className="font-bold text-slate-800 text-base">Autofill Preferences</h3>
        </div>

        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoShowSuggestions}
              onChange={(e) => updateSetting('autoShowSuggestions', e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
            />
            <div>
              <span className="text-sm font-semibold text-slate-800 block">
                Show in-page floating suggestion bubble
              </span>
              <span className="text-xs text-slate-500">
                Display candidate values directly below recognized form fields when clicked or focused.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.confirmBeforeOverwrite}
              onChange={(e) => updateSetting('confirmBeforeOverwrite', e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
            />
            <div>
              <span className="text-sm font-semibold text-slate-800 block">
                Protect non-empty fields
              </span>
              <span className="text-xs text-slate-500">
                Never overwrite existing text in form fields without your explicit choice.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableDynamicForms}
              onChange={(e) => updateSetting('enableDynamicForms', e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
            />
            <div>
              <span className="text-sm font-semibold text-slate-800 block">
                Observe dynamic forms (SPA support)
              </span>
              <span className="text-xs text-slate-500">
                Detect fields added dynamically via JavaScript (React, Vue, Angular multi-step application forms).
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.promptToSaveNewFields}
              onChange={(e) => updateSetting('promptToSaveNewFields', e.target.checked)}
              className="mt-1 w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-slate-300"
            />
            <div>
              <span className="text-sm font-semibold text-slate-800 block">
                Prompt to save new fields when filled
              </span>
              <span className="text-xs text-slate-500">
                Automatically ask to save unrecognized fields and new values directly into your vault when entered on forms.
              </span>
            </div>
          </label>
        </div>
      </div>

      {/* Backup Export / Import Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
        <h3 className="font-bold text-slate-800 text-base mb-1">Local Backup &amp; Restore</h3>
        <p className="text-xs text-slate-500 mb-6">
          Export an offline JSON backup of your records and documents, or restore your vault on another browser.
        </p>

        {/* Warning banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 mb-6">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <strong>Warning:</strong> Exported backups contain your sensitive personal information and documents in plain JSON format. 
            Store backup files securely and never share them with untrusted parties.
          </div>
        </div>

        {importStatus && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3.5 rounded-xl text-xs mb-6 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{importStatus}</span>
          </div>
        )}

        {errorStatus && (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs mb-6 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{errorStatus}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Export Box */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between">
            <div>
              <h4 className="font-semibold text-sm text-slate-800 mb-1">Export Vault Backup</h4>
              <p className="text-xs text-slate-500 mb-3">
                Downloads a <code>.json</code> file with your personal fields, aliases, and documents.
              </p>
              <label className="flex items-center gap-2 text-xs text-slate-700 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeFileData}
                  onChange={(e) => setIncludeFileData(e.target.checked)}
                  className="rounded text-sky-600"
                />
                <span>Include uploaded document contents (file blobs)</span>
              </label>
            </div>
            <button
              onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 hover:text-slate-900 font-medium text-xs px-4 py-2.5 rounded-lg shadow-2xs transition"
            >
              <Download className="w-4 h-4 text-sky-600" />
              <span>Download JSON Backup</span>
            </button>
          </div>

          {/* Import Box */}
          <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 flex flex-col justify-between">
            <div>
              <h4 className="font-semibold text-sm text-slate-800 mb-1">Restore from Backup</h4>
              <p className="text-xs text-slate-500 mb-4">
                Select a previously exported SmartForm backup file to restore records.
              </p>
            </div>
            <div>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelected}
                accept=".json"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs px-4 py-2.5 rounded-lg shadow-sm transition"
              >
                <Upload className="w-4 h-4" />
                <span>Select Backup JSON File</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
