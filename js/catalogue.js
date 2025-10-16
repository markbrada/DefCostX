import { qs, createEl, debounce, formatCurrency, emitKeyboardShortcut } from './utils.js';
import { loadCatalogueState, saveCatalogueState } from './storage.js';

const catalogueRoot = qs('#catalogue-root');

const catalogueData = [
  {
    tab: 'Site Items',
    groups: [
      {
        title: 'Site Setup',
        items: [
          { code: 'SI100', description: 'Site mobilization and setup', price: 550, unit: 'ea', minCharge: '$250', type: 'Service' },
          { code: 'SI200', description: 'Project management support', price: 720, unit: 'day', minCharge: '$720', type: 'Service' },
        ],
      },
      {
        title: 'Misc Equipment',
        items: [
          { code: 'EQ015', description: 'Traffic control signage pack', price: 185, unit: 'set', minCharge: '$180', type: 'Item' },
        ],
      },
    ],
  },
  {
    tab: 'Ladders + Stairs',
    groups: [
      {
        title: 'Stair Access',
        items: [
          { code: 'LD110', description: 'Temporary stair install', price: 860, unit: 'ea', minCharge: '$650', type: 'Service' },
          { code: 'LD210', description: 'Modular handrail kit', price: 340, unit: 'ea', minCharge: '$320', type: 'Item' },
        ],
      },
    ],
  },
  {
    tab: 'Walkway + Platforms',
    groups: [
      {
        title: 'Platforms',
        items: [
          { code: 'WP410', description: 'Aluminium walkway 1.5m', price: 455, unit: 'ea', minCharge: '$400', type: 'Item' },
          { code: 'WP900', description: 'Platform mesh upgrade', price: 195, unit: 'ea', minCharge: '$195', type: 'Item' },
        ],
      },
    ],
  },
  {
    tab: 'Height Safety',
    groups: [
      {
        title: 'Lifelines',
        items: [
          { code: 'HS305', description: 'Static line install (per metre)', price: 88, unit: 'm', minCharge: '$300', type: 'Service' },
          { code: 'HS740', description: 'Anchor point certification', price: 140, unit: 'ea', minCharge: '$200', type: 'Service' },
        ],
      },
    ],
  },
  {
    tab: 'Misc',
    groups: [
      {
        title: 'Consumables',
        items: [
          { code: 'MS001', description: 'Fastener kit', price: 45, unit: 'kit', minCharge: '$45', type: 'Item' },
          { code: 'MS020', description: 'Custom fabrication allowance', price: 310, unit: 'ea', minCharge: '$310', type: 'Service' },
        ],
      },
    ],
  },
  {
    tab: 'Coles',
    groups: [
      {
        title: 'Coles BOH Fencing',
        items: [
          { code: 'CL101', description: 'Coles Plantroom Door Kit', price: 557, unit: 'ea', minCharge: '$557', type: 'Item' },
          { code: 'CL205', description: 'Coles Rear Platform Guard', price: 640, unit: 'ea', minCharge: '$640', type: 'Item' },
        ],
      },
    ],
  },
];

let state = {
  isOpen: true,
  x: null,
  y: null,
  w: 960,
  h: 420,
  allTabs: false,
  activeTab: catalogueData[0].tab,
  lastQuery: '',
  minimized: false,
  fullscreen: false,
};

let handlers = {};
let rootEl = null;
let searchInput = null;
let disposeShortcut = null;
let resizeObserver = null;

const initCatalogue = (options = {}) => {
  handlers = options;
  const saved = loadCatalogueState();
  if (saved) state = { ...state, ...saved };
  render();
  disposeShortcut = emitKeyboardShortcut(handleShortcut);
};

