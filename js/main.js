import {
  setupUI,
  renderApp,
  setStatus,
  showModal,
  closeModal,
  showToast,
  getCaptureMode,
} from './ui.js';
import {
  loadBasket,
  saveBasket,
  snapshotBasket,
  restoreSnapshot,
  exportBasketToCSV,
  importCSV,
  createEmptySection,
} from './storage.js';
import { computeTotals, clampDiscount, calculateDiscountFromGrand } from './calc.js';
import { initCatalogue } from './catalogue.js';
import { uid } from './utils.js';

let basket = null;
let activeSectionId = null;
let captureSubItems = false;

const init = () => {
  basket = loadBasket();
  activeSectionId = basket.sections[0]?.id ?? null;
  captureSubItems = getCaptureMode();
  setupUI(createUIHandlers());
  initCatalogue({ onAddItem: handleCatalogueAdd });
  render();
};

document.addEventListener('DOMContentLoaded', init);

const createUIHandlers = () => ({
  onAddSection: addSection,
  onSelectSection: selectSection,
  onRemoveSection: deleteSection,
  onRenameSection: renameSection,
  onAddCustomLine: addCustomLine,
  onDeleteLine: removeLine,
  onItemFieldChange: updateItemField,
  onToggleChild: toggleChild,
  onReorder: reorderSection,
  onUpdateNotes: updateSectionNotes,
  onDeleteQuote: confirmDeleteQuote,
  onImportCSV: promptImport,
  onExportCSV: () => exportBasketToCSV(basket),
  onDiscountChange: handleDiscountChange,
  onGrandTotalChange: handleGrandChange,
  onToggleDarkMode: toggleDarkMode,
  onCaptureToggle: (value) => { captureSubItems = value; },
  getSections: () => basket.sections,
});

const render = () => {
  if (!basket.sections.length) {
    basket.sections.push(createEmptySection());
  }
  const active = basket.sections.find((section) => section.id === activeSectionId) ?? basket.sections[0];
  activeSectionId = active?.id ?? basket.sections[0]?.id ?? null;
  const totals = computeTotals({ sections: basket.sections, discountPct: basket.discountPct, grandTotalEx: basket.grandTotalEx });
  renderApp({ basket, activeSection: active, totals });
  basket.discountPct = totals.discountPct;
  basket.grandTotalEx = totals.discountedEx;
  saveBasket(basket);
};

const addSection = () => {
  const name = uniqueSectionName('Section');
  const section = createEmptySection(name);
  basket.sections.push(section);
  activeSectionId = section.id;
  setStatus(`Created ${section.title}`);
  render();
};

const selectSection = (sectionId) => {
  activeSectionId = sectionId;
  render();
};

const deleteSection = (sectionId) => {
  if (basket.sections.length === 1) {
    showToast('Cannot delete the last section.', { variant: 'danger' });
    return;
  }
  basket.sections = basket.sections.filter((section) => section.id !== sectionId);
  if (activeSectionId === sectionId) {
    activeSectionId = basket.sections[0]?.id ?? null;
  }
  setStatus('Section removed');
  render();
};

const renameSection = (sectionId, nextTitle) => {
  const section = basket.sections.find((sec) => sec.id === sectionId);
  if (!section) return;
  if (!nextTitle) {
    showToast('Section name is required', { variant: 'danger' });
    render();
    return;
  }
  if (basket.sections.some((sec) => sec.id !== sectionId && sec.title.toLowerCase() === nextTitle.toLowerCase())) {
    showToast('Section names must be unique', { variant: 'danger' });
    render();
    return;
  }
  section.title = nextTitle;
  setStatus(`Renamed section to ${nextTitle}`);
  render();
};

const addCustomLine = () => {
  const section = getActiveSection();
  if (!section) return;
  const item = {
    id: uid('it'),
    parentId: null,
    isChild: captureSubItems && hasParent(section),
    label: 'Custom item',
    code: '',
    unit: '',
    price: NaN,
    qty: 0,
    sourceTab: null,
  };
  if (item.isChild) {
    const parent = findLastParent(section);
    item.parentId = parent?.id ?? null;
  }
  section.items.push(item);
  render();
};

const handleCatalogueAdd = (item) => {
  const section = getActiveSection();
  if (!section) return;
  const newItem = {
    id: uid('it'),
    parentId: null,
    isChild: captureSubItems && hasParent(section),
    label: item.label,
    code: item.code,
    unit: item.unit,
    price: item.price,
    qty: 1,
    sourceTab: item.sourceTab,
  };
  if (newItem.isChild) {
    const parent = findLastParent(section);
    newItem.parentId = parent?.id ?? null;
  }
  section.items.push(newItem);
  render();
  setStatus(`${item.label} added to ${section.title}`);
};

const removeLine = (sectionId, itemId) => {
  const section = basket.sections.find((sec) => sec.id === sectionId);
  if (!section) return;
  section.items = section.items.filter((item) => item.id !== itemId && item.parentId !== itemId);
  render();
};

