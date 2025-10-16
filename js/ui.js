import { qs, createEl, formatCurrency, roundCurrency } from './utils.js';
import { lineTotal } from './calc.js';

const app = {
  sectionTabs: qs('#section-tabs'),
  tableWrapper: qs('#quote-table-wrapper'),
  totalsPanel: qs('#totals-panel'),
  statusLine: qs('#status-line'),
  modalRoot: qs('#modal-root'),
  toastRoot: qs('#toast-root'),
};

let handlers = {};
let activeSectionId = null;
let captureChildren = false;

const setupUI = (options = {}) => {
  handlers = options;
  bindSectionEvents();
  bindToolbar();
  bindTotalsPanel();
  bindDarkToggle();
};

const bindSectionEvents = () => {
  app.sectionTabs.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tab-id]');
    if (!button) return;
    const id = button.getAttribute('data-tab-id');
    handlers.onSelectSection?.(id);
  });

  app.sectionTabs.addEventListener('click', (event) => {
    const close = event.target.closest('button[data-close-tab]');
    if (!close) return;
    event.stopPropagation();
    const id = close.getAttribute('data-close-tab');
    handlers.onRemoveSection?.(id);
  });

  app.sectionTabs.addEventListener('dblclick', (event) => {
    const tab = event.target.closest('[data-tab-id]');
    if (!tab) return;
    startTabRename(tab.getAttribute('data-tab-id'));
  });
};

const bindToolbar = () => {
  qs('.toolbar').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    switch (action) {
      case 'add-section':
        handlers.onAddSection?.();
        break;
      case 'add-custom-line':
        handlers.onAddCustomLine?.(captureChildren);
        break;
      case 'delete-quote':
        handlers.onDeleteQuote?.();
        break;
      case 'import-csv':
        handlers.onImportCSV?.();
        break;
      case 'export-csv':
        handlers.onExportCSV?.();
        break;
      default:
        break;
    }
  });
};

const bindTotalsPanel = () => {
  app.totalsPanel.addEventListener('input', (event) => {
    const input = event.target;
    if (!input.matches('[data-total-input]')) return;
    const field = input.dataset.totalInput;
    const value = Number.parseFloat(input.value);
    if (field === 'discount') {
      handlers.onDiscountChange?.(value / 100);
    } else if (field === 'grand-ex') {
      handlers.onGrandTotalChange?.(value);
    }
  });
};

const bindDarkToggle = () => {
  const button = qs('#toggle-dark');
  button.addEventListener('click', () => handlers.onToggleDarkMode?.());
};

const renderApp = ({ basket, activeSection, totals }) => {
  activeSectionId = activeSection?.id ?? basket.sections[0]?.id;
  renderSectionTabs(basket.sections, activeSectionId);
  renderQuoteTable(activeSection);
  renderTotals(totals);
};

const renderSectionTabs = (sections, currentId) => {
  const fragment = document.createDocumentFragment();
  sections.forEach((section) => {
    const tab = createEl('button', {
      className: `section-tab${section.id === currentId ? ' active' : ''}`,
    });
    tab.setAttribute('data-tab-id', section.id);

    const label = createEl('span', { textContent: section.title });
    tab.appendChild(label);

    const close = createEl('button', {
      attrs: { 'data-close-tab': section.id, 'aria-label': `Delete ${section.title}` },
      textContent: '×',
    });
    tab.appendChild(close);

    fragment.appendChild(tab);
  });

  const addTab = createEl('button', {
    className: 'section-tab add-tab',
    textContent: '+ Section',
  });
  addTab.addEventListener('click', () => handlers.onAddSection?.());
  fragment.appendChild(addTab);

  app.sectionTabs.innerHTML = '';
  app.sectionTabs.appendChild(fragment);
};

