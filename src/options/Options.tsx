import React, { useState, useEffect } from 'react';
import PersonalFieldsTab from './PersonalFieldsTab';
import DocumentsTab from './DocumentsTab';
import AliasesTab from './AliasesTab';
import SettingsBackupTab from './SettingsBackupTab';
import { 
  User, 
  Files, 
  Link2, 
  Settings, 
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';

type TabType = 'fields' | 'documents' | 'aliases' | 'settings';

export default function Options() {
  const [activeTab, setActiveTab] = useState<TabType>('fields');

  useEffect(() => {
    // Check hash in URL (e.g. #documents or #settings from popup navigation)
    const hash = window.location.hash.replace('#', '') as TabType;
    if (['fields', 'documents', 'aliases', 'settings'].includes(hash)) {
      setActiveTab(hash);
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-2xs">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-sky-600 flex items-center justify-center text-white font-bold text-lg shadow-sm">
              S
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-base text-slate-900 leading-none">SmartForm Vault</h1>
                <span className="text-[11px] bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-semibold border border-sky-200">
                  v1.0 Local-First
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">Manage your personal data, multiple resumes, and alias mappings</p>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg font-medium">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>On-Device Vault (No Cloud)</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-6xl mx-auto px-6 flex space-x-1 border-t border-slate-100">
          <button
            onClick={() => { setActiveTab('fields'); window.location.hash = 'fields'; }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'fields'
                ? 'border-sky-600 text-sky-700 bg-sky-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <User className="w-4 h-4" />
            <span>Personal Information</span>
          </button>

          <button
            onClick={() => { setActiveTab('documents'); window.location.hash = 'documents'; }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'documents'
                ? 'border-sky-600 text-sky-700 bg-sky-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Files className="w-4 h-4" />
            <span>Documents Vault</span>
          </button>

          <button
            onClick={() => { setActiveTab('aliases'); window.location.hash = 'aliases'; }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'aliases'
                ? 'border-sky-600 text-sky-700 bg-sky-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Link2 className="w-4 h-4" />
            <span>Aliases &amp; Mappings</span>
          </button>

          <button
            onClick={() => { setActiveTab('settings'); window.location.hash = 'settings'; }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === 'settings'
                ? 'border-sky-600 text-sky-700 bg-sky-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Backup &amp; Preferences</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-6xl mx-auto px-6 py-8 flex-1 w-full">
        {activeTab === 'fields' && <PersonalFieldsTab />}
        {activeTab === 'documents' && <DocumentsTab />}
        {activeTab === 'aliases' && <AliasesTab />}
        {activeTab === 'settings' && <SettingsBackupTab />}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400 bg-white">
        SmartForm Extension &bull; Private, Fast, Local-First Form Autofill
      </footer>
    </div>
  );
}
