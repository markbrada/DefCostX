import { uid } from './utils.js';
import { lineTotal } from './calc.js';

const BASKET_KEY = 'defcost_basket_v2';
const CATALOGUE_KEY = 'defcost_catalogue_state';

let lastBackup = null;

const createEmptySection = (title = 'Section 1') => ({
  id: uid('sec'),
  title,
  notes: '',
  items: [],
});

const createEmptyBasket = () => ({
  sections: [createEmptySection()],
  discountPct: 0,
  grandTotalEx: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const loadBasket = () => {
  try {
    const raw = localStorage.getItem(BASKET_KEY);
    if (!raw) {
      const basket = createEmptyBasket();
      saveBasket(basket);
      return basket;
    }
    const parsed = JSON.parse(raw);
    return normalizeBasket(parsed);
  } catch (error) {
    console.warn('Failed to load basket, creating new one', error);
    const basket = createEmptyBasket();
    saveBasket(basket);
    return basket;
  }
};

const normalizeBasket = (basket) => {
  const normalized = {
    sections: Array.isArray(basket.sections) && basket.sections.length
      ? basket.sections.map((section, index) => ({
          id: section.id || uid('sec'),
          title: section.title || `Section ${index + 1}`,
          notes: section.notes || '',
          items: Array.isArray(section.items)
            ? section.items.map((item) => ({
                id: item.id || uid('it'),
                parentId: item.parentId || null,
                isChild: Boolean(item.isChild),
                label: item.label || '',
                code: item.code || '',
                unit: item.unit || '',
                price: Number.isFinite(item.price) ? item.price : (item.price === '' ? NaN : Number(item.price)),
                qty: Number.isFinite(item.qty) ? item.qty : 0,
                sourceTab: item.sourceTab || null,
              }))
            : [],
        }))
      : [createEmptySection()],
    discountPct: Number.isFinite(basket.discountPct) ? basket.discountPct : 0,
    grandTotalEx: Number.isFinite(basket.grandTotalEx) ? basket.grandTotalEx : null,
    createdAt: basket.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return normalized;
};

const saveBasket = (basket) => {
  const payload = {
    ...basket,
    updatedAt: new Date().toISOString(),
  };
  localStorage.setItem(BASKET_KEY, JSON.stringify(payload));
  return payload;
};

const snapshotBasket = (basket) => {
  lastBackup = structuredClone(basket);
};

const restoreSnapshot = () => {
  if (!lastBackup) return null;
  saveBasket(lastBackup);
  return loadBasket();
};

const loadCatalogueState = () => {
  try {
    const raw = localStorage.getItem(CATALOGUE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.warn('Failed to parse catalogue state', error);
    return null;
  }
};

const saveCatalogueState = (state) => {
  localStorage.setItem(CATALOGUE_KEY, JSON.stringify(state));
};

const exportBasketToCSV = (basket) => {
  const rows = buildCsvRows(basket);
  const sheet = globalThis.XLSX.utils.aoa_to_sheet(rows);
  const book = globalThis.XLSX.utils.book_new();
  globalThis.XLSX.utils.book_append_sheet(book, sheet, 'Quote');
  globalThis.XLSX.writeFile(book, 'DefCost-Quote.csv', { bookType: 'csv', compression: true });
};

const buildCsvRows = (basket) => {
  const rows = [['Section', 'Item', 'Quantity', 'Price', 'Line Total']];
  basket.sections.forEach((section) => {
    section.items.forEach((item) => {
      const label = item.isChild ? `- ${item.label}` : item.label;
      const priceValue = Number.isFinite(item.price) ? roundTwo(item.price) : '';
      const lineValue = Number.isFinite(item.price) ? lineTotal(item.qty, item.price) : '';
      rows.push([
        section.title,
        label,
        Number.isFinite(item.qty) && item.qty !== 0 ? item.qty : item.qty === 0 ? 0 : '',
        priceValue,
        lineValue,
      ]);
    });
    if (section.notes && section.notes.trim().length) {
      rows.push([
        `${section.title} Notes`,
        section.notes,
        '',
        '',
        '',
      ]);
    }
  });
  return rows;
};

const roundTwo = (value) => Number.isFinite(value) ? Number(value.toFixed(2)) : value;

const readFileAsBinaryString = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsBinaryString(file);
});

const importCSV = async (fileOrString) => {
  let data = fileOrString;
  if (fileOrString instanceof File) {
    data = await readFileAsBinaryString(fileOrString);
  }
  const workbook = globalThis.XLSX.read(data, { type: typeof data === 'string' ? 'binary' : 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = globalThis.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
  if (!rows.length) throw new Error('Empty CSV');
  const [header, ...body] = rows;
  const expected = ['Section', 'Item', 'Quantity', 'Price', 'Line Total'];
  const headerMismatch = expected.some((value, index) => header[index] !== value);
  if (headerMismatch) {
    const columns = header.join(', ');
    throw new Error(`Invalid CSV header. Expected ${expected.join(', ')}, received: ${columns}`);
  }

  const sections = [];
  let currentSection = null;
  let lastParent = null;

  const ensureSection = (title) => {
    const normalized = title.trim();
    const existing = sections.find((sec) => sec.title.toLowerCase() === normalized.toLowerCase());
    if (existing) return existing;
    const baseName = normalized || `Section ${sections.length + 1}`;
    let uniqueTitle = baseName;
    let i = 2;
    while (sections.some((sec) => sec.title.toLowerCase() === uniqueTitle.toLowerCase())) {
      uniqueTitle = normalized ? `${normalized} (${i++})` : `Section ${sections.length + i - 1}`;
    }
    const section = {
      id: uid('sec'),
      title: uniqueTitle,
      notes: '',
      items: [],
    };
    sections.push(section);
    return section;
  };

  body.forEach((row) => {
    if (!row || row.every((cell) => cell === undefined || cell === null || `${cell}`.trim() === '')) return;
    const [sectionCell = '', itemCell = '', qtyCell = '', priceCell = ''] = row;
    if (sectionCell) {
      const isNotes = sectionCell.trim().toLowerCase().endsWith(' notes');
      const baseTitle = isNotes ? sectionCell.replace(/\s*Notes$/i, '').trim() : sectionCell.trim();
      currentSection = ensureSection(baseTitle);
      if (isNotes) {
        currentSection.notes = itemCell || '';
        return;
      }
      lastParent = null;
    } else if (!currentSection) {
      currentSection = ensureSection(`Section ${sections.length + 1}`);
    }

    const trimmedItem = `${itemCell || ''}`.trim();
    if (!trimmedItem) return;
    const isChild = trimmedItem.startsWith('- ');
    const label = isChild ? trimmedItem.slice(2) : trimmedItem;

    const qty = parseFloat(qtyCell);
    const price = parseFloat(priceCell);

    const item = {
      id: uid('it'),
      parentId: isChild && lastParent ? lastParent.id : null,
      isChild,
      label,
      code: '',
      unit: '',
      price: Number.isFinite(price) ? price : NaN,
      qty: Number.isFinite(qty) ? qty : 0,
      sourceTab: null,
    };

    currentSection.items.push(item);
    if (!isChild) {
      lastParent = item;
    }
  });

  const basket = {
    sections: sections.length ? sections : [createEmptySection()],
    discountPct: 0,
    grandTotalEx: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveBasket(basket);
  return basket;
};

export {
  BASKET_KEY,
  CATALOGUE_KEY,
  loadBasket,
  saveBasket,
  snapshotBasket,
  restoreSnapshot,
  exportBasketToCSV,
  importCSV,
  loadCatalogueState,
  saveCatalogueState,
  createEmptyBasket,
  createEmptySection,
};
