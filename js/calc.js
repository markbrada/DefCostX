import { roundCurrency } from './utils.js';

export const lineTotal = (qty, price) => {
  const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 0;
  const safePrice = Number.isFinite(price) && price > 0 ? price : 0;
  return roundCurrency(safeQty * safePrice, 2);
};

export const computeSectionTotals = (sections) => {
  const totals = new Map();
  sections.forEach((section) => {
    const subtotal = section.items.reduce((acc, item) => {
      const qty = Number.isFinite(item.qty) ? item.qty : 0;
      const price = Number.isFinite(item.price) ? item.price : 0;
      return acc + lineTotal(qty, price);
    }, 0);
    totals.set(section.id, roundCurrency(subtotal, 2));
  });
  return totals;
};

export const computeQuoteTotals = (basket) => {
  const sectionsTotal = basket.sections.reduce((acc, section) => acc + section.items.reduce((sum, item) => {
    return sum + lineTotal(item.qty, item.price);
  }, 0), 0);

  const totalEx = roundCurrency(sectionsTotal, 2);
  const discountPct = Number.isFinite(basket.discountPct) ? basket.discountPct : 0;
  const discountedEx = applyDiscountPct(totalEx, discountPct);
  const gst = roundCurrency(discountedEx * 0.1, 2);
  const grandIncl = roundCurrency(discountedEx + gst, 2);

  return {
    totalEx,
    discountPct: roundCurrency(discountPct, 4),
    discountedEx,
    gst,
    grandIncl
  };
};

export const applyDiscountPct = (totalEx, discountPct) => {
  const pct = Number.isFinite(discountPct) ? discountPct : 0;
  const pctClamped = Math.min(Math.max(pct, 0), 100);
  const discounted = totalEx * (1 - pctClamped / 100);
  return roundCurrency(discounted, 2);
};

export const deriveDiscountFromGrandTotal = (totalEx, desiredGrand) => {
  const safeTotal = Number.isFinite(totalEx) && totalEx > 0 ? totalEx : 0;
  const safeDesired = Number.isFinite(desiredGrand) ? desiredGrand : 0;
  if (safeTotal === 0) {
    return { discountPct: 0, discountedEx: 0 };
  }
  const pct = 100 - (safeDesired / safeTotal) * 100;
  return {
    discountPct: roundCurrency(Math.min(Math.max(pct, 0), 100), 4),
    discountedEx: roundCurrency(safeDesired, 2)
  };
};

export const syncGrandTotal = (basket, { discountPct, discountedEx }) => {
  const totalEx = basket.sections.reduce((acc, section) => acc + section.items.reduce((sum, item) => sum + lineTotal(item.qty, item.price), 0), 0);
  if (typeof discountPct === 'number') {
    const nextDiscounted = applyDiscountPct(totalEx, discountPct);
    const gst = roundCurrency(nextDiscounted * 0.1, 2);
    return {
      discountPct: roundCurrency(Math.min(Math.max(discountPct, 0), 100), 4),
      discountedEx: nextDiscounted,
      gst,
      grandIncl: roundCurrency(nextDiscounted + gst, 2)
    };
  }
  if (typeof discountedEx === 'number') {
    const derived = deriveDiscountFromGrandTotal(totalEx, discountedEx);
    const gst = roundCurrency(derived.discountedEx * 0.1, 2);
    return {
      discountPct: derived.discountPct,
      discountedEx: derived.discountedEx,
      gst,
      grandIncl: roundCurrency(derived.discountedEx + gst, 2)
    };
  }
  return computeQuoteTotals({ ...basket, discountPct: basket.discountPct || 0 });
};
