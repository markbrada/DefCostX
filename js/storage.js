import {
  roundCurrency,
  formatCurrency,
  formatPercent,
  recalcGrandTotal,
  calculateGst,
  buildReportModel,
  lineTotal
} from './calc.js';

export const LS_KEY = 'defcost_basket_v2';
export const BACKUP_KEY = 'defcost_basket_backup';
export const IMPORT_HEADER = ['Section', 'Item', 'Quantity', 'Price', 'Line Total'];
export const SUMMARY_ROWS = {
  'Total (Ex GST)': 1,
  'Discount (%)': 2,
  'Grand Total (Ex GST)': 1,
  'GST': 1,
  'Grand Total (Incl. GST)': 1
};

export function saveBasket({
  basket,
  sections,
  activeSectionId,
  discountPercent,
  storageKey = LS_KEY,
  storage = window.localStorage
} = {}) {
  try {
    const payload = {
      items: Array.isArray(basket) ? basket : [],
      sections: Array.isArray(sections) ? sections : [],
      activeSectionId: activeSectionId,
      discountPercent: isFinite(discountPercent) ? discountPercent : 0
    };
    storage.setItem(storageKey, JSON.stringify(payload));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadBasket({
  storageKey = LS_KEY,
  storage = window.localStorage
} = {}) {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) {
      return null;
    }
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      return {
        basket: data,
        sections: null,
        activeSectionId: null,
        discountPercent: 0
      };
    }
    if (data && typeof data === 'object') {
      return {
        basket: Array.isArray(data.items) ? data.items : [],
        sections: Array.isArray(data.sections) && data.sections.length ? data.sections : null,
        activeSectionId: data.activeSectionId,
        discountPercent:
          typeof data.discountPercent !== 'undefined' && isFinite(data.discountPercent)
            ? +data.discountPercent
            : 0
      };
    }
  } catch (err) {
    // ignore corrupt storage
  }
  return null;
}

export function backupCurrentQuote({
  basket,
  sections,
  activeSectionId,
  discountPercent,
  storageKey = BACKUP_KEY,
  storage = window.localStorage
} = {}) {
  try {
    const payload = {
      items: Array.isArray(basket) ? basket : [],
      sections: Array.isArray(sections) ? sections : [],
      activeSectionId: activeSectionId,
      discountPercent: isFinite(discountPercent) ? discountPercent : 0
    };
    storage.setItem(storageKey, JSON.stringify(payload));
    return true;
  } catch (err) {
    return false;
  }
}

export function restoreBackup({
  storageKey = BACKUP_KEY,
  storage = window.localStorage
} = {}) {
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) {
      return { success: false, error: 'No backup available' };
    }
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'No backup available' };
    }
    return {
      success: true,
      data: {
        basket: Array.isArray(data.items) ? data.items : [],
        sections: Array.isArray(data.sections) && data.sections.length ? data.sections : null,
        activeSectionId: data.activeSectionId,
        discountPercent:
          typeof data.discountPercent !== 'undefined' && isFinite(data.discountPercent)
            ? +data.discountPercent
            : 0
      }
    };
  } catch (err) {
    return { success: false, error: 'Unable to restore backup' };
  }
}

export function closeImportSummaryModal() {
  const root = (window.DefCost = window.DefCost || {});
  const state = (root.state = root.state || {});
  const modalState = state.importSummaryState;
  if (!modalState) {
    state.importSummaryState = null;
    return;
  }
  document.removeEventListener('focus', modalState.focusHandler, true);
  document.removeEventListener('keydown', modalState.keyHandler, true);
  if (modalState.overlay && modalState.overlay.parentNode) {
    modalState.overlay.parentNode.removeChild(modalState.overlay);
  }
  document.body.style.overflow = modalState.bodyOverflow || '';
  const lastFocus = modalState.previousFocus;
  state.importSummaryState = null;
  if (lastFocus && typeof lastFocus.focus === 'function') {
    try {
      lastFocus.focus();
    } catch (err) {
      // ignore focus errors
    }
  }
}

