import { FieldSignals, DetectedInputType, FieldMatch } from '../types';
import { matchField, MatchOptions } from '../engine/matcher';

export interface ScannedElement {
  id: string;
  element: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  signals: FieldSignals;
  match: FieldMatch | null;
}

let elementCounter = 0;

export function extractSignals(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement): FieldSignals {
  const name = el.getAttribute('name') || '';
  const id = el.getAttribute('id') || '';
  const placeholder = el.getAttribute('placeholder') || '';
  const ariaLabel = el.getAttribute('aria-label') || '';
  const ariaLabelledBy = el.getAttribute('aria-labelledby') || '';
  const autocomplete = el.getAttribute('autocomplete') || '';
  
  let inputType: DetectedInputType = 'text';
  if (el.tagName.toLowerCase() === 'select') {
    inputType = 'select';
  } else if (el.tagName.toLowerCase() === 'textarea') {
    inputType = 'textarea';
  } else if (el.tagName.toLowerCase() === 'input') {
    const rawType = (el as HTMLInputElement).type?.toLowerCase() || 'text';
    if (rawType === 'password') inputType = 'other'; // NEVER autofill password
    else if (['email', 'tel', 'url', 'date', 'file', 'checkbox'].includes(rawType)) {
      inputType = rawType as DetectedInputType;
    } else {
      inputType = 'text';
    }
  }

  // Find associated label text
  let labelText = '';
  if (id) {
    const labelEl = document.querySelector(`label[for="${CSS.escape(id)}"]`);
    if (labelEl) {
      labelText = labelEl.textContent || '';
    }
  }

  if (!labelText) {
    // Check wrapping label
    const parentLabel = el.closest('label');
    if (parentLabel) {
      // Clone and remove inputs to get clean label text
      const clone = parentLabel.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('input, select, textarea').forEach(e => e.remove());
      labelText = clone.textContent || '';
    }
  }

  if (!labelText && ariaLabelledBy) {
    const labelByEl = document.getElementById(ariaLabelledBy);
    if (labelByEl) {
      labelText = labelByEl.textContent || '';
    }
  }

  // Surrounding contextual text (e.g. preceding sibling or parent container title)
  let surroundingText = '';
  const parentContainer = el.closest('.form-group, .field, [class*="form-"], [class*="input-"], div');
  if (parentContainer) {
    const heading = parentContainer.querySelector('h1, h2, h3, h4, h5, h6, strong, span');
    if (heading && heading !== el) {
      surroundingText = heading.textContent || '';
    }
  }

  return {
    name,
    id,
    placeholder,
    ariaLabel,
    ariaLabelledBy,
    autocomplete,
    labelText: labelText.trim(),
    surroundingText: surroundingText.trim(),
    inputType
  };
}

export function scanPage(options: MatchOptions): ScannedElement[] {
  const elements = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]), select, textarea'
    )
  );

  const scanned: ScannedElement[] = [];

  for (const el of elements) {
    // SECURITY FLOOR: Never inspect or touch passwords!
    if ((el as HTMLInputElement).type === 'password') {
      continue;
    }

    // Assign internal tracking ID
    let fieldId = el.getAttribute('data-smartform-id');
    if (!fieldId) {
      fieldId = `sf-field-${++elementCounter}`;
      el.setAttribute('data-smartform-id', fieldId);
    }

    const signals = extractSignals(el);
    const match = matchField(fieldId, signals, options);

    scanned.push({
      id: fieldId,
      element: el,
      signals,
      match
    });
  }

  return scanned;
}
