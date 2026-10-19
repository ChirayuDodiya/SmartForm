import { DocumentRecord } from '../types';

/**
 * Converts a base64 DataURL string into a standard browser File object.
 */
export function dataUrlToFile(dataUrl: string, filename: string, mimeType: string): File {
  const arr = dataUrl.split(',');
  const bstr = atob(arr[1] || arr[0]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mimeType });
}

/**
 * Injects a value into an input, textarea, or select element,
 * properly triggering React/Vue synthetic events.
 */
export function fillTextInput(
  el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
  value: string
): boolean {
  try {
    el.focus();

    if (el.tagName.toLowerCase() === 'select') {
      const select = el as HTMLSelectElement;
      // Try finding option matching value or text
      let matched = false;
      for (let i = 0; i < select.options.length; i++) {
        const opt = select.options[i];
        if (
          opt.value.toLowerCase() === value.toLowerCase() ||
          opt.text.toLowerCase().includes(value.toLowerCase())
        ) {
          select.selectedIndex = i;
          matched = true;
          break;
        }
      }
      if (!matched && select.options.length > 0) {
        select.value = value;
      }
    } else if (el instanceof HTMLInputElement && el.type === 'checkbox') {
      el.checked = Boolean(value && value !== 'false' && value !== '0');
    } else {
      // Trigger native setter so React/Vue internal state updates
      const prototype = el instanceof HTMLInputElement 
        ? window.HTMLInputElement.prototype 
        : window.HTMLTextAreaElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');

      if (descriptor && descriptor.set) {
        descriptor.set.call(el, value);
      } else {
        el.value = value;
      }
    }

    // Dispatch input, change, and blur events
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    
    flashSuccessIndicator(el);
    return true;
  } catch (err) {
    console.error('[SmartForm] Failed to fill input:', err);
    return false;
  }
}

/**
 * Injects a stored document file into a standard <input type="file"> element.
 */
export function fillFileInput(
  fileInput: HTMLInputElement,
  doc: DocumentRecord
): boolean {
  try {
    fileInput.focus();
    const file = dataUrlToFile(doc.data, doc.originalFilename, doc.mimeType);

    // Use DataTransfer to populate FileList on input
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;

    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));

    flashSuccessIndicator(fileInput);
    return true;
  } catch (err) {
    console.error('[SmartForm] Failed to attach document to file input:', err);
    return false;
  }
}

/**
 * Briefly highlights the element with a subtle green border to indicate successful autofill.
 */
function flashSuccessIndicator(el: HTMLElement) {
  const originalOutline = el.style.outline;
  const originalTransition = el.style.transition;

  el.style.transition = 'outline 0.15s ease';
  el.style.outline = '2px solid #10b981';

  setTimeout(() => {
    el.style.outline = originalOutline;
    el.style.transition = originalTransition;
  }, 1200);
}
