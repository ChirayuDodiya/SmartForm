import { FieldMatch, MatchCandidate, DocumentRecord } from '../types';
import { fillTextInput, fillFileInput } from './injector';

let hostElement: HTMLElement | null = null;
let shadowRoot: ShadowRoot | null = null;
let activeElement: HTMLElement | null = null;
const dismissedFieldIds = new Set<string>();

export interface TooltipCallbacks {
  onFillAll?: (formEl: HTMLFormElement | null) => void;
  onAddAlias?: (canonicalKey: string, aliasText: string) => void;
  getDocumentById?: (docId: string) => Promise<DocumentRecord | null>;
  onDisableSite?: () => void;
}

export function initTooltip(_callbacks?: TooltipCallbacks) {
  if (hostElement) return;

  hostElement = document.createElement('smartform-suggestion-host');
  hostElement.style.cssText = 'all: initial !important; position: fixed !important; z-index: 2147483647 !important; top: 0 !important; left: 0 !important; width: 0 !important; height: 0 !important; pointer-events: none !important;';
  (document.documentElement || document.body).appendChild(hostElement);

  shadowRoot = hostElement.attachShadow({ mode: 'open' });

  // Add styles inside Shadow DOM
  const style = document.createElement('style');
  style.textContent = `
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .popup-card {
      position: fixed !important;
      pointer-events: auto !important;
      z-index: 2147483647 !important;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.15);
      width: 290px;
      max-height: 380px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: sfFadeIn 0.15s ease-out;
      font-size: 13px;
      color: #1e293b;
    }
    @keyframes sfFadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .header {
      padding: 8px 12px;
      background: #f8fafc;
      border-bottom: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .badge-icon {
      width: 18px;
      height: 18px;
      background: #0284c7;
      color: #fff;
      border-radius: 5px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: bold;
      font-size: 11px;
    }
    .field-name {
      font-weight: 600;
      font-size: 12px;
      color: #0f172a;
    }
    .close-btn {
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 14px;
      padding: 2px 4px;
      border-radius: 4px;
    }
    .close-btn:hover {
      color: #475569;
      background: #e2e8f0;
    }
    .reason-bar {
      padding: 5px 12px;
      background: #f0f9ff;
      border-bottom: 1px solid #e0f2fe;
      font-size: 11px;
      color: #0369a1;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .candidates-list {
      overflow-y: auto;
      max-height: 200px;
      padding: 4px;
    }
    .candidate-item {
      padding: 8px 10px;
      border-radius: 6px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      gap: 2px;
      transition: background 0.12s ease;
    }
    .candidate-item:hover, .candidate-item.focused {
      background: #f0f9ff;
    }
    .candidate-label {
      font-size: 10px;
      font-weight: 600;
      color: #0284c7;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .candidate-val {
      font-size: 12px;
      color: #0f172a;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      word-break: break-all;
    }
    .footer {
      padding: 6px 10px;
      background: #fafafa;
      border-top: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
    }
    .action-btn {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      color: #475569;
      font-size: 11px;
      font-weight: 500;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      transition: all 0.12s;
    }
    .action-btn:hover {
      background: #0284c7;
      color: #fff;
      border-color: #0284c7;
    }
    .action-btn-danger {
      color: #94a3b8;
      background: transparent;
      border: 1px solid transparent;
      font-size: 10px;
    }
    .action-btn-danger:hover {
      background: #fee2e2;
      color: #dc2626;
      border-color: #fca5a5;
    }
    /* Save to Vault Card */
    .save-card {
      position: fixed !important;
      pointer-events: auto !important;
      z-index: 2147483647 !important;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 12px;
      box-shadow: 0 12px 30px -5px rgba(0, 0, 0, 0.25), 0 8px 12px -6px rgba(0, 0, 0, 0.15);
      width: 310px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: sfFadeIn 0.15s ease-out;
      font-size: 13px;
      color: #0f172a;
    }
    .save-header {
      padding: 10px 14px;
      background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .save-title {
      font-weight: 700;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .save-close {
      background: transparent;
      border: none;
      color: rgba(255, 255, 255, 0.8);
      font-size: 16px;
      cursor: pointer;
      line-height: 1;
      padding: 2px 4px;
      border-radius: 4px;
    }
    .save-close:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.2);
    }
    .save-body {
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      background: #ffffff;
    }
    .save-label {
      font-size: 10px;
      font-weight: 600;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
    }
    .save-input {
      width: 100%;
      padding: 6px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 13px;
      color: #0f172a;
      outline: none;
      box-sizing: border-box;
      transition: border-color 0.12s;
    }
    .save-input:focus {
      border-color: #0284c7;
      box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.15);
    }
    .save-preview {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      font-size: 12px;
      color: #334155;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      word-break: break-all;
      max-height: 55px;
      overflow-y: auto;
    }
    .save-select {
      width: 100%;
      padding: 6px 8px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      font-size: 12px;
      background: #ffffff;
      color: #0f172a;
      outline: none;
      box-sizing: border-box;
    }
    .save-footer {
      padding: 10px 14px;
      background: #f8fafc;
      border-top: 1px solid #f1f5f9;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
    }
    .btn-save {
      background: #0284c7;
      color: #ffffff;
      border: none;
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background 0.12s;
    }
    .btn-save:hover {
      background: #0369a1;
    }
    .btn-dismiss {
      background: transparent;
      color: #64748b;
      border: 1px solid #cbd5e1;
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.12s;
    }
    .btn-dismiss:hover {
      background: #f1f5f9;
      color: #334155;
    }
    .save-success {
      padding: 16px;
      text-align: center;
      color: #059669;
      font-weight: 600;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
  `;
  shadowRoot.appendChild(style);

  // Global dismiss listener when clicking outside
  document.addEventListener('click', (e) => {
    if (!hostElement) return;
    const path = e.composedPath();
    if (!path.includes(hostElement) && !path.includes(activeElement as any)) {
      hideTooltip();
    }
  });

  // Global escape key listener
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideTooltip();
    }
  });

  // Reposition on window or ANY element scroll (modal dialogs, drawers, overlays)
  document.addEventListener('scroll', () => {
    if (activeElement) repositionTooltip(activeElement);
  }, { passive: true, capture: true });

  window.addEventListener('resize', () => {
    if (activeElement) repositionTooltip(activeElement);
  }, { passive: true });
}