const updateItemField = (sectionId, itemId, field, value) => {
  const section = basket.sections.find((sec) => sec.id === sectionId);
  if (!section) return;
  const item = section.items.find((it) => it.id === itemId);
  if (!item) return;
  if (field === 'qty' || field === 'price') {
    item[field] = Number.isFinite(value) ? Math.max(0, value) : NaN;
  } else {
    item[field] = value;
  }
  render();
};

const toggleChild = (sectionId, itemId) => {
  const section = basket.sections.find((sec) => sec.id === sectionId);
  if (!section) return;
  const index = section.items.findIndex((item) => item.id === itemId);
  if (index === -1) return;
  const item = section.items[index];
  if (item.isChild) {
    item.isChild = false;
    item.parentId = null;
  } else {
    const parent = findParentForIndex(section.items, index);
    if (!parent) {
      showToast('No parent item above to indent under.', { variant: 'danger' });
      return;
    }
    item.isChild = true;
    item.parentId = parent.id;
  }
  render();
};

const reorderSection = (sectionId, order) => {
  const section = basket.sections.find((sec) => sec.id === sectionId);
  if (!section) return;
  const newOrder = order.map((id) => section.items.find((item) => item.id === id)).filter(Boolean);
  if (newOrder.length === section.items.length) {
    section.items = newOrder;
    reorderChildrenAfterReorder(section);
    render();
  }
};

const updateSectionNotes = (sectionId, notes) => {
  const section = basket.sections.find((sec) => sec.id === sectionId);
  if (!section) return;
  section.notes = notes;
  saveBasket(basket);
};

const handleDiscountChange = (value) => {
  basket.discountPct = clampDiscount(value);
  basket.grandTotalEx = null;
  render();
};

const handleGrandChange = (value) => {
  const sectionsTotals = computeTotals({ sections: basket.sections, discountPct: basket.discountPct });
  const discount = calculateDiscountFromGrand(sectionsTotals.sectionsEx, value);
  basket.discountPct = discount;
  basket.grandTotalEx = Number.isFinite(value) ? value : null;
  render();
};

const toggleDarkMode = () => {
  const html = document.documentElement;
  const next = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('defcost_theme', next);
  const button = document.getElementById('toggle-dark');
  if (button) button.setAttribute('aria-pressed', String(next === 'dark'));
};

const confirmDeleteQuote = () => {
  showModal({
    title: 'Delete quote?',
    message: '<p>This will remove all sections and items.</p><p>We recommend exporting to CSV first.</p>',
    actions: [
      { label: 'Cancel', handler: closeModal },
      {
        label: 'Delete quote',
        variant: 'danger',
        handler: () => {
          basket = {
            sections: [createEmptySection('Section 1')],
            discountPct: 0,
            grandTotalEx: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
          activeSectionId = basket.sections[0].id;
          saveBasket(basket);
          render();
        },
      },
    ],
  });
};

const promptImport = () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv, text/csv';
  input.addEventListener('change', async () => {
    if (!input.files.length) return;
    try {
      snapshotBasket(basket);
      const file = input.files[0];
      basket = await importCSV(file);
      activeSectionId = basket.sections[0]?.id ?? null;
      setStatus('Import successful');
      render();
    } catch (error) {
      showModal({
        title: 'Import failed',
        message: `<p>${error.message}</p>`,
        actions: [
          {
            label: 'Undo',
            handler: () => {
              const restored = restoreSnapshot();
              if (restored) {
                basket = restored;
                render();
              }
            },
          },
          { label: 'Close', handler: closeModal },
        ],
      });
    }
  });
  input.click();
};

const reorderChildrenAfterReorder = (section) => {
  section.items.forEach((item, index) => {
    if (item.isChild) {
      const parent = findParentForIndex(section.items, index);
      if (!parent) {
        item.isChild = false;
        item.parentId = null;
      } else {
        item.parentId = parent.id;
      }
    }
  });
};

const getActiveSection = () => basket.sections.find((section) => section.id === activeSectionId);

const hasParent = (section) => section.items.some((item) => !item.isChild);

const findLastParent = (section) => {
  const reversed = [...section.items].reverse();
  return reversed.find((item) => !item.isChild) || null;
};

const findParentForIndex = (items, index) => {
  for (let i = index - 1; i >= 0; i -= 1) {
    if (!items[i].isChild) return items[i];
  }
  return null;
};

const uniqueSectionName = (base) => {
  let index = basket.sections.length + 1;
  let name = `${base} ${index}`;
  const lower = basket.sections.map((section) => section.title.toLowerCase());
  while (lower.includes(name.toLowerCase())) {
    index += 1;
    name = `${base} ${index}`;
  }
  return name;
};

const restoreTheme = () => {
  const stored = localStorage.getItem('defcost_theme');
  if (stored) {
    document.documentElement.setAttribute('data-theme', stored);
  }
  const button = document.getElementById('toggle-dark');
  if (button) button.setAttribute('aria-pressed', String((stored || document.documentElement.getAttribute('data-theme')) === 'dark'));
};

restoreTheme();

window.addEventListener('beforeunload', () => saveBasket(basket));
