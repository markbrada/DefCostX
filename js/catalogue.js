import { bus, debounce, formatCurrency, qs, safeFocus } from './utils.js';

const CATALOGUE_DATA = [
  {
    name: 'Site Items',
    groups: [
      {
        title: 'General Labour',
        items: [
          { code: 'LAB001', description: 'Site Labour Allowance', price: 320, unit: 'ea', minCharge: 320, type: 'Service' },
          { code: 'LAB002', description: 'Supervisor Allowance', price: 420, unit: 'ea', minCharge: 420, type: 'Service' }
        ]
      },
      {
        title: 'Equipment',
        items: [
          { code: 'EQP101', description: 'Scissor Lift', price: 680, unit: 'week', minCharge: 680, type: 'Item' }
        ]
      }
    ]
  },
  {
    name: 'Ladders + Stairs',
    groups: [
      {
        title: 'Stair Units',
        items: [
          { code: 'STA300', description: 'Aluminium Stair Unit', price: 1350, unit: 'ea', minCharge: 1350, type: 'Item' }
        ]
      }
    ]
  },
  {
    name: 'Walkway + Platforms',
    groups: [
      {
        title: 'Platform Systems',
        items: [
          { code: 'PLT100', description: 'Fixed Walkway Platform', price: 1880, unit: 'ea', minCharge: 1880, type: 'Item' }
        ]
      }
    ]
  },
  {
    name: 'Height Safety',
    groups: [
      {
        title: 'Static Line',
        items: [
          { code: 'HSS400', description: 'Static Line + Lifeline Kit', price: 2400, unit: 'kit', minCharge: 2400, type: 'Item' }
        ]
      }
    ]
  },
  {
    name: 'Misc',
    groups: [
      {
        title: 'Consumables',
        items: [
          { code: 'MSC120', description: 'Fasteners + Fixings Pack', price: 140, unit: 'pack', minCharge: 140, type: 'Item' }
        ]
      }
    ]
  },
  {
    name: 'Coles',
    groups: [
      {
        title: 'Coles BOH Fencing',
        items: [
          { code: 'CLS900', description: 'Back of House Safety Fence', price: 920, unit: 'ea', minCharge: 920, type: 'Item' },
          { code: 'CLS901', description: 'BOH Gate Assembly', price: 650, unit: 'ea', minCharge: 650, type: 'Item' }
        ]
      }
    ]
  }
];

const MAX_RESULTS = 500;

const template = () => `
  <div class="catalogue-window hidden" role="dialog" aria-label="Catalogue">
    <div class="catalogue-window__titlebar" data-drag-handle>
      <span class="catalogue-window__dot red"></span>
      <span class="catalogue-window__dot yellow"></span>
      <span class="catalogue-window__dot green"></span>
      <strong style="margin-left:12px;">Catalogue</strong>
      <div style="margin-left:auto; display:flex; gap:8px;">
        <button class="btn btn-ghost" data-action="catalogue-minimise" aria-label="Minimise">–</button>
        <button class="btn btn-ghost" data-action="catalogue-toggle-size" aria-label="Toggle size">⤢</button>
        <button class="btn btn-ghost" data-action="catalogue-close" aria-label="Close">×</button>
      </div>
    </div>
    <nav class="catalogue-tabs" role="tablist"></nav>
    <div class="catalogue-search-row">
      <input type="search" placeholder="Type to filter…" aria-label="Search catalogue" data-role="search-input" />
      <label class="catalogue-switch">
        <span>All Tabs</span>
        <span class="switch" role="switch" aria-checked="false" tabindex="0" data-role="switch">
          <span class="switch__thumb"></span>
        </span>
      </label>
      <div class="catalogue-hints">↵ add first • Esc clear/close • ⌘K toggle</div>
    </div>
    <div class="catalogue-results" data-role="results"></div>
  </div>
`;

export class CatalogueController {
  constructor(root, initialState) {
    this.root = root;
    this.state = {
      ...initialState,
      activeTab: initialState.activeTab || CATALOGUE_DATA[0].name,
      lastQuery: initialState.lastQuery || '',
      isOpen: Boolean(initialState.isOpen)
    };
    this.isFullscreen = false;
    this.dragging = false;
    this.resizing = false;
    this.render();
    this.bindEvents();
    if (this.state.isOpen) this.open();
  }

