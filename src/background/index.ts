import { db } from '../storage/db';
import { suggestAliases } from '../engine/aliases';
import { generateFieldMetadata, describeWebField } from '../engine/ai';
import { generateEmbedding } from '../engine/vector';

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

  if (message.type === 'GENERATE_FIELD_METADATA') {
    (async () => {
      try {
        const metadata = await generateFieldMetadata(message.key, message.value);
        sendResponse({ success: true, metadata });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'DESCRIBE_WEB_FIELD') {
    (async () => {
      try {
        const description = await describeWebField(message.signals);
        sendResponse({ success: true, description });
      } catch (err: any) {
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'SAVE_NEW_FIELD') {
    (async () => {
      try {
        const { canonicalKey, value, category, label, description } = message;
        await db.ensureInitialized();
        const fields = await db.getFields();

        const cleanKey = (canonicalKey || 'Custom Field').trim();
        const cleanVal = (value || '').trim();
        let targetField = fields.find(f => f.key.toLowerCase() === cleanKey.toLowerCase());

        if (targetField) {
          const valExists = targetField.values.some(
            v => v.value.trim().toLowerCase() === cleanVal.toLowerCase()
          );
          if (!valExists) {
            targetField.values.push({
              id: 'val-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
              label: label || 'Additional',
              value: cleanVal
            });
            await db.saveField(targetField);
          }
        } else {
          // Generate AI metadata if not provided
          let finalDesc = description;
          let finalCat = category;
          if (!finalDesc || !finalCat) {
            const aiMeta = await generateFieldMetadata(cleanKey, cleanVal);
            finalDesc = finalDesc || aiMeta.description;
            finalCat = finalCat || aiMeta.category;
          }

          const embedding = generateEmbedding(`${finalDesc} ${cleanKey}`);

          targetField = {
            id: 'field-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            key: cleanKey,
            category: finalCat || 'Personal',
            description: finalDesc,
            embedding,
            values: [
              {
                id: 'val-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                label: label || 'Primary',
                value: cleanVal,
                isDefault: true
              }
            ],
            updatedAt: Date.now()
          };
          await db.saveField(targetField);

          // Automatically suggest and register aliases for the newly created canonical key
          const suggested = suggestAliases(cleanKey);
          for (const aliasText of suggested) {
            await db.saveAlias({
              id: `alias-${cleanKey}-${aliasText}`.replace(/\s+/g, '-').toLowerCase(),
              canonicalKey: cleanKey,
              alias: aliasText,
              isBuiltIn: false
            });
          }
        }

        notifyTabsVaultUpdated();
        sendResponse({ success: true, field: targetField });
      } catch (err: any) {
        console.error('[SmartForm Background] Error saving new field:', err);
        sendResponse({ success: false, error: err.message });
      }
    })();
    return true;
  }

  if (message.type === 'VAULT_UPDATED') {
    notifyTabsVaultUpdated();
    sendResponse({ success: true });
    return true;
  }
});
