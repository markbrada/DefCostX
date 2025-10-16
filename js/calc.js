import { roundCurrency } from './utils.js';

const lineTotal = (qty, price) => {
  const q = Number.isFinite(qty) && qty > 0 ? qty : 0;
  const p = Number.isFinite(price) && price > 0 ? price : 0;
  return roundCurrency(q * p);
};

const computeSectionTotals = (sections) => {
  return sections.map((section) => {
    const subtotal = section.items.reduce((sum, item) => {
      const qty = Number.isFinite(item.qty) ? item.qty : 0;
      const price = Number.isFinite(item.price) ? item.price : 0;
      return sum + lineTotal(qty, price);
    }, 0);

    return {
      sectionId: section.id,
      title: section.title,
      subtotal: roundCurrency(subtotal),
    };
  });
};

const computeTotals = ({ sections, discountPct = 0, grandTotalEx }) => {
  const sectionTotals = computeSectionTotals(sections);
  const sectionsEx = roundCurrency(sectionTotals.reduce((sum, sec) => sum + sec.subtotal, 0));
  const discount = Number.isFinite(discountPct) ? clampDiscount(discountPct) : 0;
  const discountedEx = Number.isFinite(grandTotalEx) && grandTotalEx >= 0
    ? roundCurrency(grandTotalEx)
    : roundCurrency(sectionsEx * (1 - discount));

  const resolvedDiscount = sectionsEx === 0 ? 0 : roundCurrency(1 - discountedEx / (sectionsEx || 1));
  const gst = roundCurrency(discountedEx * 0.1);
  const grandIncl = roundCurrency(discountedEx + gst);

  return {
    sectionTotals,
    sectionsEx,
    discountPct: resolvedDiscount,
    discountedEx,
    gst,
    grandIncl,
  };
};

const clampDiscount = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.min(Math.max(value, 0), 0.99);
};

const calculateDiscountFromGrand = (sectionsEx, desiredGrand) => {
  if (!Number.isFinite(sectionsEx) || sectionsEx <= 0) return 0;
  if (!Number.isFinite(desiredGrand) || desiredGrand < 0) return 0;
  const ratio = clampDiscount(1 - desiredGrand / sectionsEx);
  return ratio;
};

export {
  lineTotal,
  computeSectionTotals,
  computeTotals,
  clampDiscount,
  calculateDiscountFromGrand,
};
