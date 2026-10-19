import { db } from '../storage/db';
import { PersonalField, AliasMapping, DocumentRecord, AppSettings, FieldMatch, FieldSignals } from '../types';
import { 
  scanPage, 
  ScannedElement, 
  extractSignals, 
  formatSuggestedFieldName, 
  formatSuggestedCategory 
} from './detector';
import { initTooltip, showTooltip, hideTooltip, showSavePrompt } from './tooltip';
import { fillTextInput, fillFileInput } from './injector';
import { suggestAliases } from '../engine/aliases';

let cachedFields: PersonalField[] = [];
let cachedAliases: AliasMapping[] = [];
let cachedDocs: DocumentRecord[] = [];
let cachedSettings: AppSettings = {
  activeProfile: 'Personal',
  autoShowSuggestions: true,
  confirmBeforeOverwrite: true,
  enableDynamicForms: true,
  promptToSaveNewFields: true
};

const dismissedSavePrompts = new Set<string>();

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

async function saveNewFieldThroughBackground(
  canonicalKey: string,
  value: string,
  category: string
): Promise<void> {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          type: 'SAVE_NEW_FIELD',
          canonicalKey,
          value,
          category,
          label: 'Primary'
        },
        () => {
          syncVaultData().then(resolve);
        }
      );
    });
  } else {
    // Standalone fallback
    let field = cachedFields.find(f => f.key.toLowerCase() === canonicalKey.toLowerCase());
    if (field) {
      const exists = field.values.some(v => v.value.toLowerCase().trim() === value.toLowerCase().trim());
      if (!exists) {
        field.values.push({
          id: 'val-' + Date.now(),
          label: 'Additional',
          value: value.trim()
        });
        await db.saveField(field);
      }
    } else {
      field = {
        id: 'field-' + Date.now(),
        key: canonicalKey,
        category,
        values: [
          {
            id: 'val-' + Date.now(),
            label: 'Primary',
            value: value.trim(),
            isDefault: true
          }
        ],
        updatedAt: Date.now()
      };
      await db.saveField(field);

      const suggested = suggestAliases(canonicalKey);
      for (const a of suggested) {
        await db.saveAlias({
          id: `alias-${canonicalKey}-${a}`.replace(/\s+/g, '-').toLowerCase(),
          canonicalKey,
          alias: a,
          isBuiltIn: false
        });
      }
    }
    await syncVaultData();
  }
}

function isValueInRecords(val: string): boolean {
  const lower = val.toLowerCase().trim();
  for (const field of cachedFields) {
    for (const v of field.values) {
      if (v.value.toLowerCase().trim() === lower) {
        return true;
      }
    }
  }
  return false;
}

function isSearchInput(el: HTMLElement, signals: FieldSignals): boolean {
  if (el instanceof HTMLInputElement && el.type === 'search') return true;
  if (el.getAttribute('role') === 'searchbox') return true;
  const nameLower = (signals.name || '').toLowerCase();
  if (['q', 'query', 'search', 'keyword', 'keywords', 'search_query', 's'].includes(nameLower)) {
    return true;
  }
  const combined = `${signals.name} ${signals.id} ${signals.placeholder}`.toLowerCase();
  if (combined.includes('search') && !combined.includes('research')) {
    return true;
  }
  return false;
}

function isOtpOrCaptcha(signals: FieldSignals): boolean {
  if (signals.autocomplete === 'one-time-code') return true;
  const combined = `${signals.name} ${signals.id} ${signals.placeholder} ${signals.labelText}`.toLowerCase();
  return /otp|captcha|verification[_-]?code|2fa|mfa|security[_-]?code/.test(combined);
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

  // Attach focus, click, and blur/change listeners
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
  document.addEventListener('change', handleFieldChangeOrBlur, true);
  document.addEventListener('blur', handleFieldChangeOrBlur, true);
}

let savePromptDebounceTimer: any = null;

async function handleFieldChangeOrBlur(e: Event) {
  if (!cachedSettings.promptToSaveNewFields) {
    return;
  }

  const target = e.target as HTMLElement;
  if (!target || !['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) {
    return;
  }

  // Do not prompt for interactions inside SmartForm's own UI
  if (target.closest('smartform-suggestion-host')) {
    return;
  }

  if (target instanceof HTMLInputElement) {
    // Security Floor: NEVER capture passwords!
    if (target.type === 'password') return;
    // Skip buttons and non-textual input types
    if (['hidden', 'submit', 'button', 'reset', 'image', 'file', 'checkbox', 'radio'].includes(target.type)) {
      return;
    }
    if (target.readOnly || target.disabled) return;
  }

  const rawVal = (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value;
  const val = rawVal ? rawVal.trim() : '';

  if (!val || val.length === 0 || val.length > 500) {
    return;
  }

  // Avoid duplicate handling if value hasn't changed since last evaluation
  const lastChecked = target.getAttribute('data-smartform-last-checked-val');
  if (lastChecked === val) {
    return;
  }
  target.setAttribute('data-smartform-last-checked-val', val);

  // Skip if this value was just injected by SmartForm autofill
  const autofilledVal = target.getAttribute('data-smartform-autofilled-val');
  if (autofilledVal === val) {
    return;
  }

  const fieldId = target.getAttribute('data-smartform-id') || '';
  const dismissKey = `${fieldId || target.getAttribute('name') || target.id || 'field'}:${val}`;
  if (dismissedSavePrompts.has(dismissKey)) {
    return;
  }

  clearTimeout(savePromptDebounceTimer);
  savePromptDebounceTimer = setTimeout(async () => {
    // Refresh vault data to check latest records
    await syncVaultData();

    // Check if this value is already stored in vault records
    if (isValueInRecords(val)) {
      return;
    }

    const signals = extractSignals(target as any);

    // Skip search inputs and OTP/captchas
    if (isSearchInput(target, signals) || isOtpOrCaptcha(signals)) {
      return;
    }

    const scanned = scannedElements.find(s => s.id === fieldId) || scannedElements.find(s => s.element === target);
    const matchedKey = scanned?.match?.matchedCanonicalKey;

    const suggestedKey = formatSuggestedFieldName(signals, matchedKey);
    let suggestedCat = 'Personal';
    if (matchedKey) {
      const existingField = cachedFields.find(f => f.key.toLowerCase() === matchedKey.toLowerCase());
      if (existingField) suggestedCat = existingField.category;
    } else {
      suggestedCat = formatSuggestedCategory(suggestedKey, signals);
    }

    showSavePrompt(target, {
      suggestedKey,
      value: val,
      suggestedCategory: suggestedCat,
      onSave: async (finalKey, finalValue, finalCat) => {
        await saveNewFieldThroughBackground(finalKey, finalValue, finalCat);
        target.setAttribute('data-smartform-autofilled-val', finalValue);
      },
      onDismiss: () => {
        dismissedSavePrompts.add(dismissKey);
      }
    });
  }, 200);
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
