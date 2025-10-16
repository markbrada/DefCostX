# DefCost – Workplace Defender Pricing Tool

DefCost is a browser-based estimating and quoting tool for **Workplace Defender**.  
It loads an Excel workbook of products and services and lets estimators build quotes structured into **Sections**, with support for **sub-items**, drag-reorder, per-section notes, and CSV import/export.

---

## Tech Stack

- Pure **HTML / CSS / Vanilla JavaScript** (modular **ES6**, see `/js/`)
- Hosted on **GitHub Pages**
- Libraries  
  - **SheetJS** (`xlsx.full.min.js`) – Excel parsing  
  - **SortableJS** – drag-and-drop ordering
- Data source: **`Defender Price List.xlsx`** (must be in repo root)
- Persistence: **localStorage** key `defcost_basket_v2`
- Locale: **AUD**, **GST 10 %**
- Dark mode supported

---

## Core Features

### Quote Builder (primary workspace)

- **Sections** – create, rename, delete; one **active** section at a time  
- **Items** – add from catalog or custom; quantity, unit price, line totals (Ex. GST)  
- **Sub-items** – optional nested lines that roll up into the parent and section totals  
- **Section notes** – dedicated notes field stored alongside each section in localStorage  
- **Reorder** – drag-and-drop for items (and keep sub-items with their parent)  
- **Totals**
  - Right-aligned summary table (beneath the active section) lists **Total (Ex. GST)**, **Discount %**, **Grand Total (Ex. GST)**, **GST (10 %)**, **Grand Total (Incl. GST)**
  - Discount % and Grand Total inputs stay in sync  
- **CSV export/import** – section-aware, includes grand totals and per-section notes  
- **Clipboard** – click any non-input cell to copy its text  
- **Sticky header** – stable sizing with `scrollbar-gutter: stable`

### Catalogue (floating utility window)

- **Excel-driven** data rendered from the included workbook tabs  
- **Search** – keyword filtering per sheet with highlight on matches  
- **Click-to-copy** – quickly copies values for use in the Quote Builder  
- **Add buttons** – send catalogue items straight into the active section  
- **Window controls** – drag, minimise to dock icon, or toggle full-screen view  
- **Dark-mode aware** so the window matches the active theme

---

## Totals Logic

- **Line Total** = `qty × price` (Ex. GST)  
- **Section Ex. GST subtotal** = sum of parent + sub-items in that section  
- **Discounted Grand Total (Ex. GST)** = `Section Ex. GST subtotal × (1 − Discount %)`  
- **GST (10 %)** = `Discounted Grand Total × 0.10`  
- **Grand Total (Incl. GST)** = `Discounted Grand Total + GST`

---

## File Layout

```
index.html                 # Main HTML shell, loads modules under /js
/js/                       # JavaScript modules
  main.js                  # App bootstrap and event wiring
  ui.js                    # Rendering and UI helpers
  storage.js               # localStorage, CSV import/export, backups
  calc.js                  # Totals, rounding, currency logic
  catalogue.js             # Floating catalogue window behaviour
xlsx.full.min.js           # SheetJS (local fallback)
Defender Price List.xlsx   # Workbook loaded by the app
Defender.jpeg              # Brand image / logo
```

---

## Do Not Break

- **Workbook loading** path or filename  
- **localStorage schema** and key `defcost_basket_v2`  
- **Sections** structure and item ↔ sub-item relationships  
- **Sticky header** layout (do not move padding/borders from sticky wrapper)  
- **CSV export** shape and ordering  
- **Clipboard copy** behaviour  
- **Dark mode** toggle  
- **Global namespace** `window.DefCost` must remain until fully ES6-scoped  

---

## Current Status

- Implemented: **Sections, sub-items, and per-section notes** with persistence
- Implemented: **Quote Builder** as main workspace
- Implemented: **Catalogue** in floating macOS-style window
- Implemented: **Window controls** (delete quote modal, minimise, dock icon, full-screen toggle)
- Implemented: **Import Summary modal** and Undo system after CSV import
- Implemented: **Hybrid modular JS architecture** (main, ui, storage, calc, catalogue)

---

## Design System / tokens / visual layer

- New design tokens anchor the interface: `color-primary`, `color-surface`, `color-muted`, `spacing-unit`, `shadow-base`, `radius-base`.
- Buttons, inputs, textareas, cards, and tabs all inherit the token palette for consistent dark/light rendering.
- Quote Builder now uses a responsive grid to pair the basket with the totals card and maintain even spacing.
- Section tabs and catalogue sheet tabs present as pill-shaped segmented controls with hover/focus transitions.
- Shared rounded corners (`radius-base`) and soft elevation (`shadow-base`) unify cards, modals, and floating windows.
- Subtle motion on hover/focus keeps interactions smooth without altering existing behaviour.