export function ensureHostAttached(targetEl?: HTMLElement) {
  if (!hostElement) {
    initTooltip();
  }
  if (!hostElement) return;

  // If targetEl is inside a native <dialog>, hostElement MUST be inside that <dialog>
  // so it shares the browser's top-layer stacking context.
  // Otherwise, attach to document.documentElement so it's immune to document.body styling.
  const dialog = targetEl?.closest('dialog');
  const targetParent = dialog || document.documentElement || document.body;

  if (hostElement.parentElement !== targetParent) {
    targetParent.appendChild(hostElement);
  }
}

export function showTooltip(
  targetEl: HTMLElement,
  match: FieldMatch,
  callbacks: TooltipCallbacks
) {
  ensureHostAttached(targetEl);
  if (!shadowRoot) return;

  const fieldId = targetEl.getAttribute('data-smartform-id') || '';
  if (dismissedFieldIds.has(fieldId)) {
    return;
  }

  // Never show suggestions if field already has content
  const currentVal = targetEl instanceof HTMLInputElement && targetEl.type === 'file'
    ? (targetEl.files?.length ? 'has_files' : '')
    : (targetEl as HTMLInputElement | HTMLTextAreaElement).value;
  if (currentVal && currentVal.trim().length > 0) {
    return;
  }

  activeElement = targetEl;

  // Remove existing popup if any
  const oldPopup = shadowRoot.querySelector('.popup-card, .save-card');
  if (oldPopup) oldPopup.remove();

  const popup = document.createElement('div');
  popup.className = 'popup-card';

  // Build Header
  const header = document.createElement('div');
  header.className = 'header';
  header.innerHTML = `
    <div class="title-row">
      <div class="badge-icon">S</div>
      <span class="field-name">${escapeHtml(match.matchedCanonicalKey)}</span>
    </div>
    <button class="close-btn" title="Dismiss suggestion">&times;</button>
  `;
  header.querySelector('.close-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (fieldId) dismissedFieldIds.add(fieldId);
    hideTooltip();
  });
  popup.appendChild(header);

  // Build Reason Bar
  const reasonBar = document.createElement('div');
  reasonBar.className = 'reason-bar';
  reasonBar.textContent = `★ ${match.reason}`;
  popup.appendChild(reasonBar);

  // Build Candidates List
  const list = document.createElement('div');
  list.className = 'candidates-list';

  match.candidates.forEach((cand: MatchCandidate) => {
    const item = document.createElement('div');
    item.className = 'candidate-item';
    item.innerHTML = `
      <div class="candidate-label">${escapeHtml(cand.label)}</div>
      <div class="candidate-val">${escapeHtml(cand.value)}</div>
    `;

    item.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (cand.documentId && callbacks.getDocumentById) {
        const doc = await callbacks.getDocumentById(cand.documentId);
        if (doc && targetEl instanceof HTMLInputElement) {
          fillFileInput(targetEl, doc);
        }
      } else {
        fillTextInput(targetEl as any, cand.value);
      }
      hideTooltip();
    });

    list.appendChild(item);
  });
  popup.appendChild(list);

  // Build Footer Actions
  const footer = document.createElement('div');
  footer.className = 'footer';

  const fillAllBtn = document.createElement('button');
  fillAllBtn.className = 'action-btn';
  fillAllBtn.textContent = 'Autofill Form';
  fillAllBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const form = targetEl.closest('form');
    if (callbacks.onFillAll) callbacks.onFillAll(form);
    hideTooltip();
  });
  footer.appendChild(fillAllBtn);

  const disableSiteBtn = document.createElement('button');
  disableSiteBtn.className = 'action-btn action-btn-danger';
  disableSiteBtn.textContent = 'Disable on this page';
  disableSiteBtn.title = 'Disable SmartForm suggestions for this website';
  disableSiteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (callbacks.onDisableSite) callbacks.onDisableSite();
    hideTooltip();
  });
  footer.appendChild(disableSiteBtn);

  popup.appendChild(footer);
  shadowRoot.appendChild(popup);

  repositionTooltip(targetEl);
}

