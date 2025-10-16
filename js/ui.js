import { bus, formatCompactCurrency, formatCurrency, loadTheme, qs, qsa, safeFocus, toggleTheme } from './utils.js';
import { computeQuoteTotals, lineTotal } from './calc.js';

const template = () => `
  <header class="app-header">
    <div class="app-header__title">
      <span>Workplace Defender</span>
      <span>DefCost 4.0.0</span>
      <span class="badge-version">v4.0.0</span>
    </div>
    <button class="btn" data-action="toggle-theme">Toggle Dark Mode</button>
  </header>
  <main class="main-content" data-role="main"></main>
  <div class="toast-stack" aria-live="polite"></div>
`;

const quotePanelTemplate = () => `
  <section class="quote-panel" data-role="quote">
    <div class="quote-panel__header">
      <h1 style="font-size:1.25rem;font-weight:700;">Quote Builder</h1>
      <div class="quote-panel__toolbar" data-role="toolbar">
        <button class="btn btn-danger" data-action="delete-quote">Delete quote</button>
        <button class="btn" data-action="add-custom-line">Add custom line</button>
        <button class="btn" data-action="add-section">+ Section</button>
        <button class="btn" data-action="import-csv">Import CSV</button>
        <button class="btn" data-action="export-csv">Export CSV</button>
      </div>
    </div>
    <div class="status-line" data-role="status"></div>
    <nav class="section-tabs" data-role="section-tabs"></nav>
    <div class="quote-table-wrapper">
      <table class="quote-table">
        <thead>
          <tr>
            <th>Section</th>
            <th>Item</th>
            <th>Quantity</th>
            <th>Price (Ex. GST)</th>
            <th>Line Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody data-role="quote-body"></tbody>
      </table>
    </div>
  </section>
`;

const totalsTemplate = () => `
  <aside class="totals-panel" data-role="totals">
    <header style="display:flex;justify-content:space-between;align-items:center;">
      <h2 style="margin:0;font-size:1rem;font-weight:700;">Totals</h2>
      <label style="font-size:0.8rem;display:flex;align-items:center;gap:8px;">
        <input type="checkbox" data-role="capture-subitems" />
        Capture catalogue adds as sub-item
      </label>
    </header>
    <table>
      <tbody>
        <tr>
          <td>Total (Ex. GST)</td>
          <td data-field="total-ex"></td>
        </tr>
        <tr>
          <td>
            Discount (%)
          </td>
          <td>
            <input type="number" step="0.01" min="0" max="100" data-field="discount-pct" />
          </td>
        </tr>
        <tr>
          <td>Grand Total (Ex. GST)</td>
          <td>
            <input type="number" step="0.01" min="0" data-field="grand-total-ex" />
          </td>
        </tr>
        <tr>
          <td>GST (10%)</td>
          <td data-field="gst"></td>
        </tr>
        <tr>
          <td>Grand Total (Incl. GST)</td>
          <td data-field="grand-incl"></td>
        </tr>
      </tbody>
    </table>
  </aside>
`;

const notesRow = (section) => `
  <tr class="section-notes-row">
    <td colspan="6">
      <label style="display:grid;gap:6px;">
        <span style="font-size:0.8rem;color:var(--text-muted);">Section notes</span>
        <textarea data-role="section-notes" data-section-id="${section.id}" placeholder="Add section notes…">${section.notes || ''}</textarea>
      </label>
    </td>
  </tr>
`;

const itemRow = (section, item, options = {}) => {
  const { activeSectionId } = options;
  const isActive = section.id === activeSectionId;
  const rowClass = `${item.isChild ? 'child-row' : ''}`;
  const total = lineTotal(item.qty, item.price);
  return `
    <tr class="${rowClass}" data-item-id="${item.id}" data-section-id="${section.id}">
      <td>${section.title}</td>
      <td>
        <input type="text" data-field="label" value="${item.label || ''}" ${item.sourceTab ? 'readonly' : ''} />
        ${item.sourceTab ? `<div style="font-size:0.7rem;color:var(--text-muted);">${item.sourceTab}</div>` : ''}
      </td>
      <td>
        <input type="number" min="0" step="0.01" data-field="qty" value="${Number.isFinite(item.qty) ? item.qty : ''}" />
      </td>
      <td>
        <input type="number" min="0" step="0.01" data-field="price" value="${Number.isFinite(item.price) ? item.price : ''}" />
      </td>
      <td data-field="total">${formatCompactCurrency(total)}</td>
      <td>
        <div class="row-controls">
          <span class="row-handle" title="Drag to reorder" aria-hidden="true">⋮⋮</span>
          <button class="btn btn-ghost" data-action="toggle-child" title="Toggle sub-item">⇥</button>
          <button class="row-delete" data-action="delete-line" title="Remove">×</button>
        </div>
      </td>
    </tr>
  `;
};