const renderQuoteTable = (section) => {
  if (!section) {
    app.tableWrapper.innerHTML = '<div class="empty-state">No section selected.</div>';
    return;
  }

  const table = createEl('table', { className: 'quote-table' });
  table.innerHTML = `
    <thead>
      <tr>
        <th style="width: 120px">Section</th>
        <th>Item</th>
        <th style="width: 120px">Quantity</th>
        <th style="width: 150px">Price (Ex. GST)</th>
        <th style="width: 160px">Line Total</th>
        <th style="width: 120px">Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector('tbody');
  section.items.forEach((item) => {
    tbody.appendChild(renderItemRow(item, section));
  });

  const notesRow = createEl('tr', { className: 'section-notes' });
  notesRow.innerHTML = `
    <td colspan="6">
      <label>
        <div>Section notes</div>
        <textarea data-section-notes="${section.id}" placeholder="Notes for ${section.title}">${section.notes || ''}</textarea>
      </label>
    </td>
  `;
  tbody.appendChild(notesRow);

  const optionsRow = createEl('div', { className: 'table-options' });
  optionsRow.innerHTML = `
    <label class="capture-switch">
      <input type="checkbox" ${captureChildren ? 'checked' : ''} data-capture-subitems>
      <span>Capture catalogue adds as sub-item</span>
    </label>
  `;

  app.tableWrapper.innerHTML = '';
  app.tableWrapper.appendChild(table);
  app.tableWrapper.appendChild(optionsRow);

  bindTableEvents(tbody, section.id);
  bindCaptureToggle();
  setupSortable(tbody, section.id);
};

const renderItemRow = (item, section) => {
  const row = createEl('tr', {
    className: `quote-row${item.isChild ? ' child-row' : ''}`,
  });
  row.dataset.itemId = item.id;
  row.dataset.sectionId = section.id;

  const sectionCell = createEl('td', { textContent: section.title });
  const itemCell = createEl('td');
  const labelInput = createEl('input', { attrs: { type: 'text', 'data-field': 'label' } });
  labelInput.value = item.label ?? '';
  if (item.sourceTab) {
    labelInput.setAttribute('readonly', 'true');
    labelInput.dataset.locked = 'true';
  }
  itemCell.appendChild(labelInput);
  if (item.code) {
    const codeText = [item.code, item.unit].filter(Boolean).join(' · ');
    const sub = createEl('div', { className: 'subtext', textContent: codeText });
    itemCell.appendChild(sub);
  }

  const qtyCell = createEl('td');
  const qtyWrapper = createEl('div', { className: 'qty-input' });
  const decrement = createEl('button', { attrs: { type: 'button', 'data-step': '-1', 'aria-label': 'Decrease quantity' }, textContent: '−' });
  const qtyInput = createEl('input', { attrs: { type: 'number', step: '1', min: '0', 'data-field': 'qty' } });
  qtyInput.value = Number.isFinite(item.qty) ? item.qty : '';
  const increment = createEl('button', { attrs: { type: 'button', 'data-step': '1', 'aria-label': 'Increase quantity' }, textContent: '+' });
  qtyWrapper.append(decrement, qtyInput, increment);
  qtyCell.appendChild(qtyWrapper);

  const priceCell = createEl('td');
  const priceInput = createEl('input', { attrs: { type: 'number', min: '0', step: '0.01', 'data-field': 'price' } });
  priceInput.value = Number.isFinite(item.price) ? item.price : '';
  priceCell.appendChild(priceInput);

  const totalCell = createEl('td', { className: 'line-total', textContent: formatCurrency(lineTotal(item.qty, item.price)) });

  const actionsCell = createEl('td');
  const controls = createEl('div', { className: 'row-controls' });
  const handle = createEl('span', { className: 'row-handle', textContent: '⋮⋮' });
  handle.setAttribute('aria-hidden', 'true');
  const actions = createEl('div', { className: 'row-actions' });
  const indent = createEl('button', { className: 'indent-toggle', textContent: item.isChild ? 'Outdent' : 'Indent' });
  indent.dataset.toggleChild = 'true';
  const remove = createEl('button', { attrs: { type: 'button', 'aria-label': 'Delete line' }, textContent: '×' });
  remove.dataset.deleteLine = 'true';
  actions.append(indent, remove);
  controls.append(handle, actions);
  actionsCell.appendChild(controls);

  row.append(sectionCell, itemCell, qtyCell, priceCell, totalCell, actionsCell);
  return row;
};

const bindTableEvents = (tbody, sectionId) => {
  tbody.addEventListener('click', (event) => {
    const stepper = event.target.closest('button[data-step]');
    if (stepper) {
      const row = event.target.closest('tr.quote-row');
      if (!row) return;
      const input = row.querySelector('input[data-field="qty"]');
      const delta = Number(stepper.dataset.step);
      const current = Number.parseFloat(input.value) || 0;
      const next = Math.max(0, current + delta);
      input.value = next;
      handlers.onItemFieldChange?.(sectionId, row.dataset.itemId, 'qty', next);
      return;
    }

    const toggle = event.target.closest('[data-toggle-child]');
    if (toggle) {
      const row = event.target.closest('tr.quote-row');
      handlers.onToggleChild?.(sectionId, row.dataset.itemId);
      return;
    }

    const remove = event.target.closest('[data-delete-line]');
    if (remove) {
      const row = event.target.closest('tr.quote-row');
      handlers.onDeleteLine?.(sectionId, row.dataset.itemId);
    }
  });

  tbody.addEventListener('input', (event) => {
    const input = event.target.closest('input[data-field], textarea[data-section-notes]');
    if (!input) return;
    const row = event.target.closest('tr.quote-row');
    if (input.matches('textarea[data-section-notes]')) {
      handlers.onUpdateNotes?.(sectionId, input.value);
      return;
    }
    if (!row) return;
    const field = input.dataset.field;
    const value = field === 'qty' || field === 'price' ? Number.parseFloat(input.value) : input.value;
    handlers.onItemFieldChange?.(sectionId, row.dataset.itemId, field, value);
  });
};

const bindCaptureToggle = () => {
  const toggle = qs('[data-capture-subitems]', app.tableWrapper);
  if (!toggle) return;
  toggle.addEventListener('change', (event) => {
    captureChildren = event.target.checked;
    handlers.onCaptureToggle?.(captureChildren);
  });
};

const setupSortable = (tbody, sectionId) => {
  if (!globalThis.Sortable) return;
  if (tbody.sortableInstance) {
    tbody.sortableInstance.destroy();
  }
  tbody.sortableInstance = new globalThis.Sortable(tbody, {
    handle: '.row-handle',
    animation: 150,
    filter: 'textarea',
    draggable: 'tr.quote-row',
    onEnd: (evt) => {
      if (evt.item.dataset.itemId) {
        handlers.onReorder?.(sectionId, Array.from(tbody.querySelectorAll('tr.quote-row')).map((row) => row.dataset.itemId));
      }
    },
  });
};

const renderTotals = (totals) => {
  if (!totals) {
    app.totalsPanel.innerHTML = '';
    return;
  }
  app.totalsPanel.innerHTML = `
    <h2>Totals</h2>
    <table class="totals-table">
      <tbody>
        <tr>
          <td>Total (Ex. GST)</td>
          <td>${formatCurrency(totals.sectionsEx)}</td>
        </tr>
        <tr>
          <td>
            <label>
              Discount (%)
              <input type="number" min="0" max="99" step="0.1" value="${roundCurrency(totals.discountPct * 100)}" data-total-input="discount">
            </label>
          </td>
          <td>
            <label>
              Grand Total (Ex. GST)
              <input type="number" min="0" step="0.01" value="${roundCurrency(totals.discountedEx)}" data-total-input="grand-ex">
            </label>
          </td>
        </tr>
        <tr>
          <td>GST (10%)</td>
          <td>${formatCurrency(totals.gst)}</td>
        </tr>
        <tr>
          <td>Grand Total (Incl. GST)</td>
          <td>${formatCurrency(totals.grandIncl)}</td>
        </tr>
      </tbody>
    </table>
  `;
};

const startTabRename = (sectionId) => {
  const tab = app.sectionTabs.querySelector(`[data-tab-id="${sectionId}"]`);
  if (!tab) return;
  const currentTitle = tab.querySelector('span').textContent;
  tab.innerHTML = '';
  const input = createEl('input', { attrs: { type: 'text', value: currentTitle } });
  tab.appendChild(input);
  input.focus();
  input.select();

  const commit = () => {
    handlers.onRenameSection?.(sectionId, input.value.trim());
  };

  input.addEventListener('blur', commit, { once: true });
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      renderSectionTabs(handlers.getSections?.(), sectionId);
    }
  });
};

const setStatus = (message) => {
  app.statusLine.textContent = message || '';
};

const showModal = ({ title, message, actions = [] }) => {
  app.modalRoot.innerHTML = '';
  const overlay = createEl('div', { className: 'modal-overlay' });
  const modal = createEl('div', { className: 'modal' });
  modal.innerHTML = `
    <h3>${title}</h3>
    <div class="modal-body">${message}</div>
  `;
  const footer = createEl('div', { className: 'modal-actions' });
  actions.forEach(({ label, variant = 'default', handler }) => {
    const button = createEl('button', { className: `btn ${variant === 'danger' ? 'btn-danger' : ''}`, textContent: label });
    button.addEventListener('click', () => {
      handler?.();
      closeModal();
    });
    footer.appendChild(button);
  });
  modal.appendChild(footer);
  overlay.appendChild(modal);
  app.modalRoot.appendChild(overlay);
};

const closeModal = () => {
  app.modalRoot.innerHTML = '';
};

const showToast = (message, { variant = 'info', timeout = 2800 } = {}) => {
  const toast = createEl('div', { className: `toast toast-${variant}`, textContent: message });
  app.toastRoot.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, timeout);
};

const clearToast = () => {
  app.toastRoot.innerHTML = '';
};

const getCaptureMode = () => captureChildren;

export {
  setupUI,
  renderApp,
  renderSectionTabs,
  renderTotals,
  setStatus,
  showModal,
  closeModal,
  showToast,
  clearToast,
  getCaptureMode,
};
