import { db } from '../storage/db';
import { PersonalField, AliasMapping, DocumentRecord, AppSettings, FieldMatch } from '../types';
import { scanPage, ScannedElement } from './detector';
import { initTooltip, showTooltip, hideTooltip } from './tooltip';
import { fillTextInput, fillFileInput } from './injector';

let cachedFields: PersonalField[] = [];
let cachedAliases: AliasMapping[] = [];
let cachedDocs: DocumentRecord[] = [];
let cachedSettings: AppSettings = {
  activeProfile: 'Personal',
  autoShowSuggestions: true,
  confirmBeforeOverwrite: true,
  enableDynamicForms: true
};

let scannedElements: ScannedElement[] = [];

/**
 * Fetches the single-source-of-truth vault records from the extension background service worker.
 * Falls back to local IndexedDB if running in standalone test or dev environments.
 */
async function syncVaultData(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage({ type: 'GET_VAULT_DATA' }, (response) => {
        if (!chrome.runtime.lastError && response?.success) {
          cachedFields = response.fields || [];
          cachedAliases = response.aliases || [];
          cachedDocs = response.documents || [];
          if (response.settings) cachedSettings = response.settings;
          performScan();
          resolve();
          return;
        }
        // Fallback if background worker unavailable
        fallbackToLocalDb().then(resolve);
      });
    } else {
      fallbackToLocalDb().then(resolve);
    }
  });
}

async function fallbackToLocalDb() {
  try {
    await db.ensureInitialized();
    cachedFields = await db.getFields();
    cachedAliases = await db.getAliases();
    cachedDocs = await db.getDocuments();
    cachedSettings = await db.getSettings();
  } catch (err) {
    console.warn('[SmartForm] Vault not initialized yet:', err);
  }
  performScan();
}

async function fetchDocumentById(docId: string): Promise<DocumentRecord | null> {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ type: 'GET_DOCUMENT_DATA', docId }, (response) => {
        if (!chrome.runtime.lastError && response?.success && response.doc) {
          resolve(response.doc);
        } else {
          db.getDocument(docId).then(resolve);
        }
      });
    });
  }
  return db.getDocument(docId);
}

async function saveAliasThroughBackground(canonicalKey: string, aliasText: string): Promise<void> {
  const alias: AliasMapping = {
    id: 'alias-' + Date.now(),
    canonicalKey,
    alias: aliasText,
    isBuiltIn: false
  };

  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    chrome.runtime.sendMessage({ type: 'SAVE_ALIAS', alias }, () => {
      syncVaultData();
    });
  } else {
    await db.saveAlias(alias);
    await syncVaultData();
  }
}

async function initContentScript() {
  await syncVaultData();

  // Initialize Shadow-DOM tooltip
  initTooltip({
    onFillAll: (formEl) => {
      autofillRecognizedFields(formEl, true);
    },
    onAddAlias: (canonicalKey, aliasText) => {
      saveAliasThroughBackground(canonicalKey, aliasText);
    },
    getDocumentById: (docId) => {
      return fetchDocumentById(docId);
    }
  });

  // Attach focus & click listeners to show suggestion tooltip
  attachEventListeners();

  // Observe dynamic form changes (SPAs)
  if (cachedSettings.enableDynamicForms) {
    setupMutationObserver();
  }

  // Listen for messages from extension popup, options, or background worker
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.type === 'VAULT_UPDATED') {
        // Vault edited in Options/Popup -> refresh immediately
        syncVaultData().then(() => {
          sendResponse({ success: true });
        });
        return true;
      }

      if (request.type === 'SCAN_PAGE_FIELDS') {
        syncVaultData().then(() => {
          const matches = scannedElements
            .filter(s => s.match !== null)
            .map(s => s.match as FieldMatch);
          sendResponse({ success: true, matches });
        });
        return true;
      }

      if (request.type === 'AUTOFILL_ALL_DETECTED') {
        syncVaultData().then(() => {
          const count = autofillRecognizedFields(null, request.overwrite ?? true);
          sendResponse({ success: true, filledCount: count });
        });
        return true;
      }
    });
  }
}

function performScan() {
  scannedElements = scanPage({
    fields: cachedFields,
    userAliases: cachedAliases,
    documents: cachedDocs
  });
}

function attachEventListeners() {
  document.addEventListener('focusin', handleElementInteraction, true);
  document.addEventListener('click', handleElementInteraction, true);
}

async function handleElementInteraction(e: Event) {
  const target = e.target as HTMLElement;
  if (!target || !['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
    return;
  }

  if (target instanceof HTMLInputElement && target.type === 'password') {
    hideTooltip();
    return;
  }

  // Refresh latest vault data to guarantee edited values are immediately available
  await syncVaultData();

  const fieldId = target.getAttribute('data-smartform-id');
  const scanned = scannedElements.find(s => s.id === fieldId) || scannedElements.find(s => s.element === target);

  if (scanned && scanned.match && scanned.match.candidates.length > 0) {
    if (cachedSettings.autoShowSuggestions) {
      showTooltip(target, scanned.match, {
        onFillAll: (formEl) => autofillRecognizedFields(formEl),
        getDocumentById: (id) => fetchDocumentById(id),
        onAddAlias: (canonicalKey, aliasText) => saveAliasThroughBackground(canonicalKey, aliasText)
      });
    }
  }
}

function autofillRecognizedFields(targetForm: HTMLFormElement | null, forceOverwrite = false): number {
  let filledCount = 0;

  for (const scanned of scannedElements) {
    if (!scanned.match || scanned.match.candidates.length === 0) continue;

    // If a specific form was targeted, only fill elements inside that form
    if (targetForm && !targetForm.contains(scanned.element)) continue;

    const el = scanned.element;

    // Never fill passwords
    if (el instanceof HTMLInputElement && el.type === 'password') continue;

    // Check if element is already non-empty
    const currentValue = el instanceof HTMLInputElement && el.type === 'file' 
      ? (el.files?.length ? 'has_files' : '') 
      : el.value;

    if (currentValue && !forceOverwrite && cachedSettings.confirmBeforeOverwrite) {
      // Protect non-empty fields unless user explicitly requested overwrite
      continue;
    }

    const firstCandidate = scanned.match.candidates[0];

    if (scanned.signals.inputType === 'file' && firstCandidate.documentId && el instanceof HTMLInputElement) {
      fetchDocumentById(firstCandidate.documentId).then(doc => {
        if (doc) fillFileInput(el, doc);
      });
      filledCount++;
    } else {
      fillTextInput(el, firstCandidate.value);
      filledCount++;
    }
  }

  return filledCount;
}

let mutationDebounceTimer: any = null;
function setupMutationObserver() {
  const observer = new MutationObserver(() => {
    clearTimeout(mutationDebounceTimer);
    mutationDebounceTimer = setTimeout(() => {
      performScan();
    }, 300);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

// Start content script
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => initContentScript());
} else {
  initContentScript();
}