const render = () => {
  if (!state.isOpen) {
    catalogueRoot.innerHTML = '';
    return;
  }

  rootEl = createEl('div', { className: 'catalogue-window' });
  if (state.fullscreen) {
    rootEl.style.left = '5%';
    rootEl.style.right = '5%';
    rootEl.style.top = '8%';
    rootEl.style.bottom = '8%';
    rootEl.style.width = 'auto';
    rootEl.style.height = 'auto';
    rootEl.style.transform = 'none';
  } else {
    rootEl.style.width = `${state.w}px`;
    rootEl.style.height = `${state.h}px`;
    if (state.x !== null && state.y !== null) {
      rootEl.style.left = `${state.x}px`;
      rootEl.style.top = `${state.y}px`;
      rootEl.style.bottom = 'auto';
      rootEl.style.transform = 'none';
    } else {
      rootEl.style.left = '50%';
      rootEl.style.transform = 'translateX(-50%)';
      rootEl.style.bottom = '32px';
    }
  }
  if (state.minimized) rootEl.classList.add('minimized');

  const header = createEl('div', { className: 'catalogue-header' });
  header.innerHTML = `
    <div class="catalogue-dots">
      <span class="catalogue-dot dot-close" data-action="close"></span>
      <span class="catalogue-dot dot-minimize" data-action="minimize"></span>
      <span class="catalogue-dot dot-maximize" data-action="maximize"></span>
    </div>
    <div>Catalogue</div>
  `;
  rootEl.appendChild(header);

  const tabsRow = createEl('div', { className: 'catalogue-tabs' });
  catalogueData.forEach((tab) => {
    const button = createEl('button', {
      className: `catalogue-tab${state.activeTab === tab.tab ? ' active' : ''}`,
      textContent: tab.tab,
    });
    button.dataset.tab = tab.tab;
    button.addEventListener('click', () => {
      state.activeTab = tab.tab;
      state.minimized = false;
      persist();
      render();
    });
    tabsRow.appendChild(button);
  });
  rootEl.appendChild(tabsRow);

  const searchRow = createSearchRow();
  rootEl.appendChild(searchRow);

  const list = createEl('div', { className: 'catalogue-list' });
  renderList(list);
  rootEl.appendChild(list);

  catalogueRoot.innerHTML = '';
  catalogueRoot.appendChild(rootEl);

  attachDrag(header);
  attachResize();
};

const createSearchRow = () => {
  const row = createEl('div', { className: 'catalogue-search-row' });
  const input = createEl('input', {
    attrs: { type: 'search', placeholder: 'Type to filter…', value: state.lastQuery },
  });
  searchInput = input;
  input.addEventListener('input', debounce((event) => {
    state.lastQuery = event.target.value;
    render();
    persist();
  }, 200));

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      const first = rootEl.querySelector('.catalogue-item button.add-btn');
      if (first) {
        first.click();
      }
    } else if (event.key === 'Escape') {
      if (state.lastQuery) {
        state.lastQuery = '';
        input.value = '';
        render();
        persist();
      } else {
        toggleOpen(false);
      }
    }
  });

  const switchLabel = createEl('label', { className: 'switch', attrs: { 'aria-label': 'All Tabs' } });
  const checkbox = createEl('input', { attrs: { type: 'checkbox' } });
  checkbox.checked = state.allTabs;
  checkbox.addEventListener('change', () => {
    state.allTabs = checkbox.checked;
    persist();
    render();
  });
  const slider = createEl('span', { className: 'slider' });
  switchLabel.appendChild(checkbox);
  switchLabel.appendChild(slider);

  const hints = createEl('div', { className: 'keyboard-hints', html: '<span>Enter = Add first result</span><span>Esc = Clear / Close</span>' });

  row.appendChild(input);
  row.appendChild(switchLabel);
  row.appendChild(hints);

  return row;
};

const getVisibleItems = () => {
  const query = state.lastQuery.trim().toLowerCase();
  const tabs = state.allTabs ? catalogueData : catalogueData.filter((tab) => tab.tab === state.activeTab);
  const results = [];
  tabs.forEach((tab) => {
    tab.groups.forEach((group) => {
      const filtered = group.items.filter((item) => !query || `${item.code} ${item.description}`.toLowerCase().includes(query));
      if (!filtered.length) return;
      results.push({ tab: tab.tab, title: group.title, items: filtered });
    });
  });
  return results.slice(0, 500);
};

