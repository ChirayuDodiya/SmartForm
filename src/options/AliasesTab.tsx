import React, { useState, useEffect } from 'react';
import { db } from '../storage/db';
import { AliasMapping, PersonalField } from '../types';
import { Plus, Trash2, Search, Link2, ShieldAlert } from 'lucide-react';

export default function AliasesTab() {
  const [aliases, setAliases] = useState<AliasMapping[]>([]);
  const [fields, setFields] = useState<PersonalField[]>([]);
  const [search, setSearch] = useState('');
  const [filterKey, setFilterKey] = useState('All');

  // New alias form
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCanonicalKey, setSelectedCanonicalKey] = useState('');
  const [newAliasText, setNewAliasText] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    await db.ensureInitialized();
    const aliasData = await db.getAliases();
    const fieldData = await db.getFields();
    setAliases(aliasData);
    setFields(fieldData);
    if (fieldData.length > 0 && !selectedCanonicalKey) {
      setSelectedCanonicalKey(fieldData[0].key);
    }
  }

  async function handleAddAlias(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCanonicalKey || !newAliasText.trim()) return;

    const newAlias: AliasMapping = {
      id: 'alias-' + Date.now(),
      canonicalKey: selectedCanonicalKey,
      alias: newAliasText.trim(),
      isBuiltIn: false
    };

    await db.saveAlias(newAlias);
    setNewAliasText('');
    setIsModalOpen(false);
    await loadData();
  }

  async function handleDeleteAlias(id: string) {
    if (confirm('Delete this alias mapping?')) {
      await db.deleteAlias(id);
      await loadData();
    }
  }

  const canonicalKeys = ['All', ...Array.from(new Set(aliases.map(a => a.canonicalKey)))];

  const filteredAliases = aliases.filter(a => {
    const matchKey = filterKey === 'All' || a.canonicalKey === filterKey;
    const matchSearch = a.alias.toLowerCase().includes(search.toLowerCase()) ||
      a.canonicalKey.toLowerCase().includes(search.toLowerCase());
    return matchKey && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search aliases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
            />
          </div>
          <select
            value={filterKey}
            onChange={(e) => setFilterKey(e.target.value)}
            className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500"
          >
            {canonicalKeys.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Custom Alias</span>
        </button>
      </div>

      {/* Aliases List Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm">Configured Aliases</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Aliases allow website fields with alternative labels (e.g. "Family Name") to match your canonical records (e.g. "Surname").
            </p>
          </div>
          <span className="text-xs text-slate-500 font-medium">{filteredAliases.length} aliases</span>
        </div>

        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
          {filteredAliases.map(alias => (
            <div key={alias.id} className="px-6 py-3.5 flex items-center justify-between hover:bg-slate-50 transition">
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center">
                  <Link2 className="w-3.5 h-3.5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                      "{alias.alias}"
                    </span>
                    <span className="text-xs text-slate-400">maps to</span>
                    <span className="text-xs font-semibold text-sky-700">
                      {alias.canonicalKey}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 mt-0.5 block">
                    {alias.isBuiltIn ? 'Built-in standard equivalent' : 'User custom mapping'}
                  </span>
                </div>
              </div>

              <div>
                {!alias.isBuiltIn ? (
                  <button
                    onClick={() => handleDeleteAlias(alias.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                    title="Delete alias"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <span className="text-[11px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                    Default
                  </span>
                )}
              </div>
            </div>
          ))}

          {filteredAliases.length === 0 && (
            <div className="py-12 text-center text-slate-400 text-sm">
              No aliases found matching your filter.
            </div>
          )}
        </div>
      </div>

      {/* Add Alias Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Add Custom Alias</h2>
            <p className="text-xs text-slate-500 mb-4">
              Map a website field variation to one of your saved canonical records.
            </p>

            <form onSubmit={handleAddAlias} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Canonical Field
                </label>
                <select
                  value={selectedCanonicalKey}
                  onChange={(e) => setSelectedCanonicalKey(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500"
                  required
                >
                  {fields.map(f => (
                    <option key={f.id} value={f.key}>{f.key}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Alternative Alias Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Second Name, Candidate Surname, Cell"
                  value={newAliasText}
                  onChange={(e) => setNewAliasText(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg shadow-sm transition"
                >
                  Save Alias
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
