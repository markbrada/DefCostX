# DefCost 4.0.0

DefCost 4.0.0 is a ground-up rebuild of Workplace Defender's browser-based quoting tool using modern ES6 modules. The application mirrors the DefCost 3.0.10 layout with a refreshed codebase that runs natively on GitHub Pages without any build tooling.

## Overview
- **Quote Builder** with draggable rows, section tabs, inline editing and section notes.
- **Totals panel** that keeps discount percentage and grand total in sync while calculating GST.
- **Floating catalogue window** with keyboard shortcuts, search, All Tabs toggle, and persistent window state.
- **Dark mode** toggle stored per user.
- **CSV import/export** compatible with spreadsheet workflows via SheetJS.

## File layout
```
index.html            # Entry page wiring third-party libraries and modules
css/style.css         # Core styling, layout, and dark mode theming
js/main.js            # Application bootstrap, event wiring, state orchestration
js/ui.js              # UI controller rendering header, quote table, tabs, totals
js/storage.js         # LocalStorage persistence, backups, CSV import/export helpers
js/calc.js            # Business logic for line totals, discounts, GST calculations
js/catalogue.js       # Floating catalogue window controller and search filtering
js/utils.js           # Shared helpers, event bus, formatting, keybindings, theme support
```

## Key features
- Case-insensitive section name validation with inline toasts.
- Parent/child line items with captured catalogue additions as sub-items.
- Undo safeguard for failed CSV imports.
- Cmd/Ctrl + K toggles the catalogue and focuses search.
- Persisted preferences: basket, catalogue window state, dark mode, sub-item capture.

## Do Not Break
- **CSV columns:** `Section, Item, Quantity, Price, Line Total` in that order for export/import.
- **Storage keys:** `defcost_basket_v2`, `defcost_catalogue_state`, `defcost_theme`, `defcost_capture_child`.

## Versioning
- Current release: **4.0.0**
- Reference screenshot: DefCost 3.0.10 (for visual parity).

## Screenshot
Link to provided reference screenshot (DefCost 3.0.10) from the project brief.