const renderList = (container) => {
  const groups = getVisibleItems();
  if (!groups.length) {
    container.innerHTML = '<div class="empty-state">No catalogue results</div>';
    return;
  }
  container.innerHTML = '';
  groups.forEach((group) => {
    const groupEl = createEl('div', { className: 'catalogue-group' });
    const header = createEl('h4', { textContent: group.title + (state.allTabs ? ` · ${group.tab}` : '') });
    groupEl.appendChild(header);
    group.items.forEach((item) => {
      groupEl.appendChild(renderItemRow(group.tab, item));
    });
    container.appendChild(groupEl);
  });
};

const renderItemRow = (tab, item) => {
  const row = createEl('div', { className: 'catalogue-item' });
  row.innerHTML = `
    <div>${item.code}</div>
    <div>${item.description}</div>
    <div>${formatCurrency(item.price)}</div>
    <div>${item.unit}</div>
    <div>${item.minCharge}</div>
    <div>${item.type}</div>
    <div>
      ${state.allTabs ? `<span class="tab-badge">${tab}</span>` : ''}
      <button class="add-btn">Add</button>
    </div>
  `;
  row.querySelector('.add-btn').addEventListener('click', () => {
    handlers.onAddItem?.({
      label: item.description,
      code: item.code,
      unit: item.unit,
      price: item.price,
      sourceTab: tab,
    });
  });
  return row;
};

const attachDrag = (header) => {
  let startX;
  let startY;
  let startLeft;
  let startTop;

  const onMouseMove = (event) => {
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    const nextX = startLeft + dx;
    const nextY = startTop + dy;
    rootEl.style.left = `${nextX}px`;
    rootEl.style.top = `${nextY}px`;
    rootEl.style.transform = 'none';
    rootEl.style.bottom = 'auto';
    state.x = nextX;
    state.y = nextY;
  };

  const onMouseUp = () => {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
    persist();
  };

  header.addEventListener('mousedown', (event) => {
    if (event.target.dataset.action) return;
    if (state.fullscreen) return;
    startX = event.clientX;
    startY = event.clientY;
    startLeft = rootEl.offsetLeft;
    startTop = rootEl.offsetTop;
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  header.addEventListener('click', (event) => {
    const action = event.target.dataset.action;
    if (!action) return;
    if (action === 'close') {
      toggleOpen(false);
    } else if (action === 'minimize') {
      state.minimized = !state.minimized;
      persist();
      render();
    } else if (action === 'maximize') {
      state.fullscreen = !state.fullscreen;
      if (state.fullscreen) {
        rootEl.style.left = '5%';
        rootEl.style.right = '5%';
        rootEl.style.top = '8%';
        rootEl.style.bottom = '8%';
        rootEl.style.width = 'auto';
        rootEl.style.height = 'auto';
      } else {
        state.w = 960;
        state.h = 420;
      }
      persist();
      render();
    }
  });
};

const attachResize = () => {
  resizeObserver?.disconnect();
  resizeObserver = new ResizeObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.target !== rootEl || state.fullscreen) return;
      state.w = entry.contentRect.width;
      state.h = entry.contentRect.height;
      persist();
    });
  });
  resizeObserver.observe(rootEl);
};

const persist = () => {
  saveCatalogueState({
    isOpen: state.isOpen,
    x: state.x,
    y: state.y,
    w: state.w,
    h: state.h,
    allTabs: state.allTabs,
    activeTab: state.activeTab,
    lastQuery: state.lastQuery,
    minimized: state.minimized,
    fullscreen: state.fullscreen,
  });
};

const toggleOpen = (force) => {
  const next = typeof force === 'boolean' ? force : !state.isOpen;
  state.isOpen = next;
  persist();
  render();
  if (state.isOpen) {
    setTimeout(() => searchInput?.focus(), 0);
  }
};

const handleShortcut = (event) => {
  const meta = event.metaKey || event.ctrlKey;
  if (meta && event.key.toLowerCase() === 'k') {
    event.preventDefault();
    toggleOpen();
    if (state.isOpen) {
      setTimeout(() => searchInput?.focus(), 0);
    }
  }
};

const teardownCatalogue = () => {
  disposeShortcut?.();
  resizeObserver?.disconnect();
};

export {
  initCatalogue,
  toggleOpen,
  teardownCatalogue,
  render as renderCatalogue,
};