export class UIController {
  constructor(root) {
    this.root = root;
    this.root.innerHTML = template();
    this.main = qs('[data-role="main"]', this.root);
    this.toasts = qs('.toast-stack', this.root);
    this.quotePanel = null;
    this.quoteBody = null;
    this.totalsPanel = null;
    this.state = null;
    this.mount();
    this.bindHeader();
  }

  mount() {
    this.main.innerHTML = `${quotePanelTemplate()}${totalsTemplate()}`;
    this.quotePanel = qs('[data-role="quote"]', this.main);
    this.quoteBody = qs('[data-role="quote-body"]', this.quotePanel);
    this.sectionTabs = qs('[data-role="section-tabs"]', this.quotePanel);
    this.statusLine = qs('[data-role="status"]', this.quotePanel);
    this.toolbar = qs('[data-role="toolbar"]', this.quotePanel);
    this.totalsPanel = qs('[data-role="totals"]', this.main);
    this.captureToggle = qs('[data-role="capture-subitems"]', this.totalsPanel);
    this.discountInput = qs('[data-field="discount-pct"]', this.totalsPanel);
    this.grandInput = qs('[data-field="grand-total-ex"]', this.totalsPanel);
    this.totalEx = qs('[data-field="total-ex"]', this.totalsPanel);
    this.gstField = qs('[data-field="gst"]', this.totalsPanel);
    this.grandIncl = qs('[data-field="grand-incl"]', this.totalsPanel);

    this.bindToolbar();
    this.bindTable();
    this.bindTotals();
  }

  bindHeader() {
    const isDark = loadTheme();
    this.currentThemeDark = isDark;
    this.root.addEventListener('click', (event) => {
      if (event.target.matches('[data-action="toggle-theme"]')) {
        this.currentThemeDark = !this.currentThemeDark;
        toggleTheme(this.currentThemeDark);
      }
    });
  }

  bindToolbar() {
    this.toolbar.addEventListener('click', (event) => {
      const action = event.target.dataset.action;
      if (!action) return;
      bus.emit(`toolbar:${action}`);
    });
  }

  bindTable() {
    this.sectionTabs.addEventListener('click', (event) => {
      const tab = event.target.closest('.section-tab');
      if (!tab) return;
      if (event.target.matches('[data-action="remove-section"]')) {
        bus.emit('section:delete', tab.dataset.id);
        return;
      }
      bus.emit('section:activate', tab.dataset.id);
    });

    this.sectionTabs.addEventListener('dblclick', (event) => {
      const tab = event.target.closest('.section-tab');
      if (!tab) return;
      this.promptSectionRename(tab.dataset.id, tab.textContent.trim());
    });

    this.quoteBody.addEventListener('input', (event) => {
      const row = event.target.closest('tr[data-item-id]');
      if (!row) return;
      const itemId = row.dataset.itemId;
      const sectionId = row.dataset.sectionId;
      const field = event.target.dataset.field;
      let value = event.target.value;
      if (field === 'qty' || field === 'price') {
        value = event.target.value === '' ? '' : Number(event.target.value);
      }
      bus.emit('item:update', { sectionId, itemId, field, value });
    });

    this.quoteBody.addEventListener('click', (event) => {
      const row = event.target.closest('tr[data-item-id]');
      if (!row) return;
      const itemId = row.dataset.itemId;
      const sectionId = row.dataset.sectionId;
      if (event.target.matches('[data-action="delete-line"]')) {
        bus.emit('item:delete', { sectionId, itemId });
      }
      if (event.target.matches('[data-action="toggle-child"]')) {
        bus.emit('item:toggle-child', { sectionId, itemId });
      }
    });

    this.quoteBody.addEventListener('change', (event) => {
      if (event.target.matches('[data-role="section-notes"]')) {
        const sectionId = event.target.dataset.sectionId;
        bus.emit('section:update-notes', { sectionId, notes: event.target.value });
      }
    });
  }

