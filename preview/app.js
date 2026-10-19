/* =============================================================================
 * SmartSpend AI — Interactive preview
 * app.js : state, rendering and interactions for the standalone prototype.
 *
 * PREVIEW ONLY. Sample data lives in memory and is discarded on reload.
 * No backend, no API keys, no SQLite, and no real AI calls.
 * ===========================================================================*/
(function () {
  'use strict';

  var SS = window.SS;
  var util = SS.util;
  var icon = SS.icon;
  var avatar = SS.avatar;
  var hexA = SS.hexA;

  /* -------------------------------------------------------------------- state */
  var state = {
    locale: 'ar',
    theme: 'light',
    tab: 'dashboard',
    data: SS.buildSampleData(),
    filters: { type: 'all', category: 'all' },
    overlay: null,
    form: null,
    dialog: null,
    toast: null,
    ai: { text: '', loading: false, failure: null, extraction: null },
    insights: { loading: false, text: null }
  };

  /* ------------------------------------------------------------------ helpers */
  function t(key) {
    var table = SS.i18n[state.locale] || SS.i18n.ar;
    var value = table[key];
    if (value === undefined) return key;
    if (typeof value === 'function') {
      return value.apply(null, Array.prototype.slice.call(arguments, 1));
    }
    return value;
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function fmtMoney(cents) { return util.formatMoney(cents, state.locale, true); }
  function catLabel(id) { var c = SS.categoryById(id); return state.locale === 'en' ? c.en : c.ar; }

  function findTx(id) {
    for (var i = 0; i < state.data.length; i++) if (state.data[i].id === id) return state.data[i];
    return null;
  }
  function categorySupports(catId, type) {
    var c = SS.categoryById(catId);
    return type === 'income' ? c.income : c.expense;
  }
  function catIndex(id) {
    for (var i = 0; i < SS.categories.length; i++) if (SS.categories[i].id === id) return i;
    return 99;
  }
  function nextId() {
    var max = 0;
    state.data.forEach(function (tx) { if (tx.id > max) max = tx.id; });
    return max + 1;
  }
  function sortNewest(list) {
    return list.slice().sort(function (a, b) {
      if (b.date - a.date) return b.date - a.date;
      if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
      return (b.id || 0) - (a.id || 0);
    });
  }

  function showToast(message) {
    state.toast = { message: message, id: Date.now() };
    render();
    var id = state.toast.id;
    window.setTimeout(function () {
      if (state.toast && state.toast.id === id) { state.toast = null; render(); }
    }, 2400);
  }

  /* ------------------------------------------------------------- computations */
  function computeDashboard() {
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth();
    var monthStart = new Date(y, m, 1), nextStart = new Date(y, m + 1, 1);
    var balance = 0, income = 0, expense = 0;
    state.data.forEach(function (tx) {
      if (tx.type === 'income') balance += tx.cents; else balance -= tx.cents;
      if (tx.date >= monthStart && tx.date < nextStart) {
        if (tx.type === 'income') income += tx.cents; else expense += tx.cents;
      }
    });
    var months = [];
    for (var i = 5; i >= 0; i--) {
      var s = new Date(y, m - i, 1), e = new Date(y, m - i + 1, 1), total = 0;
      state.data.forEach(function (tx) {
        if (tx.type === 'expense' && tx.date >= s && tx.date < e) total += tx.cents;
      });
      months.push({ month: s, cents: total });
    }
    return {
      balance: balance, income: income, expense: expense, months: months,
      recent: sortNewest(state.data).slice(0, 5), count: state.data.length
    };
  }

  function computeInsights() {
    var now = new Date();
    var y = now.getFullYear(), m = now.getMonth();
    var monthStart = new Date(y, m, 1), next = new Date(y, m + 1, 1), prevStart = new Date(y, m - 1, 1);
    var current = 0, previous = 0, count = 0, totals = {};
    state.data.forEach(function (tx) {
      if (tx.type !== 'expense') return;
      if (tx.date >= monthStart && tx.date < next) {
        current += tx.cents; count++;
        totals[tx.category] = (totals[tx.category] || 0) + tx.cents;
      } else if (tx.date >= prevStart && tx.date < monthStart) {
        previous += tx.cents;
      }
    });
    var cats = Object.keys(totals).map(function (id) {
      return { id: id, cents: totals[id], share: current > 0 ? totals[id] / current : 0 };
    });
    cats.sort(function (a, b) {
      if (b.cents !== a.cents) return b.cents - a.cents;
      return catIndex(a.id) - catIndex(b.id);
    });
    return {
      current: current, previous: previous,
      change: previous > 0 ? ((current - previous) / previous) * 100 : null,
      cats: cats, top: cats[0] || null, count: count,
      hasData: state.data.length > 0, hasCurrent: current > 0
    };
  }

  function filteredTransactions() {
    var f = state.filters;
    return sortNewest(state.data.filter(function (tx) {
      if (f.type !== 'all' && tx.type !== f.type) return false;
      if (f.category !== 'all' && tx.category !== f.category) return false;
      return true;
    }));
  }

  function comparisonPhrase(ins) {
    if (ins.previous <= 0) return t('ins.noComparison');
    var diff = ins.current - ins.previous;
    if (diff === 0) return t('ins.same');
    var p = util.formatPercent(Math.abs(ins.change || 0));
    return diff > 0 ? t('ins.up', p) : t('ins.down', p);
  }

  function buildExplanation(ins) {
    var ar = state.locale === 'ar';
    var cur = fmtMoney(ins.current);
    var s = ar ? ('صرفت ' + cur + ' الشهر ده') : ('You spent ' + cur + ' this month');
    if (ins.previous <= 0) {
      s += ar ? '، ومفيش بيانات كافية للمقارنة مع الشهر اللي فات' : ', with no previous-month data to compare';
    } else {
      var diff = ins.current - ins.previous;
      var p = util.formatPercent(Math.abs(ins.change || 0));
      if (diff === 0) s += ar ? '، نفس مستوى الشهر اللي فات' : ', the same as last month';
      else if (diff > 0) s += ar ? ('، بزيادة ' + p) : (', up ' + p + ' versus last month');
      else s += ar ? ('، بتراجع ' + p) : (', down ' + p + ' versus last month');
    }
    if (ins.top) {
      var name = catLabel(ins.top.id);
      var amt = fmtMoney(ins.top.cents);
      var share = util.formatPercent(ins.top.share * 100);
      s += ar
        ? ('، وأكبر بند كان ' + name + ' بمبلغ ' + amt + ' (' + share + ' من مصروفات الشهر)')
        : (', and your largest category was ' + name + ' at ' + amt + ' (' + share + ' of the month)');
    }
    return s + '.';
  }

  /* ------------------------------------------------------------------- render */
  var NAV = [
    ['dashboard', 'home', 'nav.dashboard'],
    ['transactions', 'receipt', 'nav.transactions'],
    ['ai', 'sparkles', 'nav.ai'],
    ['insights', 'insights', 'nav.insights']
  ];

  function tabTitle() {
    if (state.tab === 'transactions') return t('tx.title');
    if (state.tab === 'ai') return t('ai.title');
    if (state.tab === 'insights') return t('nav.insights');
    return 'SmartSpend';
  }

  function statusbar() {
    var now = new Date();
    var h = now.getHours() % 12; if (h === 0) h = 12;
    return '<div class="statusbar"><span>' + h + ':' + util.pad2(now.getMinutes()) + '</span>' +
      '<span class="statusbar__icons">' +
      '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 17h2v-4H4zm5 0h2v-6H9zm5 0h2v-8h-2zm5 0h2V5h-2z"/></svg>' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="3" y="8" width="16" height="8" rx="2"/><rect x="4.6" y="9.6" width="10" height="4.8" rx="1" fill="currentColor" stroke="none"/><rect x="20.4" y="10.5" width="1.8" height="3" rx="1" fill="currentColor" stroke="none"/></svg>' +
      '</span></div>';
  }

  function renderNav() {
    return '<nav class="bottomnav">' + NAV.map(function (item) {
      var active = state.tab === item[0];
      return '<button class="navitem' + (active ? ' active' : '') + '" data-action="tab" data-tab="' + item[0] + '">' +
        '<span class="ico">' + icon(item[1]) + '</span><span>' + esc(t(item[2])) + '</span></button>';
    }).join('') + '</nav>';
  }

  function render() {
    document.documentElement.lang = state.locale;
    document.documentElement.dir = state.locale === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.setAttribute('data-theme', state.theme);

    var screens = { dashboard: renderDashboard, transactions: renderTransactions, ai: renderAi, insights: renderInsights };
    var html;
    if (state.overlay) {
      html = renderFormOverlay();
    } else {
      var showFab = state.tab === 'dashboard' || state.tab === 'transactions';
      html = statusbar() +
        '<div class="preview-strip">' + icon('info') + '<span>' + esc(t('preview.strip')) + '</span></div>' +
        '<header class="appbar">' +
          '<h1 class="appbar__title">' + esc(tabTitle()) + '</h1>' +
          '<div class="appbar__actions">' +
            '<button class="iconbtn" data-action="lang" title="' + esc(t('a11y.language')) + '">' + icon('translate') + '</button>' +
            '<button class="iconbtn" data-action="theme" title="' + esc(t('a11y.theme')) + '">' + icon(state.theme === 'light' ? 'moon' : 'sun') + '</button>' +
          '</div>' +
        '</header>' +
        '<main class="screen">' + screens[state.tab]() + '</main>' +
        (showFab ? '<button class="fab" data-action="open-add" aria-label="' + esc(t('form.new')) + '">' + icon('plus') + '</button>' : '') +
        renderNav();
    }
    if (state.dialog) html += renderDialog();
    if (state.toast) html += '<div class="toast">' + esc(state.toast.message) + '</div>';

    document.getElementById('app').innerHTML = html;
    var note = document.getElementById('previewNote');
    if (note) note.textContent = t('preview.badge');
    var cap = document.getElementById('previewCaption');
    if (cap) cap.textContent = t('preview.caption');
  }

  /* ----------------------------------------------------------------- dashboard */
  function renderDashboard() {
    var d = computeDashboard();
    var hasChart = d.months.some(function (m) { return m.cents > 0; });
    var parts = [];
    parts.push(balanceCard(d));
    parts.push('<div class="mt16"><button class="aibanner" data-action="tab" data-tab="ai">' + aiBannerInner() + '</button></div>');
    if (d.count === 0) {
      parts.push('<div class="mt16">' + welcomeCard() + '</div>');
    } else {
      parts.push('<div class="sechead"><div><h2>' + esc(t('dash.trend')) + '</h2><p>' + esc(t('dash.trendSub')) + '</p></div></div>');
      parts.push('<div class="card chartcard">' + (hasChart ? chartSVG(d.months) : chartEmpty()) + '</div>');
      parts.push('<div class="sechead"><h2>' + esc(t('dash.recent')) + '</h2>' +
        '<button class="linkbtn" data-action="tab" data-tab="transactions">' + esc(t('dash.viewAll')) + '</button></div>');
      parts.push('<div class="card listcard">' + d.recent.map(function (tx) { return txRow(tx, false); }).join('<div class="divider"></div>') + '</div>');
    }
    return parts.join('');
  }

  function balanceCard(d) {
    var hint = d.balance < 0
      ? '<div class="balance__hint">' + icon('warn') + esc(t('dash.negativeHint')) + '</div>' : '';
    return '<div class="balance">' +
      '<div class="balance__label">' + icon('wallet') + '<span>' + esc(t('dash.totalBalance')) + '</span></div>' +
      '<div class="balance__value">' + esc(fmtMoney(d.balance)) + '</div>' + hint +
      '<div class="balance__stats">' +
        miniStat('up', t('dash.monthIncome'), fmtMoney(d.income)) +
        miniStat('down', t('dash.monthExpense'), fmtMoney(d.expense)) +
      '</div></div>';
  }

  function miniStat(iconName, label, value) {
    return '<div class="stat"><div class="stat__label">' + icon(iconName) + '<span>' + esc(label) + '</span></div>' +
      '<div class="stat__value">' + esc(value) + '</div></div>';
  }

  function aiBannerInner() {
    return '<div class="aibanner__icon">' + icon('sparkles') + '</div>' +
      '<div class="aibanner__text"><div class="aibanner__title">' + esc(t('ai.bannerTitle')) + '</div>' +
      '<div class="aibanner__sub">' + esc(t('ai.bannerSub')) + '</div></div>' +
      icon('chevron', 'flip-rtl');
  }

  function welcomeCard() {
    return '<div class="card center">' +
      '<div class="empty__circ" style="margin:0 auto 12px">' + icon('pie') + '</div>' +
      '<h3>' + esc(t('dash.welcomeTitle')) + '</h3>' +
      '<p class="muted mt8">' + esc(t('dash.welcomeBody')) + '</p>' +
      '<button class="btn btn--primary btn--block mt16" data-action="open-add">' + icon('plus') + esc(t('dash.addFirst')) + '</button>' +
      '<button class="btn btn--ghost mt8" data-action="load-demo">' + esc(t('dash.loadDemo')) + '</button></div>';
  }

  function chartEmpty() {
    return '<div class="empty" style="padding:26px 10px">' +
      '<div class="empty__circ">' + icon('bar') + '</div>' +
      '<h3>' + esc(t('dash.chartEmptyTitle')) + '</h3><p>' + esc(t('dash.chartEmptyBody')) + '</p></div>';
  }

  function chartSVG(months) {
    var w = 320, h = 182, padTop = 16, padBottom = 28, padLeft = 6, padRight = 6;
    var innerW = w - padLeft - padRight, innerH = h - padTop - padBottom;
    var max = 0;
    months.forEach(function (m) { if (m.cents > max) max = m.cents; });
    var maxY = max <= 0 ? 100 : max * 1.25;
    var interval = maxY / 3;
    var slot = innerW / months.length;
    var barW = Math.min(26, slot * 0.5);
    var svg = ['<svg class="chart" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="xMidYMid meet">'];
    for (var g = 1; g <= 3; g++) {
      var gy = padTop + innerH - innerH * (g / 3);
      svg.push('<line x1="0" y1="' + gy.toFixed(1) + '" x2="' + w + '" y2="' + gy.toFixed(1) + '" stroke="currentColor" stroke-opacity="0.12" stroke-width="1"/>');
      svg.push('<text x="4" y="' + (gy - 3).toFixed(1) + '" font-size="9" fill="currentColor" fill-opacity="0.5">' + esc(util.formatCompact(Math.round(interval * g))) + '</text>');
    }
    months.forEach(function (m, i) {
      var cx = padLeft + slot * i + slot / 2;
      var barH = maxY > 0 ? innerH * (m.cents / maxY) : 0;
      var y = padTop + innerH - barH;
      var isCurrent = i === months.length - 1;
      svg.push('<rect x="' + (cx - barW / 2).toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + barW.toFixed(1) + '" height="' + Math.max(0, barH).toFixed(1) + '" rx="6" fill="currentColor" fill-opacity="' + (isCurrent ? '1' : '0.32') + '"/>');
      svg.push('<text x="' + cx.toFixed(1) + '" y="' + (h - 8) + '" font-size="9" text-anchor="middle" fill="currentColor" fill-opacity="0.6">' + esc(util.shortMonthName(m.month.getMonth() + 1, state.locale)) + '</text>');
    });
    svg.push('</svg>');
    return svg.join('');
  }

  function txRow(tx, withDelete) {
    var title = (tx.desc && (tx.desc[state.locale] || tx.desc.ar)) || catLabel(tx.category);
    var isIncome = tx.type === 'income';
    return '<div class="tx" data-action="open-edit" data-id="' + tx.id + '">' +
      avatar(tx.category) +
      '<div class="tx__main"><div class="tx__title">' + esc(title) + '</div>' +
      '<div class="tx__sub">' + esc(catLabel(tx.category)) + ' • ' + esc(util.formatDate(tx.date, state.locale)) + '</div></div>' +
      '<div><div class="tx__amount ' + (isIncome ? 'income' : 'expense') + '">' + (isIncome ? '+' : '-') + esc(fmtMoney(tx.cents)) + '</div>' +
      '<div class="tx__type">' + esc(isIncome ? t('common.income') : t('common.expense')) + '</div></div>' +
      (withDelete ? '<button class="tx__del" data-action="delete" data-id="' + tx.id + '" aria-label="' + esc(t('common.delete')) + '">' + icon('trash') + '</button>' : '') +
      '</div>';
  }

  /* -------------------------------------------------------------- transactions */
  function renderTransactions() {
    if (state.data.length === 0) {
      return '<div class="empty"><div class="empty__circ">' + icon('receipt') + '</div>' +
        '<h3>' + esc(t('tx.emptyTitle')) + '</h3><p>' + esc(t('tx.emptyBody')) + '</p>' +
        '<button class="btn btn--primary mt12" data-action="open-add">' + icon('plus') + esc(t('dash.addFirst')) + '</button>' +
        '<button class="btn btn--ghost" data-action="load-demo">' + esc(t('dash.loadDemo')) + '</button></div>';
    }

    var list = filteredTransactions();
    var hasFilters = state.filters.type !== 'all' || state.filters.category !== 'all';
    var parts = ['<div class="card">' + filterPanel() + '</div>'];

    if (list.length === 0) {
      parts.push('<div class="empty"><div class="empty__circ">' + icon('search') + '</div>' +
        '<h3>' + esc(t('tx.noneTitle')) + '</h3><p>' + esc(t('tx.noneBody')) + '</p>' +
        (hasFilters ? '<button class="btn btn--outline mt12" data-action="clear-filters">' + esc(t('tx.clear')) + '</button>' : '') +
        '</div>');
      return parts.join('');
    }

    var exp = 0, inc = 0;
    list.forEach(function (tx) { if (tx.type === 'income') inc += tx.cents; else exp += tx.cents; });
    parts.push('<div class="card mt12"><div class="statline">' +
      '<div><div class="tiny muted">' + esc(t('tx.expInRange')) + '</div><div class="amountbig expense mt8">' + esc(fmtMoney(exp)) + '</div></div>' +
      '<div style="text-align:end"><div class="tiny muted">' + esc(t('tx.incInRange')) + '</div><div class="amountbig income mt8">' + esc(fmtMoney(inc)) + '</div></div>' +
      '</div></div>');

    var groups = {}, order = [];
    list.forEach(function (tx) {
      var k = util.toISO(tx.date);
      if (!groups[k]) { groups[k] = []; order.push(k); }
      groups[k].push(tx);
    });
    order.forEach(function (k) {
      var dayTx = groups[k], dayExp = 0;
      dayTx.forEach(function (tx) { if (tx.type === 'expense') dayExp += tx.cents; });
      parts.push('<div class="sechead" style="margin:16px 6px 6px"><h2 style="font-size:13px;color:var(--muted);font-weight:700">' +
        esc(util.formatDate(dayTx[0].date, state.locale)) + '</h2>' +
        (dayExp > 0 ? '<span class="tiny expense">-' + esc(fmtMoney(dayExp)) + '</span>' : '') + '</div>');
      parts.push('<div class="card listcard">' + dayTx.map(function (tx) { return txRow(tx, true); }).join('<div class="divider"></div>') + '</div>');
    });
    return parts.join('');
  }

  function filterPanel() {
    var f = state.filters;
    var types = [['all', t('common.all')], ['expense', t('common.expense')], ['income', t('common.income')]];
    var typeChips = types.map(function (item) {
      return '<button class="chip' + (f.type === item[0] ? ' active' : '') + '" data-action="filter-type" data-type="' + item[0] + '">' + esc(item[1]) + '</button>';
    }).join('');
    var hasFilters = f.type !== 'all' || f.category !== 'all';
    var catChips = '<button class="chip' + (f.category === 'all' ? ' active' : '') + '" data-action="filter-category" data-cat="all">' + esc(t('tx.allCategories')) + '</button>' +
      SS.categories.map(function (c) {
        return '<button class="chip' + (f.category === c.id ? ' active' : '') + '" data-action="filter-category" data-cat="' + c.id + '">' +
          '<span style="color:' + c.color + '">' + SS.catIcon(c.id) + '</span>' + esc(state.locale === 'en' ? c.en : c.ar) + '</button>';
      }).join('');
    return '<div class="row" style="justify-content:space-between">' +
        '<div class="row" style="gap:8px">' + icon('filter') + '<strong>' + esc(t('tx.filters')) + '</strong></div>' +
        (hasFilters ? '<button class="linkbtn" data-action="clear-filters">' + esc(t('tx.clear')) + '</button>' : '') +
      '</div>' +
      '<div class="chiprow mt12">' + typeChips + '</div>' +
      '<div class="chiprow mt8">' + catChips + '</div>';
  }

  /* --------------------------------------------------------------- AI quick add */
  function renderAi() {
    var a = state.ai;
    var parts = ['<div class="aibanner" style="cursor:default">' +
      '<div class="aibanner__icon">' + icon('sparkles') + '</div>' +
      '<div class="aibanner__text"><div class="aibanner__title">' + esc(t('ai.title')) + '</div>' +
      '<div class="aibanner__sub">' + esc(t('ai.subtitle')) + '</div></div></div>'];

    parts.push('<div class="banner banner--gold mt12"><div class="banner__icon">' + icon('info') + '</div>' +
      '<div><div class="banner__title">' + esc(t('ai.simulatedTitle')) + '</div>' +
      '<div class="banner__body">' + esc(t('ai.simulated')) + '</div></div></div>');

    parts.push('<div class="card mt16">' +
      '<div class="label" style="font-size:14px;color:var(--text);font-weight:800">' + esc(t('ai.inputLabel')) + '</div>' +
      '<textarea class="input" data-field="ai-text" rows="3" maxlength="500" placeholder="' + esc(t('ai.inputHint')) + '">' + esc(a.text) + '</textarea>' +
      '<div class="label mt12">' + esc(t('ai.examples')) + '</div>' +
      '<div style="display:flex;flex-wrap:wrap;gap:8px">' + SS.examples[state.locale].map(function (ex, i) {
        return '<button class="chip chip--ghost" data-action="example" data-i="' + i + '">' + esc(ex) + '</button>';
      }).join('') + '</div>' +
      '<button class="btn btn--primary btn--block mt16" data-action="extract"' + (a.loading ? ' disabled' : '') + '>' +
        (a.loading ? '<span class="spinner spinner--light"></span>' + esc(t('ai.extracting')) : icon('sparkles') + esc(t('ai.extract'))) +
      '</button>' +
      '<p class="tiny muted center mt8">' + esc(t('ai.privacy')) + '</p>' +
      '</div>');

    if (a.failure) {
      parts.push('<div class="banner banner--error mt12"><div class="banner__icon">' + icon('error') + '</div>' +
        '<div class="grow"><div class="banner__body">' + esc(t('ai.failEmpty')) + '</div>' +
        '<button class="btn btn--ghost" style="padding-inline-start:0" data-action="open-add">' + icon('edit') + esc(t('ai.manual')) + '</button></div></div>');
    }

    parts.push('<div class="card mt16"><div class="appbar__title" style="font-size:16px">' + esc(t('ai.how')) + '</div>' +
      '<div class="mt12">' + [t('ai.step1'), t('ai.step2'), t('ai.step3')].map(function (s, i) {
        return '<div class="step"><div class="step__num">' + (i + 1) + '</div><div>' + esc(s) + '</div></div>';
      }).join('') + '</div></div>');
    return parts.join('');
  }

  /* ------------------------------------------------------------------- insights */
  function renderInsights() {
    var ins = computeInsights();
    if (!ins.hasData) {
      return '<div class="empty"><div class="empty__circ">' + icon('insights') + '</div>' +
        '<h3>' + esc(t('ins.emptyTitle')) + '</h3><p>' + esc(t('ins.emptyBody')) + '</p>' +
        '<button class="btn btn--primary mt12" data-action="open-add">' + icon('plus') + esc(t('dash.addFirst')) + '</button></div>';
    }
    var parts = ['<p class="tiny muted" style="margin:2px 2px 12px">' + esc(t('ins.subtitle')) + '</p>'];
    parts.push(comparisonCard(ins));
    if (!ins.hasCurrent) {
      parts.push('<div class="card center mt16"><div class="empty__circ" style="margin:0 auto 10px">' + icon('happy') + '</div>' +
        '<h3>' + esc(t('ins.noCurrent')) + '</h3><p class="muted mt8">' + esc(t('ins.noCurrentBody')) + '</p></div>');
    } else {
      parts.push(topCategoryCard(ins));
      parts.push(breakdownCard(ins));
    }
    parts.push(summaryCard(ins));
    parts.push(aiExplainCard());
    return parts.join('');
  }

  function comparisonCard(ins) {
    var change = ins.change;
    var increased = (change || 0) > 0;
    var flat = change == null || change === 0;
    var accent = flat ? 'var(--muted)' : (increased ? 'var(--expense)' : 'var(--income)');
    var mark = flat ? 'flat' : (increased ? 'trendUp' : 'trendDown');
    return '<div class="card"><div class="appbar__title" style="font-size:16px">' + esc(t('ins.comparisonTitle')) + '</div>' +
      '<div class="mt16" style="display:flex;gap:16px">' +
        '<div class="grow"><div class="tiny muted">' + esc(t('ins.current')) + '</div><div class="amountbig expense mt8">' + esc(fmtMoney(ins.current)) + '</div></div>' +
        '<div class="grow"><div class="tiny muted">' + esc(t('ins.previous')) + '</div><div class="amountbig muted mt8">' + esc(fmtMoney(ins.previous)) + '</div></div>' +
      '</div>' +
      '<div class="mt12" style="display:flex;align-items:center;gap:10px;padding:11px 12px;border-radius:14px;background:var(--surface-2)">' +
        '<span style="color:' + accent + '">' + icon(mark) + '</span>' +
        '<span class="tiny grow">' + esc(comparisonPhrase(ins)) + '</span>' +
        (change != null ? '<strong style="color:' + accent + ';font-size:13px">' + esc(util.formatPercent(change, true)) + '</strong>' : '') +
      '</div></div>';
  }

  function topCategoryCard(ins) {
    var c = SS.categoryById(ins.top.id);
    return '<div class="card mt16"><div class="appbar__title" style="font-size:16px">' + esc(t('ins.topTitle')) + '</div>' +
      '<div class="row mt12">' + avatar(ins.top.id, 'lg') +
        '<div class="grow"><div style="font-size:15px;font-weight:700">' + esc(catLabel(ins.top.id)) + '</div>' +
        '<div class="amountbig mt8">' + esc(fmtMoney(ins.top.cents)) + '</div></div>' +
        '<span class="pillbadge" style="background:' + hexA(c.color, 0.16) + ';color:' + c.color + '">' + esc(util.formatPercent(ins.top.share * 100)) + '</span>' +
      '</div></div>';
  }

  function breakdownCard(ins) {
    return '<div class="card mt16"><div class="appbar__title" style="font-size:16px">' + esc(t('ins.breakdownTitle')) + '</div>' +
      '<div class="mt12">' + ins.cats.map(function (item) {
        var c = SS.categoryById(item.id);
        return '<div class="row">' + avatar(item.id, 'sm') +
          '<div class="grow"><div class="statline"><span style="font-weight:600;font-size:14px">' + esc(catLabel(item.id)) + '</span>' +
          '<span class="tiny" style="font-weight:700">' + esc(fmtMoney(item.cents)) + '</span></div>' +
          '<div class="row mt8" style="gap:10px"><div class="progress grow"><span style="width:' + (item.share * 100).toFixed(1) + '%;background:' + c.color + '"></span></div>' +
          '<span class="tiny muted" style="width:44px;text-align:end;flex:0 0 auto">' + esc(util.formatPercent(item.share * 100)) + '</span></div></div></div>';
      }).join('') + '</div></div>';
  }

  function summaryCard(ins) {
    var text = ins.top
      ? t('ins.summary', fmtMoney(ins.current), catLabel(ins.top.id), fmtMoney(ins.top.cents), util.formatPercent(ins.top.share * 100))
      : t('ins.summaryNoCat', fmtMoney(ins.current));
    return '<div class="card mt16"><div class="row" style="gap:8px">' +
      '<span style="color:var(--primary)">' + icon('calc') + '</span>' +
      '<strong style="font-size:14px">' + esc(t('ins.summaryTitle')) + '</strong></div>' +
      '<p class="mt12" style="margin:0;line-height:1.6;font-size:14px">' + esc(text) + '</p></div>';
  }

  function aiExplainCard() {
    var body;
    if (state.insights.loading) {
      body = '<div class="row mt12" style="gap:12px"><span class="spinner" style="color:var(--primary)"></span>' +
        '<span class="tiny">' + esc(t('ins.explaining')) + '</span></div>';
    } else if (state.insights.text) {
      body = '<div class="mt12" style="padding:14px;border-radius:14px;background:var(--primary-soft);line-height:1.65;font-size:14px">' + esc(state.insights.text) + '</div>' +
        '<p class="tiny muted mt8" style="margin-bottom:0">' + esc(t('ins.aiNote')) + '</p>' +
        '<button class="btn btn--ghost mt8" style="padding-inline-start:0" data-action="explain">' + icon('refresh') + esc(t('ins.explain')) + '</button>';
    } else {
      body = '<button class="btn btn--outline btn--block mt12" data-action="explain">' + icon('sparkles') + esc(t('ins.explain')) + '</button>';
    }
    return '<div class="card mt16"><div class="row" style="gap:8px">' +
      '<span style="color:var(--primary)">' + icon('sparkles') + '</span>' +
      '<strong style="font-size:14px">' + esc(t('ins.aiTitle')) + '</strong></div>' +
      '<p class="tiny muted mt8" style="margin-bottom:0;line-height:1.5">' + esc(t('ins.aiSub')) + '</p>' + body + '</div>';
  }

  /* ------------------------------------------------------------ form (overlay) */
  function openForm(mode, opts) {
    opts = opts || {};
    var form;
    if (mode === 'edit') {
      var tx = findTx(opts.id);
      if (!tx) return;
      form = {
        id: tx.id,
        amount: (tx.cents / 100).toFixed(2),
        type: tx.type,
        category: tx.category,
        date: util.toISO(tx.date),
        description: (tx.desc && (tx.desc[state.locale] || tx.desc.ar)) || '',
        missing: [], errors: {}, ai: false
      };
    } else if (mode === 'ai') {
      var ex = opts.extraction || {};
      var type = ex.type || 'expense';
      var cat = ex.category || 'other';
      if (!categorySupports(cat, type)) cat = 'other';
      form = {
        amount: ex.amount != null ? (ex.amount / 100).toFixed(2) : '',
        type: type, category: cat,
        date: ex.date || util.toISO(util.today()),
        description: ex.description || '',
        missing: (ex.missing || []).slice(), errors: {}, ai: true
      };
    } else {
      form = {
        amount: '', type: 'expense', category: 'other',
        date: util.toISO(util.today()), description: '',
        missing: [], errors: {}, ai: false
      };
    }
    state.form = form;
    state.overlay = { mode: mode, id: opts.id || null };
    render();
  }

  function fieldLabel(field) {
    var map = {
      amount: t('form.amount'), type: t('form.type'), category: t('form.category'),
      date: t('form.date'), description: t('form.description')
    };
    return map[field] || field;
  }

  function fieldWrap(label, error, isMissing, inner) {
    return '<div class="field' + (isMissing ? ' is-missing' : '') + '">' +
      '<label class="label">' + esc(label) + '</label>' + inner +
      (error ? '<div class="err">' + esc(error) + '</div>' : '') + '</div>';
  }

  function segBtn(type, iconName, label, current) {
    return '<button type="button" class="' + (current === type ? 'active' : '') + '" data-action="form-type" data-type="' + type + '">' +
      icon(iconName) + '<span>' + esc(label) + '</span></button>';
  }

  function renderFormOverlay() {
    var f = state.form, o = state.overlay;
    var title = o.mode === 'edit' ? t('form.edit') : t('form.new');
    var cats = SS.categoriesFor(f.type);
    var parts = [];
    parts.push(statusbar());
    parts.push('<header class="appbar">' +
      '<button class="iconbtn iconbtn--plain" data-action="close-overlay" aria-label="' + esc(t('a11y.back')) + '">' + icon('back', 'flip-rtl') + '</button>' +
      '<h1 class="appbar__title" style="flex:1;text-align:center;font-size:17px">' + esc(title) + '</h1>' +
      (o.mode === 'edit'
        ? '<button class="iconbtn iconbtn--plain iconbtn--danger" data-action="form-delete" aria-label="' + esc(t('common.delete')) + '">' + icon('trash') + '</button>'
        : '<span style="width:40px"></span>') +
      '</header>');

    var body = [];
    if (f.ai) {
      body.push('<div class="banner banner--ai"><div class="banner__icon">' + icon('sparkles') + '</div>' +
        '<div><div class="banner__title">' + esc(t('ai.reviewTitle')) + '</div>' +
        '<div class="banner__body">' + esc(t('ai.reviewBody')) + '</div></div></div>');
      if (f.missing.length) {
        var labels = f.missing.map(fieldLabel).join(state.locale === 'en' ? ', ' : '، ');
        body.push('<div class="banner banner--gold mt12"><div class="banner__icon">' + icon('info') + '</div>' +
          '<div><div class="banner__title">' + esc(t('ai.missingTitle')) + '</div>' +
          '<div class="banner__body">' + esc(t('ai.missingText', labels)) + '</div></div></div>');
      }
    }

    body.push('<div class="mt16"><div class="seg">' +
      segBtn('expense', 'down', t('common.expense'), f.type) +
      segBtn('income', 'up', t('common.income'), f.type) +
      '</div></div>');

    body.push(fieldWrap(t('form.amount'), f.errors.amount, f.missing.indexOf('amount') >= 0,
      '<div class="inputwrap"><span class="lead">' + icon('payments') + '</span>' +
      '<input class="input has-suffix" type="text" inputmode="decimal" data-field="amount" value="' + esc(f.amount) + '" placeholder="' + esc(t('form.amountHint')) + '"/>' +
      '<span class="suffix">' + esc(SS.currency[state.locale]) + '</span></div>'));

    var options = cats.map(function (c) {
      return '<option value="' + c.id + '"' + (c.id === f.category ? ' selected' : '') + '>' + esc(state.locale === 'en' ? c.en : c.ar) + '</option>';
    }).join('');
    body.push(fieldWrap(t('form.category'), null, f.missing.indexOf('category') >= 0,
      '<div class="inputwrap"><span class="lead">' + icon('category') + '</span>' +
      '<select class="input" data-field="category">' + options + '</select></div>'));

    body.push(fieldWrap(t('form.date'), null, f.missing.indexOf('date') >= 0,
      '<div class="inputwrap"><span class="lead">' + icon('calendar') + '</span>' +
      '<input class="input" type="date" data-field="date" value="' + esc(f.date) + '"/></div>'));

    body.push(fieldWrap(t('form.description'), f.errors.description, f.missing.indexOf('description') >= 0,
      '<div class="inputwrap"><span class="lead">' + icon('notes') + '</span>' +
      '<textarea class="input" data-field="description" rows="2" maxlength="120" placeholder="' + esc(t('form.descriptionHint')) + '">' + esc(f.description) + '</textarea></div>'));

    parts.push('<div class="overlay__body">' + body.join('') + '</div>');
    parts.push('<div class="overlay__footer"><button class="btn btn--primary btn--block" data-action="save-form">' + esc(t('form.save')) + '</button></div>');
    return '<div class="overlay">' + parts.join('') + '</div>';
  }

  function setFormType(type) {
    var f = state.form;
    f.type = type;
    if (!categorySupports(f.category, type)) f.category = 'other';
    f.missing = f.missing.filter(function (x) { return x !== 'type'; });
    if (f.errors) delete f.errors.amount;
    render();
  }

  function saveForm() {
    var f = state.form, o = state.overlay, errors = {};
    var cents = util.parseAmountToCents(f.amount);
    if (!String(f.amount).trim() || cents <= 0) errors.amount = t('form.amountRequired');
    else if (cents / 100 > 100000000) errors.amount = t('form.amountTooLarge');
    if (!String(f.description).trim()) errors.description = t('form.descriptionRequired');
    if (Object.keys(errors).length) { f.errors = errors; render(); return; }

    var date = util.fromISO(f.date) || util.today();
    if (o.mode === 'edit') {
      var existing = findTx(o.id);
      state.data = state.data.map(function (tx) {
        if (tx.id !== existing.id) return tx;
        return {
          id: tx.id, cents: cents, type: f.type, category: f.category,
          date: util.dateOnly(date), createdAt: tx.createdAt,
          desc: { ar: f.description, en: f.description }
        };
      });
    } else {
      state.data = state.data.concat([{
        id: nextId(), cents: cents, type: f.type, category: f.category,
        date: util.dateOnly(date), createdAt: Date.now(),
        desc: { ar: f.description, en: f.description }
      }]);
    }

    var wasAi = o.mode === 'ai';
    var wasEdit = o.mode === 'edit';
    state.overlay = null;
    state.form = null;
    state.insights = { loading: false, text: null };
    if (wasAi) { state.ai = { text: '', loading: false, failure: null, extraction: null }; state.tab = 'ai'; }
    showToast(wasEdit ? t('form.updated') : t('form.saved'));
  }

  /* -------------------------------------------------------------------- dialog */
  function renderDialog() {
    return '<div class="scrim" data-action="dialog-cancel">' +
      '<div class="dialog"><h3>' + esc(t('form.deleteTitle')) + '</h3>' +
      '<p>' + esc(t('form.deleteBody')) + '</p>' +
      '<div class="dialog__actions">' +
        '<button class="btn btn--outline" data-action="dialog-cancel">' + esc(t('common.cancel')) + '</button>' +
        '<button class="btn btn--danger" data-action="dialog-confirm">' + esc(t('common.delete')) + '</button>' +
      '</div></div></div>';
  }

  function confirmDelete() {
    var id = state.dialog.id;
    state.data = state.data.filter(function (tx) { return tx.id !== id; });
    state.dialog = null;
    if (state.overlay && state.overlay.mode === 'edit' && state.overlay.id === id) {
      state.overlay = null; state.form = null;
    }
    state.insights = { loading: false, text: null };
    showToast(t('tx.deleted'));
  }

  /* -------------------------------------------------------------------- events */
  document.addEventListener('click', function (e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el) return;
    var action = el.getAttribute('data-action');

    switch (action) {
      case 'tab':
        state.tab = el.getAttribute('data-tab');
        render();
        break;

      case 'lang':
        state.locale = state.locale === 'ar' ? 'en' : 'ar';
        state.insights = { loading: false, text: null };
        render();
        break;

      case 'theme':
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        render();
        break;

      case 'open-add':
        if (!state.overlay) openForm('add');
        break;

      case 'open-edit':
        openForm('edit', { id: Number(el.getAttribute('data-id')) });
        break;

      case 'delete':
        state.dialog = { id: Number(el.getAttribute('data-id')) };
        render();
        break;

      case 'dialog-cancel':
        state.dialog = null;
        render();
        break;

      case 'dialog-confirm':
        confirmDelete();
        break;

      case 'clear-filters':
        state.filters = { type: 'all', category: 'all' };
        render();
        break;

      case 'filter-type':
        state.filters.type = el.getAttribute('data-type');
        render();
        break;

      case 'filter-category':
        state.filters.category = el.getAttribute('data-cat');
        render();
        break;

      case 'close-overlay':
        state.overlay = null; state.form = null; state.dialog = null;
        render();
        break;

      case 'form-type':
        setFormType(el.getAttribute('data-type'));
        break;

      case 'form-delete':
        state.dialog = { id: state.overlay.id };
        render();
        break;

      case 'save-form':
        saveForm();
        break;

      case 'extract':
        runExtract();
        break;

      case 'example':
        state.ai.text = SS.examples[state.locale][Number(el.getAttribute('data-i'))] || '';
        state.ai.failure = null;
        render();
        break;

      case 'explain':
        runExplain();
        break;

      case 'load-demo':
        state.data = SS.buildSampleData();
        state.insights = { loading: false, text: null };
        showToast(t('dash.loadDemo'));
        break;
    }
  });

  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var field = el.getAttribute('data-field');
    if (field === 'ai-text') { state.ai.text = el.value; return; }
    if (!state.form) return;
    if (field === 'amount') state.form.amount = el.value;
    else if (field === 'description') state.form.description = el.value;
  });

  document.addEventListener('change', function (e) {
    var el = e.target;
    if (!el || !el.getAttribute || !state.form) return;
    var field = el.getAttribute('data-field');
    if (field === 'category') state.form.category = el.value;
    else if (field === 'date') state.form.date = el.value;
  });

  /* ------------------------------------------------------------ ai simulation */
  function runExtract() {
    var text = String(state.ai.text || '').trim();
    if (!text) { state.ai.failure = 'empty'; render(); return; }
    state.ai.loading = true;
    state.ai.failure = null;
    render();
    window.setTimeout(function () {
      var extraction = util.simulateExtraction(state.ai.text, state.locale);
      state.ai.loading = false;
      state.ai.extraction = extraction;
      openForm('ai', { extraction: extraction });
    }, 850);
  }

  function runExplain() {
    state.insights = { loading: true, text: null };
    render();
    window.setTimeout(function () {
      state.insights = { loading: false, text: buildExplanation(computeInsights()) };
      render();
    }, 850);
  }

  /* ---------------------------------------------------------------------- init */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();
