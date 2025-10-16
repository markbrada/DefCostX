# AGENTS.md – DefCost Project

## Overview
This project uses **AI-assisted development (Codex)** to maintain and improve the **DefCost** quoting system — a browser-based tool for Workplace Defender that loads Excel price lists, allows adding catalogue items to a quote, and exports/imports CSVs.  
Since version **3.0.6**, the system runs on a **hybrid modular JavaScript architecture** (ES6 modules with a shared global namespace `window.DefCost`).

---

## Active Agent: `DefCost-UI`

**Role:**  
Implement and optimise the front-end quoting interface, including:
- Table layouts, totals logic, and discount synchronisation  
- Catalogue window behaviour (open/close, drag, resize, dock)  
- UI polish and dark-mode styling  
- CSV import/export workflow and modal feedback (Import Summary, Undo)

**Focus Areas:**  
HTML, TailwindCSS, and JavaScript logic directly related to:
- Quote building and section handling  
- Catalogue rendering  
- CSV data integrity and persistence  

**Constraints:**
- Preserve existing localStorage keys (`defcost_basket_v2`, `defcost_catalogue_state`)  
- Maintain responsive layout and dark-mode compatibility  
- Keep export logic (`exportCSV`, `exportBasketToCsv`, and future Excel export) untouched unless requested  
- Maintain section note persistence (`notes` field on each section stored in `defcost_basket_v2`)  
- Maintain the `window.DefCost` namespace until full ES6 modularisation is complete  

---

## Current Architecture

### JavaScript Modules
All core logic lives in the `/js/` folder:

| File | Responsibility |
|------|----------------|
| **main.js** | App bootstrap, event wiring, and orchestration. |
| **ui.js** | Rendering (quote table, sections, modals, toasts) and UI helpers. |
| **storage.js** | LocalStorage, CSV import/export, and backup/undo management. |
| **calc.js** | Totals, rounding, and GST/discount calculations. |
| **catalogue.js** | Floating catalogue window behaviour (open/close, persist state). |

### Global Namespace
The app still exposes a shared global object for compatibility:
```js
window.DefCost = {
  state: {},
  api: {},        // cross-module functions
  ui: {},         // UI utilities
  catalogue: {}   // catalogue controls
};
```
Codex may continue to reference these globals for coordination until a full ES6 import/export architecture (DefCost 4.x.x).

---

## CSS Architecture (3.0.11+)

- `/css/style.css` is the single source for layout, spacing, borders, typography, and colour tokens.
- `index.html` must reference these styles via classes/IDs; avoid reintroducing inline `style` attributes.
- Dark/light theming relies on CSS variables with `.light` applied to `<body>` for the light variant (dark is default when `.light` is absent).
- When editing UI or HTML, keep the class hooks in sync with `/css/style.css` so components remain pixel-perfect.

---

## Design System / visual layer (3.1.0+)

- The UI is driven by the design tokens `color-primary`, `color-surface`, `color-muted`, `spacing-unit`, `shadow-base`, and `radius-base`.
- Layout containers: `.page-heading`, `.quote-shell`, `.quote-shell__body`, `.quote-shell__summary`, and `.quote-summary-card` define the new grid pairing for basket + totals.
- Buttons use the shared `.btn` family with variants (`.btn-primary`, `.btn-tonal`, `.btn-outline`, `.btn-danger`, `.btn-ghost`). Keep token-driven colours/hover states intact.
- Section tabs and catalogue sheet tabs are pill-like segmented controls; preserve the DOM hooks (`.section-tab`, `#sheetTabs button`) and their focus/hover behaviour.
- Tables rely on the `col-*` width classes plus `grand-totals-wrapper` for JS toggling—do not remove these hooks when restyling.
- Catalogue window, modals, search controls, and import summary cards share the same surface/border/shadow tokens for dark/light parity.

---

## Versioning Rules

Codex must update the **displayed project version** in both the UI header and `README.md` whenever a patch is applied.  
Example:
```
DefCost 3.0.6 → DefCost 3.0.7 (bug fix)
DefCost 3.1.0 → DefCost 3.2.0 (new feature)
DefCost 4.0.0 → Major rework or full modularisation
```

### Version Naming Convention
| Type | Description | Example |
|-------|--------------|----------|
| **Major (X.0)** | Structural overhaul or new system | 4.0.0 |
| **Minor (X.Y)** | New feature or workflow improvement | 3.1.0 |
| **Patch (X.Y.Z)** | Bug fix or small UI adjustment | 3.0.7 |

---

## Development Guidelines

1. **Pull the latest `main` branch** before editing `index.html` or any `/js` module.  
2. **Backup** `index.html` and `/js/main.js` before large modifications.  
3. Keep all commits **phase-based** and scoped to a clear functional block (≤300 lines recommended).  
4. After every edit, **update version strings** in:
   - `index.html` header and `<title>`  
   - `README.md` (Versioning section)  
   - Commit message and changelog line  
5. Maintain **semantic versioning** consistency between UI and repo tags/releases.  
6. Document all **localStorage or data schema** updates explicitly.  
7. If Codex hits time limits on large refactors, break the task into sequential phases (e.g. 3.0.4 → 3.0.5 → 3.0.6).  
8. Always verify:
   - CSV import/export integrity  
   - Quote total accuracy  
   - Section/sub-item persistence  
   - Catalogue open/close state retention  
