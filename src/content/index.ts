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

async function initContentScript() {
  try {
    await db.ensureInitialized();
    cachedFields = await db.getFields();
    cachedAliases = await db.getAliases();
    cachedDocs = await db.getDocuments();
    cachedSettings = await db.getSettings();
  } catch (err) {
    console.warn('[SmartForm] Vault not initialized yet or running restricted context:', err);
  }

  // Initialize Shadow-DOM tooltip
  initTooltip({
    onFillAll: (formEl) => {
      autofillRecognizedFields(formEl);
    },
    onAddAlias: async (canonicalKey, aliasText) => {
      await db.saveAlias({
        id: 'alias-' + Date.now(),
        canonicalKey,
        alias: aliasText,
        isBuiltIn: false
      });
      cachedAliases = await db.getAliases();
      performScan();
    },
    getDocumentById: async (docId) => {
      return await db.getDocument(docId);
    }
  });

  // Perform initial scan
  performScan();

  // Attach focus & click listeners to show suggestion tooltip
  attachEventListeners();

  // Observe dynamic form changes (SPAs)
  if (cachedSettings.enableDynamicForms) {
    setupMutationObserver();
  }

  // Listen for messages from extension popup or background worker
  if (typeof chrome !== 'undefined' && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      if (request.type === 'SCAN_PAGE_FIELDS') {
        performScan();
        const matches = scannedElements
          .filter(s => s.match !== null)
          .map(s => s.match as FieldMatch);
        sendResponse({ success: true, matches });
        return true;
      }

      if (request.type === 'AUTOFILL_ALL_DETECTED') {
        const count = autofillRecognizedFields(null);
        sendResponse({ success: true, filledCount: count });
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

function handleElementInteraction(e: Event) {
  const target = e.target as HTMLElement;
  if (!target || !['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
    return;
  }

  if (target instanceof HTMLInputElement && target.type === 'password') {
    hideTooltip();
    return;
  }

  const fieldId = target.getAttribute('data-smartform-id');
  const scanned = scannedElements.find(s => s.id === fieldId);

  if (scanned && scanned.match && scanned.match.candidates.length > 0) {
    if (cachedSettings.autoShowSuggestions) {
      showTooltip(target, scanned.match, {
        onFillAll: (formEl) => autofillRecognizedFields(formEl),
        getDocumentById: (id) => db.getDocument(id)
      });
    }
  } else {
    // If element is not recognized yet, try re-scanning this specific element
    performScan();
    const newlyScanned = scannedElements.find(s => s.element === target);
    if (newlyScanned && newlyScanned.match && newlyScanned.match.candidates.length > 0) {
      if (cachedSettings.autoShowSuggestions) {
        showTooltip(target, newlyScanned.match, {
          onFillAll: (formEl) => autofillRecognizedFields(formEl),
          getDocumentById: (id) => db.getDocument(id)
        });
      }
    }
  }
}

function autofillRecognizedFields(targetForm: HTMLFormElement | null): number {
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

    if (currentValue && cachedSettings.confirmBeforeOverwrite) {
      // Protect non-empty fields according to user preference
      continue;
    }

    const firstCandidate = scanned.match.candidates[0];

    if (scanned.signals.inputType === 'file' && firstCandidate.documentId && el instanceof HTMLInputElement) {
      db.getDocument(firstCandidate.documentId).then(doc => {
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
