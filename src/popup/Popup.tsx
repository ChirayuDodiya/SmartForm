import { useEffect, useState } from 'react';
import { db } from '../storage/db';
import { PersonalField, FieldMatch } from '../types';
import { 
  Sparkles, 
  ExternalLink, 
  Copy, 
  Check, 
  Search, 
  ShieldCheck, 
  RefreshCw,
  FolderOpen
} from 'lucide-react';

export default function Popup() {
  const [fields, setFields] = useState<PersonalField[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [detectedMatches, setDetectedMatches] = useState<FieldMatch[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [fillStatus, setFillStatus] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    scanActiveTab();
  }, []);

  async function loadData() {
    await db.ensureInitialized();
    const data = await db.getFields();
    setFields(data);
  }

  function scanActiveTab() {
    setIsScanning(true);
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id) {
          chrome.tabs.sendMessage(
            activeTab.id,
            { type: 'SCAN_PAGE_FIELDS' },
            (response) => {
              setIsScanning(false);
              if (chrome.runtime.lastError) {
                // Content script might not be injected or on a restricted page (e.g. chrome://)
                setDetectedMatches([]);
                return;
              }
              if (response && response.matches) {
                setDetectedMatches(response.matches);
              }
            }
          );
        } else {
          setIsScanning(false);
        }
      });
    } else {
      setIsScanning(false);
    }
  }

  function handleAutofillAll() {
    setFillStatus('Filling fields...');
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const activeTab = tabs[0];
        if (activeTab?.id) {
          chrome.tabs.sendMessage(
            activeTab.id,
            { type: 'AUTOFILL_ALL_DETECTED' },
            (response) => {
              if (response?.success) {
                setFillStatus(`Filled ${response.filledCount} fields!`);
                setTimeout(() => setFillStatus(null), 2500);
              } else {
                setFillStatus('Autofill complete');
                setTimeout(() => setFillStatus(null), 2000);
              }
            }
          );
        }
      });
    } else {
      setFillStatus('Autofill triggered');
      setTimeout(() => setFillStatus(null), 1500);
    }
  }

  function copyToClipboard(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  }

  function openDashboard(tab?: string) {
    if (typeof chrome !== 'undefined' && chrome.runtime?.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('options.html' + (tab ? `#${tab}` : ''), '_blank');
    }
  }

  const filteredFields = fields.filter(f => 
    f.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.values.some(v => v.value.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex flex-col h-[520px] bg-slate-50 text-slate-800 select-none">
      {/* Header */}
      <header className="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-2">
          <div className="w-7 h-7 rounded-lg bg-sky-600 flex items-center justify-center text-white shadow-sm font-bold text-sm">
            S
          </div>
          <div>
            <h1 className="font-semibold text-sm leading-none text-slate-900">SmartForm</h1>
            <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
              <ShieldCheck className="w-3 h-3 inline" /> 100% Local-First
            </span>
          </div>
        </div>
        <button
          onClick={() => openDashboard()}
          className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1 bg-sky-50 px-2 py-1 rounded border border-sky-200 transition"
          title="Open Vault & Management Dashboard"
        >
          <span>Vault</span>
          <ExternalLink className="w-3 h-3" />
        </button>
      </header>

      {/* Form Detection / Autofill Action Card */}
      <div className="p-3 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-sky-600" />
            <span className="text-xs font-semibold text-slate-700">Active Page Form</span>
          </div>
          <button 
            onClick={scanActiveTab} 
            className="text-[11px] text-slate-400 hover:text-slate-600 flex items-center gap-1"
            title="Rescan fields"
          >
            <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
            <span>Rescan</span>
          </button>
        </div>

        {detectedMatches.length > 0 ? (
          <div className="space-y-2">
            <div className="bg-sky-50 border border-sky-100 rounded-md p-2 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-sky-900">
                  {detectedMatches.length} field{detectedMatches.length > 1 ? 's' : ''} recognized
                </p>
                <p className="text-[11px] text-sky-700 truncate max-w-[220px]">
                  {detectedMatches.map(m => m.matchedCanonicalKey).join(', ')}
                </p>
              </div>
              <button
                onClick={handleAutofillAll}
                className="bg-sky-600 hover:bg-sky-700 text-white text-xs font-medium px-3 py-1.5 rounded shadow-sm transition whitespace-nowrap"
              >
                {fillStatus || 'Autofill Page'}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-md p-2 text-center text-xs text-slate-500">
            {isScanning ? 'Scanning page fields...' : 'No supported form fields detected on active page.'}
          </div>
        )}
      </div>

      {/* Quick Search */}
      <div className="p-3 border-b border-slate-200 bg-slate-50">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search saved values or keys..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-md focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Saved Records List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-medium px-1">
          <span>SAVED VAULT RECORDS</span>
          <span className="cursor-pointer text-sky-600 hover:underline" onClick={() => openDashboard('fields')}>
            Manage
          </span>
        </div>

        {filteredFields.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-400">
            No matching records found.
          </div>
        ) : (
          filteredFields.map((field) => (
            <div 
              key={field.id}
              className="bg-white border border-slate-200 rounded-md p-2 text-xs shadow-2xs hover:border-slate-300 transition"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-slate-700">{field.key}</span>
                <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                  {field.category}
                </span>
              </div>
              <div className="space-y-1">
                {field.values.map((v) => (
                  <div 
                    key={v.id} 
                    className="flex items-center justify-between bg-slate-50 hover:bg-sky-50 px-2 py-1 rounded group transition cursor-pointer"
                    onClick={() => copyToClipboard(v.value, v.id)}
                  >
                    <div className="truncate pr-2">
                      {v.label && <span className="text-[10px] text-slate-400 mr-1.5 font-medium">{v.label}:</span>}
                      <span className="text-slate-800 font-mono text-[11px]">{v.value}</span>
                    </div>
                    <button 
                      className="text-slate-400 group-hover:text-sky-600 p-0.5"
                      title="Click to copy"
                    >
                      {copiedId === v.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <footer className="p-2.5 bg-white border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
        <button
          onClick={() => openDashboard('documents')}
          className="flex items-center gap-1.5 hover:text-sky-600 transition"
        >
          <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
          <span>Documents</span>
        </button>
        <button
          onClick={() => openDashboard('settings')}
          className="hover:text-sky-600 transition"
        >
          Backup & Settings
        </button>
      </footer>
    </div>
  );
}