---

## 3.1.0 – Sleek visual redesign (phase 1)

- Introduced cohesive design tokens and refreshed the entire visual layer for light/dark mode parity.
- Modernised Quote Builder layout with a grid shell, elevated totals card, and pill-style section tabs.
- Restyled buttons, inputs, textarea, and catalogue window with shared hover/focus transitions.
- Tuned table column widths and alignments for the rebuilt quote/totals presentation.

---

## 3.0.11 – CSS architecture introduced

- Added `/css/style.css` as the single design layer for layout, spacing, and colour tokens.
- Refactored `index.html` to remove inline styles in favour of reusable class hooks.
- Maintained pixel-perfect parity with 3.0.10 — no behavioural or visual changes.
- Dark mode toggle now switches the `.light` class on `<body>`.

---

## Versioning

- **3.1.0** – Sleek visual redesign phase 1 with shared design tokens, rebalanced quote layout, and catalogue restyle.
- **3.0.11** – Technical CSS refactor: moved inline styling to `/css/style.css`, identical UI/behaviour; ensured dark-mode toggle compatibility and table alignment.
- **3.0.10** – Removed redundant ‘Add note sub-item’ button; streamlined sub-item creation via ‘Capture catalogue adds as sub-item’ and ‘Add custom line’.
- **3.0.9** – Added an “All Tabs” catalogue search scope with tab labels plus Enter-to-add and ⌘K / Ctrl+K catalogue shortcuts.
- **3.0.8** – Fixed zero-quantity rows being counted as 1; qty=0 now contributes 0 to all totals and CSV round-trips correctly.
- **3.0.7** – Prevented duplicate Section names (case-insensitive) to maintain clean CSV import/export integrity.
- **3.0.6** – Hybrid modularisation C: Minimal catalogue module (open/close/state persistence). No functional changes.
- **3.0.5** – Hybrid modularisation B: Moved renderBasket into /ui.js. No functional changes.  
- **3.0.4** – Hybrid modularisation A: Introduced global namespace and moved Import Summary modal + toast to /ui.js. No functional changes.  
- **3.0.3** – Split calculation and storage logic into calc.js and storage.js. No behavioural changes.  
- **3.0.2** – Extracted inline JavaScript into /js/main.js. No logic changes.  
- **3.0.1** – Added Import Summary modal after CSV import (with Undo).  
- **3.0.0** – Added CSV Import (restores sections, items, children, notes). Includes backup/undo.  
- **2.0.7** – Fixed CSV header ('Line Total' label) and added Notes rows under each section in CSV export.  
- **2.0.6** – Section selector moved to its own column; children inherit section (read-only).  
- **2.0.5** – Simplified line total header copy and reduced Quote Builder title size.  
- **2.0.4** – Refined section tabs, tightened quote row spacing, refreshed notes + totals styling.  
- **2.0.3** – Hardened the dark mode toggle binding and bumped displayed version.  
- **2.0.2** – Repositioned the quote totals into a dedicated table beneath the sections.  
- **2.0.1** – Fixed merge regression that duplicated the totals sidebar and broke the main script bootstrap.  
- **2.0.0** – Added per-section notes, Ex. GST line totals, and redesigned totals sidebar with synced discount logic.  
- **1.2.0** – Quote Builder moved to the main page; Catalogue lives in the floating window with macOS-style controls.  
- **1.1.1** – Sections UI refinements and bug fixes.  
- **1.1.0** – Introduced Sections and section totals.  
- **1.0.0** – Initial release with basic quoting table and Excel-driven catalogue.

---

## For Codex & AI Editors

When you make feature changes in this repo, keep this README aligned.

1. **Update the version** in this README and in `index.html` (`<title>` + `<h1>`).  
2. Add a concise bullet under **Versioning** describing the change.  
3. Preserve the **Do Not Break** rules (localStorage key, paths, sticky header).  
4. Keep the **CSV export format** and **section/sub-item** relationships intact.  
5. If you change basket or totals logic, confirm Grand Totals = sum of all sections and CSV remains consistent.  
6. Follow phase-based commits for major refactors to avoid timeouts.

---

## Author

Maintained by **markbrada** for [Workplace Defender](https://workplacedefender.com.au)
