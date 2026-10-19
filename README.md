# SmartForm — Local-First Browser Autofill Extension

[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue?style=flat-square)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![React 18](https://img.shields.io/badge/React-18.3-61dafb?style=flat-square)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?style=flat-square)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.3-646cff?style=flat-square)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.4-38bdf8?style=flat-square)](https://tailwindcss.com/)
[![Vitest](https://img.shields.io/badge/Tests-Vitest-yellow?style=flat-square)](https://vitest.dev/)
[![Privacy](https://img.shields.io/badge/Privacy-100%25_On--Device-emerald?style=flat-square)](#-security--privacy-floors)

**SmartForm** is a privacy-first, local-first browser extension (Manifest V3) for Chrome, Edge, and Brave. It stores reusable personal information, multiple resumes, and key-value records entirely on your device. When visiting websites with job applications or forms, SmartForm intelligently detects input fields, matches them against your vault via exact keys, auto-enabled aliases, and semantic equivalents, and offers clean autofill suggestions.

---

## 🌟 Key Features

### 1. 🗄️ Local Personal Information Vault
- Store reusable records (First Name, Surname, Email, Phone, Address, LinkedIn, GitHub, Portfolio, etc.).
- **Multiple Values per Field**: Save distinct values for the same field (e.g. *Personal Email* vs. *Work Email*, *Primary Phone* vs. *Alternative Phone*).
- **Profile Categories**: Organize records into categories (*Personal*, *Job Applications*, *Academic*).
- **Fast Search & 1-Click Copy**: Quick search bar in the popup with instant clipboard copying.

### 2. 📄 Multi-Resume & Document Management
- Upload multiple resumes, cover letters, certificates, and portfolio files.
- Assign friendly display names (e.g., *Backend Resume*, *Full Stack Resume*, *AI/ML Resume*).
- Preserves original filenames, MIME types, and file sizes in browser-local `IndexedDB`.
- **Intelligent File Input Detection**: Detects file upload fields (e.g. `"Upload Your CV"`, `"Attach Resume"`) and presents your saved resumes. Attaches chosen files to `<input type="file">` using the standard browser `DataTransfer` API.
- Download, rename, replace, or delete documents anytime.

### 3. 🎯 Intelligent Matching Engine & Auto-Enabled Aliases
- **Signal Extraction**: Inspects `<label>`, `aria-label`, `aria-labelledby`, `placeholder`, `name`, `id`, `autocomplete`, input `type`, and surrounding section headings.
- **Normalizer**: Cleans camelCase/snake_case (`firstName` &rarr; `first name`), strips punctuation/symbols, removes filler words (`enter your`, `required`, `*`), and protects brand names (`GitHub`, `LinkedIn`).
- **Priority Ladder**:
  1. **Exact Key Match** (100% confidence)
  2. **Custom User Aliases** (95% confidence)
  3. **Built-in Aliases** (90% confidence)
  4. **HTML Autocomplete Tokens** (85% confidence, e.g. `given-name`, `family-name`)
  5. **Semantic Similarity** (75% confidence)
  6. **Document Category Match** (90% confidence for file inputs)
- **Auto-Enabled Suggested Aliases**: When creating a field (like `Surname` or `Last Name`), common variations (`Family Name`, `LastName`, `Second Name`) are **automatically enabled and mapped** by default. Users can toggle individual aliases on/off with one click.

### 4. 💬 In-Page Shadow-DOM Suggestion Tooltip
- Appears floating near the active input when clicked or focused.
- **Shadow DOM Encapsulated**: Webpage stylesheets (Bootstrap, Tailwind, custom CSS resets) cannot distort the suggestion card, and extension styles never pollute the webpage.
- Displays candidate values/documents, matching reason, and confidence.
- Keyboard accessible (`Tab`, `Escape`, `Enter`).
- **Autofill Form Action**: 1-click batch autofill for all recognized fields in the form.
- **Dismiss & Correction**: Dismiss suggestions without repeated popups, or map custom aliases right from the interface.

### 5. 🛡️ Security & Privacy Floors
- **Zero Cloud / Zero External API**: 100% on-device operation. No remote servers, analytics, or external AI APIs.
- **Password Exclusion**: `<input type="password">` fields are NEVER read, matched, or autofilled.
- **No Auto-Submit**: SmartForm never automatically triggers `form.submit()`.
- **Non-Empty Protection**: Configurable option to prevent overwriting existing inputs without user consent.
- **Backup Export & Restore**: Export offline JSON backups (with optional document data) and restore on other browsers, complete with sensitive data security warnings.

---

## 🏗️ Technical Architecture

| Component | Technology | Responsibility |
| :--- | :--- | :--- |
| **Popup UI** | React 18 + Tailwind CSS | Quick form detection summary, 1-click page fill, search & copy vault |
| **Management Dashboard** | React 18 + Tailwind CSS | Full-page vault: fields, multiple values, resume upload, alias manager, settings & backups |
| **Content Script** | TypeScript (Standalone IIFE) | DOM field scanner, MutationObserver (SPAs), Shadow-DOM tooltip, input/file injector |
| **Background Service Worker** | TypeScript (Manifest V3) | Single-source-of-truth coordinator, context menus, live vault update broadcast |
| **Vault Storage** | Native `IndexedDB` + `chrome.storage.local` | Zero-dependency persistent storage for structured fields and base64 file blobs |
| **Matching Engine** | Pure TypeScript | Standalone, deterministic matcher & normalizer (100% unit-tested with Vitest) |

---

## 📁 Project Structure

```
SmartForm/
├── public/
│   ├── manifest.json         # Chrome Extension Manifest V3 configuration
│   └── icons/                # Extension icon assets (16px, 48px, 128px)
├── src/
│   ├── types/                # Core TypeScript interfaces & models
│   ├── engine/               # Pure matching engine & alias dictionary
│   │   ├── normalizer.ts     # Label & token cleaner (preserves tech brands)
│   │   ├── aliases.ts        # Built-in alias groups & keyword mappings
│   │   ├── matcher.ts        # Priority-ladder scoring & candidate resolver
│   │   └── __tests__/        # 14 Vitest unit tests
│   ├── storage/              # Local persistence layer
│   │   ├── db.ts             # IndexedDB & chrome.storage coordinator with auto-notify
│   │   └── backup.ts         # JSON backup export and restore with validation
│   ├── content/              # Webpage content script
│   │   ├── detector.ts       # DOM scanner & signal extractor
│   │   ├── injector.ts       # React/Vue synthetic event & DataTransfer file injector
│   │   ├── tooltip.ts        # Shadow-DOM floating suggestion UI
│   │   └── index.ts          # Live vault sync, MutationObserver, and messaging
│   ├── background/           # Service worker (single source of truth & context menus)
│   ├── popup/                # Popup interface (Quick fill, search & copy)
│   └── options/              # Full-page Management Dashboard tabs:
│       ├── PersonalFieldsTab.tsx
│       ├── DocumentsTab.tsx
│       ├── AliasesTab.tsx
│       └── SettingsBackupTab.tsx
├── popup.html                # Extension popup entry point
├── options.html              # Management Dashboard entry point
├── test-form.html            # Realistic job application test page with dynamic SPAs
├── build.js                  # Production build script generating self-contained IIFE
├── vite.config.ts            # Vite & Tailwind compilation configuration
└── package.json              # Scripts & dependencies
```

---

## 🚀 Getting Started

### Prerequisites
- **Node.js** (v18 or higher)
- **npm** (v9 or higher)

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Unit Tests
```bash
npm test
```
Runs the 14 Vitest test cases covering text normalization, alias variations, priority ladder matching, file input resolution, and password safety exclusion.

### 3. Build for Chrome / Edge / Brave
```bash
npm run build
```
This compiles all TypeScript, React components, CSS, and content scripts into the production-ready [`dist/`](./dist) directory.

---

## 📦 Loading the Extension into Your Browser

1. Open your Chromium browser and navigate to the extensions page:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
2. Enable **Developer mode** (toggle switch in the top-right corner).
3. Click the **Load unpacked** button in the top-left toolbar.
4. Select the **`dist`** folder inside this project (`<path>/SmartForm/dist`).
5. The **SmartForm - Local-First Autofill** extension will now be loaded!

> [!IMPORTANT]
> **Testing with local HTML files (`file:///...`):**
> If you test forms opened directly from your file system (such as `dist/test-form.html`), Chrome requires file access permission:
> 1. In `chrome://extensions`, click **Details** on the SmartForm card.
> 2. Toggle **ON** the option: **"Allow access to file URLs"**.

---

## 🧪 Testing with the Included Demo Form

A comprehensive job application form is included in the project to test all autofill capabilities:

1. Open [`dist/test-form.html`](./dist/test-form.html) in your browser.
2. The page includes:
   - **First Name** &rarr; Exact match (`First Name`)
   - **Family Name** &rarr; Alias match (`Surname` &rarr; `Family Name`)
   - **Email Address** &rarr; Semantic match showing multiple candidate values (*Personal* vs. *Work*)
   - **Mobile Phone Number** &rarr; Alias match (`Phone`)
   - **LinkedIn Profile URL** &rarr; Exact/Semantic match
   - **GitHub Profile URL** &rarr; Semantic match
   - **Upload Your CV / Resume** &rarr; Document category match (`Resume`) listing your saved resumes
   - **Attach Cover Letter** &rarr; Document category match (`Cover Letter`)
   - **Create Portal Password** &rarr; Password input strictly excluded and untouched
   - **Simulate Dynamically Rendered Field** &rarr; Injects new fields via JavaScript to test `MutationObserver`
3. Click into any input to see the in-page **SmartForm suggestion bubble**, or click the SmartForm icon in your browser toolbar to run **Autofill Page** with one click.

---

## 🔒 Privacy & Permissions

SmartForm requires only the following minimal permissions in Manifest V3:

- **`storage`**: Allows saving lightweight user preferences and sync flags in `chrome.storage.local`.
- **`activeTab`**: Allows the extension popup to scan form fields on the active tab upon user click.
- **`contextMenus`**: Adds right-click shortcuts (*"SmartForm: Autofill this form"* and *"SmartForm: Open Vault & Documents"*).

**No host permissions or remote server connections are requested.** All personal records and documents remain safely on your computer.

---

## 📄 License

MIT License. Free and open source for personal and commercial use.
