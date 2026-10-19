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

// Coordinate messages between extension parts
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_APP_INFO') {
    sendResponse({ name: 'SmartForm', version: '1.0.0', localOnly: true });
    return true;
  }
});
