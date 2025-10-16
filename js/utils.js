const listeners = new Map();

export const bus = {
  on(event, handler) {
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(handler);
    return () => this.off(event, handler);
  },
  off(event, handler) {
    if (listeners.has(event)) {
      listeners.get(event).delete(handler);
    }
  },
  emit(event, payload) {
    if (!listeners.has(event)) return;
    for (const handler of listeners.get(event)) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[bus] handler for ${event} failed`, err);
      }
    }
  }
};

export const qs = (selector, scope = document) => scope.querySelector(selector);
export const qsa = (selector, scope = document) => [...scope.querySelectorAll(selector)];

export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export const debounce = (fn, delay = 250) => {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
};

export const uniqueId = (prefix = 'id') => `${prefix}_${Math.random().toString(36).slice(2, 9)}`;

export const parseNumber = (value) => {
  if (value === null || value === undefined) return NaN;
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const cleaned = String(value).replace(/[^0-9.+-]/g, '');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : NaN;
};

export const roundCurrency = (value, precision = 2) => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** precision;
  return Math.round((value + Number.EPSILON) * factor) / factor;
};

export const formatCurrency = (value) => {
  const num = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
};

export const formatCompactCurrency = (value) => {
  const num = Number.isFinite(value) ? value : 0;
  return num === 0 ? '$0.00' : formatCurrency(num);
};

export const formatPercent = (value) => {
  const num = Number.isFinite(value) ? value : 0;
  return `${roundCurrency(num, 2)}%`;
};

export const safeFocus = (el) => {
  if (el && typeof el.focus === 'function') {
    window.requestAnimationFrame(() => el.focus());
  }
};

export const toggleTheme = (isDark) => {
  const nextTheme = isDark ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', nextTheme);
  window.localStorage.setItem('defcost_theme', nextTheme);
};

export const loadTheme = () => {
  const stored = window.localStorage.getItem('defcost_theme');
  if (stored) {
    document.documentElement.setAttribute('data-theme', stored);
    return stored === 'dark';
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  return prefersDark;
};

export const keybinder = (() => {
  const registry = new Map();
  document.addEventListener('keydown', (event) => {
    const key = [];
    if (event.metaKey || event.ctrlKey) key.push('mod');
    if (event.shiftKey) key.push('shift');
    key.push(event.key.toLowerCase());
    const signature = key.join('+');
    if (registry.has(signature)) {
      for (const handler of registry.get(signature)) {
        const shouldPrevent = handler(event) !== false;
        if (shouldPrevent) event.preventDefault();
      }
    }
  });
  return {
    register(signature, handler) {
      const key = signature.toLowerCase();
      if (!registry.has(key)) registry.set(key, new Set());
      registry.get(key).add(handler);
      return () => registry.get(key)?.delete(handler);
    }
  };
})();

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const serializeDate = () => new Date().toISOString();
