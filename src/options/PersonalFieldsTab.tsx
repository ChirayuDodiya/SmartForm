import React, { useState, useEffect } from 'react';
import { db } from '../storage/db';
import { PersonalField, FieldValueItem } from '../types';
import { suggestAliases } from '../engine/aliases';
import { generateFieldMetadata } from '../engine/ai';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Search, 
  PlusCircle, 
  Check, 
  Sparkles
} from 'lucide-react';

export default function PersonalFieldsTab() {
  const [fields, setFields] = useState<PersonalField[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  // Form state
  const [fieldKey, setFieldKey] = useState('');
  const [category, setCategory] = useState('Personal');
  const [description, setDescription] = useState('');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [values, setValues] = useState<FieldValueItem[]>([
    { id: 'v-' + Date.now(), label: 'Primary', value: '', isDefault: true }
  ]);
  const [suggestedAliasesList, setSuggestedAliasesList] = useState<string[]>([]);
  const [acceptedAliases, setAcceptedAliases] = useState<string[]>([]);

  useEffect(() => {
    loadFields();
  }, []);

  async function loadFields() {
    await db.ensureInitialized();
    const data = await db.getFields();
    setFields(data);
  }

  function handleKeyChange(newKey: string) {
    setFieldKey(newKey);
    if (newKey.trim().length >= 2) {
      const suggestions = suggestAliases(newKey);
      setSuggestedAliasesList(suggestions);
      // Auto-enable all suggested aliases by default
      setAcceptedAliases(suggestions);
    } else {
      setSuggestedAliasesList([]);
      setAcceptedAliases([]);
    }
  }

  function addValueRow() {
    setValues([
      ...values,
      { id: 'v-' + Date.now() + Math.random(), label: '', value: '' }
    ]);
  }

  function removeValueRow(id: string) {
    if (values.length <= 1) return;
    setValues(values.filter(v => v.id !== id));
  }

  function updateValueRow(id: string, field: 'label' | 'value', text: string) {
    setValues(values.map(v => v.id === id ? { ...v, [field]: text } : v));
  }

  function toggleAcceptAlias(alias: string) {
    if (acceptedAliases.includes(alias)) {
      setAcceptedAliases(acceptedAliases.filter(a => a !== alias));
    } else {
      setAcceptedAliases([...acceptedAliases, alias]);
    }
  }

  function selectAllAliases() {
    setAcceptedAliases([...suggestedAliasesList]);
  }

  function deselectAllAliases() {
    setAcceptedAliases([]);
  }

  async function handleGenerateAIDescription() {
    if (!fieldKey.trim()) return;
    setIsGeneratingAI(true);
    try {
      const primaryVal = values.find(v => v.value.trim().length > 0)?.value || '';
      const meta = await generateFieldMetadata(fieldKey, primaryVal);
      setDescription(meta.description);
      if (!category || category === 'Personal') {
        setCategory(meta.category);
      }
    } catch (err) {
      console.error('AI generation error:', err);
    } finally {
      setIsGeneratingAI(false);
    }
  }

  function openAddModal() {
    setEditingFieldId(null);
    setFieldKey('');
    setCategory('Personal');
    setDescription('');
    setValues([{ id: 'v-' + Date.now(), label: 'Primary', value: '', isDefault: true }]);
    setSuggestedAliasesList([]);
    setAcceptedAliases([]);
    setIsModalOpen(true);
  }

  async function openEditModal(field: PersonalField) {
    setEditingFieldId(field.id);
    setFieldKey(field.key);
    setCategory(field.category);
    setDescription(field.description || '');
    setValues(field.values.map(v => ({ ...v })));
    const suggestions = suggestAliases(field.key);
    setSuggestedAliasesList(suggestions);

    // Fetch existing aliases for this canonical key
    const allAliases = await db.getAliases();
    const existingFieldAliases = allAliases
      .filter(a => a.canonicalKey.toLowerCase() === field.key.toLowerCase())
      .map(a => a.alias);

    // Auto-enable both existing aliases and suggestions
    const initialAccepted = Array.from(new Set([...existingFieldAliases, ...suggestions]));
    setAcceptedAliases(initialAccepted);
    setIsModalOpen(true);
  }

  async function handleSaveField(e: React.FormEvent) {
    e.preventDefault();
    if (!fieldKey.trim()) return;

    const validValues = values.filter(v => v.value.trim().length > 0);
    if (validValues.length === 0) {
      alert('Please enter at least one non-empty value for this field.');
      return;
    }

    const field: PersonalField = {
      id: editingFieldId || 'field-' + Date.now(),
      key: fieldKey.trim(),
      category: category.trim() || 'Personal',
      description: description.trim() || undefined,
      values: validValues,
      updatedAt: Date.now()
    };

    await db.saveField(field);

    // Save all auto-enabled / accepted aliases without creating duplicate mappings
    const allAliases = await db.getAliases();
    for (const alias of acceptedAliases) {
      const alreadyExists = allAliases.some(
        a => a.canonicalKey.toLowerCase() === field.key.toLowerCase() &&
             a.alias.toLowerCase() === alias.toLowerCase()
      );
      if (!alreadyExists) {
        await db.saveAlias({
          id: 'alias-' + Date.now() + Math.random(),
          canonicalKey: field.key,
          alias: alias,
          isBuiltIn: false
        });
      }
    }

    setIsModalOpen(false);
    await loadFields();
  }

  async function handleDeleteField(id: string) {
    if (confirm('Are you sure you want to delete this field?')) {
      await db.deleteField(id);
      await loadFields();
    }
  }

  const categories = ['All', ...Array.from(new Set(fields.map(f => f.category)))];

  const filteredFields = fields.filter(f => {
    const matchesCategory = selectedCategory === 'All' || f.category === selectedCategory;
    const matchesSearch = f.key.toLowerCase().includes(search.toLowerCase()) ||
      f.values.some(v => v.value.toLowerCase().includes(search.toLowerCase()));
    return matchesCategory && matchesSearch;
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
              placeholder="Search keys or values..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
            />
          </div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500"
          >
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <button
          onClick={openAddModal}
          className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Field</span>
        </button>
      </div>

      {/* Fields Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFields.map(field => (
          <div 
            key={field.id}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-slate-800 text-base">{field.key}</h3>
                <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-medium">
                  {field.category}
                </span>
              </div>

              {field.description && (
                <p className="text-[11px] text-slate-500 italic mb-2 line-clamp-2" title={field.description}>
                  ✨ {field.description}
                </p>
              )}

              <div className="space-y-1.5 mt-3">
                {field.values.map(v => (
                  <div key={v.id} className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-xs">
                    {v.label && (
                      <span className="text-[10px] font-semibold text-sky-700 uppercase tracking-wider block mb-0.5">
                        {v.label}
                      </span>
                    )}
                    <span className="text-slate-800 font-mono select-all break-all">{v.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => openEditModal(field)}
                className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-md transition"
                title="Edit field"
              >
                <Edit2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteField(field.id)}
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                title="Delete field"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal Dialog for Add / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-slate-900 mb-4">
              {editingFieldId ? 'Edit Personal Field' : 'Add New Personal Field'}
            </h2>

            <form onSubmit={handleSaveField} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Canonical Field Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. First Name, Surname, Email, LinkedIn"
                  value={fieldKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category / Profile
                </label>
                <input
                  type="text"
                  placeholder="e.g. Personal, Job Applications, Academic"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-700">
                    AI Semantic Description
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateAIDescription}
                    disabled={isGeneratingAI || !fieldKey.trim()}
                    className="text-[11px] text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1 disabled:opacity-40"
                  >
                    <Sparkles className="w-3 h-3 text-sky-500" />
                    <span>{isGeneratingAI ? 'Generating...' : 'Auto-Generate with AI'}</span>
                  </button>
                </div>
                <textarea
                  placeholder="Concise description explaining what this field represents (used for vector embedding matching)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500 resize-none h-16"
                />
              </div>

              {/* Multiple Values Section */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Saved Values (Supports Multiple Versions)
                  </label>
                  <button
                    type="button"
                    onClick={addValueRow}
                    className="text-xs text-sky-600 hover:text-sky-700 font-medium flex items-center gap-1"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>Add Another Value</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {values.map((val) => (
                    <div key={val.id} className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Label (e.g. Work)"
                        value={val.label}
                        onChange={(e) => updateValueRow(val.id, 'label', e.target.value)}
                        className="w-28 text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-sky-500"
                      />
                      <input
                        type="text"
                        placeholder="Saved Value"
                        value={val.value}
                        onChange={(e) => updateValueRow(val.id, 'value', e.target.value)}
                        className="flex-1 text-xs px-2.5 py-1.5 border border-slate-300 rounded-md focus:outline-none focus:border-sky-500 font-mono"
                        required
                      />
                      {values.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeValueRow(val.id)}
                          className="text-slate-400 hover:text-rose-500 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Suggested Aliases Section */}
              {suggestedAliasesList.length > 0 && (
                <div className="bg-sky-50 border border-sky-100 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-sky-600" />
                      <span className="text-xs font-bold text-sky-950">
                        Suggested Aliases
                      </span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                        Auto-Enabled ({acceptedAliases.length}/{suggestedAliasesList.length})
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={selectAllAliases}
                        className="text-sky-700 hover:text-sky-800 font-semibold hover:underline"
                      >
                        Select All
                      </button>
                      <span className="text-slate-300">&bull;</span>
                      <button
                        type="button"
                        onClick={deselectAllAliases}
                        className="text-slate-500 hover:text-slate-700 font-medium hover:underline"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-sky-800 leading-normal">
                    These common alternatives are <strong>auto-enabled by default</strong> to match web forms automatically. Click any alias to toggle it off if you don't want it mapped.
                  </p>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {suggestedAliasesList.map(alias => {
                      const isAccepted = acceptedAliases.includes(alias);
                      return (
                        <button
                          key={alias}
                          type="button"
                          onClick={() => toggleAcceptAlias(alias)}
                          className={`text-xs px-2.5 py-1 rounded-full border transition flex items-center gap-1.5 font-medium ${
                            isAccepted
                              ? 'bg-sky-600 text-white border-sky-600 shadow-2xs hover:bg-sky-700'
                              : 'bg-white text-slate-500 border-slate-300 hover:border-sky-400 hover:text-slate-700 opacity-70'
                          }`}
                          title={isAccepted ? 'Click to disable' : 'Click to enable'}
                        >
                          {isAccepted ? (
                            <Check className="w-3 h-3 text-white stroke-[2.5]" />
                          ) : (
                            <span className="w-3 h-3 text-slate-400 text-center leading-none">&times;</span>
                          )}
                          <span>{alias}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

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
                  Save Field
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
