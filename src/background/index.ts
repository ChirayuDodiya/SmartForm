import { db } from '../storage/db';

// Extension Installation & Update Lifecycle
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('[SmartForm Background] Extension installed/updated:', details.reason);
  try {
    await db.ensureInitialized();
  } catch (err) {
    console.warn('[SmartForm Background] Initialization note:', err);
  }

  // Create Context Menu for convenient right-click autofill
  if (chrome.contextMenus) {
    chrome.contextMenus.removeAll(() => {
      chrome.contextMenus.create({
        id: 'smartform-autofill-page',
        title: 'SmartForm: Autofill this form',
        contexts: ['page', 'editable']
      });

      chrome.contextMenus.create({
        id: 'smartform-open-vault',
        title: 'SmartForm: Open Vault & Documents',
        contexts: ['action']
      });
    });
  }
});

// Handle Context Menu item clicks
if (chrome.contextMenus) {
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'smartform-autofill-page' && tab?.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'AUTOFILL_ALL_DETECTED' });
    } else if (info.menuItemId === 'smartform-open-vault') {
      chrome.runtime.openOptionsPage();
    }
  });
}

function notifyTabsVaultUpdated() {
  if (typeof chrome !== 'undefined' && chrome.tabs) {
    chrome.tabs.query({}, (tabs) => {
      for (const tab of tabs) {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, { type: 'VAULT_UPDATED' }, () => {
            // suppress error if tab does not have content script (e.g. chrome://)
            if (chrome.runtime.lastError) { /* ignore */ }
          });
        }
      }
    });
  }
}

// Single Source of Truth message coordinator
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_APP_INFO') {
    sendResponse({ name: 'SmartForm', version: '1.0.0', localOnly: true });
    return true;
  }

  if (message.type === 'GET_VAULT_DATA') {
    (async () => {
      await db.ensureInitialized();
      const fields = await db.getFields();
      const aliases = await db.getAliases();
      const rawDocs = await db.getDocuments();
      const settings = await db.getSettings();

      // Send document metadata (without full base64 data to keep response fast)
      const docsMeta = rawDocs.map(({ data: _, ...meta }) => meta);

      sendResponse({
        success: true,
        fields,
        aliases,
        documents: docsMeta,
        settings
      });
    })();
    return true; // asynchronous response
  }

  if (message.type === 'GET_DOCUMENT_DATA') {
    (async () => {
      const doc = await db.getDocument(message.docId);
      sendResponse({ success: true, doc });
    })();
    return true;
  }

  if (message.type === 'SAVE_ALIAS') {
    (async () => {
      await db.saveAlias(message.alias);
      sendResponse({ success: true });
      notifyTabsVaultUpdated();
    })();
    return true;
  }

  if (message.type === 'VAULT_UPDATED') {
    notifyTabsVaultUpdated();
    sendResponse({ success: true });
    return true;
  }
});
