import { uniqueId, serializeDate } from './utils.js';
import { computeQuoteTotals } from './calc.js';

export const BASKET_KEY = 'defcost_basket_v2';
export const CATALOGUE_KEY = 'defcost_catalogue_state';

let backupBasket = null;

export const createEmptySection = (title = 'Section 1') => ({
  id: uniqueId('sec'),
  title,
  notes: '',
  items: []
});

export const createEmptyBasket = () => ({
  sections: [createEmptySection()],
  discountPct: 0,
  grandTotalEx: 0,
  createdAt: serializeDate(),
  updatedAt: serializeDate()
});

export const loadBasket = () => {
  try {
    const stored = window.localStorage.getItem(BASKET_KEY);
    if (!stored) {
      const basket = createEmptyBasket();
      saveBasket(basket);
      return basket;
    }
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed.sections)) {
      throw new Error('Invalid basket format');
    }
    const totals = computeQuoteTotals(parsed);
    return {
      ...parsed,
      grandTotalEx: totals.discountedEx,
      updatedAt: parsed.updatedAt || serializeDate()
    };
  } catch (error) {
    console.warn('[storage] Failed to load basket, resetting.', error);
    const basket = createEmptyBasket();
    saveBasket(basket);
    return basket;
  }
};

export const saveBasket = (basket) => {
  const next = {
    ...basket,
    updatedAt: serializeDate()
  };
  window.localStorage.setItem(BASKET_KEY, JSON.stringify(next));
  return next;
};

export const loadCatalogueState = () => {
  try {
    const stored = window.localStorage.getItem(CATALOGUE_KEY);
    if (!stored) return { isOpen: false, x: 120, y: 420, w: 1100, h: 400, allTabs: false, activeTab: 'Site Items', lastQuery: '' };
    return JSON.parse(stored);
  } catch (error) {
    console.warn('[storage] Failed to load catalogue state.', error);
    return { isOpen: false, x: 120, y: 420, w: 1100, h: 400, allTabs: false, activeTab: 'Site Items', lastQuery: '' };
  }
};

export const saveCatalogueState = (state) => {
  window.localStorage.setItem(CATALOGUE_KEY, JSON.stringify(state));
};

export const snapshotBackup = (basket) => {
  backupBasket = structuredClone ? structuredClone(basket) : JSON.parse(JSON.stringify(basket));
};

export const consumeBackup = () => {
  const copy = backupBasket;
  backupBasket = null;
  return copy;
};

export const exportBasketToCSV = (basket) => {
  const rows = [];
  basket.sections.forEach((section) => {
    section.items.forEach((item) => {
      const prefix = item.isChild ? '- ' : '';
      rows.push({
        Section: section.title,
        Item: `${prefix}${item.label || item.code || 'Item'}`,
        Quantity: Number.isFinite(item.qty) ? item.qty : '',
        Price: Number.isFinite(item.price) ? item.price : '',
        'Line Total': ''
      });
    });
    if (section.notes) {
      rows.push({
        Section: `${section.title} Notes`,
        Item: section.notes,
        Quantity: '',
        Price: '',
        'Line Total': ''
      });
    }
  });
  const worksheet = XLSX.utils.json_to_sheet(rows, { header: ['Section', 'Item', 'Quantity', 'Price', 'Line Total'] });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Quote');
  const wbout = XLSX.write(workbook, { type: 'array', bookType: 'csv' });
  return new Blob([wbout], { type: 'text/csv;charset=utf-8;' });
};

const normalizeSectionTitle = (title, existing) => {
  let candidate = title;
  let counter = 2;
  const lowerExisting = existing.map((t) => t.toLowerCase());
  while (lowerExisting.includes(candidate.toLowerCase())) {
    candidate = `${title} (${counter++})`;
  }
  return candidate;
};

export const importBasketFromCSV = async (file) => {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
  const header = XLSX.utils.sheet_to_json(sheet, { header: 1 })[0] || [];
  const expectedHeader = ['Section', 'Item', 'Quantity', 'Price', 'Line Total'];
  const headerMismatch = expectedHeader.some((col, idx) => header[idx] !== col);
  if (headerMismatch) {
    throw new Error('CSV column mismatch. Expected: Section, Item, Quantity, Price, Line Total');
  }

  const sections = [];
  const seenTitles = [];
  rows.forEach((row) => {
    const sectionRaw = row.Section || 'Section';
    const itemLabel = row.Item || '';
    const qty = parseFloat(row.Quantity);
    const price = parseFloat(row.Price);

    if (sectionRaw.endsWith(' Notes') && !itemLabel.trim()) {
      return;
    }

    const isNotesRow = sectionRaw.endsWith(' Notes') && itemLabel.trim().length;
    const baseSectionTitle = isNotesRow ? sectionRaw.replace(/ Notes$/, '') : sectionRaw;
    let section = sections.find((sec) => sec.title.toLowerCase() === baseSectionTitle.toLowerCase());
    if (!section) {
      const uniqueTitle = normalizeSectionTitle(baseSectionTitle || 'Section', seenTitles);
      section = {
        id: uniqueId('sec'),
        title: uniqueTitle,
        notes: '',
        items: []
      };
      sections.push(section);
      seenTitles.push(uniqueTitle);
    }

    if (isNotesRow) {
      section.notes = itemLabel;
      return;
    }

    const isChild = itemLabel.trim().startsWith('- ');
    const label = isChild ? itemLabel.trim().slice(2) : itemLabel.trim();
    section.items.push({
      id: uniqueId('it'),
      parentId: null,
      isChild,
      label,
      code: '',
      unit: '',
      price: Number.isFinite(price) ? price : '',
      qty: Number.isFinite(qty) ? qty : 0,
      sourceTab: ''
    });
  });

  const basket = {
    sections,
    discountPct: 0,
    grandTotalEx: 0,
    createdAt: serializeDate(),
    updatedAt: serializeDate()
  };

  const totals = computeQuoteTotals(basket);
  basket.grandTotalEx = totals.discountedEx;
  return basket;
};