export interface SavePromptOptions {
  suggestedKey: string;
  value: string;
  suggestedCategory?: string;
  suggestedDescription?: string;
  onSave: (key: string, value: string, category: string, description?: string) => Promise<void> | void;
  onDismiss: () => void;
}

export function showSavePrompt(
  targetEl: HTMLElement,
  options: SavePromptOptions
) {
  ensureHostAttached(targetEl);
  if (!shadowRoot) return;

  activeElement = targetEl;

  // Remove existing popup if any
  const oldPopup = shadowRoot.querySelector('.popup-card, .save-card');
  if (oldPopup) oldPopup.remove();

  const card = document.createElement('div');
  card.className = 'save-card';

  card.innerHTML = `
    <div class="save-header">
      <div class="save-title">
        <span style="background: rgba(255,255,255,0.25); border-radius: 4px; padding: 1px 5px; font-size: 11px;">+</span>
        Save to Vault?
      </div>
      <button class="save-close" title="Dismiss">&times;</button>
    </div>
    <div class="save-body">
      <div>
        <div class="save-label">Entered Value</div>
        <div class="save-preview" title="${escapeHtml(options.value)}">${escapeHtml(options.value)}</div>
      </div>
      <div>
        <div class="save-label">Field Name</div>
        <input type="text" class="save-input field-key-input" value="${escapeHtml(options.suggestedKey)}" placeholder="e.g. Portfolio URL" />
      </div>
      <div>
        <div class="save-label">AI Semantic Description</div>
        <input type="text" class="save-input field-desc-input" value="${escapeHtml(options.suggestedDescription || '')}" placeholder="e.g. User's portfolio link" />
      </div>
      <div>
        <div class="save-label">Category</div>
        <select class="save-select category-select">
          <option value="Personal" ${options.suggestedCategory === 'Personal' ? 'selected' : ''}>Personal</option>
          <option value="Job Applications" ${options.suggestedCategory === 'Job Applications' ? 'selected' : ''}>Job Applications</option>
          <option value="Academic" ${options.suggestedCategory === 'Academic' ? 'selected' : ''}>Academic</option>
          <option value="Other" ${options.suggestedCategory === 'Other' ? 'selected' : ''}>Other</option>
        </select>
      </div>
    </div>
    <div class="save-footer">
      <button class="btn-dismiss">Not Now</button>
      <button class="btn-save">Save to Vault</button>
    </div>
  `;

  const closeBtn = card.querySelector('.save-close') as HTMLButtonElement;
  const dismissBtn = card.querySelector('.btn-dismiss') as HTMLButtonElement;
  const saveBtn = card.querySelector('.btn-save') as HTMLButtonElement;
  const keyInput = card.querySelector('.field-key-input') as HTMLInputElement;
  const descInput = card.querySelector('.field-desc-input') as HTMLInputElement;
  const catSelect = card.querySelector('.category-select') as HTMLSelectElement;

  const handleDismiss = (e?: Event) => {
    e?.stopPropagation();
    options.onDismiss();
    hideTooltip();
  };

  closeBtn?.addEventListener('click', handleDismiss);
  dismissBtn?.addEventListener('click', handleDismiss);

  saveBtn?.addEventListener('click', async (e) => {
    e.stopPropagation();
    const finalKey = keyInput?.value.trim() || options.suggestedKey || 'Custom Field';
    const finalDesc = descInput?.value.trim() || options.suggestedDescription || '';
    const finalCat = catSelect?.value || options.suggestedCategory || 'Personal';

    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    try {
      await options.onSave(finalKey, options.value, finalCat, finalDesc);

      const body = card.querySelector('.save-body');
      const footer = card.querySelector('.save-footer');
      if (body) {
        body.innerHTML = `
          <div class="save-success">
            <span style="font-size: 16px;">✓</span>
            <span>Saved "<strong>${escapeHtml(finalKey)}</strong>" to Vault!</span>
          </div>
        `;
      }
      if (footer) (footer as HTMLElement).style.display = 'none';

      setTimeout(() => {
        hideTooltip();
      }, 1200);
    } catch (err) {
      console.error('[SmartForm] Failed to save field:', err);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save to Vault';
    }
  });

  shadowRoot.appendChild(card);
  repositionTooltip(targetEl);
}

