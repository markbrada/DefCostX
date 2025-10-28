const GST_RATE = 0.10;

const currencyFormatter = (() => {
  try {
    return new Intl.NumberFormat('en-AU', {
      style: 'currency',
      currency: 'AUD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  } catch (err) {
    return null;
  }
})();

export function lineTotal(qty, price) {
  let q = Number.isFinite(qty) ? qty : 0;
  if (q < 0) {
    q = 0;
  }
  const p = Number.isFinite(price) ? price : 0;
  return q * p;
}

export function roundCurrency(val) {
  if (!isFinite(val)) {
    return 0;
  }
  return Math.round(val * 100) / 100;
}

export function formatCurrency(val) {
  return roundCurrency(isFinite(val) ? val : 0).toFixed(2);
}

export function formatCurrencyWithSymbol(val) {
  const safe = roundCurrency(isFinite(val) ? val : 0);
  if (currencyFormatter) {
    try {
      return currencyFormatter.format(safe);
    } catch (err) {
      // fall through
    }
  }
  const parts = safe.toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '$' + parts.join('.');
}

export function formatPercent(val) {
  return roundCurrency(isFinite(val) ? val : 0).toFixed(2);
}

export function recalcGrandTotal(base, discount) {
  const b = isFinite(base) ? base : 0;
  const d = isFinite(discount) ? discount : 0;
  let computed = b * (1 - d / 100);
  if (!isFinite(computed)) {
    computed = 0;
  }
  return roundCurrency(computed < 0 ? 0 : computed);
}

export function calculateGst(amount) {
  const base = isFinite(amount) ? amount : 0;
  return roundCurrency(base * GST_RATE);
}

export function buildReportModel(basket, sections) {
  const safeSections = Array.isArray(sections) && sections.length
    ? sections
    : [{ id: 1, name: 'Section 1', notes: '' }];

  const sectionsById = {};
  for (let i = 0; i < safeSections.length; i++) {
    sectionsById[safeSections[i].id] = safeSections[i];
  }

  const sanitizePercent = (value) => {
    if (value == null || value === '') {
      return 0;
    }
    const num = parseFloat(value);
    if (!isFinite(num)) {
      return 0;
    }
    if (num < 0) {
      return 0;
    }
    if (num > 100) {
      return 100;
    }
    return roundCurrency(num);
  };

  const sanitizeOverride = (value) => {
    if (value == null || value === '') {
      return null;
    }
    const num = parseFloat(value);
    if (!isFinite(num)) {
      return null;
    }
    return roundCurrency(Math.max(0, num));
  };

  const overridesById = {};
  for (const key in sectionsById) {
    if (Object.prototype.hasOwnProperty.call(sectionsById, key)) {
      overridesById[key] = sanitizeOverride(sectionsById[key].overrideTotalEx);
    }
  }

  const childMap = {};
  for (let i = 0; i < (basket ? basket.length : 0); i++) {
    const entry = basket[i];
    if (entry && entry.pid) {
      (childMap[entry.pid] || (childMap[entry.pid] = [])).push(entry);
    }
  }

  const secMap = {};
  function ensureSection(id) {
    const source = sectionsById[id];
    if (secMap[id]) {
      secMap[id].notes = source && typeof source.notes === 'string' ? source.notes : '';
      return secMap[id];
    }
    const name = source ? source.name : 'Section ' + id;
    secMap[id] = {
      id: id,
      name: name,
      items: [],
      rawTotalEx: 0,
      sectionDiscountPercent: sanitizePercent(source && source.discountPercent),
      discountedEx: 0,
      discountValueEx: 0,
      effectiveDiscountPercent: 0,
      overrideTotalEx: null,
      hasOverride: false,
      notes: source && typeof source.notes === 'string' ? source.notes : ''
    };
    return secMap[id];
  }

  function addAmounts(obj, qty, ex) {
    const lineEx = lineTotal(qty, ex);
    obj.rawTotalEx += lineEx;
  }

  for (let i = 0; i < (basket ? basket.length : 0); i++) {
    const item = basket[i];
    if (!item || item.pid) {
      continue;
    }
    const sectionId = item.sectionId || safeSections[0].id;
    const section = ensureSection(sectionId);
    const subs = childMap[item.id] || [];
    section.items.push({ parent: item, subs: subs });
    addAmounts(section, item.qty, item.ex);
    for (let k = 0; k < subs.length; k++) {
      addAmounts(section, subs[k].qty, subs[k].ex);
    }
  }

  const orderedSections = [];
  const seenSections = {};
  for (let i = 0; i < safeSections.length; i++) {
    const entry = ensureSection(safeSections[i].id);
    orderedSections.push(entry);
    seenSections[entry.id] = true;
  }

  for (const id in secMap) {
    if (Object.prototype.hasOwnProperty.call(secMap, id) && !seenSections[id]) {
      orderedSections.push(secMap[id]);
    }
  }

  if (!orderedSections.length) {
    const base = safeSections[0];
    orderedSections.push({
      id: base.id,
      name: base.name,
      items: [],
      subtotalEx: 0,
      subtotalGst: 0,
      subtotalTotal: 0,
      notes: base && typeof base.notes === 'string' ? base.notes : ''
    });
  }

  let totalRawEx = 0;
  let totalDiscountedEx = 0;

  for (let s = 0; s < orderedSections.length; s++) {
    const section = orderedSections[s];
    const rawTotal = roundCurrency(section.rawTotalEx);
    const basePercent = sanitizePercent(section.sectionDiscountPercent);
    const overrideCandidate = overridesById[section.id];

    let discounted = roundCurrency(rawTotal * (1 - basePercent / 100));
    let overrideApplied = false;

    if (overrideCandidate != null) {
      const clampedOverride = roundCurrency(Math.min(Math.max(0, overrideCandidate), rawTotal));
      discounted = clampedOverride;
      overrideApplied = true;
      section.overrideTotalEx = clampedOverride;
    } else {
      section.overrideTotalEx = null;
    }

    section.hasOverride = overrideApplied;
    section.rawTotalEx = rawTotal;
    section.sectionDiscountPercent = basePercent;
    section.discountedEx = discounted;
    section.discountValueEx = roundCurrency(rawTotal - discounted);
    section.effectiveDiscountPercent = rawTotal > 0
      ? roundCurrency((section.discountValueEx / rawTotal) * 100)
      : 0;

    totalRawEx += rawTotal;
    totalDiscountedEx += discounted;
  }

  totalRawEx = roundCurrency(totalRawEx);
  totalDiscountedEx = roundCurrency(totalDiscountedEx);
  const discountValue = roundCurrency(totalRawEx - totalDiscountedEx);
  const effectiveDiscountPercent = totalRawEx > 0
    ? roundCurrency((discountValue / totalRawEx) * 100)
    : 0;
  const grandGst = calculateGst(totalDiscountedEx);
  const grandIncl = roundCurrency(totalDiscountedEx + grandGst);

  return {
    sections: orderedSections,
    grandEx: totalRawEx,
    grandGst: grandGst,
    grandTotal: grandIncl,
    discountedEx: totalDiscountedEx,
    discountValueEx: discountValue,
    effectiveDiscountPercent: effectiveDiscountPercent
  };
}

export function computeGrandTotalsState({
  report,
  basketCount,
  discountPercent,
  currentGrandTotal,
  lastBaseTotal,
  preserveGrandTotal
}) {
  const base = report && isFinite(report.grandEx) ? roundCurrency(report.grandEx) : 0;
  const discountedEx = report && isFinite(report.discountedEx) ? roundCurrency(report.discountedEx) : 0;
  const hasItems = basketCount > 0;
  const discount = report && isFinite(report.effectiveDiscountPercent)
    ? report.effectiveDiscountPercent
    : (base > 0 ? roundCurrency((1 - (discountedEx / (base || 1))) * 100) : 0);
  let nextGrandTotal = preserveGrandTotal && isFinite(currentGrandTotal)
    ? roundCurrency(currentGrandTotal)
    : discountedEx;
  let nextLastBase = base;
  let gstAmount = 0;
  let grandIncl = 0;

  if (!hasItems) {
    return {
      hasItems: false,
      base: base,
      discountPercent: discount,
      currentGrandTotal: 0,
      lastBaseTotal: 0,
      gstAmount: 0,
      grandIncl: 0,
      discountedEx: 0
    };
  }

  gstAmount = calculateGst(nextGrandTotal);
  grandIncl = roundCurrency(nextGrandTotal + gstAmount);

  return {
    hasItems: true,
    base: base,
    discountPercent: discount,
    currentGrandTotal: nextGrandTotal,
    lastBaseTotal: nextLastBase,
    gstAmount: gstAmount,
    grandIncl: grandIncl,
    discountedEx: nextGrandTotal
  };
}

export { GST_RATE };