export function buildImportModel(rows) {
  const issues = [];
  if (!rows || !rows.length) {
    issues.push('Row 1: Header must be "' + IMPORT_HEADER.join(',') + '"');
    return { issues };
  }
  const header = rows[0] ? rows[0].slice(0) : [];
  if (header.length) {
    header[0] = String(header[0] == null ? '' : header[0]).replace(/^\ufeff/, '');
  }
  if (header.length !== IMPORT_HEADER.length) {
    issues.push('Row 1: Header must be "' + IMPORT_HEADER.join(',') + '"');
    return { issues };
  }
  for (let h = 0; h < IMPORT_HEADER.length; h++) {
    const cell = header[h] == null ? '' : String(header[h]);
    if (cell !== IMPORT_HEADER[h]) {
      issues.push('Row 1: Header must be "' + IMPORT_HEADER.join(',') + '"');
      return { issues };
    }
  }

  const sectionsModel = [];
  const sectionMap = {};
  const lastParentBySection = {};
  const pendingNotes = {};
  let discountPercentValue = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 1;
    if (!row) {
      continue;
    }
    let nonEmpty = false;
    for (let c = 0; c < IMPORT_HEADER.length; c++) {
      if (row[c] != null && String(row[c]).trim() !== '') {
        nonEmpty = true;
        break;
      }
    }
    if (!nonEmpty) {
      continue;
    }

    const sectionCell = row[0] == null ? '' : String(row[0]).trim();
    if (SUMMARY_ROWS[sectionCell]) {
      if (sectionCell === 'Discount (%)') {
        const discStr = row[4] == null ? '' : String(row[4]).trim();
        if (discStr) {
          const cleanedDisc = discStr.replace(/[$,\s]/g, '');
          const parsedDisc = parseFloat(cleanedDisc);
          if (isFinite(parsedDisc)) {
            discountPercentValue = parsedDisc;
          }
        }
      }
      continue;
    }

    const notesMatch = /^Section\s+(\d+)\s+Notes$/.exec(sectionCell);
    if (notesMatch) {
      const noteIndex = parseInt(notesMatch[1], 10);
      if (isFinite(noteIndex) && noteIndex > 0) {
        const noteText = row[1] == null ? '' : String(row[1]).trim();
        if (noteText) {
          pendingNotes[noteIndex] = { text: noteText, row: rowNumber };
        }
      }
      continue;
    }

    if (!sectionCell) {
      issues.push('Row ' + rowNumber + ': Section is required');
      continue;
    }

    let section = sectionMap[sectionCell];
    if (!section) {
      section = { title: sectionCell, items: [], notes: '' };
      sectionMap[sectionCell] = section;
      sectionsModel.push(section);
      lastParentBySection[sectionCell] = null;
    }

    const rawItem = row[1] == null ? '' : String(row[1]);
    let trimmedItem = rawItem.trim();
    let escaped = false;
    if (trimmedItem.indexOf('\\- ') === 0) {
      escaped = true;
      trimmedItem = trimmedItem.slice(1);
    }
    let isChild = false;
    if (!escaped && trimmedItem.indexOf('- ') === 0) {
      isChild = true;
      trimmedItem = trimmedItem.slice(2);
    }

    const qtyInfo = parseNumericCell(row[2], rowNumber, 'Quantity', issues);
    const priceInfo = parseNumericCell(row[3], rowNumber, 'Price', issues);

    const itemName = trimmedItem;
    if (isChild) {
      const parent = lastParentBySection[sectionCell];
      if (!parent) {
        issues.push('Row ' + rowNumber + ': Child row without a parent in section "' + sectionCell + '"');
        continue;
      }
      parent.children.push({ name: itemName, qty: qtyInfo.value, price: priceInfo.value });
    } else {
      const parentItem = { name: itemName, qty: qtyInfo.value, price: priceInfo.value, children: [] };
      section.items.push(parentItem);
      lastParentBySection[sectionCell] = parentItem;
    }
  }

  for (const key in pendingNotes) {
    if (!Object.prototype.hasOwnProperty.call(pendingNotes, key)) {
      continue;
    }
    const noteIndex = parseInt(key, 10);
    const targetSection = sectionsModel[noteIndex - 1];
    if (targetSection) {
      targetSection.notes = pendingNotes[key].text;
    } else {
      issues.push('Row ' + pendingNotes[key].row + ': Notes row references missing Section ' + noteIndex);
    }
  }

  if (!sectionsModel.length) {
    issues.push('No section data found in CSV');
  }

  return { sections: sectionsModel, discount: discountPercentValue, issues: issues };
}

function parseNumericCell(raw, rowNumber, label, issues) {
  const str = raw == null ? '' : String(raw).trim();
  if (!str) {
    return { value: 0 };
  }
  const cleaned = str.replace(/[$,\s]/g, '');
  if (!cleaned) {
    return { value: 0 };
  }
  const num = parseFloat(cleaned);
  if (!isFinite(num)) {
    issues.push('Row ' + rowNumber + ': ' + label + ' is not a number');
    return { value: 0, invalid: true };
  }
  return { value: num };
}

