import { initUI } from './ui.js';
import { initCatalogue } from './catalogue.js';
import { bus, downloadBlob, keybinder, uniqueId } from './utils.js';
import {
  createEmptyBasket,
  createEmptySection,
  loadBasket,
  loadCatalogueState,
  saveBasket,
  saveCatalogueState,
  snapshotBackup,
  consumeBackup,
  exportBasketToCSV,
  importBasketFromCSV
} from './storage.js';
import { syncGrandTotal } from './calc.js';

const appRoot = document.getElementById('app');
const ui = initUI(appRoot);

let catalogueState = loadCatalogueState();
initCatalogue(document.body, catalogueState);

const initialBasket = loadBasket();

const state = {
  basket: initialBasket,
  activeSectionId: initialBasket.sections[0]?.id || null,
  captureAsChild: window.localStorage.getItem('defcost_capture_child') === 'true'
};

const render = () => {
  ui.render({
    sections: state.basket.sections,
    discountPct: state.basket.discountPct || 0,
    activeSectionId: state.activeSectionId,
    captureAsChild: state.captureAsChild
  });
};

render();

const persist = () => {
  state.basket = saveBasket(state.basket);
};

const findSection = (id) => state.basket.sections.find((section) => section.id === id);
const findSectionIndex = (id) => state.basket.sections.findIndex((section) => section.id === id);

const isSectionTitleUnique = (title, excludeId = null) => {
  const lower = title.trim().toLowerCase();
  return !state.basket.sections.some((section) => section.id !== excludeId && section.title.trim().toLowerCase() === lower);
};

const createNewSectionTitle = () => {
  const base = 'Section';
  let idx = state.basket.sections.length + 1;
  let candidate = `${base} ${idx}`;
  while (!isSectionTitleUnique(candidate)) {
    idx += 1;
    candidate = `${base} ${idx}`;
  }
  return candidate;
};

const addCustomLine = () => {
  const section = findSection(state.activeSectionId) || state.basket.sections[0];
  if (!section) return;
  const item = {
    id: uniqueId('it'),
    parentId: null,
    isChild: false,
    label: 'Custom item',
    code: '',
    unit: '',
    qty: 1,
    price: 0,
    sourceTab: ''
  };
  section.items.push(item);
  persist();
  render();
};

const addSection = () => {
  const title = createNewSectionTitle();
  const section = createEmptySection(title);
  state.basket.sections.push(section);
  state.activeSectionId = section.id;
  persist();
  render();
  ui.showToast(`Added ${title}`);
};

const deleteQuote = () => {
  if (!window.confirm('Delete quote? Make sure you export CSV first.')) return;
  state.basket = createEmptyBasket();
  state.activeSectionId = state.basket.sections[0]?.id || null;
  persist();
  render();
  ui.showToast('Quote cleared.');
};

const deleteSection = (sectionId) => {
  const idx = findSectionIndex(sectionId);
  if (idx === -1) return;
  state.basket.sections.splice(idx, 1);
  if (state.activeSectionId === sectionId) {
    state.activeSectionId = state.basket.sections[idx]?.id || state.basket.sections[idx - 1]?.id || null;
  }
  if (state.basket.sections.length === 0) {
    const section = createEmptySection('Section 1');
    state.basket.sections.push(section);
    state.activeSectionId = section.id;
  }
  persist();
  render();
};

const activateSection = (sectionId) => {
  state.activeSectionId = sectionId;
  render();
};

const renameSection = ({ sectionId, title }) => {
  const trimmed = title.trim();
  if (!trimmed) return;
  if (!isSectionTitleUnique(trimmed, sectionId)) {
    ui.showToast('Section name must be unique (case-insensitive).');
    return;
  }
  const section = findSection(sectionId);
  if (!section) return;
  section.title = trimmed;
  persist();
  render();
};

const updateNotes = ({ sectionId, notes }) => {
  const section = findSection(sectionId);
  if (!section) return;
  section.notes = notes;
  persist();
};

const updateItemField = ({ sectionId, itemId, field, value }) => {
  const section = findSection(sectionId);
  if (!section) return;
  const item = section.items.find((it) => it.id === itemId);
  if (!item) return;
  if (field === 'qty' || field === 'price') {
    item[field] = value === '' ? '' : Math.max(0, Number(value));
  } else {
    item[field] = value;
  }
  persist();
  render();
};

const deleteItem = ({ sectionId, itemId }) => {
  const section = findSection(sectionId);
  if (!section) return;
  const idx = section.items.findIndex((item) => item.id === itemId);
  if (idx === -1) return;
  section.items.splice(idx, 1);
  persist();
  render();
};

const toggleChild = ({ sectionId, itemId }) => {
  const section = findSection(sectionId);
  if (!section) return;
  const item = section.items.find((it) => it.id === itemId);
  if (!item) return;
  item.isChild = !item.isChild;
  persist();
  render();
};

const reorderItems = (order) => {
  const section = findSection(state.activeSectionId);
  if (!section) return;
  const map = new Map(section.items.map((item) => [item.id, item]));
  const reordered = order.map((id) => map.get(id)).filter(Boolean);
  section.items = reordered;
  persist();
  render();
};

