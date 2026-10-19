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
}

export function initTooltip(_callbacks?: TooltipCallbacks) {
  if (hostElement) return;

  hostElement = document.createElement('smartform-suggestion-host');
  hostElement.style.cssText = 'all: initial; position: absolute; z-index: 2147483647; top: 0; left: 0;';
  document.body.appendChild(hostElement);

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
      position: absolute;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
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

  // Reposition on window scroll or resize
  window.addEventListener('scroll', () => {
    if (activeElement) repositionTooltip(activeElement);
  }, { passive: true });

  window.addEventListener('resize', () => {
    if (activeElement) repositionTooltip(activeElement);
  }, { passive: true });
}

export function showTooltip(
  targetEl: HTMLElement,
  match: FieldMatch,
  callbacks: TooltipCallbacks
) {
  if (!shadowRoot) return;

  const fieldId = targetEl.getAttribute('data-smartform-id') || '';
  if (dismissedFieldIds.has(fieldId)) {
    return;
  }

  activeElement = targetEl;

  // Remove existing popup if any
  const oldPopup = shadowRoot.querySelector('.popup-card');
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

  popup.appendChild(footer);
  shadowRoot.appendChild(popup);

  repositionTooltip(targetEl);
}

export function hideTooltip() {
  if (!shadowRoot) return;
  const popup = shadowRoot.querySelector('.popup-card');
  if (popup) popup.remove();
  activeElement = null;
}

function repositionTooltip(targetEl: HTMLElement) {
  if (!shadowRoot) return;
  const popup = shadowRoot.querySelector('.popup-card') as HTMLElement;
  if (!popup) return;

  const rect = targetEl.getBoundingClientRect();
  const scrollX = window.scrollX || window.pageXOffset;
  const scrollY = window.scrollY || window.pageYOffset;

  let top = rect.bottom + scrollY + 4;
  let left = rect.left + scrollX;

  // Ensure within horizontal screen bounds
  const popupWidth = 290;
  if (left + popupWidth > window.innerWidth + scrollX - 16) {
    left = window.innerWidth + scrollX - popupWidth - 16;
  }
  if (left < scrollX + 8) left = scrollX + 8;

  // If close to bottom of screen, show above input
  if (rect.bottom + 260 > window.innerHeight && rect.top > 260) {
    top = rect.top + scrollY - popup.offsetHeight - 4;
  }

  popup.style.top = `${top}px`;
  popup.style.left = `${left}px`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