export function hideTooltip() {
  if (!shadowRoot) return;
  const popup = shadowRoot.querySelector('.popup-card, .save-card');
  if (popup) popup.remove();
  activeElement = null;
}

function repositionTooltip(targetEl: HTMLElement) {
  if (!shadowRoot) return;
  const popup = (shadowRoot.querySelector('.popup-card') || shadowRoot.querySelector('.save-card')) as HTMLElement;
  if (!popup) return;

  const rect = targetEl.getBoundingClientRect();

  // If the target element is detached or hidden (e.g. modal closed)
  if (rect.width === 0 && rect.height === 0) {
    popup.style.display = 'none';
    return;
  }

  // If scrolled completely out of current viewport
  if (rect.bottom < 0 || rect.top > window.innerHeight || rect.right < 0 || rect.left > window.innerWidth) {
    popup.style.display = 'none';
    return;
  }

  popup.style.display = 'flex';

  const popupWidth = popup.offsetWidth || 310;
  const popupHeight = popup.offsetHeight || 260;

  // Viewport-relative positioning (matches position: fixed)
  let top = rect.bottom + 6;
  let left = rect.left;

  // Keep within horizontal screen bounds
  if (left + popupWidth > window.innerWidth - 12) {
    left = window.innerWidth - popupWidth - 12;
  }
  if (left < 8) left = 8;

  // If close to bottom of screen or not enough space below, flip above input
  if (top + popupHeight > window.innerHeight - 8 && rect.top > popupHeight + 12) {
    top = rect.top - popupHeight - 6;
  }
  if (top < 8) top = 8;

  popup.style.top = `${Math.round(top)}px`;
  popup.style.left = `${Math.round(left)}px`;
}


function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
