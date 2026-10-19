import React, { useState, useEffect, useRef } from 'react';
import { db } from '../storage/db';
import { DocumentRecord, DocumentCategory } from '../types';
import { 
  Upload, 
  FileText, 
  Download, 
  Trash2, 
  Edit3, 
  FileCheck, 
  Search,
  Sparkles
} from 'lucide-react';

const CATEGORIES: DocumentCategory[] = [
  'Resume',
  'Cover Letter',
  'Certificate',
  'Portfolio',
  'Other'
];

export default function DocumentsTab() {
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  
  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory>('Resume');
  
  // Edit modal state
  const [editingDoc, setEditingDoc] = useState<DocumentRecord | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  async function loadDocuments() {
    await db.ensureInitialized();
    const docs = await db.getDocuments();
    setDocuments(docs);
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingFile(file);
    // Suggest default display name from filename (e.g. resume_backend.pdf -> Resume Backend)
    const baseName = file.name.replace(/\.[^/.]+$/, '').replace(/[_\-]+/g, ' ');
    const suggestedName = baseName
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');

    setDisplayName(suggestedName);
    
    // Auto-detect category from filename
    const lower = file.name.toLowerCase();
    if (lower.includes('cover')) {
      setSelectedCategory('Cover Letter');
    } else if (lower.includes('cert') || lower.includes('diploma')) {
      setSelectedCategory('Certificate');
    } else {
      setSelectedCategory('Resume');
    }

    setIsUploadModalOpen(true);
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSaveNewDocument(e: React.FormEvent) {
    e.preventDefault();
    if (!pendingFile || !displayName.trim()) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const base64Data = reader.result as string;
      const newDoc: DocumentRecord = {
        id: 'doc-' + Date.now(),
        displayName: displayName.trim(),
        originalFilename: pendingFile.name,
        category: selectedCategory,
        mimeType: pendingFile.type || 'application/octet-stream',
        size: pendingFile.size,
        data: base64Data,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      await db.saveDocument(newDoc);
      setIsUploadModalOpen(false);
      setPendingFile(null);
      await loadDocuments();
    };

    reader.readAsDataURL(pendingFile);
  }

  async function handleUpdateMetadata(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDoc) return;

    await db.saveDocument(editingDoc);
    setEditingDoc(null);
    await loadDocuments();
  }

  async function handleDeleteDocument(id: string) {
    if (confirm('Are you sure you want to delete this document?')) {
      await db.deleteDocument(id);
      await loadDocuments();
    }
  }

  function downloadDocument(doc: DocumentRecord) {
    const a = document.createElement('a');
    a.href = doc.data;
    a.download = doc.originalFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  const filteredDocs = documents.filter(d => {
    const matchCat = categoryFilter === 'All' || d.category === categoryFilter;
    const matchSearch = d.displayName.toLowerCase().includes(search.toLowerCase()) ||
      d.originalFilename.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
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
              placeholder="Search documents..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-sky-500"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-sm bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:border-sky-500"
          >
            <option value="All">All Categories</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelected}
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium px-4 py-2 rounded-lg shadow-sm transition"
          >
            <Upload className="w-4 h-4" />
            <span>Upload Document</span>
          </button>
        </div>
      </div>

      {/* Info notice about resume autofill */}
      <div className="bg-sky-50 border border-sky-100 rounded-xl p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-sky-600 shrink-0 mt-0.5" />
        <div className="text-xs text-sky-800 space-y-1">
          <p className="font-semibold">Multiple Resumes Supported</p>
          <p>
            When a job portal has a file upload for a resume or CV, SmartForm will list all your resumes 
            (e.g., <em>Backend Resume</em>, <em>Full Stack Resume</em>) so you can choose the right one for that specific application.
          </p>
        </div>
      </div>

      {/* Documents List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDocs.map(doc => (
          <div
            key={doc.id}
            className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-800 text-sm leading-snug">{doc.displayName}</h3>
                    <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium mt-1 inline-block">
                      {doc.category}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 bg-slate-50 border border-slate-100 rounded-lg p-2.5 text-[11px] text-slate-600 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">File:</span>
                  <span className="font-mono text-slate-700 truncate max-w-[160px]">{doc.originalFilename}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Size:</span>
                  <span>{formatBytes(doc.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Uploaded:</span>
                  <span>{new Date(doc.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-slate-100">
              <button
                onClick={() => downloadDocument(doc)}
                className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-md transition"
                title="Download document"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={() => setEditingDoc({ ...doc })}
                className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-sky-50 rounded-md transition"
                title="Rename or edit category"
              >
                <Edit3 className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDeleteDocument(doc.id)}
                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                title="Delete document"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {filteredDocs.length === 0 && (
          <div className="col-span-full py-12 text-center text-slate-400 text-sm">
            No documents uploaded yet. Click "Upload Document" to add your resumes or cover letters.
          </div>
        )}
      </div>

      {/* Upload Dialog: Display Name & Category Prompt */}
      {isUploadModalOpen && pendingFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Upload Document</h2>
            <p className="text-xs text-slate-500 mb-4">
              Give your document a friendly display name and select its category for form suggestions.
            </p>

            <form onSubmit={handleSaveNewDocument} className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-mono text-slate-700 truncate">{pendingFile.name}</span>
                <span className="text-slate-400 ml-auto">{formatBytes(pendingFile.size)}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Friendly Display Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Backend Resume, Full Stack Resume"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value as DocumentCategory)}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setIsUploadModalOpen(false); setPendingFile(null); }}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg shadow-sm transition"
                >
                  Save to Vault
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Metadata Modal */}
      {editingDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Edit Document Details</h2>

            <form onSubmit={handleUpdateMetadata} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Friendly Display Name
                </label>
                <input
                  type="text"
                  value={editingDoc.displayName}
                  onChange={(e) => setEditingDoc({ ...editingDoc, displayName: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <select
                  value={editingDoc.category}
                  onChange={(e) => setEditingDoc({ ...editingDoc, category: e.target.value as DocumentCategory })}
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-sky-500"
                >
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingDoc(null)}
                  className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm bg-sky-600 hover:bg-sky-700 text-white font-medium rounded-lg shadow-sm transition"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
