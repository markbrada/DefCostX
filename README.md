# DefCost 4.0.0

DefCost 4.0.0 is a clean-room rebuild of Workplace Defender's browser-based quoting tool. It provides a modern ES6 module architecture, resilient local persistence, CSV interoperability, and a refreshed user interface inspired by DefCost 3.0.10.

## Overview

* Build detailed quotes across multiple sections with drag-and-drop ordering, parent/child nesting, and inline notes.
* Apply global discounts or target a grand total with automatic GST calculations and rounding.
* Import and export CSV files that round-trip safely, including section notes and child items.
* Browse the floating catalogue with keyboard shortcuts, All Tabs mode, and persistent window state.
* Toggle dark mode, undo failed imports, and keep everything saved automatically to the browser.

## File Layout

```
index.html            # Root HTML shell, script loading, global layout
css/style.css         # Application styling, light/dark themes, layout for all panels
js/utils.js           # Shared helpers: DOM utilities, formatting, event bus, keyboard shortcuts
js/calc.js            # Calculation helpers for line totals, section totals, discounts, and GST
js/storage.js         # LocalStorage persistence, snapshot/restore, CSV import/export helpers
js/ui.js              # Declarative UI rendering and event binding for quote builder + totals
js/catalogue.js       # Floating catalogue window, search, All Tabs switch, drag/resize logic
js/main.js            # Application bootstrap, state management, module orchestration
xlsx.full.min.js      # SheetJS runtime for CSV/Excel operations
```

## Key Features

* Section pill tabs with inline rename, uniqueness enforcement, and close controls.
* Quote table with quantity steppers, price inputs, sortable rows, and section notes.
* Totals panel summarising GST, discount %, and grand totals with bi-directional sync.
* CSV exporter/importer with strict headers, notes rows, and duplicate section resolution.
* macOS-style floating catalogue window with persistent position/size, Cmd/Ctrl+K toggle, search hints, and All Tabs mode.
* Dark/light theme toggle with stored preference.

## Do Not Break Rules

* CSV column order must remain: `Section, Item, Quantity, Price, Line Total`.
* LocalStorage keys are `defcost_basket_v2` for quotes and `defcost_catalogue_state` for catalogue UI state.
* Preserve numeric rounding logic (`roundCurrency`) to avoid drift and maintain GST accuracy.

## Versioning

This release is tagged as **DefCost 4.0.0**. Increment the minor/patch version in both the `<title>` element and header badge for subsequent updates.

## Screenshot

The interface follows the layout of DefCost 3.0.10. Capture updated screenshots when visual changes are introduced and link them here.
