window.DefCost = window.DefCost || {};
window.DefCost.state = window.DefCost.state || {};
window.DefCost.api = window.DefCost.api || {};
window.DefCost.ui = window.DefCost.ui || {};

(function(){
  var DEFAULT_TOAST_MS = 3000;

  function getImportSummaryFormatter() {
    var api = window.DefCost.api || {};
    if (typeof api.formatCurrencyWithSymbol === 'function') {
      return api.formatCurrencyWithSymbol;
    }
    if (typeof api.formatCurrency === 'function') {
      return function (value) {
        var formatted = api.formatCurrency(value);
        if (formatted && formatted.indexOf('$') !== 0) {
          return '$' + formatted;
        }
        return formatted;
      };
    }
    return function (value) {
      var number = Number(value);
      if (!isFinite(number)) {
        return '$0.00';
      }
      return '$' + number.toFixed(2);
    };
  }

  function showToast(message, opts) {
    var toastEl = document.getElementById('toast');
    if (!toastEl) {
      return;
    }
    var state = window.DefCost.state = window.DefCost.state || {};
    if (state.toastTimer) {
      clearTimeout(state.toastTimer);
      state.toastTimer = null;
    }

    var options;
    if (typeof opts === 'function') {
      options = { onClick: opts };
    } else {
      options = opts || {};
    }

    var actionHandler = null;
    if (typeof options.onClick === 'function') {
      actionHandler = options.onClick;
    } else if (typeof options.onUndo === 'function') {
      actionHandler = options.onUndo;
    }

    toastEl.textContent = message == null ? '' : String(message);
    toastEl.classList.add('show');

    var clear = function () {
      toastEl.classList.remove('show');
      toastEl.style.cursor = 'default';
      toastEl.onclick = null;
      if (state.toastTimer) {
        clearTimeout(state.toastTimer);
        state.toastTimer = null;
      }
    };

    if (actionHandler) {
      toastEl.style.cursor = 'pointer';
      toastEl.onclick = function (ev) {
        if (ev && typeof ev.preventDefault === 'function') {
          ev.preventDefault();
        }
        actionHandler();
        clear();
      };
    } else {
      toastEl.style.cursor = 'default';
      toastEl.onclick = null;
    }

    var duration = options && isFinite(options.duration) ? options.duration : DEFAULT_TOAST_MS;
    state.toastTimer = window.setTimeout(function () {
      clear();
    }, duration);
  }

  function showImportSummaryModal(summary, options) {
    if (!summary) {
      return;
    }
    var api = window.DefCost.api || {};
    if (typeof api.closeImportSummaryModal === 'function') {
      api.closeImportSummaryModal();
    }

    var overlay = document.createElement('div');
    overlay.className = 'import-summary-backdrop';
    overlay.setAttribute('role', 'presentation');

    var card = document.createElement('div');
    card.className = 'import-summary-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('tabindex', '-1');

    var title = document.createElement('h2');
    title.className = 'import-summary-title';
    title.id = 'import-summary-title';
    title.textContent = 'Import Summary';
    card.setAttribute('aria-labelledby', 'import-summary-title');

    var subtitle = document.createElement('p');
    subtitle.className = 'import-summary-subtitle';
    subtitle.id = 'import-summary-subtitle';
    subtitle.textContent = 'Your quote has been successfully imported.';
    card.setAttribute('aria-describedby', 'import-summary-subtitle');

    var table = document.createElement('table');
    table.className = 'import-summary-table';
    var tbody = document.createElement('tbody');

    var formatCurrency = getImportSummaryFormatter();
    var rows = [
      ['Imported Sections', String(summary.sections || 0)],
      ['Parent Items', String(summary.parents || 0)],
      ['Child Items', String(summary.children || 0)],
      ['Notes', String(summary.notes || 0)],
      ['Quote Total (Ex. GST)', formatCurrency(summary.totalEx)]
    ];

    for (var i = 0; i < rows.length; i++) {
      var tr = document.createElement('tr');
      var labelTd = document.createElement('td');
      labelTd.textContent = rows[i][0];
      var valueTd = document.createElement('td');
      valueTd.textContent = rows[i][1];
      tr.appendChild(labelTd);
      tr.appendChild(valueTd);
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);

    var divider = document.createElement('div');
    divider.className = 'import-summary-divider';

    var actions = document.createElement('div');
    actions.className = 'import-summary-actions';

    var viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'import-summary-view-btn';
    viewBtn.textContent = 'View Quote';

    var undoBtn = document.createElement('button');
    undoBtn.type = 'button';
    undoBtn.className = 'import-summary-undo-btn';
    undoBtn.textContent = 'Undo Import';

    actions.appendChild(viewBtn);
    actions.appendChild(undoBtn);

    card.appendChild(title);
    card.appendChild(subtitle);
    card.appendChild(table);
    card.appendChild(divider);
    card.appendChild(actions);

    overlay.appendChild(card);

    var previousFocus = document.activeElement;
    var previousOverflow = document.body.style.overflow;

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    var focusables = Array.prototype.slice.call(
      card.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')
    );

    var keyHandler = function (ev) {
      var currentState = window.DefCost && window.DefCost.state ? window.DefCost.state.importSummaryState : null;
      if (!currentState) {
        return;
      }
      if (ev.key === 'Escape' || ev.key === 'Esc') {
        ev.preventDefault();
        if (typeof api.closeImportSummaryModal === 'function') {
          api.closeImportSummaryModal();
        }
        return;
      }
      if (ev.key === 'Tab') {
        if (!focusables.length) {
          return;
        }
        var active = document.activeElement;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (ev.shiftKey) {
          if (!card.contains(active) || active === first) {
            ev.preventDefault();
            last.focus();
          }
        } else if (active === last) {
          ev.preventDefault();
          first.focus();
        }
      }
    };

    var focusHandler = function (ev) {
      var currentState = window.DefCost && window.DefCost.state ? window.DefCost.state.importSummaryState : null;
      if (!currentState) {
        return;
      }
      if (!overlay.contains(ev.target)) {
        ev.stopPropagation();
        if (focusables.length) {
          focusables[0].focus();
        } else {
          card.focus();
        }
      }
    };

    var modalState = {
      overlay: overlay,
      keyHandler: keyHandler,
      focusHandler: focusHandler,
      previousFocus: previousFocus,
      bodyOverflow: previousOverflow
    };

    window.DefCost.state.importSummaryState = modalState;

    document.addEventListener('keydown', keyHandler, true);
    document.addEventListener('focus', focusHandler, true);

    setTimeout(function () {
      try {
        viewBtn.focus();
      } catch (err) {
        // ignore focus errors
      }
    }, 0);

    viewBtn.addEventListener('click', function () {
      if (typeof api.closeImportSummaryModal === 'function') {
        api.closeImportSummaryModal();
      }
    });

    undoBtn.addEventListener('click', function () {
      if (typeof api.closeImportSummaryModal === 'function') {
        api.closeImportSummaryModal();
      }
      if (options && typeof options.onUndo === 'function') {
        options.onUndo();
      }
    });
  }

  function renderBasket() {
    var state = window.DefCost.state = window.DefCost.state || {};
    var api = window.DefCost.api = window.DefCost.api || {};

    var ensureSectionState = typeof state.ensureSectionState === 'function'
      ? state.ensureSectionState
      : function () {};
    ensureSectionState();

    var basketGetter = typeof state.getBasket === 'function' ? state.getBasket : null;
    var sectionsGetter = typeof state.getSections === 'function' ? state.getSections : null;
    var basket = basketGetter ? basketGetter() : (Array.isArray(state.basket) ? state.basket : []);
    var sections = sectionsGetter ? sectionsGetter() : (Array.isArray(state.sections) ? state.sections : []);
    var activeSectionId = typeof state.getActiveSectionId === 'function'
      ? state.getActiveSectionId()
      : state.activeSectionId;
    var captureParentId = typeof state.getCaptureParentId === 'function'
      ? state.getCaptureParentId()
      : state.captureParentId;

    var setBasket = typeof state.setBasket === 'function'
      ? state.setBasket
      : function (next) {
          state.basket = Array.isArray(next) ? next : [];
          return state.basket;
        };
    var setActiveSectionId = typeof state.setActiveSectionId === 'function'
      ? state.setActiveSectionId
      : function (next) {
          state.activeSectionId = next;
          return next;
        };
    var setCaptureParentId = typeof state.setCaptureParentId === 'function'
      ? state.setCaptureParentId
      : function (next) {
          state.captureParentId = next;
          return next;
        };
    var incrementUid = typeof state.incrementUid === 'function'
      ? state.incrementUid
      : function () {
          var current = typeof state.getUid === 'function' ? state.getUid() : state.uid || 0;
          current += 1;
          state.uid = current;
          return current;
        };

    var persistBasket = typeof state.persistBasket === 'function'
      ? state.persistBasket
      : function () {
          if (typeof api.saveBasket === 'function') {
            var discount = typeof state.getDiscountPercent === 'function'
              ? state.getDiscountPercent()
              : state.discountPercent || 0;
            var currentActive = typeof state.getActiveSectionId === 'function'
              ? state.getActiveSectionId()
              : state.activeSectionId;
            api.saveBasket({
              basket: basketGetter ? basketGetter() : (Array.isArray(state.basket) ? state.basket : []),
              sections: sectionsGetter ? sectionsGetter() : (Array.isArray(state.sections) ? state.sections : []),
              activeSectionId: currentActive,
              discountPercent: discount
            });
          }
        };

    var container = document.getElementById('basketContainer');
    var bBody = state.bBody || (typeof state.getBasketBody === 'function' ? state.getBasketBody() : null);
    var bFoot = state.bFoot || (typeof state.getBasketFoot === 'function' ? state.getBasketFoot() : null);

    if (!container || !bBody || !bFoot) {
      persistBasket();
      return;
    }

    if (window.Sortable && !state.Sortable) {
      state.Sortable = window.Sortable;
    }

    var qbDockIcon = state.qbDockIcon;
    if (qbDockIcon) {
      qbDockIcon.textContent = 'Catalogue';
    }
    var qbTitle = state.qbTitle;
    if (qbTitle) {
      qbTitle.textContent = basket.length ? 'Quote Builder (' + basket.length + ')' : 'Quote Builder';
    }

    var renderSectionTabs = typeof state.renderSectionTabs === 'function' ? state.renderSectionTabs : null;
    if (renderSectionTabs) {
      renderSectionTabs();
    }

    var updateTotals = typeof api.recalcTotals === 'function'
      ? api.recalcTotals
      : (typeof state.updateGrandTotals === 'function' ? state.updateGrandTotals : function () {});
    var updateBasketHeaderOffset = typeof state.updateBasketHeaderOffset === 'function'
      ? state.updateBasketHeaderOffset
      : function () {};

    if (!Array.isArray(sections)) {
      sections = [];
    }

    if (!basket.length) {
      bBody.innerHTML = '';
      bFoot.innerHTML = '';
      updateTotals(null, { preserveGrandTotal: true });
      persistBasket();
      updateBasketHeaderOffset();
      return;
    }

    var fallback = sections[0] ? sections[0].id : 1;
    if (!sections.some(function (sec) { return sec.id === activeSectionId; })) {
      activeSectionId = setActiveSectionId(fallback);
    }

    bBody.innerHTML = '';
    var childrenMap = {};
    for (var i = 0; i < basket.length; i++) {
      var item = basket[i];
      if (item && item.pid) {
        (childrenMap[item.pid] || (childrenMap[item.pid] = [])).push(item);
      }
    }

    var captureFound = false;
    var getSectionNameById = typeof state.getSectionNameById === 'function'
      ? state.getSectionNameById
      : function (id) { return 'Section ' + id; };
    var cascadeSectionToChildren = typeof state.cascadeSectionToChildren === 'function'
      ? state.cascadeSectionToChildren
      : function () {};
    var setParentSection = typeof state.setParentSection === 'function'
      ? state.setParentSection
      : function () {};
    var buildReportModel = typeof state.buildReportModel === 'function'
      ? state.buildReportModel
      : (typeof api.buildReportModel === 'function' ? api.buildReportModel : function () { return null; });
    var getSectionById = typeof state.getSectionById === 'function'
      ? state.getSectionById
      : function () { return null; };
    var lineTotalFn = typeof api.lineTotal === 'function'
      ? api.lineTotal
      : function (qty, price) {
          var q = Number.isFinite(qty) ? qty : 0;
          if (q < 0) {
            q = 0;
          }
          var p = Number.isFinite(price) ? price : 0;
          return q * p;
        };
    var formatCurrency = typeof api.formatCurrency === 'function'
      ? api.formatCurrency
      : function (value) {
          var num = Number(value);
          if (!isFinite(num)) {
            return '0.00';
          }
          return num.toFixed(2);
        };
    var getDisplayQty = function (value) {
      if (Number.isFinite(value)) {
        return value > 0 ? value : 0;
      }
      return 1;
    };
    var clampQty = function (value) {
      if (!Number.isFinite(value) || value <= 0) {
        return 0;
      }
      return value;
    };
    var getQtyOrDefault = function (value) {
      if (!Number.isFinite(value)) {
        return 1;
      }
      return value;
    };

    function renderParent(b) {
      if (!sections.some(function (sec) { return sec.id === b.sectionId; })) {
        b.sectionId = fallback;
      }
      var parentSectionName = getSectionNameById(b.sectionId);
      if (captureParentId === b.id) {
        captureFound = true;
      }
      var tr = document.createElement('tr');
      tr.className = 'main-row';
      tr.dataset.id = String(b.id || '');
      var tdHandle = document.createElement('td');
      tdHandle.className = 'sort-handle';
      tdHandle.textContent = '≡';
      tr.appendChild(tdHandle);
      var tdSection = document.createElement('td');
      tdSection.className = 'section-cell';
      var secSelect = document.createElement('select');
      secSelect.className = 'section-select';
      for (var si = 0; si < sections.length; si++) {
        var opt = document.createElement('option');
        opt.value = String(sections[si].id);
        opt.textContent = sections[si].name;
        if (sections[si].id === b.sectionId) {
          opt.selected = true;
        }
        secSelect.appendChild(opt);
      }
      secSelect.value = String(b.sectionId);
      secSelect.onchange = function () {
        var newSectionId = parseInt(secSelect.value, 10);
        captureParentId = setCaptureParentId(null);
        setParentSection(b, newSectionId);
        renderBasket();
      };
      tdSection.appendChild(secSelect);
      tr.appendChild(tdSection);
      var tdItem = document.createElement('td');
      var ctrl = document.createElement('span');
      ctrl.className = 'sub-controls';
      var cap = document.createElement('button');
      cap.className = 'subbtn' + (captureParentId === b.id ? ' active' : '');
      cap.title = 'Capture catalog adds as sub-items';
      cap.textContent = '⊞';
      cap.onclick = function () {
        captureParentId = setCaptureParentId(captureParentId === b.id ? null : b.id);
        renderBasket();
      };
      var tog = document.createElement('button');
      tog.className = 'subbtn';
      tog.title = 'Collapse/expand sub-items';
      tog.textContent = b.collapsed ? '▸' : '▾';
      tog.onclick = function () {
        b.collapsed = !b.collapsed;
        renderBasket();
      };
      ctrl.appendChild(cap);
      ctrl.appendChild(tog);
      tdItem.appendChild(ctrl);
      var itemInput = document.createElement('textarea');
      itemInput.rows = 1;
      itemInput.value = b.item || '';
      itemInput.className = 'editable item-input';
      itemInput.oninput = function () {
        b.item = itemInput.value;
        persistBasket();
      };
      tdItem.appendChild(itemInput);
      tr.appendChild(tdItem);
      var tdQ = document.createElement('td');
      var qc = document.createElement('div');
      qc.className = 'qty-controls';
      var minus = document.createElement('button');
      minus.textContent = '-';
      var inp = document.createElement('input');
      inp.type = 'number';
      inp.step = '0.1';
      inp.className = 'qty-input';
      inp.value = getDisplayQty(b.qty);
      var plus = document.createElement('button');
      plus.textContent = '+';
      minus.onclick = function () {
        var currentQty = getQtyOrDefault(b.qty);
        currentQty = currentQty > 0 ? currentQty : 0;
        var nextQty = currentQty - 1;
        b.qty = nextQty > 0 ? nextQty : 0;
        renderBasket();
      };
      plus.onclick = function () {
        var currentQty = getQtyOrDefault(b.qty);
        currentQty = currentQty > 0 ? currentQty : 0;
        b.qty = currentQty + 1;
        renderBasket();
      };
      inp.onchange = function () {
        var parsed = parseFloat(inp.value);
        b.qty = clampQty(parsed);
        renderBasket();
      };
      qc.appendChild(minus);
      qc.appendChild(inp);
      qc.appendChild(plus);
      tdQ.appendChild(qc);
      tr.appendChild(tdQ);
      var tdEx = document.createElement('td');
      var exInput = document.createElement('input');
      exInput.type = 'number';
      exInput.step = '0.01';
      exInput.className = 'editable price-input';
      exInput.value = isNaN(b.ex) ? '' : Number(b.ex).toFixed(2);
      exInput.onchange = function () {
        var v = parseFloat(exInput.value);
        b.ex = isFinite(v) ? v : NaN;
        renderBasket();
      };
      tdEx.appendChild(exInput);
      tr.appendChild(tdEx);
      var hasPrice = Number.isFinite(b.ex);
      var lineValue = hasPrice ? lineTotalFn(b.qty, b.ex) : NaN;
      var tdLi = document.createElement('td');
      tdLi.textContent = Number.isFinite(lineValue) ? formatCurrency(lineValue) : 'N/A';
      tr.appendChild(tdLi);
      var tdRem = document.createElement('td');
      var x = document.createElement('span');
      x.className = 'remove-btn';
      x.textContent = 'X';
      x.onclick = function () {
        var id = b.id;
        var nb = [];
        for (var r = 0; r < basket.length; r++) {
          var it = basket[r];
          if (!it) {
            continue;
          }
          if (it.id === id || it.pid === id) {
            continue;
          }
          nb.push(it);
        }
        basket = setBasket(nb);
        if (captureParentId === id) {
          captureParentId = setCaptureParentId(null);
        }
        renderBasket();
      };
      tdRem.appendChild(x);
      tr.appendChild(tdRem);
      bBody.appendChild(tr);
      if (b.collapsed) {
        return;
      }
      var kids = childrenMap[b.id] || [];
      for (var k = 0; k < kids.length; k++) {
        (function (s) {
          if (!Number.isFinite(s.qty)) {
            s.qty = 1;
          } else if (s.qty < 0) {
            s.qty = 0;
          }
          s.sectionId = b.sectionId;
          var sr = document.createElement('tr');
          sr.className = 'sub-row';
          sr.dataset.id = String(s.id || '');
          var c1 = document.createElement('td');
          c1.textContent = '';
          sr.appendChild(c1);
          var sectionCell = document.createElement('td');
          sectionCell.className = 'section-cell';
          var sectionLabel = document.createElement('span');
          sectionLabel.className = 'section-readonly';
          sectionLabel.textContent = parentSectionName;
          sectionCell.appendChild(sectionLabel);
          sr.appendChild(sectionCell);
          var c2 = document.createElement('td');
          c2.className = 'sub-item-cell';
          var t = document.createElement('textarea');
          t.rows = 1;
          t.className = 'editable item-input';
          t.value = s.item || '';
          t.oninput = function () {
            s.item = t.value;
            persistBasket();
          };
          c2.appendChild(t);
          sr.appendChild(c2);
          var c3 = document.createElement('td');
          var qc = document.createElement('div');
          qc.className = 'qty-controls';
          var minus = document.createElement('button');
          minus.textContent = '-';
          var inp = document.createElement('input');
          inp.type = 'number';
          inp.step = '0.1';
          inp.className = 'qty-input';
          inp.value = getDisplayQty(s.qty);
          var plus = document.createElement('button');
          plus.textContent = '+';
          minus.onclick = function () {
            var currentQty = getQtyOrDefault(s.qty);
            currentQty = currentQty > 0 ? currentQty : 0;
            var nextQty = currentQty - 1;
            s.qty = nextQty > 0 ? nextQty : 0;
            renderBasket();
          };
          plus.onclick = function () {
            var currentQty = getQtyOrDefault(s.qty);
            currentQty = currentQty > 0 ? currentQty : 0;
            s.qty = currentQty + 1;
            renderBasket();
          };
          inp.onchange = function () {
            var parsed = parseFloat(inp.value);
            s.qty = clampQty(parsed);
            renderBasket();
          };
          qc.appendChild(minus);
          qc.appendChild(inp);
          qc.appendChild(plus);
          c3.appendChild(qc);
          sr.appendChild(c3);
          var c4 = document.createElement('td');
          var exInput = document.createElement('input');
          exInput.type = 'number';
          exInput.step = '0.01';
          exInput.className = 'editable price-input';
          exInput.value = isNaN(s.ex) ? '' : Number(s.ex).toFixed(2);
          exInput.onchange = function () {
            var v = parseFloat(exInput.value);
            s.ex = isFinite(v) ? v : NaN;
            renderBasket();
          };
          c4.appendChild(exInput);
          sr.appendChild(c4);
          var subHasPrice = Number.isFinite(s.ex);
          var lineSubTotal = subHasPrice ? lineTotalFn(s.qty, s.ex) : NaN;
          var c5 = document.createElement('td');
          c5.textContent = Number.isFinite(lineSubTotal) ? formatCurrency(lineSubTotal) : 'N/A';
          sr.appendChild(c5);
          var c6 = document.createElement('td');
          var rx = document.createElement('span');
          rx.className = 'remove-btn';
          rx.textContent = 'X';
          rx.onclick = function () {
            for (var r = basket.length - 1; r >= 0; r--) {
              if (basket[r].id === s.id) {
                basket.splice(r, 1);
                break;
              }
            }
            renderBasket();
          };
          c6.appendChild(rx);
          sr.appendChild(c6);
          bBody.appendChild(sr);
        })(kids[k]);
      }
    }

    for (var i2 = 0; i2 < basket.length; i2++) {
      var candidate = basket[i2];
      if (candidate && !candidate.pid) {
        if (typeof candidate.kind === 'undefined') {
          candidate.kind = 'line';
        }
        if (typeof candidate.collapsed === 'undefined') {
          candidate.collapsed = false;
        }
        if (typeof candidate.qty === 'undefined' || !isFinite(candidate.qty)) {
          candidate.qty = 1;
        } else if (candidate.qty < 0) {
          candidate.qty = 0;
        }
        if (!sections.some(function (sec) { return sec.id === candidate.sectionId; })) {
          candidate.sectionId = fallback;
        }
        if (candidate.sectionId === activeSectionId) {
          renderParent(candidate);
        }
      }
    }

    if (captureParentId && !captureFound) {
      captureParentId = setCaptureParentId(null);
    }

    var report = buildReportModel(basket, sections);
    var sectionRef = getSectionById(activeSectionId);
    bFoot.innerHTML = '';
    var notesRow = document.createElement('tr');
    var notesCell = document.createElement('td');
    notesCell.colSpan = 7;
    notesCell.className = 'section-notes-cell';
    var wrapper = document.createElement('div');
    wrapper.className = 'section-notes-wrapper';
    var notesId = 'section-notes-' + activeSectionId;
    var label = document.createElement('label');
    label.setAttribute('for', notesId);
    label.textContent = 'Notes:';
    var textarea = document.createElement('textarea');
    textarea.id = notesId;
    textarea.placeholder = 'Add notes for this section';
    textarea.value = sectionRef && typeof sectionRef.notes === 'string' ? sectionRef.notes : '';
    textarea.oninput = function () {
      if (sectionRef) {
        sectionRef.notes = textarea.value;
        persistBasket();
      }
    };
    wrapper.appendChild(label);
    wrapper.appendChild(textarea);
    notesCell.appendChild(wrapper);
    notesRow.appendChild(notesCell);
    bFoot.appendChild(notesRow);

    updateTotals(report);

    var SortableCtor = state.Sortable || window.Sortable;
    if (SortableCtor && !bBody.getAttribute('data-sortable')) {
      SortableCtor.create(bBody, {
        handle: '.sort-handle',
        draggable: 'tr.main-row',
        animation: 150,
        onEnd: function () {
          var rows = bBody.querySelectorAll('tr.main-row');
          var order = [];
          for (var k = 0; k < rows.length; k++) {
            order.push(+rows[k].dataset.id);
          }
          var childMap = {};
          for (var t = 0; t < basket.length; t++) {
            var it = basket[t];
            if (it && it.pid) {
              (childMap[it.pid] || (childMap[it.pid] = [])).push(it);
            }
          }
          var parentsById = {};
          for (var t2 = 0; t2 < basket.length; t2++) {
            var current = basket[t2];
            if (current && !current.pid) {
              parentsById[current.id] = current;
            }
          }
          var sectionId = activeSectionId;
          var orderedParents = [];
          for (var o = 0; o < order.length; o++) {
            var pid = order[o];
            var parent = parentsById[pid];
            if (parent && parent.sectionId === sectionId) {
              orderedParents.push(parent);
            }
          }
          var seen = {};
          for (var op = 0; op < orderedParents.length; op++) {
            seen[orderedParents[op].id] = true;
          }
          for (var bp = 0; bp < basket.length; bp++) {
            var candidate = basket[bp];
            if (candidate && !candidate.pid && candidate.sectionId === sectionId && !seen[candidate.id]) {
              orderedParents.push(candidate);
              seen[candidate.id] = true;
            }
          }
          var rest = [];
          var insertPos = null;
          var skipParents = {};
          for (var idx = 0; idx < basket.length; idx++) {
            var item = basket[idx];
            if (!item) {
              continue;
            }
            if (item.pid) {
              if (skipParents[item.pid]) {
                continue;
              }
              rest.push(item);
              continue;
            }
            if (item.sectionId === sectionId) {
              skipParents[item.id] = true;
              if (insertPos === null) {
                insertPos = rest.length;
              }
              continue;
            }
            rest.push(item);
          }
          if (insertPos === null) {
            insertPos = rest.length;
          }
          var sectionBlock = [];
          for (var sp = 0; sp < orderedParents.length; sp++) {
            var parent = orderedParents[sp];
            sectionBlock.push(parent);
            var kids = childMap[parent.id] || [];
            for (var kc = 0; kc < kids.length; kc++) {
              sectionBlock.push(kids[kc]);
            }
          }
          basket = setBasket(rest.slice(0, insertPos).concat(sectionBlock, rest.slice(insertPos)));
          persistBasket();
          renderBasket();
        }
      });
      bBody.setAttribute('data-sortable', '1');
    }

    persistBasket();
    updateBasketHeaderOffset();
  }

  window.DefCost.ui.renderBasket = renderBasket;
  window.DefCost.ui.showImportSummaryModal = showImportSummaryModal;
  window.DefCost.ui.showToast = showToast;
})();