export function handleImportInputChange(event, {
  importInput,
  Papa,
  confirmImport = (message) => window.confirm(message),
  backup,
  showIssuesModal,
  applyImportedModel
} = {}) {
  const inputEl = importInput || (event && event.target);
  if (!inputEl) {
    return;
  }
  const file = inputEl.files && inputEl.files[0];
  if (!file) {
    return;
  }
  if (!confirmImport('Importing will replace the current quote. Continue?')) {
    inputEl.value = '';
    return;
  }
  if (!Papa) {
    inputEl.value = '';
    if (typeof showIssuesModal === 'function') {
      showIssuesModal('Import failed', ['Papa Parse library is unavailable.']);
    }
    return;
  }

  if (typeof backup === 'function') {
    backup();
  }

  Papa.parse(file, {
    header: false,
    dynamicTyping: false,
    skipEmptyLines: false,
    complete: (results) => {
      inputEl.value = '';
      const parserIssues = [];
      if (results && Array.isArray(results.errors)) {
        for (let i = 0; i < results.errors.length; i++) {
          const err = results.errors[i];
          if (err && err.message) {
            const rowNumber = typeof err.row === 'number' && err.row >= 0 ? err.row + 1 : '?';
            parserIssues.push('Row ' + rowNumber + ': ' + err.message);
          }
        }
      }
      const model = buildImportModel(results && results.data ? results.data : []);
      let combinedIssues = parserIssues.slice();
      if (model && Array.isArray(model.issues) && model.issues.length) {
        combinedIssues = combinedIssues.concat(model.issues);
      }
      if (combinedIssues.length) {
        if (typeof showIssuesModal === 'function') {
          showIssuesModal('Import failed', combinedIssues.slice(0, 5));
        }
        return;
      }
      if (typeof applyImportedModel === 'function') {
        applyImportedModel(model);
      }
    },
    error: (err) => {
      inputEl.value = '';
      const message = err && err.message ? err.message : 'Unable to parse CSV file.';
      if (typeof showIssuesModal === 'function') {
        showIssuesModal('Import failed', [message]);
      }
    }
  });
}

export function exportBasketToCsv({
  basket,
  sections,
  discountPercent,
  showToast,
  silent
} = {}) {
  if (!Array.isArray(basket) || !basket.length) {
    return false;
  }

  const report = buildReportModel(basket, sections);
  const lines = [['Section', 'Item', 'Quantity', 'Price', 'Line Total']];

  const esc = (value) => '"' + String(value).replace(/"/g, '""') + '"';

  for (let si = 0; si < report.sections.length; si++) {
    const sec = report.sections[si];
    for (let gi = 0; gi < sec.items.length; gi++) {
      const group = sec.items[gi];
      const parent = group.parent;
      const parentQty = Number.isFinite(parent.qty) ? (parent.qty > 0 ? parent.qty : 0) : 0;
      const parentHasPrice = Number.isFinite(parent.ex);
      const parentLineTotal = parentHasPrice ? lineTotal(parentQty, parent.ex) : NaN;
      lines.push([
        sec.name,
        parent.item || '',
        parentQty,
        parentHasPrice ? formatCurrency(Number(parent.ex)) : 'N/A',
        Number.isFinite(parentLineTotal) ? formatCurrency(parentLineTotal) : 'N/A'
      ]);
      const subs = group.subs || [];
      for (let sj = 0; sj < subs.length; sj++) {
        const sub = subs[sj];
        const subQty = Number.isFinite(sub.qty) ? (sub.qty > 0 ? sub.qty : 0) : 0;
        const subHasPrice = Number.isFinite(sub.ex);
        const subLineEx = subHasPrice ? lineTotal(subQty, sub.ex) : NaN;
        lines.push([
          sec.name,
          ' - ' + (sub.item || ''),
          subQty,
          subHasPrice ? formatCurrency(Number(sub.ex)) : 'N/A',
          Number.isFinite(subLineEx) ? formatCurrency(subLineEx) : 'N/A'
        ]);
      }
    }
    const notes = (sec.notes || '').trim();
    if (notes) {
      lines.push(['Section ' + (si + 1) + ' Notes', notes, '', '', '']);
    }
  }

  const discountedEx = recalcGrandTotal(report.grandEx, discountPercent);
  const gstAfter = calculateGst(discountedEx);
  const grandIncl = roundCurrency(discountedEx + gstAfter);

  lines.push(['Total (Ex GST)', '', '', '', formatCurrency(report.grandEx)]);
  lines.push(['Discount (%)', '', '', '', formatPercent(discountPercent)]);
  lines.push(['Grand Total (Ex GST)', '', '', '', formatCurrency(discountedEx)]);
  lines.push(['GST', '', '', '', formatCurrency(gstAfter)]);
  lines.push(['Grand Total (Incl. GST)', '', '', '', formatCurrency(grandIncl)]);

  const out = [];
  for (let r = 0; r < lines.length; r++) {
    const row = lines[r];
    for (let c = 0; c < row.length; c++) {
      row[c] = esc(row[c]);
    }
    out.push(row.join(','));
  }

  const csv = out.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'quote_basket.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (!silent && typeof showToast === 'function') {
    showToast('Quote CSV exported');
  }

  return true;
}
