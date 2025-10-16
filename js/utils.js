const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

const createEl = (tag, options = {}) => {
  const el = document.createElement(tag);
  if (options.className) el.className = options.className;
  if (options.textContent !== undefined) el.textContent = options.textContent;
  if (options.attrs) Object.entries(options.attrs).forEach(([k, v]) => el.setAttribute(k, v));
  if (options.html !== undefined) el.innerHTML = options.html;
  return el;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const debounce = (fn, wait = 250) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), wait);
  };
};

const safeNumber = (value) => {
  if (value === '' || value === null || value === undefined) return NaN;
  const n = Number(value);
  return Number.isFinite(n) ? n : NaN;
};

const roundCurrency = (n, decimals = 2) => {
  if (!Number.isFinite(n)) return 0;
  const factor = 10 ** decimals;
  return Math.round((n + Number.EPSILON) * factor) / factor;
};

const formatCurrency = (n) => {
  const value = Number.isFinite(n) ? n : 0;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(roundCurrency(value));
};

const formatPercent = (n) => {
  const value = Number.isFinite(n) ? n : 0;
  return `${roundCurrency(value * 100)}%`;
};

const parseCurrencyInput = (value) => {
  const cleaned = `${value}`.replace(/[^0-9.-]/g, '');
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
};

const emitKeyboardShortcut = (handler) => {
  const onKey = (event) => {
    handler(event);
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
};

class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event).add(handler);
    return () => this.off(event, handler);
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.delete(handler);
  }

  emit(event, detail) {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    handlers.forEach((handler) => handler(detail));
  }
}

const uid = (prefix) => `${prefix}_${Math.random().toString(36).slice(2, 8)}`;

const focusTrap = (container, initialSelector) => {
  const focusableSelectors = [
    'a[href]',
    'button:not([disabled])',
    'textarea:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    '[tabindex]:not([tabindex="-1"])'
  ];

  const focusables = () => qsa(focusableSelectors.join(','), container);

  const handleKeyDown = (event) => {
    if (event.key !== 'Tab') return;
    const nodes = focusables();
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  container.addEventListener('keydown', handleKeyDown);
  if (initialSelector) {
    const initial = typeof initialSelector === 'string' ? qs(initialSelector, container) : initialSelector;
    initial?.focus();
  } else {
    focusables()[0]?.focus();
  }

  return () => container.removeEventListener('keydown', handleKeyDown);
};

export {
  qs,
  qsa,
  createEl,
  clamp,
  debounce,
  safeNumber,
  roundCurrency,
  formatCurrency,
  formatPercent,
  parseCurrencyInput,
  emitKeyboardShortcut,
  EventBus,
  uid,
  focusTrap,
};