  render() {
    this.root.insertAdjacentHTML('beforeend', template());
    this.windowEl = qs('.catalogue-window', this.root);
    this.tabsEl = qs('.catalogue-tabs', this.windowEl);
    this.searchInput = qs('[data-role="search-input"]', this.windowEl);
    this.switchEl = qs('[data-role="switch"]', this.windowEl);
    this.resultsEl = qs('[data-role="results"]', this.windowEl);

    this.populateTabs();
    this.updateSwitch();
    this.searchInput.value = this.state.lastQuery;
    this.renderResults();
    this.applyWindowPosition();
  }

  populateTabs() {
    this.tabsEl.innerHTML = '';
    CATALOGUE_DATA.forEach((tab) => {
      const button = document.createElement('button');
      button.className = `catalogue-tab${tab.name === this.state.activeTab ? ' active' : ''}`;
      button.type = 'button';
      button.textContent = tab.name;
      button.dataset.tab = tab.name;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-selected', tab.name === this.state.activeTab);
      this.tabsEl.appendChild(button);
    });
  }

  bindEvents() {
    this.tabsEl.addEventListener('click', (event) => {
      const btn = event.target.closest('.catalogue-tab');
      if (!btn) return;
      this.state.activeTab = btn.dataset.tab;
      this.populateTabs();
      this.renderResults();
      this.persistState();
    });

    const updateQuery = debounce(() => {
      this.state.lastQuery = this.searchInput.value;
      this.renderResults();
      this.persistState();
    }, 200);
    this.searchInput.addEventListener('input', updateQuery);
    this.searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        const firstButton = qs('.catalogue-item__add', this.resultsEl);
        if (firstButton) {
          firstButton.click();
        }
      }
      if (event.key === 'Escape') {
        if (this.searchInput.value) {
          this.searchInput.value = '';
          this.state.lastQuery = '';
          this.renderResults();
          this.persistState();
        } else {
          this.close();
          bus.emit('catalogue:visibility', { isOpen: false });
        }
      }
    });

    this.switchEl.addEventListener('click', () => this.toggleAllTabs());
    this.switchEl.addEventListener('keydown', (event) => {
      if (event.key === ' ' || event.key === 'Enter') {
        event.preventDefault();
        this.toggleAllTabs();
      }
    });

    this.windowEl.addEventListener('click', (event) => {
      const action = event.target.dataset.action;
      if (!action) return;
      if (action === 'catalogue-close') {
        this.close();
        bus.emit('catalogue:visibility', { isOpen: false });
      }
      if (action === 'catalogue-minimise') {
        this.windowEl.classList.toggle('hidden');
        this.state.isOpen = !this.windowEl.classList.contains('hidden');
        bus.emit('catalogue:visibility', { isOpen: this.state.isOpen });
        this.persistState();
      }
      if (action === 'catalogue-toggle-size') {
        this.isFullscreen = !this.isFullscreen;
        if (this.isFullscreen) {
          this.windowEl.style.left = '50%';
          this.windowEl.style.top = '12%';
          this.windowEl.style.width = 'min(1100px, calc(100vw - 48px))';
          this.windowEl.style.height = 'min(80vh, 680px)';
          this.windowEl.style.transform = 'translateX(-50%)';
        } else {
          this.applyWindowPosition();
        }
      }
    });

    this.resultsEl.addEventListener('click', (event) => {
      const button = event.target.closest('.catalogue-item__add');
      if (!button) return;
      const { tab, group, index } = button.dataset;
      const record = this.getRecord(tab, group, Number(index));
      if (!record) return;
      bus.emit('catalogue:add-item', record);
    });

    const handle = qs('[data-drag-handle]', this.windowEl);
    handle.addEventListener('pointerdown', (event) => this.beginDrag(event));
    document.addEventListener('pointermove', (event) => this.onPointerMove(event));
    document.addEventListener('pointerup', () => this.endInteractions());
  }

  renderResults() {
    const query = (this.state.lastQuery || '').trim().toLowerCase();
    const results = [];
    const addItem = (tabName, groupTitle, item) => {
      results.push({ tabName, groupTitle, item });
    };

    const activeTabs = this.state.allTabs ? CATALOGUE_DATA : CATALOGUE_DATA.filter((tab) => tab.name === this.state.activeTab);

    activeTabs.forEach((tab) => {
      tab.groups.forEach((group) => {
        group.items.forEach((item) => {
          const haystack = `${item.code} ${item.description}`.toLowerCase();
          if (!query || haystack.includes(query)) {
            addItem(tab.name, group.title, item);
          }
        });
      });
    });

    const limited = results.slice(0, MAX_RESULTS);

    if (limited.length === 0) {
      this.resultsEl.innerHTML = '<p style="opacity:0.6;">No catalogue results.</p>';
      return;
    }

    const groups = new Map();
    limited.forEach((entry) => {
      const key = `${entry.tabName}::${entry.groupTitle}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(entry);
    });

    const frag = document.createDocumentFragment();
    groups.forEach((entries, key) => {
      const [, groupTitle] = key.split('::');
      const wrap = document.createElement('div');
      wrap.className = 'catalogue-group';
      const title = document.createElement('div');
      title.className = 'catalogue-group__title';
      title.textContent = groupTitle;
      wrap.appendChild(title);
      entries.forEach((entry, idx) => {
        const row = document.createElement('div');
        row.className = 'catalogue-item';
        row.innerHTML = `
          <span>${entry.item.code}</span>
          <span>${entry.item.description}</span>
          <span>${entry.item.unit}</span>
          <span>${formatCurrency(entry.item.price)}</span>
          <span>${formatCurrency(entry.item.minCharge)}</span>
          <span>${entry.item.type}</span>
          <button class="btn catalogue-item__add" data-tab="${entry.tabName}" data-group="${entry.groupTitle}" data-index="${idx}">+ Add</button>
        `;
        if (this.state.allTabs) {
          const badge = document.createElement('span');
          badge.className = 'badge-tab';
          badge.textContent = entry.tabName;
          row.children[1].appendChild(badge);
        }
        wrap.appendChild(row);
      });
      frag.appendChild(wrap);
    });

    this.resultsEl.innerHTML = '';
    this.resultsEl.appendChild(frag);
  }

  toggleAllTabs() {
    this.state.allTabs = !this.state.allTabs;
    this.updateSwitch();
    this.renderResults();
    this.persistState();
  }

  updateSwitch() {
    const on = Boolean(this.state.allTabs);
    this.switchEl.dataset.state = on ? 'on' : 'off';
    this.switchEl.setAttribute('aria-checked', on);
  }

  getRecord(tabName, groupTitle, index) {
    const tab = CATALOGUE_DATA.find((tab) => tab.name === tabName);
    if (!tab) return null;
    const group = tab.groups.find((group) => group.title === groupTitle);
    if (!group) return null;
    const item = group.items[index];
    if (!item) return null;
    return { ...item, sourceTab: tabName, groupTitle };
  }

  open() {
    this.state.isOpen = true;
    this.windowEl.classList.remove('hidden');
    safeFocus(this.searchInput);
    this.persistState();
  }

  close() {
    this.state.isOpen = false;
    this.windowEl.classList.add('hidden');
    this.persistState();
  }

  applyWindowPosition() {
    const { x, y, w, h } = this.state;
    if (typeof x === 'number') this.windowEl.style.left = `${x}px`;
    if (typeof y === 'number') this.windowEl.style.top = `${y}px`;
    if (typeof w === 'number') this.windowEl.style.width = `${w}px`;
    if (typeof h === 'number') this.windowEl.style.height = `${h}px`;
    this.windowEl.style.transform = 'translateX(-50%)';
  }

  persistState() {
    bus.emit('catalogue:state-change', { ...this.state });
  }

  beginDrag(event) {
    this.dragging = true;
    this.dragOffset = {
      x: event.clientX - this.windowEl.getBoundingClientRect().left,
      y: event.clientY - this.windowEl.getBoundingClientRect().top
    };
    this.windowEl.setPointerCapture(event.pointerId);
  }

  onPointerMove(event) {
    if (this.dragging) {
      const left = event.clientX - this.dragOffset.x;
      const top = event.clientY - this.dragOffset.y;
      this.windowEl.style.left = `${left}px`;
      this.windowEl.style.top = `${top}px`;
      this.windowEl.style.transform = 'translateX(0)';
      Object.assign(this.state, { x: left, y: top });
      this.persistState();
    }
  }

  endInteractions() {
    if (this.dragging) {
      this.dragging = false;
    }
    if (this.resizing) {
      this.resizing = false;
    }
  }
}

export const initCatalogue = (root, state) => {
  const controller = new CatalogueController(root, state);
  bus.on('catalogue:toggle', () => {
    if (controller.state.isOpen) {
      controller.close();
    } else {
      controller.open();
    }
  });
  bus.on('catalogue:open', () => controller.open());
  bus.on('catalogue:close', () => controller.close());
  return controller;
};
