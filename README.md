# SmartForm — Local-First Browser Autofill Extension

SmartForm is a privacy-first Chrome Extension (Manifest V3) that stores reusable personal information and documents locally, detects form fields on websites, and suggests matching values and uploaded documents for user-selected autofill.

---

## 🌟 Key Features

1. **Local Personal Information Vault**
   - Store reusable key-value records (First Name, Surname, Email, Phone, Address, LinkedIn, GitHub, etc.).
   - Support for **multiple values per field** (e.g. Personal Email, Work Email, College Email).
   - Group information into profiles/categories (*Personal*, *Job Applications*, *Academic*).

2. **Multi-Resume & Document Storage**
   - Upload multiple resumes, cover letters, certificates, and portfolio files.
   - Assign custom friendly names (e.g. *Backend Resume*, *Full Stack Resume*, *AI Resume*).
   - Preserve original filenames, MIME types, and sizes in local `IndexedDB`.
   - File input detection automatically matches and suggests relevant stored files, attaching them using the browser's `DataTransfer` API.

3. **Intelligent Field Matching**
   - Multi-signal detection: checks `<label>`, `aria-label`, `aria-labelledby`, `placeholder`, `name`, `id`, `autocomplete`, input `type`, and surrounding text.
   - Hierarchy: Exact Match (100%) &rarr; Custom User Aliases (95%) &rarr; Built-in Aliases (90%) &rarr; Autocomplete (85%) &rarr; Semantic Similarity (75%).
   - Normalizer handles camelCase, snake_case, punctuation, and common form noise words.

4. **In-Page Shadow-DOM Suggestion Tooltip**
   - Non-intrusive floating bubble near focused fields.
   - Shadow DOM encapsulation prevents CSS conflicts with host websites.
   - 1-click value insertion, "Autofill Form" batch action, and dismissal controls.

5. **Security & Privacy Floor**
   - **Zero Cloud / Zero External API**: 100% on-device operation.
   - **Password Protection**: Password fields (`type="password"`) are NEVER read, matched, or autofilled.
   - **No Auto-Submit**: Never triggers form submission automatically.
   - **Non-Empty Protection**: Configurable setting to prevent overwriting existing form text without consent.
   - **Encrypted/Local Backup**: Export & restore offline JSON backups with sensitive data warnings.

---

## 🛠️ Project Structure

```
SmartForm/
├── public/
│   ├── manifest.json         # Manifest V3 specification
│   └── icons/                # Extension icons (16px, 48px, 128px)
├── src/
│   ├── types/                # Core TypeScript interfaces & models
│   ├── engine/               # Pure matching engine & alias dictionary
│   │   ├── normalizer.ts     # Label & token cleaner
│   │   ├── aliases.ts        # Built-in aliases & keyword maps
│   │   ├── matcher.ts        # Match scoring & candidate generator
│   │   └── __tests__/        # Vitest unit test suite
│   ├── storage/              # Local persistence layer
│   │   ├── db.ts             # IndexedDB & chrome.storage coordinator
│   │   └── backup.ts         # JSON backup export & restore
│   ├── content/              # Webpage content script
│   │   ├── detector.ts       # DOM scanner & signal extractor
│   │   ├── injector.ts       # React/Vue-compatible value & file injector
│   │   ├── tooltip.ts        # Shadow-DOM floating suggestion UI
│   │   └── index.ts          # MutationObserver & lifecycle coordinator
│   ├── background/           # Service worker & context menus
│   ├── popup/                # Extension popup UI (Quick fill & search)
│   └── options/              # Full-page Management Dashboard
├── popup.html                # Popup HTML shell
├── options.html              # Options Dashboard HTML shell
├── test-form.html            # Realistic job application test page
├── build.js                  # Extension build script
└── vite.config.ts            # Vite & Tailwind configuration
```

---

## 🚀 Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Tests
```bash
npm test
```

### 3. Build Extension for Chrome / Edge / Brave
```bash
npm run build
```
This generates the ready-to-load unpacked extension inside the `dist/` folder.

---

## 📦 Loading into Chrome / Edge

1. Open your browser and navigate to:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
2. Enable **Developer mode** (toggle switch in the top-right corner).
3. Click the **Load unpacked** button.
4. Select the `dist` directory (`d:\College\Projects\SmartForm\dist`).
5. The **SmartForm - Local-First Autofill** extension is now installed!

---

## 🧪 Testing Autofill with the Demo Form

You can test the extension on the included realistic job application form:

1. In Chrome, open `d:\College\Projects\SmartForm\dist\test-form.html` (or serve it with any local server / browser).
2. Click into any field (e.g. "Family Name", "Email Address", "GitHub Profile URL", or "Upload Your CV / Resume").
3. Notice the **SmartForm suggestion bubble** displaying matching records and reasons.
4. Click any candidate to autofill the field!
5. Click the SmartForm icon in your extension bar to see the active page field summary and 1-click "Autofill Page" button.