  bindTotals() {
    this.captureToggle.addEventListener('change', () => {
      bus.emit('capture:toggle', this.captureToggle.checked);
    });
    this.discountInput.addEventListener('change', () => {
      const value = Number(this.discountInput.value);
      bus.emit('totals:update-discount', value);
    });
    this.grandInput.addEventListener('change', () => {
      const value = Number(this.grandInput.value);
      bus.emit('totals:update-grand', value);
    });
  }

  promptSectionRename(sectionId, current) {
    const modal = document.createElement('div');
    modal.innerHTML = `
      <div class="modal-backdrop" role="presentation"></div>
      <div class="modal" role="dialog" aria-modal="true" aria-labelledby="rename-title">
        <header class="modal__header">
          <h2 id="rename-title">Rename section</h2>
          <button class="btn btn-icon" data-action="close">×</button>
        </header>
        <div class="modal__body">
          <label style="display:grid;gap:6px;">
            <span>Section name</span>
            <input type="text" value="${current}" />
          </label>
        </div>
        <footer class="modal__footer">
          <button class="btn btn-ghost" data-action="close">Cancel</button>
          <button class="btn btn-primary" data-action="confirm">Save</button>
        </footer>
      </div>`;
    document.body.appendChild(modal);
    const input = qs('input', modal);
    safeFocus(input);
    const cleanup = () => modal.remove();
    modal.addEventListener('click', (event) => {
      if (event.target.dataset.action === 'close' || event.target === modal.firstElementChild) {
        cleanup();
      }
      if (event.target.dataset.action === 'confirm') {
        bus.emit('section:rename', { sectionId, title: input.value.trim() });
        cleanup();
      }
    });
  }

  render(appState) {
    this.state = appState;
    this.renderTabs();
    this.renderItems();
    this.renderTotals();
    this.captureToggle.checked = Boolean(appState.captureAsChild);
  }

  renderTabs() {
    const { sections, activeSectionId } = this.state;
    this.sectionTabs.innerHTML = '';
    sections.forEach((section) => {
      const button = document.createElement('button');
      button.className = `section-tab${section.id === activeSectionId ? ' active' : ''}`;
      button.type = 'button';
      button.dataset.id = section.id;
      button.innerHTML = `<span>${section.title}</span><button data-action="remove-section" aria-label="Remove section">×</button>`;
      this.sectionTabs.appendChild(button);
    });
  }

  renderItems() {
    const { sections, activeSectionId } = this.state;
    const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0];
    if (!activeSection) return;
    const rows = activeSection.items.map((item) => itemRow(activeSection, item, { activeSectionId }));
    rows.push(notesRow(activeSection));
    this.quoteBody.innerHTML = rows.join('');
    this.setupSortable();
  }

  setupSortable() {
    if (this.sortable) {
      this.sortable.destroy();
    }
    this.sortable = Sortable.create(this.quoteBody, {
      handle: '.row-handle',
      animation: 160,
      filter: '.section-notes-row',
      onEnd: (evt) => {
        const order = qsa('tr[data-item-id]', this.quoteBody).map((row) => row.dataset.itemId);
        bus.emit('items:reorder', order);
      }
    });
  }

  renderTotals() {
    const totals = computeQuoteTotals({ sections: this.state.sections, discountPct: this.state.discountPct });
    this.totalEx.textContent = formatCurrency(totals.totalEx);
    this.discountInput.value = totals.discountPct;
    this.grandInput.value = totals.discountedEx;
    this.gstField.textContent = formatCurrency(totals.gst);
    this.grandIncl.textContent = formatCurrency(totals.grandIncl);
  }

  setStatus(message) {
    this.statusLine.textContent = message || '';
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.toasts.appendChild(toast);
    window.setTimeout(() => toast.remove(), 3200);
  }
}

export const initUI = (root) => new UIController(root);