const updateDiscount = (discountPct) => {
  state.basket.discountPct = Number.isFinite(discountPct) ? Math.min(Math.max(discountPct, 0), 100) : 0;
  const totals = syncGrandTotal(state.basket, { discountPct: state.basket.discountPct });
  state.basket.discountPct = totals.discountPct;
  state.basket.grandTotalEx = totals.discountedEx;
  persist();
  render();
};

const updateGrandTotal = (grandTotal) => {
  const totals = syncGrandTotal(state.basket, { discountedEx: grandTotal });
  state.basket.discountPct = totals.discountPct;
  state.basket.grandTotalEx = totals.discountedEx;
  persist();
  render();
};

const toggleCapture = (flag) => {
  state.captureAsChild = flag;
  window.localStorage.setItem('defcost_capture_child', String(flag));
};

const addCatalogueItem = (record) => {
  const section = findSection(state.activeSectionId) || state.basket.sections[0];
  if (!section) return;
  const item = {
    id: uniqueId('it'),
    parentId: null,
    isChild: Boolean(state.captureAsChild),
    label: record.description,
    code: record.code,
    unit: record.unit,
    qty: 1,
    price: Number(record.price) || 0,
    sourceTab: record.sourceTab || ''
  };
  if (state.captureAsChild) {
    const lastParent = [...section.items].reverse().find((it) => !it.isChild);
    if (lastParent) item.parentId = lastParent.id;
  }
  section.items.push(item);
  persist();
  render();
  ui.showToast(`${record.description} added to ${section.title}`);
};

const exportCSV = () => {
  const blob = exportBasketToCSV(state.basket);
  downloadBlob(blob, `defcost-quote-${new Date().toISOString().slice(0, 10)}.csv`);
  ui.showToast('CSV exported.');
};

const importCSV = async () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv';
  input.style.display = 'none';
  document.body.appendChild(input);
  input.click();
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) {
      input.remove();
      return;
    }
    snapshotBackup(state.basket);
    try {
      const imported = await importBasketFromCSV(file);
      state.basket = imported;
      state.activeSectionId = imported.sections[0]?.id || null;
      persist();
      render();
      ui.showToast('CSV imported successfully.');
    } catch (error) {
      console.error(error);
      const backup = consumeBackup();
      if (backup) {
        state.basket = backup;
        persist();
        render();
      }
      showErrorModal('Import failed', `${error.message}. Previous state restored.`);
    } finally {
      input.remove();
    }
  });
};

const showErrorModal = (title, message) => {
  const template = document.getElementById('modal-template');
  const fragment = template.content.cloneNode(true);
  const modal = fragment.querySelector('.modal');
  fragment.querySelector('#modal-title').textContent = title;
  fragment.querySelector('.modal__body').innerHTML = `<p>${message}</p>`;
  const footer = fragment.querySelector('.modal__footer');
  const backdrop = fragment.querySelector('.modal-backdrop');
  const close = () => {
    modal.remove();
    backdrop.remove();
  };
  const undoButton = document.createElement('button');
  undoButton.className = 'btn btn-ghost';
  undoButton.textContent = 'Undo';
  undoButton.addEventListener('click', () => {
    const backup = consumeBackup();
    if (backup) {
      state.basket = backup;
      persist();
      render();
      ui.showToast('Import undone.');
    }
    close();
  });
  const closeButton = document.createElement('button');
  closeButton.className = 'btn btn-primary';
  closeButton.textContent = 'Close';
  closeButton.addEventListener('click', () => close());
  footer.appendChild(undoButton);
  footer.appendChild(closeButton);
  document.body.appendChild(backdrop);
  document.body.appendChild(modal);
  backdrop.addEventListener('click', close);
  modal.querySelector('[data-action="close-modal"]').addEventListener('click', close);
};

bus.on('toolbar:delete-quote', deleteQuote);
bus.on('toolbar:add-custom-line', addCustomLine);
bus.on('toolbar:add-section', addSection);
bus.on('toolbar:import-csv', importCSV);
bus.on('toolbar:export-csv', exportCSV);

bus.on('section:delete', deleteSection);
bus.on('section:activate', activateSection);
bus.on('section:rename', renameSection);
bus.on('section:update-notes', updateNotes);

bus.on('item:update', updateItemField);
bus.on('item:delete', deleteItem);
bus.on('item:toggle-child', toggleChild);
bus.on('items:reorder', reorderItems);

bus.on('totals:update-discount', updateDiscount);
bus.on('totals:update-grand', updateGrandTotal);

bus.on('capture:toggle', toggleCapture);

bus.on('catalogue:add-item', addCatalogueItem);
bus.on('catalogue:state-change', (payload) => {
  catalogueState = { ...payload };
  saveCatalogueState(catalogueState);
});
bus.on('catalogue:visibility', (payload) => {
  catalogueState = { ...catalogueState, ...payload };
  saveCatalogueState(catalogueState);
});

keybinder.register('mod+k', () => {
  bus.emit('catalogue:toggle');
});

render();
