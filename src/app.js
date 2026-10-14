// 视图切换与页面逻辑
(function (TP) {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => document.querySelectorAll(s);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  };
  const icon = (name, cls) => {
    const i = el('i', cls);
    i.innerHTML = TP.icon(name);
    return i;
  };
  const t = TP.i18n.t;
  const A = TP.analytics;

  const settings = TP.store.settings();
  TP.i18n.init(settings.uiLang);
  TP.fillIcons(document);

  // 音效：点任何按钮、卡片都有一声轻响；打字、倒数、完成时的声音在各自的地方播
  const applySound = () => {
    TP.sound.enabled = settings.sound;
    TP.sound.volume = settings.soundVolume / 100;
    TP.sound.groups = { key: settings.soundKey, cue: settings.soundCue, ui: settings.soundUi };
  };
  applySound();
  document.addEventListener('click', (e) => e.target.closest('button, .article-card') && TP.sound.play('tap'), true);

  const state = {
    view: 'home',
    lang: settings.lastLang,
    cat: 'chat',
    fromMine: false, // 现在看的是不是侧栏的「我的文章」：那一页不分语言，两种语言的自定义文章都在
    mineLang: 'all', // 「我的文章」里按语言筛选：all / ja / zh
    mode: settings.mode,
    article: null,
    histFilter: 'all',
    sort: 'default',
    query: '',
    trendLang: settings.lastLang,
    result: null,
  };
  // 趋势图默认看上次练的语言；那个语言还没有记录时，换成有记录的那个
  {
    const has = (l) => TP.store.history().some((r) => r.lang === l);
    const other = state.trendLang === 'ja' ? 'zh' : 'ja';
    if (!has(state.trendLang) && has(other)) state.trendLang = other;
  }
  let run = null;
  const right = $('#right-body');

  // ---------- 小工具 ----------
  const textLang = (lang) => (lang === 'ja' ? 'ja' : 'zh-CN');
  function allArticles(lang) {
    const builtin = TP.data[lang].map((a) => ({ ...a, lang }));
    return builtin.concat(TP.store.customArticles().filter((a) => a.lang === lang));
  }
  const everyArticle = () => allArticles('ja').concat(allArticles('zh'));
  const inCat = (a, cat) => (cat === 'mine' ? !!a.custom : a.cat === cat);
  // 文章字数：开了「去除标点符号」就不算标点，和练习时要打的字数一致
  const charCount = (a) => TP.reading.charCount(a.lang, a.text, settings.noPunct);
  const setLang = (lang) => {
    state.lang = settings.lastLang = lang;
    TP.store.saveSettings(settings);
  };

  // 圆环：pct 取 0~1，中间一大一小两行字
  function ring(pct, big, small) {
    const R = 76;
    const C = 2 * Math.PI * R;
    const w = el('div', 'ring');
    w.innerHTML = `<svg viewBox="0 0 174 174"><circle class="track" cx="87" cy="87" r="${R}"/><circle class="arc" cx="87" cy="87" r="${R}" stroke-dasharray="${C}"/></svg>`;
    const inner = el('div', 'inner');
    const b = el('b');
    const s = el('span');
    inner.append(b, s);
    w.appendChild(inner);
    w.set = (p, bigText, smallText) => {
      const v = Math.max(0.001, Math.min(1, p || 0));
      w.querySelector('.arc').setAttribute('stroke-dashoffset', C * (1 - v));
      b.textContent = bigText;
      s.textContent = smallText;
    };
    w.set(pct, big, small);
    return w;
  }
  const ringWrap = (r) => {
    const w = el('div', 'ring-wrap');
    w.appendChild(r);
    return w;
  };
  function rHead(title, extra, rule) {
    const h = el('div', 'r-head' + (rule ? ' rule' : ''));
    h.appendChild(el('span', null, title));
    if (extra) h.appendChild(extra);
    return h;
  }
  function rCard(label, value, unit, side) {
    const c = el('div', 'r-card');
    const left = el('div');
    const b = el('b', null, String(value));
    if (unit) b.appendChild(el('em', null, unit));
    left.append(el('small', null, label), b);
    c.appendChild(left);
    if (side) c.appendChild(side);
    return c;
  }
  function bar(pct) {
    const b = el('div', 'bar');
    const i = el('i');
    i.style.width = Math.max(0, Math.min(100, pct)) + '%';
    b.appendChild(i);
    return b;
  }
  function emptyBox(iconName, text, btnText, onClick) {
    const box = el('div', 'empty-box');
    const ill = el('div', 'ill');
    ill.append(el('b'), icon(iconName));
    box.append(ill, el('p', null, text));
    if (btnText) {
      const b = el('button', 'btn primary big');
      if (iconName === 'plus') b.appendChild(icon('plus'));
      b.appendChild(el('span', null, btnText));
      b.addEventListener('click', onClick);
      box.appendChild(b);
    }
    return box;
  }

  // 打开弹窗。浏览器会自动聚焦第一个按钮并画出焦点框，鼠标点开时不需要，去掉
  function openDialog(d) {
    d.showModal();
    if (document.activeElement && document.activeElement.tagName === 'BUTTON') document.activeElement.blur();
  }

  // ---------- 窗口按钮 ----------
  // 页面自己画的最小化 / 最大化 / 关闭，只有在 Electron 里才显示
  const winCtl = $('#win-ctl');
  if (window.tpNative && window.tpNative.win) {
    winCtl.hidden = false;
    // 点按钮不抢焦点：打字框不会失去焦点，之后按空格回车也不会误触到按钮
    winCtl.addEventListener('mousedown', (e) => e.preventDefault());
    winCtl.addEventListener('click', (e) => {
      const b = e.target.closest('[data-win]');
      if (b) window.tpNative.win(b.dataset.win);
    });
    const maxBtn = winCtl.querySelector('[data-win="max"]');
    window.tpNative.onMaximize((maximized) => {
      maxBtn.firstElementChild.innerHTML = TP.icon(maximized ? 'winRestore' : 'winMax');
      maxBtn.dataset.i18nTitle = maximized ? 'win.restore' : 'win.max';
      maxBtn.title = t(maxBtn.dataset.i18nTitle);
    });
    // 弹窗打开时页面其余部分点不了，所以把按钮挪进最上面那个弹窗里，关掉后再挪回来
    new MutationObserver((list) => {
      const d = list[list.length - 1].target;
      if (d.tagName === 'DIALOG') (d.open ? d : $('dialog[open]') || document.body).appendChild(winCtl);
    }).observe(document.body, { attributes: true, attributeFilter: ['open'], subtree: true });
  }

  // 通用确认框。返回 'a'（左按钮）、'b'（右按钮）或 ''（按 Esc 关闭）
  const dlgConfirm = $('#dlg-confirm');
  let confirmDone = null;
  function confirmBox({ iconName, tone, title, sub, note, a, b }) {
    const ic = $('#confirm-ic');
    ic.className = 'dlg-ic ' + tone;
    ic.innerHTML = TP.icon(iconName);
    $('#confirm-title').textContent = title;
    $('#confirm-sub').textContent = sub;
    $('#confirm-note').textContent = note || '';
    $('#confirm-a').textContent = a.text;
    $('#confirm-a').className = 'btn big ' + a.cls;
    $('#confirm-b').textContent = b.text;
    $('#confirm-b').className = 'btn big ' + b.cls;
    dlgConfirm.returnValue = '';
    openDialog(dlgConfirm);
    return new Promise((resolve) => (confirmDone = resolve));
  }
  $('#confirm-a').addEventListener('click', () => dlgConfirm.close('a'));
  $('#confirm-b').addEventListener('click', () => dlgConfirm.close('b'));
  dlgConfirm.addEventListener('close', () => {
    const done = confirmDone;
    confirmDone = null;
    if (done) done(dlgConfirm.returnValue);
  });

  // ---------- 视图 ----------
  function show(view) {
    if (view !== 'practice') stopRun();
    state.view = view;
    $$('.view').forEach((v) => (v.hidden = v.id !== 'view-' + view));
    $('#app').classList.toggle('practicing', view === 'practice');
    const key = view === 'home' || view === 'history' || view === 'settings' ? view : view === 'list' && state.fromMine ? 'mine' : state.lang;
    $$('#nav button').forEach((b) => b.classList.toggle('active', b.dataset.nav === key));
    // 侧栏选中的底色块滑到新选中的那一项（练习时侧栏藏起来了，量不到位置就先不动）
    const on = $('#nav button.active');
    if (on && on.offsetParent) $('#nav-ind').style.transform = `translateY(${on.offsetTop}px)`;
    replay($('#view-' + view));
    replay(right);
    renderSide();
  }

  // 重新播放一遍进场动画：换页时页面内容和右侧面板轻轻上浮淡入
  function replay(node) {
    node.classList.remove('enter');
    void node.offsetWidth;
    node.classList.add('enter');
  }

  // ---------- 分段按钮 ----------
  // 选中的底色块单独画成一个滑块，换选项时滑过去而不是直接跳
  function placeThumb(seg) {
    const on = seg.querySelector('button.active');
    const placed = seg.classList.contains('thumbed');
    if (!on || !on.offsetWidth) {
      // 还没显示出来量不到位置：先退回按钮自带的底色，等显示出来再放滑块
      if (placed) seg.classList.remove('thumbed');
      return;
    }
    const thumb = seg.querySelector('.seg-thumb');
    if (!placed) thumb.style.transition = 'none'; // 第一次出现直接到位，不要从左边滑进来
    thumb.style.width = on.offsetWidth + 'px';
    thumb.style.transform = `translateX(${on.offsetLeft}px)`;
    if (!placed) {
      seg.classList.add('thumbed');
      void thumb.offsetWidth;
      thumb.style.transition = '';
    }
  }
  function segThumb(seg) {
    seg.prepend(el('span', 'seg-thumb'));
    const place = () => placeThumb(seg);
    // 选中项变了、所在页面显示出来了、换语言后文字宽度变了，都要重新摆一次
    new MutationObserver(place).observe(seg, { attributes: true, attributeFilter: ['class'], subtree: true });
    new ResizeObserver(place).observe(seg);
  }
  $$('.seg').forEach(segThumb);

  function renderSide() {
    const days = A.lastDays(TP.store.history(), 7);
    const wd = t('wd').split(',');
    const max = Math.max(...days.map((d) => d.minutes), 1);
    $('#week-min').textContent = t('min', { n: days.reduce((n, d) => n + d.minutes, 0) });
    const box = $('#week-bars');
    box.textContent = '';
    days.forEach((d) => {
      const col = el('div', 'wb');
      const b = el('i');
      b.style.height = (d.minutes ? 10 + (72 * d.minutes) / max : 4) + 'px';
      col.append(b, el('span', null, wd[d.date.getDay()]));
      box.appendChild(col);
    });
  }

  $$('#nav button').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.nav;
      if (k === 'home') return openHome();
      if (k === 'history') return openHistory();
      if (k === 'settings') return openSettings();
      state.fromMine = k === 'mine';
      if (k === 'mine') {
        state.cat = 'mine';
        state.mineLang = 'all';
      } else {
        setLang(k);
        state.cat = 'chat';
      }
      openList();
    })
  );
  $$('[data-back]').forEach((b) => b.addEventListener('click', () => (state.view === 'result' ? openList() : openHome())));
  $$('[data-go-history]').forEach((b) => b.addEventListener('click', openHistory));
  $('#card-history').addEventListener('click', openHistory);
  $$('.entry[data-lang]').forEach((b) =>
    b.addEventListener('click', () => {
      setLang(b.dataset.lang);
      state.cat = 'chat';
      state.fromMine = false;
      openList();
    })
  );

  // 主页横幅上的按钮：优先挑一篇还没练过的
  $('#btn-random').addEventListener('click', () => {
    const done = A.practiced(TP.store.history());
    const all = everyArticle();
    const fresh = all.filter((a) => !done.has(a.id));
    const pool = fresh.length ? fresh : all;
    chooseMode(pool[Math.floor(Math.random() * pool.length)]);
  });

  // 主页横幅：每 15 秒换一句关于努力的名言，用哪种语言的名言跟着界面语言走
  const QUOTE_MS = 15000;
  const QUOTE_SWAP_MS = 400; // 旧句子淡出的时间，和 styles.css 里 quote-out 的时长一致
  const quote = { lang: null, order: [], at: 0 };
  function fitQuote() {
    // 两行排不下的长句子用小一号的字
    const box = $('#hero-quote');
    box.classList.remove('long');
    box.classList.toggle('long', box.offsetHeight > 60);
  }
  function drawQuote() {
    const [text, by] = TP.quotes[quote.lang][quote.order[quote.at]];
    $('#quote-text').textContent = text;
    $('#quote-by').textContent = (quote.lang === 'zh' ? '—— ' : '— ') + by;
    fitQuote();
  }
  // 界面语言变了就换成那种语言的名言，顺序每次打乱
  function syncQuote() {
    if (quote.lang === TP.i18n.lang) return fitQuote();
    quote.lang = TP.i18n.lang;
    quote.order = TP.quotes[quote.lang].map((_, i) => i);
    for (let i = quote.order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [quote.order[i], quote.order[j]] = [quote.order[j], quote.order[i]];
    }
    quote.at = 0;
    drawQuote();
  }
  function nextQuote() {
    if (state.view !== 'home' || document.hidden) return;
    const box = $('#hero-quote');
    box.classList.remove('enter');
    box.classList.add('leave');
    setTimeout(() => {
      quote.at = (quote.at + 1) % quote.order.length;
      drawQuote();
      box.classList.remove('leave');
      box.classList.add('enter');
    }, QUOTE_SWAP_MS);
  }
  setInterval(nextQuote, QUOTE_MS);

  // ---------- 主页 ----------
  function openHome() {
    show('home');
    renderHome();
  }

  function renderHome() {
    const hist = TP.store.history();
    const now = Date.now();
    const loc = TP.i18n.locale;
    const datePart = new Intl.DateTimeFormat(loc, { year: 'numeric', month: 'long', day: 'numeric' }).format(now);
    const weekPart = new Intl.DateTimeFormat(loc, { weekday: 'short' }).format(now);
    $('#date-text').textContent = `${datePart} · ${weekPart}`;
    syncQuote();

    const today = A.day(hist, now);
    const goal = settings.dailyGoal;
    $('#hero-sub').textContent = !today.count
      ? t('hero.none')
      : today.minutes >= goal
        ? t('hero.done', { n: today.minutes })
        : t('hero.left', { n: today.minutes, m: goal - today.minutes });

    $$('#trend-seg button').forEach((b) => b.classList.toggle('active', b.dataset.l === state.trendLang));
    // 趋势图要按实际大小来画，所以放在其他部分排好之后
    renderHomeTiles(hist);
    renderHomeRight(hist, today);
    renderTrend(hist);
  }

  // 趋势图：最近 7 周每周（或最近 7 天每天）的速度、错误率，画成平滑曲线。
  // 按周还是按日在标题旁边选；取平均还是最好、画哪几条线在设置里改
  const TREND_KEYS = { speed: ['cpm'], error: ['err'], both: ['cpm', 'err'] };
  const TREND_GRID = 4; // 纵轴分成几格
  // 把各点连成线：一直涨或一直跌的地方接近直线，只在拐弯的点上圆一下，并且不会冲过点的高度
  function smoothPath(P) {
    const n = P.length;
    const slope = [];
    for (let i = 0; i < n - 1; i++) slope.push((P[i + 1][1] - P[i][1]) / (P[i + 1][0] - P[i][0]));
    // 每个点上线的方向：两边同是涨或同是跌时取两边斜率的调和平均，峰和谷取水平
    const dir = P.map((_, i) => {
      if (n < 2) return 0;
      if (i === 0) return slope[0];
      if (i === n - 1) return slope[n - 2];
      return slope[i - 1] * slope[i] <= 0 ? 0 : (2 * slope[i - 1] * slope[i]) / (slope[i - 1] + slope[i]);
    });
    let path = `M${P[0][0]},${P[0][1]}`;
    for (let i = 0; i < n - 1; i++) {
      const h = (P[i + 1][0] - P[i][0]) / 3;
      path += ` C${P[i][0] + h},${P[i][1] + dir[i] * h} ${P[i + 1][0] - h},${P[i + 1][1] - dir[i + 1] * h} ${P[i + 1][0]},${P[i + 1][1]}`;
    }
    return path;
  }
  function renderTrend(hist) {
    const box = $('#trend-chart');
    box.textContent = '';
    const byDay = settings.trendUnit === 'day';
    const keys = TREND_KEYS[settings.trendShow];
    const both = keys.length > 1;
    const unit = { cpm: ' ' + t('u.cpm'), err: '%' };
    $$('#trend-unit button').forEach((b) => b.classList.toggle('active', (b.dataset.u === 'day') === byDay));
    $('#trend-title').textContent = t('trend.title.' + settings.trendShow);
    // 副标题：只画一条线时写成一句；两条都画时，每一项前面带一个色点当图例
    const sub = $('#trend-sub');
    const per = t(`trend.p.${settings.trendUnit}.${settings.trendStat}`);
    sub.textContent = both ? per : t('trend.sub', { p: per, m: t('trend.m.' + keys[0]) });
    if (both) keys.forEach((k) => sub.appendChild(el('span', 'trend-key ' + k, t('trend.m.' + k))));
    const now = t(byDay ? 'trend.today' : 'trend.this');
    const data = (byDay ? A.days : A.weeks)(hist || TP.store.history(), state.trendLang, settings.trendStat, 7);
    const pts = data.map((d, i) => ({ ...d, i })).filter((d) => d.cpm != null);
    if (!pts.length) {
      box.appendChild(el('div', 'trend-empty', t('trend.empty')));
      return;
    }
    const W = box.clientWidth;
    const H = box.clientHeight;
    // 左边留给纵轴的刻度；两条线时右边也有一列刻度
    const padL = 46;
    const padR = both ? 50 : 24;
    const top = 14;
    const bottom = H - 34;
    const x = (i) => padL + (i * (W - padL - padR)) / (data.length - 1);
    // 纵轴从 0 开始，分成 4 格，这样线的起伏就是真实的变化幅度。
    // 两条线各有各的刻度：第一条看左边，第二条看右边
    const peak = {};
    const step = {};
    const full = {};
    keys.forEach((k) => {
      peak[k] = Math.max(...pts.map((p) => p[k])) || 1;
      const raw = Math.max(peak[k] / TREND_GRID, 0.1);
      const pow = 10 ** Math.floor(Math.log10(raw));
      // 每格取 1、2、5 这类好读的数；每格不小于 1 时只用整数，刻度上就不会带小数
      const nice = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((m) => Number((m * pow).toFixed(2))).filter((s) => pow < 1 || Number.isInteger(s));
      step[k] = nice.find((s) => s >= raw) || 10 * pow;
      full[k] = step[k] * TREND_GRID;
    });
    // 刻度上的数字：同一列的小数位数对齐，错误率带上 %
    const tick = (k, j) => {
      const dec = (String(step[k]).split('.')[1] || '').length;
      return (j ? (step[k] * j).toFixed(dec) : '0') + (k === 'err' ? '%' : '');
    };
    // 最高的点上面要放得下气泡（两条线时气泡多一行），剩下的高度都用来画线
    const room = both ? 102 : 80;
    const plotH = Math.max(40, Math.min(bottom - top - 6, ...keys.map((k) => ((bottom - room) * full[k]) / peak[k])));
    const y = {};
    keys.forEach((k) => (y[k] = (v) => bottom - (v / full[k]) * plotH));
    const label = (d) => (d.current ? now : `${d.start.getMonth() + 1}/${d.start.getDate()}`);

    // 每条线下面铺一层往下变淡的底色
    let svg = '<defs>';
    keys.forEach((k) => (svg += `<linearGradient id="trend-fill-${k}" x1="0" y1="0" x2="0" y2="1"><stop class="fill-a ${k}" offset="0"/><stop class="fill-b ${k}" offset="1"/></linearGradient>`));
    svg += '</defs>';
    for (let j = 0; j <= TREND_GRID; j++) {
      const gy = bottom - (j / TREND_GRID) * plotH;
      svg += `<line class="grid-line${j ? '' : ' base'}" x1="${padL}" y1="${gy}" x2="${W - padR}" y2="${gy}"/>`;
      keys.forEach((k, n) => {
        svg += `<text class="tick${n ? ' right' : ''}${both ? ' ' + k : ''}" x="${n ? W - padR + 12 : padL - 12}" y="${gy + 4}">${tick(k, j)}</text>`;
      });
    }
    // 带 data-i 的是属于某一列的东西，鼠标指到那一列时一起加亮
    data.forEach((d, i) => {
      svg += `<line class="guide-line" data-i="${i}" x1="${x(i)}" y1="${top}" x2="${x(i)}" y2="${bottom}"/><circle class="cap" data-i="${i}" cx="${x(i)}" cy="${top}" r="4.5"/>`;
      svg += `<text class="when" data-i="${i}" x="${x(i)}" y="${H - 8}">${label(d)}</text>`;
    });
    const lines = keys.map((k) => ({ k, P: pts.map((p) => [x(p.i), y[k](p[k]), p.i]) }));
    lines.forEach(({ k, P }) => {
      if (P.length > 1) svg += `<path class="area" fill="url(#trend-fill-${k})" d="${smoothPath(P)} L${P[P.length - 1][0]},${bottom} L${P[0][0]},${bottom} Z"/>`;
    });
    lines.forEach(({ k, P }) => (svg += `<path class="curve ${k}" d="${smoothPath(P)}"/>`));
    lines.forEach(({ k, P }) => P.forEach((p) => (svg += `<circle class="dot ${k}" data-i="${p[2]}" cx="${p[0]}" cy="${p[1]}" r="4.5"/>`)));
    const colW = (W - padL - padR) / (data.length - 1);
    pts.forEach((p) => (svg += `<rect class="hit" data-i="${p.i}" x="${x(p.i) - colW / 2}" y="0" width="${colW}" height="${H}"/>`));
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${svg}</svg>`;
    box.classList.toggle('both', both);

    const tip = el('div', 'trend-tip');
    box.appendChild(tip);
    const showTip = (p) => {
      box.querySelectorAll('[data-i]').forEach((n) => n.classList.toggle('on', Number(n.dataset.i) === p.i));
      const d = new Intl.DateTimeFormat(TP.i18n.locale, { month: 'short', day: 'numeric' }).format(p.start);
      tip.textContent = p.current ? now : byDay ? d : t('trend.week', { d });
      keys.forEach((k) => tip.appendChild(el('b', both ? k : null, p[k] + unit[k])));
      // 气泡不超出画线的范围，免得盖住两侧的刻度
      tip.style.left = Math.max(padL + 58, Math.min(W - padR - 58, x(p.i))) + 'px';
      // 两条线时，气泡放在这一列较高的那个点上面
      tip.style.top = Math.min(...keys.map((k) => y[k](p[k]))) - 14 + 'px';
    };
    // 默认标出最好的那一段（速度最快的；只看错误率时是错误率最低的），鼠标移到哪一段就显示哪一段
    const best = pts.reduce((a, b) => ((keys[0] === 'err' ? b.err <= a.err : b.cpm >= a.cpm) ? b : a));
    showTip(best);
    box.querySelectorAll('.hit').forEach((r) => {
      const p = pts.find((q) => q.i === Number(r.dataset.i));
      r.addEventListener('mouseenter', () => showTip(p));
    });
    box.querySelector('svg').addEventListener('mouseleave', () => showTip(best));
  }
  $$('#trend-seg button').forEach((b) =>
    b.addEventListener('click', () => {
      state.trendLang = b.dataset.l;
      $$('#trend-seg button').forEach((x) => x.classList.toggle('active', x === b));
      renderTrend();
    })
  );
  $$('#trend-unit button').forEach((b) =>
    b.addEventListener('click', () => {
      settings.trendUnit = b.dataset.u;
      TP.store.saveSettings(settings);
      renderTrend();
    })
  );
  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => state.view === 'home' && renderTrend(), 120);
  });

  function renderHomeTiles(hist) {
    const box = $('#home-tiles');
    box.textContent = '';
    const c = A.compare(hist);
    const tile = (ic, tone, label, value, sub, subCls) => {
      const d = el('div', 'tile');
      const badge = el('span', 'tile-ic ' + tone);
      badge.appendChild(icon(ic));
      const tx = el('span', 'tile-tx');
      tx.append(el('small', null, label), el('b', null, value), el('span', 'delta ' + (subCls || ''), sub));
      d.append(badge, tx);
      box.appendChild(d);
    };
    const withDelta = (m, fmt) => {
      if (m.value == null) return ['—', t('tile.none'), ''];
      if (m.delta == null) return [fmt(m.value), t('tile.recent'), ''];
      const sign = m.delta > 0 ? '+' : m.delta < 0 ? '−' : '';
      return [fmt(m.value), t('tile.vs', { v: `${sign}${Math.abs(m.delta)}%` }), m.delta > 0 ? 'up' : m.delta < 0 ? 'down' : ''];
    };
    const int = (v) => String(Math.round(v));
    tile('gauge', 'lav', t('tile.avg'), ...withDelta(c.cpm, int));
    tile('keyboard', 'cyan', t('tile.kpm'), ...withDelta(c.kpm, int));
    tile('target', 'peach', t('tile.acc'), ...withDelta(c.acc, (v) => Math.round(v * 10) / 10 + '%'));
    const done = A.practiced(hist);
    const count = (lang) => allArticles(lang).filter((a) => done.has(a.id)).length;
    const j = count('ja');
    const z = count('zh');
    tile('docCheck', 'pink', t('tile.done'), `${j + z} / ${everyArticle().length}`, t('tile.langs', { j, z }));
  }

  // 每日目标由用户自己填，单位分钟
  const GOAL_RANGE = [1, 1440];
  function renderHomeRight(hist, today) {
    right.textContent = '';
    const go = () => {
      const b = el('button', 'r-go');
      b.appendChild(icon('right'));
      b.addEventListener('click', openHistory);
      return b;
    };
    right.append(
      rCard(t('today.min'), today.minutes, t('unit.min'), go()),
      rCard(t('today.count'), today.count, t('unit.count'), go()),
      rCard(t('today.best'), today.best == null ? '—' : today.best, t('u.cpm'), go())
    );

    const streakTag = el('span', null, t('cal.streak', { n: A.streak(hist) }));
    streakTag.style.fontWeight = '400';
    streakTag.style.fontSize = '13.5px';
    right.appendChild(rHead(t('cal.title'), streakTag));
    const cal = el('div', 'cal');
    const wd = t('wd').split(',');
    A.lastDays(hist, 7).forEach((d, i, arr) => {
      const c = el('div', 'cal-d' + (d.count ? ' on' : '') + (i === arr.length - 1 ? ' today' : ''));
      c.append(el('span', null, wd[d.date.getDay()]), el('b', null, String(d.date.getDate())));
      cal.appendChild(c);
    });
    right.appendChild(cal);

    // 点目标时长可以在几个常用值之间切换
    const goal = settings.dailyGoal;
    const goalChip = el('button', 'chip', t('min', { n: goal }));
    goalChip.addEventListener('click', openSettings);
    right.appendChild(rHead(t('goal.title'), goalChip, true));
    const pct = Math.min(1, today.minutes / goal);
    const left = goal - today.minutes;
    right.appendChild(ringWrap(ring(pct, Math.round(pct * 100) + '%', left > 0 ? t('goal.left', { n: left }) : t('goal.done'))));

    const r = TP.store.resume();
    const a = r && everyArticle().find((x) => x.id === r.articleId);
    if (a) {
      const box = el('div', 'resume');
      const top = el('div', 'resume-top');
      const btn = el('button');
      btn.append(el('span', null, t('resume.go')), icon('arrow'));
      btn.addEventListener('click', () => {
        setLang(a.lang);
        state.mode = r.mode;
        startPractice(a, r);
      });
      top.append(el('b', null, r.percent + '%'), btn);
      const p = el('p', null, `${a.title} · ${t('mode.' + r.mode)}`);
      p.lang = textLang(a.lang);
      box.append(top, p, bar(r.percent));
      right.appendChild(box);
    }
  }

  // 主页搜索：在两种语言的全部文章标题里找
  const searchPop = $('#home-search-pop');
  $('#home-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    searchPop.textContent = '';
    searchPop.hidden = !q;
    if (!q) return;
    const hits = everyArticle().filter((a) => a.title.toLowerCase().includes(q)).slice(0, 8);
    if (!hits.length) searchPop.appendChild(el('p', null, t('search.none')));
    hits.forEach((a) => {
      const b = el('button');
      const name = el('span', null, a.title);
      name.lang = textLang(a.lang);
      b.append(name, el('small', null, `${t('lang.' + a.lang)} · ${t('cat.' + (a.cat || 'mine'))}`));
      b.addEventListener('click', () => {
        searchPop.hidden = true;
        $('#home-search').value = '';
        setLang(a.lang);
        chooseMode(a);
      });
      searchPop.appendChild(b);
    });
  });

  // ---------- 界面语言 ----------
  const flagMenu = $('#flag-menu');
  function renderFlags() {
    $('#flag-cur').innerHTML = TP.i18n.flag(TP.i18n.lang);
    flagMenu.textContent = '';
    TP.i18n.langs.forEach((l) => {
      const active = l === TP.i18n.lang;
      const b = el('button', 'flag-item' + (active ? ' active' : ''));
      const f = el('span', 'flag');
      f.innerHTML = TP.i18n.flag(l);
      b.append(f, el('span', null, TP.i18n.name(l)));
      if (active) b.appendChild(icon('check'));
      b.addEventListener('click', () => {
        settings.uiLang = l;
        TP.store.saveSettings(settings);
        TP.i18n.set(l);
        flagMenu.hidden = true;
        renderFlags();
        refresh();
      });
      flagMenu.appendChild(b);
    });
  }
  $('#flag-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    flagMenu.hidden = !flagMenu.hidden;
  });
  document.addEventListener('click', (e) => {
    flagMenu.hidden = true;
    if (!e.target.closest('#home-search-box')) searchPop.hidden = true;
  });
  renderFlags();

  // 语言等设置变化后，把当前页面里动态生成的文字重画一遍
  function refresh() {
    if (state.view === 'home') renderHome();
    else if (state.view === 'list') renderList();
    else if (state.view === 'history') renderHistory();
    else if (state.view === 'result') showResult();
    else if (state.view === 'settings') settingsRight();
    renderSide();
  }

  // ---------- 设置 ----------
  // 页面颜色由 data-theme 直接控制；窗口按钮的颜色交给主进程
  const applyTheme = () => {
    if (settings.theme === 'system') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = settings.theme;
    if (window.tpNative) window.tpNative.setTheme(settings.theme);
  };
  const applyTextSize = () => (document.documentElement.dataset.size = settings.textSize);
  applyTheme();
  applyTextSize();

  function openSettings() {
    show('settings');
    renderSettings();
    settingsRight();
  }
  // 设置页右侧沿用主页的今日数据，改每日目标时能马上看到变化
  function settingsRight() {
    const hist = TP.store.history();
    renderHomeRight(hist, A.day(hist, Date.now()));
  }
  function renderSettings() {
    const onOff = [[true, t('set.on')], [false, t('set.off')]];
    // 某一类声音的单独开关；打开时响一声这类声音当示范
    const soundSwitch = (label, key, sample) => ({
      label,
      sub: true,
      value: settings[key],
      options: onOff,
      pick(v) {
        settings[key] = v;
        applySound();
        if (v) TP.sound.play(sample);
      },
    });
    const rows = [
      {
        label: 'set.lang',
        value: settings.uiLang || 'system',
        options: [['system', t('set.system')]].concat(TP.i18n.langs.map((l) => [l, TP.i18n.name(l)])),
        pick(v) {
          settings.uiLang = v === 'system' ? null : v;
          TP.i18n.init(settings.uiLang);
          renderFlags();
          refresh();
        },
      },
      {
        label: 'set.theme',
        value: settings.theme,
        options: [['system', t('set.system')], ['light', t('set.light')], ['dark', t('set.dark')]],
        pick(v) {
          settings.theme = v;
          applyTheme();
        },
      },
      {
        label: 'goal.title',
        value: settings.dailyGoal,
        number: GOAL_RANGE,
        unit: t('min', { n: '' }).trim(),
        pick(v) {
          settings.dailyGoal = v;
          refresh();
        },
      },
      {
        label: 'set.count',
        value: settings.countdown,
        options: [[0, t('set.off')], [3, t('set.sec', { n: 3 })], [5, t('set.sec', { n: 5 })]],
        pick(v) {
          settings.countdown = v;
        },
      },
      {
        label: 'set.size',
        sample: true,
        value: settings.textSize,
        options: [['small', t('set.small')], ['normal', t('set.normal')], ['large', t('set.large')]],
        pick(v) {
          settings.textSize = v;
          applyTextSize();
        },
      },
      {
        label: 'set.noPunct',
        value: settings.noPunct,
        options: onOff,
        pick(v) {
          settings.noPunct = v;
        },
      },
      // ----- 主页的趋势图 -----
      { heading: 'set.trend' },
      {
        label: 'set.trendUnit',
        value: settings.trendUnit,
        options: [['week', t('trend.byWeek')], ['day', t('trend.byDay')]],
        pick(v) {
          settings.trendUnit = v;
        },
      },
      {
        label: 'set.trendStat',
        value: settings.trendStat,
        options: [['avg', t('set.avg')], ['best', t('set.best')]],
        pick(v) {
          settings.trendStat = v;
        },
      },
      {
        label: 'set.trendShow',
        value: settings.trendShow,
        options: [['speed', t('set.speed')], ['error', t('set.error')], ['both', t('set.both')]],
        pick(v) {
          settings.trendShow = v;
        },
      },
      // ----- 音频 -----
      { heading: 'set.audio' },
      {
        label: 'set.sound',
        value: settings.sound,
        options: onOff,
        pick(v) {
          settings.sound = v;
          applySound();
          body.classList.toggle('sound-off', !v);
          TP.sound.play('tap');
        },
      },
      {
        label: 'set.volume',
        sub: true,
        value: settings.soundVolume,
        range: [0, 100],
        unit: '%',
        pick(v) {
          settings.soundVolume = v;
          applySound();
        },
        // 松手时响一声，听听现在多大声
        done: () => TP.sound.play('line'),
      },
      soundSwitch('set.sKey', 'soundKey', 'key'),
      soundSwitch('set.sCue', 'soundCue', 'line'),
      soundSwitch('set.sUi', 'soundUi', 'tap'),
    ];
    const body = $('#settings-body');
    body.textContent = '';
    body.classList.toggle('sound-off', !settings.sound);
    rows.forEach((r) => {
      if (r.heading) return body.appendChild(el('div', 'set-head', t(r.heading)));
      // 音效总开关关掉时，下面几项细分设置变灰不能点
      const row = el('div', 'set-row' + (r.sub ? ' needs-sound' : ''));
      row.appendChild(el('span', null, t(r.label)));
      if (r.range) {
        const [min, max] = r.range;
        const box = el('label', 'set-range');
        const input = el('input');
        input.type = 'range';
        input.min = min;
        input.max = max;
        input.value = r.value;
        const out = el('span', null, r.value + r.unit);
        input.addEventListener('input', () => {
          out.textContent = input.value + r.unit;
          r.pick(Number(input.value));
        });
        input.addEventListener('change', () => {
          TP.store.saveSettings(settings);
          r.done();
        });
        box.append(input, out);
        row.appendChild(box);
        body.appendChild(row);
        return;
      }
      if (r.sample) {
        const s = el('span', 'set-sample');
        s.append(el('b', null, t('set.sample')), el('small', null, t('set.preview')));
        row.appendChild(s);
      }
      if (r.number) {
        // 自己输入数字：超出范围的自动调回范围内，没填或填错的恢复原值
        const [min, max] = r.number;
        const box = el('label', 'set-num');
        const input = el('input');
        input.type = 'number';
        input.min = min;
        input.max = max;
        input.step = 1;
        input.value = r.value;
        input.addEventListener('input', () => {
          if (Number(input.value) > max) input.value = max;
        });
        input.addEventListener('change', () => {
          const n = Math.round(Number(input.value));
          if (input.value.trim() !== '' && Number.isFinite(n)) r.pick(Math.max(min, Math.min(max, n)));
          TP.store.saveSettings(settings);
          renderSettings();
        });
        input.addEventListener('keydown', (e) => e.key === 'Enter' && input.blur());
        box.append(input, el('span', null, r.unit));
        row.appendChild(box);
        body.appendChild(row);
        return;
      }
      const seg = el('div', 'seg light');
      r.options.forEach(([v, label]) => {
        const b = el('button', v === r.value ? 'active' : null, label);
        b.type = 'button';
        b.addEventListener('click', () => {
          r.pick(v);
          TP.store.saveSettings(settings);
          // 换界面语言时所有文字都要重画；其余只挪一下选中项，滑块才滑得起来
          if (r.label === 'set.lang') renderSettings();
          else seg.querySelectorAll('button').forEach((x) => x.classList.toggle('active', x === b));
        });
        seg.appendChild(b);
      });
      segThumb(seg);
      row.appendChild(seg);
      body.appendChild(row);
    });
  }
  // ---------- 文章列表 ----------
  function openList() {
    state.query = '';
    $('#list-search').value = '';
    show('list');
    renderList();
  }

  function renderList() {
    const hist = TP.store.history();
    // 「我的文章」：两种语言的自定义文章放在一起，左边按语言筛选；其余是某一种语言的文章，左边按分类
    const mine = state.fromMine;
    const all = mine ? TP.store.customArticles() : allArticles(state.lang);
    const done = A.practiced(hist);
    $('#list-title').textContent = mine ? t('cat.mine') : t('home.' + state.lang);
    $('#cats-label').textContent = mine ? t('h.lang') : t('cat.label');
    const tabs = mine
      ? ['all', 'ja', 'zh'].map((id) => ({
          label: id === 'all' ? t('f.all') : t('lang.' + id),
          has: (a) => id === 'all' || a.lang === id,
          on: id === state.mineLang,
          pick: () => (state.mineLang = id),
        }))
      : TP.categories.map((id) => ({
          label: t('cat.' + id),
          has: (a) => inCat(a, id),
          on: id === state.cat,
          pick: () => (state.cat = id),
        }));
    const tab = tabs.find((x) => x.on) || tabs[0];

    const cats = $('#cat-list');
    cats.querySelectorAll('.cat').forEach((b) => b.remove());
    tabs.forEach((x) => {
      const b = el('button', 'cat' + (x === tab && !state.query ? ' active' : ''));
      b.append(el('span', null, x.label), el('span', 'count', String(all.filter(x.has).length)));
      b.addEventListener('click', () => {
        x.pick();
        state.query = '';
        $('#list-search').value = '';
        renderList();
        replay($('#article-list'));
      });
      cats.appendChild(b);
    });
    // 选中分类的底色块滑到新选中的那一项；搜索时没有选中的分类，就藏起来
    const catOn = cats.querySelector('.cat.active');
    const catInd = $('#cat-ind');
    catInd.classList.toggle('off', !catOn);
    if (catOn) catInd.style.transform = `translateY(${catOn.offsetTop}px)`;

    // 搜索时在这一页的全部文章里找，不限左边选的那一项
    const q = state.query.trim().toLowerCase();
    let list = q
      ? all.filter((a) => (a.title + TP.reading.plainText(a.lang, a.text)).toLowerCase().includes(q))
      : all.filter(tab.has);
    if (state.sort === 'new') list = list.filter((a) => !done.has(a.id)).concat(list.filter((a) => done.has(a.id)));
    $('#cat-title').textContent = q ? `“${state.query.trim()}”` : tab.label;
    $('#cat-count').textContent = t('list.count', { n: list.length });
    $$('#sort-seg button').forEach((b) => b.classList.toggle('active', b.dataset.s === state.sort));

    const box = $('#article-list');
    box.textContent = '';
    box.classList.toggle('blank', !list.length);
    if (!list.length) {
      if (q) box.appendChild(emptyBox('search', t('search.none')));
      else if (mine || state.cat === 'mine') box.appendChild(emptyBox('plus', t('empty.mine'), t('add'), () => openEditor(null)));
      else box.appendChild(emptyBox('plus', t('empty.cat'), t('add'), () => openEditor(null)));
    }
    list.forEach((a) => box.appendChild(articleCard(a)));
    if (list.length && !q) {
      const add = el('button', 'add-card');
      add.append(icon('plus'), el('span', null, t('add.here')));
      add.addEventListener('click', () => openEditor(null));
      box.appendChild(add);
    }
    renderListRight(hist, all, done);
  }

  function articleCard(a) {
    const card = el('div', 'article-card');
    card.tabIndex = 0;
    const head = el('div', 'card-head');
    const title = el('h3', null, a.title);
    title.lang = textLang(a.lang);
    head.appendChild(title);
    if (a.custom) {
      // 「我的文章」里全是自定义的，标出是哪种语言更有用
      if (state.fromMine) head.appendChild(el('span', 'lang-chip ' + (a.lang === 'ja' ? 'lav' : 'cyan'), t('lang.' + a.lang)));
      else head.appendChild(el('span', 'tag', t('custom')));
      const edit = el('button', 'mini');
      edit.title = t('edit');
      edit.appendChild(icon('edit'));
      edit.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditor(a);
      });
      const del = el('button', 'mini del');
      del.title = t('del');
      del.appendChild(icon('trash'));
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        const r = await confirmBox({
          iconName: 'trash',
          tone: 'danger',
          title: t('del.title', { t: a.title }),
          sub: t('del.sub'),
          a: { text: t('cancel'), cls: 'soft' },
          b: { text: t('del'), cls: 'danger' },
        });
        if (r === 'b') {
          TP.store.removeArticle(a.id);
          renderList();
        }
      });
      head.append(edit, del);
    }
    card.appendChild(head);
    // 内容平时隐藏，鼠标移上去才渐显（样式里控制）
    const more = el('div', 'card-more');
    const plain = TP.reading.plainText(a.lang, a.text).replace(/\s+/g, ' ');
    const preview = el('p', 'preview', plain.slice(0, 90));
    preview.lang = textLang(a.lang);
    more.appendChild(preview);
    card.appendChild(more);
    // 字数和练习情况一直显示；练习过的列出两种模式各自的最好成绩
    const meta = el('div', 'meta');
    const bests = el('div', 'bests');
    const scores = ['ime', 'key'].map((m) => [m, TP.store.best(a.id, m)]);
    if (scores.some(([, n]) => n)) {
      scores.forEach(([m, n]) => {
        const s = el('span', null, t('mode.' + m) + ' ');
        if (n) s.append(el('b', null, String(n)), ' ' + t('u.cpm'));
        else s.append('—');
        bests.appendChild(s);
      });
    } else {
      bests.appendChild(el('span', 'chip-soft', t('never')));
    }
    meta.append(el('span', null, t('chars', { n: charCount(a) })), bests);
    card.appendChild(meta);
    const go = () => chooseMode(a);
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => e.key === 'Enter' && e.target === card && go());
    return card;
  }

  function renderListRight(hist, all, done) {
    right.textContent = '';
    if (state.fromMine) {
      // 「我的文章」不分语言，这里列每种语言各有几篇
      right.appendChild(rHead(t('cat.mine')));
      ['ja', 'zh'].forEach((l) => right.appendChild(rCard(t('lang.' + l), all.filter((a) => a.lang === l).length, t('unit.count'))));
    } else {
      right.appendChild(rHead(t('right.best', { l: t('lang.' + state.lang) })));
      const best = A.bestByMode(hist, state.lang);
      ['ime', 'key'].forEach((m) => {
        const r = best[m];
        let side = null;
        if (r) {
          side = el('span', 'r-side', r.title);
          side.lang = textLang(state.lang);
        }
        right.appendChild(rCard(t('mode.' + m), r ? r.cpm : '—', t('u.cpm'), side));
      });
    }
    right.appendChild(rHead(t('cover.title'), el('span', 'chip', t('cover.total', { n: all.length })), true));
    const n = all.filter((a) => done.has(a.id)).length;
    right.appendChild(ringWrap(ring(all.length ? n / all.length : 0, `${n}/${all.length}`, t('cover.done'))));

    // 推荐：先看当前分类里没练过的，再看这个语言里其他没练过的
    const here = (a) => (state.fromMine ? state.mineLang === 'all' || a.lang === state.mineLang : inCat(a, state.cat));
    const next = all.find((a) => !done.has(a.id) && here(a)) || all.find((a) => !done.has(a.id));
    const card = el('div', 'next-card');
    const tx = el('div');
    tx.appendChild(el('small', null, t('next.title')));
    if (next) {
      const name = el('b', null, next.title);
      name.lang = textLang(next.lang);
      tx.append(name, el('span', null, `${t('cat.' + (next.cat || 'mine'))} · ${t('chars', { n: charCount(next) })} · ${t('never')}`));
      const play = el('button', 'play');
      play.appendChild(icon('play'));
      play.addEventListener('click', () => chooseMode(next));
      card.append(tx, play);
    } else {
      tx.appendChild(el('span', null, t('next.all')));
      card.appendChild(tx);
    }
    right.appendChild(card);
  }

  $('#list-search').addEventListener('input', (e) => {
    state.query = e.target.value;
    renderList();
  });
  $$('#sort-seg button').forEach((b) =>
    b.addEventListener('click', () => {
      state.sort = b.dataset.s;
      renderList();
    })
  );

  // ---------- 选好文章后选择打字方式 ----------
  const dlgMode = $('#dlg-mode');
  let showRuby = true; // 弹窗里「是否显示注音」的当前选择，一直显示在弹窗里
  function renderRubyChoice() {
    $$('#ruby-seg button').forEach((b) => b.classList.toggle('active', (b.dataset.v === '1') === showRuby));
  }
  function chooseMode(a) {
    showRuby = settings.ruby[`${a.lang}-${settings.mode}`];
    $('#ruby-q').textContent = t('ruby.q.' + a.lang);
    renderRubyChoice();
    const title = $('#mode-title');
    title.textContent = a.title;
    title.lang = textLang(a.lang);
    $('#mode-sub').textContent = t('mode.sub', { n: charCount(a) });
    const box = $('#mode-options');
    box.textContent = '';
    ['ime', 'key'].forEach((m) => {
      const locked = m === 'key' && TP.reading.hasUnknownReading(a.lang, a.text);
      const b = el('button', 'mode-option');
      b.type = 'button';
      b.disabled = locked;
      const ic = el('span', 'mo-ic ' + (m === 'ime' ? 'lav' : 'cyan'));
      if (m === 'ime') {
        ic.textContent = a.lang === 'ja' ? 'あ' : '拼';
        ic.lang = textLang(a.lang);
      } else ic.appendChild(icon('keyboard'));
      b.append(ic, el('strong', null, t('mode.' + m)), el('span', 'desc', m === 'ime' ? t('desc.ime') : t('desc.key.' + a.lang)));
      const best = TP.store.best(a.id, m);
      if (locked) b.appendChild(el('span', 'lock-note', t('locked')));
      else {
        const tag = el('span', 'mo-best');
        if (best) tag.innerHTML = t('best', { n: `<b>${best}</b>` });
        else tag.textContent = t('never');
        b.appendChild(tag);
      }
      // 点打字方式直接开始，注音按上面那一行当前的选择
      b.addEventListener('click', () => {
        settings.ruby[`${a.lang}-ime`] = settings.ruby[`${a.lang}-key`] = showRuby;
        state.mode = settings.mode = m;
        setLang(a.lang);
        dlgMode.close();
        startPractice(a);
      });
      box.appendChild(b);
    });
    openDialog(dlgMode);
  }
  $$('#ruby-seg button').forEach((b) =>
    b.addEventListener('click', () => {
      showRuby = b.dataset.v === '1';
      renderRubyChoice();
    })
  );
  $('#mode-cancel').addEventListener('click', () => dlgMode.close());
  dlgMode.addEventListener('click', (e) => e.target === dlgMode && dlgMode.close());

  // ---------- 添加 / 编辑文章 ----------
  const dlg = $('#dlg-add');
  const addText = $('#add-text');
  const addTitle = $('#add-title');
  const canAnnotate = () => !!(window.tpNative && window.tpNative.annotate);
  let editing = null; // 正在编辑的文章；新建时为 null
  let editLang = 'ja'; // 弹窗里这篇文章的语言：决定怎么分句、注音
  let previewTimer = null;
  const titleCount = () => ($('#add-title-count').textContent = `${[...addTitle.value].length} / 40`);

  // 右侧预览：一句一行，带读音；没有读音的汉字标红
  function renderPreview(text) {
    const box = $('#add-preview');
    box.textContent = '';
    box.lang = textLang(editLang);
    const lines = TP.reading.lines(editLang, text == null ? addText.value : text);
    let chars = 0;
    let unknown = 0;
    lines.forEach((ln) => {
      const row = el('div', 'pv-line');
      ln.tokens.forEach((tk) => {
        const tok = el(tk.ruby ? 'ruby' : 'span', tk.unk ? 'pv-unk' : null, tk.base);
        if (tk.ruby) tok.appendChild(el('rt', null, tk.ruby));
        if (tk.unk) unknown++;
        row.appendChild(tok);
      });
      chars += [...ln.plain].length;
      box.appendChild(row);
    });
    $('#add-count').textContent = lines.length ? t('dlg.count', { s: lines.length, n: chars }) : '';
    $('#add-warn').hidden = !unknown;
    $('#add-warn-text').textContent = unknown ? t('dlg.unknown', { n: unknown }) + (canAnnotate() ? '' : ' ' + t('dlg.noAuto')) : '';
  }

  // 打字过程中：正文先不动（免得光标乱跳），预览里直接显示自动注音后的效果
  let previewSeq = 0;
  async function previewAuto() {
    const seq = ++previewSeq;
    const text = addText.value;
    if (editLang !== 'ja' || !canAnnotate() || !text.trim()) return renderPreview();
    try {
      const annotated = await window.tpNative.annotate(text);
      if (seq === previewSeq) renderPreview(annotated);
    } catch (e) {
      if (seq === previewSeq) renderPreview();
    }
  }

  // 自动整理：日语先给还没有读音的汉字注音，然后整理成一句一行
  async function organize() {
    previewSeq++;
    let text = addText.value;
    if (text.trim()) {
      if (editLang === 'ja' && canAnnotate()) {
        $('#add-count').textContent = t('dlg.busy');
        try {
          text = await window.tpNative.annotate(text);
        } catch (e) {
          // 注音失败时保留原文，预览里会把没有读音的汉字标红
        }
      }
      addText.value = TP.reading.format(editLang, text);
    }
    renderPreview();
  }

  function showAddError(text) {
    $('#add-error-text').textContent = text;
    $('#add-error').hidden = !text;
  }

  function openEditor(article) {
    editing = article || null;
    const sel = $('#add-cat');
    sel.textContent = '';
    TP.categories.forEach((id) => {
      const o = el('option', null, id === 'mine' ? t('opt.mine') : t('cat.' + id));
      o.value = id;
      sel.appendChild(o);
    });
    sel.value = editing ? editing.cat : state.cat;
    $('#add-heading').textContent = t(editing ? 'dlg.edit' : 'dlg.title');
    addTitle.value = editing ? editing.title : '';
    titleCount();
    addText.value = editing ? editing.text : '';
    showAddError('');
    // 改已有的文章不能换语言；新建时默认用当前这一页的语言，「我的文章」里选了「全部」就用上次练的语言
    editLang = editing ? editing.lang : state.fromMine && state.mineLang !== 'all' ? state.mineLang : state.lang;
    $('#add-lang').value = editLang;
    $('#add-lang').disabled = !!editing;
    langTexts();
    renderPreview();
    dlg.showModal();
  }
  function langTexts() {
    $('#add-hint').textContent = t('dlg.hint.' + editLang);
    $('#add-organize-text').textContent = t('dlg.organize.' + editLang);
  }
  $('#add-lang').addEventListener('change', (e) => {
    editLang = e.target.value;
    langTexts();
    previewAuto();
  });

  $('#btn-add').addEventListener('click', () => openEditor(null));
  $('#add-organize').addEventListener('click', organize);
  addTitle.addEventListener('input', titleCount);
  // 粘贴、或者输入完离开正文框时，自动分句并把读音写进正文；输入过程中只刷新预览
  addText.addEventListener('paste', () => setTimeout(organize, 0));
  addText.addEventListener('change', organize);
  addText.addEventListener('input', () => {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(previewAuto, 300);
  });
  $('#add-cancel').addEventListener('click', () => dlg.close());
  $('#form-add').addEventListener('submit', async (e) => {
    e.preventDefault();
    const title = addTitle.value.trim();
    if (!title || !addText.value.trim()) return showAddError(t('err.empty'));
    await organize();
    const text = addText.value;
    if (!text) return showAddError(t('err.none'));
    const cat = $('#add-cat').value;
    if (editing) TP.store.updateArticle({ ...editing, cat, title, text });
    else TP.store.addArticle({ id: 'custom-' + Date.now(), lang: editLang, cat, title, text, custom: true });
    // 保存后要能马上看到这篇：「我的文章」里筛的是别的语言就退回「全部」，其余页面跳到它的分类
    if (!state.fromMine) {
      state.cat = cat;
      if (state.lang !== editLang) setLang(editLang);
    } else if (state.mineLang !== editLang) state.mineLang = 'all';
    dlg.close();
    renderList();
  });

  // ---------- 练习 ----------
  function buildLines(container, lines) {
    container.textContent = '';
    container.lang = textLang(state.lang);
    lines.forEach((ln) => {
      ln.el = el('div', 'line');
      const text = el('div', 'line-text');
      ln.chars = [];
      ln.tokEls = ln.tokens.map((tk) => {
        const tok = el(tk.ruby ? 'ruby' : 'span', 'tok');
        [...tk.base].forEach((c) => {
          const s = el('span', 'ch', c);
          ln.chars.push({ c, el: s });
          tok.appendChild(s);
        });
        if (tk.ruby) tok.appendChild(el('rt', null, tk.ruby));
        text.appendChild(tok);
        return tok;
      });
      ln.slot = el('div', 'line-slot');
      ln.el.append(text, ln.slot);
      container.appendChild(ln.el);
    });
  }

  // 屏幕键盘（按键跟打模式）：标出下一个要按的键，按错的键闪一下
  const kb = $('#kb');
  ['qwertyuiop', 'asdfghjkl', 'zxcvbnm,.'].forEach((row) => {
    const r = el('div', 'kb-r');
    [...row].forEach((k) => {
      const key = el('span', 'key', k.toUpperCase());
      key.dataset.k = k;
      r.appendChild(key);
    });
    kb.appendChild(r);
  });
  const keyEl = (k) => [...kb.querySelectorAll('.key')].find((x) => x.dataset.k === k);
  function showGuide(g) {
    kb.querySelectorAll('.key.next').forEach((k) => k.classList.remove('next'));
    $('#kb-now').textContent = g ? t('kb.now', { c: g.base, k: g.keys }) : '';
    const k = g && keyEl(g.next);
    if (k) k.classList.add('next');
  }
  function flashKey(k) {
    const key = keyEl(k);
    if (!key) return;
    key.classList.remove('miss');
    void key.offsetWidth;
    key.classList.add('miss');
  }

  function stopRun() {
    if (!run) return;
    clearInterval(run.tick);
    clearInterval(run.countdown);
    $('#countdown').hidden = true;
    $('#pause-mask').hidden = true;
    run.session.destroy();
    run = null;
  }

  // 进入练习前、暂停后继续前倒数（秒数在设置里，0 表示不倒数），数完才能输入并开始计时
  function countdown(done) {
    const total = settings.countdown;
    if (!total) return done();
    const num = $('#count-num');
    const dots = $('#count-dots');
    let n = total;
    const paint = () => {
      TP.sound.play('count');
      num.textContent = n;
      num.classList.remove('tick');
      void num.offsetWidth;
      num.classList.add('tick');
      dots.textContent = '';
      for (let i = 0; i < total; i++) dots.appendChild(el('i', i <= total - n ? 'on' : null));
    };
    $('#countdown').hidden = false;
    paint();
    run.countdown = setInterval(() => {
      n--;
      if (n > 0) return paint();
      clearInterval(run.countdown);
      run.countdown = null;
      $('#countdown').hidden = true;
      TP.sound.play('go');
      done();
    }, 1000);
  }

  // resume：从主页「继续上次」进来时带着上次保存的进度
  function startPractice(article, resume) {
    stopRun();
    state.article = article;
    show('practice');
    const mode = state.mode;
    const isKey = mode === 'key';

    // 接着上次练的时候，标点去不去跟上次保持一致，不然行数和字数对不上
    const noPunct = resume ? !!resume.noPunct : settings.noPunct;
    const lines = TP.reading.lines(article.lang, article.text, noPunct);
    const box = $('#lines');
    buildLines(box, lines);
    const rubyKey = `${article.lang}-${mode}`;
    box.classList.toggle('no-ruby', !settings.ruby[rubyKey]);
    box.classList.toggle('mode-key', isKey);
    box.classList.toggle('spaced', isKey && article.lang === 'zh');
    $('#tile-kpm').hidden = !isKey;
    $('#kb-row').hidden = !isKey;
    $('#ime-warning').hidden = true;
    showGuide(null);

    const title = $('#p-title');
    title.textContent = article.title;
    title.lang = textLang(article.lang);
    title.appendChild(el('span', null, ` · ${t('mode.' + mode)}`));

    const stats = resume ? { ...resume.stats } : { typed: 0, wrong: 0, chars: 0 };
    const timer = TP.stats.createTimer(resume ? resume.ms : 0);
    const total = lines.reduce((n, l) => n + l.chars.length, 0);
    const best = TP.store.best(article.id, mode);
    $('#st-total').textContent = ' / ' + total;

    // 右侧面板
    right.textContent = '';
    const progChip = el('span', 'chip');
    const progRing = ring(0, '0%', t('prog.done'));
    const vsValue = el('span');
    const vsBar = bar(0);
    const vs = el('div');
    const split = el('div', 'split');
    split.append(el('span', null, t('vs.best')), vsValue);
    vs.append(split, vsBar);
    const toggle = el('div', 'r-card toggle');
    const sw = el('button', 'switch' + (settings.ruby[rubyKey] ? ' on' : ''));
    toggle.append(el('span', null, t('ruby.' + article.lang)), sw);
    sw.addEventListener('click', () => {
      const on = !sw.classList.contains('on');
      sw.classList.toggle('on', on);
      settings.ruby[`${article.lang}-ime`] = settings.ruby[`${article.lang}-key`] = on;
      TP.store.saveSettings(settings);
      box.classList.toggle('no-ruby', !on);
      sw.blur();
      if (run && !run.paused) run.session.focus();
    });
    const actions = el('div', 'p-actions');
    const mk = (cls, ic, text, fn) => {
      const b = el('button', 'btn ' + cls);
      b.append(icon(ic), el('span', null, text));
      b.addEventListener('click', () => {
        b.blur();
        fn();
      });
      actions.appendChild(b);
    };
    mk('primary', 'pause', t('pause'), () => setPaused(true));
    mk('white', 'restart', t('restart'), () => startPractice(article));
    mk('outline wide', 'exit', t('exit'), askExit);
    right.append(rHead(t('prog.title'), progChip, true), ringWrap(progRing), vs, toggle, actions);

    const update = () => {
      const s = TP.stats.summarize(stats, timer.ms());
      const done = Math.min(stats.chars, total);
      $('#st-time').textContent = TP.stats.fmtTime(s.seconds);
      $('#st-cpm').textContent = s.cpm;
      $('#st-kpm').textContent = s.kpm;
      $('#st-acc').textContent = s.acc + '%';
      $('#st-prog').textContent = done;
      $('#p-pos').textContent = t('p.pos', {
        l: t('lang.' + article.lang),
        c: t('cat.' + (article.cat || 'mine')),
        i: Math.min(run.session ? run.session.index + 1 : 1, lines.length),
        n: lines.length,
      });
      progChip.textContent = t('prog.chars', { a: done, b: total });
      progRing.set(total ? done / total : 0, Math.round(total ? (done / total) * 100 : 0) + '%', t('prog.done'));
      vsValue.textContent = best ? `${s.cpm} / ${best} ${t('u.cpm')}` : t('vs.none');
      vsBar.firstChild.style.width = (best ? Math.min(100, (s.cpm / best) * 100) : 0) + '%';
    };

    const create = isKey ? TP.createKeySession : TP.createImeSession;
    run = {
      article,
      mode,
      stats,
      timer,
      lines,
      total,
      noPunct,
      paused: true,
      marks: resume ? resume.marks.slice() : [], // 每一行打完时的累计用时和字数
      miss: resume ? { ...resume.miss } : {}, // 本该按却按错的键 → 次数
      tick: setInterval(update, 250),
    };
    run.session = create({
      lines,
      stats,
      timer,
      startLine: resume ? Math.min(resume.line, lines.length - 1) : 0,
      onUpdate: update,
      onLine: (i) => {
        run.marks[i] = { ms: timer.ms(), chars: stats.chars };
        // 最后一行不响，留给完成的那一声
        if (i < lines.length - 1) TP.sound.play('line');
      },
      onFinish: finish,
      onImeWarning: (on) => ($('#ime-warning').hidden = !on),
      onGuide: showGuide,
      onHit: () => TP.sound.play('key'),
      onMiss: (expected, pressed) => {
        TP.sound.play('miss');
        if (!isKey) return;
        if (expected) run.miss[expected] = (run.miss[expected] || 0) + 1;
        flashKey(pressed);
      },
    });
    update();

    run.session.setPaused(true);
    startTyping();
  }

  // 先倒数，数完才能输入并开始（或接着）计时。刚进练习页和暂停后继续都走这里
  function startTyping() {
    countdown(() => {
      run.paused = false;
      run.session.setPaused(false);
      run.timer.start();
    });
  }

  function setPaused(p) {
    if (!run) return;
    $('#pause-mask').hidden = !p;
    if (!p) {
      // 倒数有自己的声音；设置里关了倒数时才响「继续」那一声
      if (!settings.countdown) TP.sound.play('resume');
      return startTyping();
    }
    TP.sound.play('pause');
    run.paused = true;
    run.timer.pause();
    $('#pause-sub').textContent = t('pause.sub', { t: TP.stats.fmtTime(Math.round(run.timer.ms() / 1000)) });
    run.session.setPaused(true);
  }
  $('#btn-resume').addEventListener('click', () => setPaused(false));
  $('#lines').addEventListener('click', () => run && !run.paused && run.session.focus());

  // 退出前确认；确认框打开期间停表，选「继续练习」后接着计时
  async function askExit() {
    if (!run) return;
    run.timer.pause();
    run.session.setPaused(true);
    const r = await confirmBox({
      iconName: 'exit',
      tone: 'peach',
      title: t('exit.title'),
      sub: t('exit.confirm'),
      note: t('exit.sub'),
      a: { text: t('exit.stay'), cls: 'primary' },
      b: { text: t('exit'), cls: 'soft' },
    });
    if (!run) return;
    if (r === 'b') {
      saveResume();
      return openList();
    }
    if (!run.paused) {
      run.session.setPaused(false);
      run.timer.start();
    }
  }

  // 中途退出时记下进度（从当前这一行的开头接着练）
  function saveResume() {
    const line = run.session.index;
    const chars = line > 0 && run.marks[line - 1] ? run.marks[line - 1].chars : 0;
    if (!chars) return;
    TP.store.saveResume({
      articleId: run.article.id,
      mode: run.mode,
      noPunct: run.noPunct,
      line,
      ms: run.marks[line - 1].ms,
      stats: { ...run.stats, chars },
      marks: run.marks.slice(0, line),
      miss: run.miss,
      percent: Math.round((chars / run.total) * 100),
    });
  }

  // ---------- 成绩 ----------
  function finish() {
    const { stats, timer, article: a, mode, marks, miss } = run;
    timer.pause();
    const s = TP.stats.summarize(stats, timer.ms());
    const lineSpeeds = marks.map((m, i) => {
      const p = i ? marks[i - 1] : { ms: 0, chars: 0 };
      const min = (m.ms - p.ms) / 60000;
      return min > 0 ? Math.round((m.chars - p.chars) / min) : 0;
    });
    const before = TP.store.history().filter((r) => r.articleId === a.id && r.mode === mode);
    state.result = {
      a,
      s,
      mode,
      lineSpeeds,
      miss,
      prevBest: before.length ? Math.max(...before.map((r) => r.cpm)) : null,
      prevAvg: before.length ? Math.round(before.reduce((n, r) => n + r.cpm, 0) / before.length) : null,
    };
    TP.store.addRecord({ ts: Date.now(), lang: a.lang, articleId: a.id, title: a.title, mode, ...s, lines: lineSpeeds, miss });
    const r = TP.store.resume();
    if (r && r.articleId === a.id) TP.store.clearResume();
    TP.sound.play(state.result.prevBest != null && s.cpm > state.result.prevBest ? 'record' : 'finish');
    // 等最后一行的输入事件处理完再切换页面
    setTimeout(showResult, 0);
  }

  function showResult() {
    const { a, s, mode, lineSpeeds, miss, prevBest, prevAvg } = state.result;
    const isKey = mode === 'key';
    show('result');
    const sub = $('#res-title');
    sub.textContent = `${t('lang.' + a.lang)} · ${a.title} · ${t('mode.' + mode)}`;
    sub.lang = textLang(a.lang);

    const record = prevBest != null && s.cpm > prevBest;
    $('#res-banner').classList.toggle('record', record);
    $('#res-best').textContent = prevBest == null ? t('best.first') : record ? t('best.new', { n: prevBest }) : t('best.old', { n: prevBest });
    $('#res-gain').hidden = !record;
    $('#res-gain').textContent = record ? t('res.gain', { n: s.cpm - prevBest }) : '';

    const grid = $('#res-grid');
    grid.textContent = '';
    const tile = (tone, label, value, unit) => {
      const d = el('div', 'rt');
      const head = el('small');
      head.append(el('i', tone), label);
      const b = el('b', null, value);
      if (unit) b.appendChild(el('em', null, unit));
      d.append(head, b);
      grid.appendChild(d);
    };
    tile('lav', t('r.speed'), String(s.cpm), t('u.cpm'));
    tile('peach', t('st.acc'), String(s.acc), '%');
    tile('cyan', t('r.time'), TP.stats.fmtTime(s.seconds));
    tile('pink', isKey ? t('r.misses') : t('r.typos'), String(s.errors), isKey ? t('u.misses') : t('u.typos'));
    if (isKey) tile('mint', t('r.kpm'), String(s.kpm), t('u.kpm'));

    // 每一句的速度，最慢的一句用浅色
    const bars = $('#res-bars');
    bars.textContent = '';
    const max = Math.max(...lineSpeeds, 1);
    const slow = lineSpeeds.length > 1 ? lineSpeeds.indexOf(Math.min(...lineSpeeds)) : -1;
    lineSpeeds.forEach((v, i) => {
      const col = el('div', 'bar-col' + (i === slow ? ' low' : ''));
      const b = el('i');
      b.style.height = Math.max(4, (v / max) * 78) + '%';
      col.append(el('b', null, String(v)), b, el('span', null, lineSpeeds.length > 10 ? String(i + 1) : t('res.line', { n: i + 1 })));
      bars.appendChild(col);
    });

    // 右侧面板
    right.textContent = '';
    right.appendChild(rHead(t('st.acc'), el('span', 'chip', t(isKey ? 'res.wrongKeys' : 'res.wrongChars', { n: s.errors })), true));
    right.appendChild(ringWrap(ring(s.acc / 100, s.acc + '%', t('st.acc'))));
    const cmp = el('div', 'box');
    cmp.appendChild(el('h4', null, t('res.compare')));
    const top = Math.max(s.cpm, prevBest || 0, prevAvg || 0, 1);
    [['res.now', s.cpm, 'now'], ['res.prev', prevBest, ''], ['res.avg', prevAvg, '']].forEach(([k, v, cls]) => {
      const row = el('div', 'cmp-row ' + cls);
      const track = el('div', 'cmp-bar');
      const fill = el('i');
      fill.style.width = (v ? (v / top) * 100 : 0) + '%';
      track.appendChild(fill);
      row.append(el('span', null, t(k)), track, el('b', null, v == null ? '—' : String(v)));
      cmp.appendChild(row);
    });
    right.appendChild(cmp);
    if (isKey) {
      const box = el('div', 'box');
      box.appendChild(el('h4', null, t('res.missed')));
      const worst = Object.entries(miss).sort((x, y) => y[1] - x[1]).slice(0, 3);
      if (worst.length) {
        const g = el('div', 'miss-keys');
        worst.forEach(([k, n]) => {
          const c = el('div', 'mk');
          c.append(el('b', null, k === ' ' ? '␣' : k.toUpperCase()), el('span', null, t('res.times', { n })));
          g.appendChild(c);
        });
        box.appendChild(g);
      } else {
        box.appendChild(el('p', null, t('res.noMiss')));
      }
      right.appendChild(box);
    }
  }
  $('#btn-again').addEventListener('click', () => {
    state.mode = state.result.mode;
    startPractice(state.result.a);
  });
  $('#btn-other').addEventListener('click', openList);

  // ---------- 历史 ----------
  function openHistory() {
    show('history');
    renderHistory();
  }

  function renderHistory() {
    const all = TP.store.history();
    $$('#hist-seg button').forEach((b) => b.classList.toggle('active', b.dataset.f === state.histFilter));
    const rows = all.filter((r) => state.histFilter === 'all' || r.lang === state.histFilter).reverse();
    $('#hist-count').textContent = rows.length ? t('hist.count', { n: rows.length }) : t('hist.count0');
    $('#btn-clear').hidden = !all.length;

    const body = $('#hist-body');
    body.textContent = '';
    if (!rows.length) {
      body.appendChild(
        emptyBox('clock', t('h.empty'), t('hist.go'), () => {
          state.cat = 'chat';
          state.fromMine = false;
          openList();
        })
      );
    } else {
      const head = el('div', 'h-row h-head');
      [['h.when'], ['h.lang'], ['h.article'], ['h.mode'], ['st.time', 'num'], ['st.cpm', 'num'], ['st.acc', 'num']].forEach(([k, cls]) =>
        head.appendChild(el('span', cls, t(k)))
      );
      body.appendChild(head);
      const pad = (n) => String(n).padStart(2, '0');
      rows.forEach((r) => {
        const d = new Date(r.ts);
        const row = el('div', 'h-row');
        const lang = el('span');
        lang.appendChild(el('span', 'lang-chip ' + (r.lang === 'ja' ? 'lav' : 'cyan'), t('lang.' + r.lang)));
        const title = el('span', 'h-title', r.title);
        title.lang = textLang(r.lang);
        row.append(
          el('span', null, `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`),
          lang,
          title,
          el('span', null, t('mode.' + r.mode)),
          el('span', 'num', TP.stats.fmtTime(r.seconds)),
          el('span', 'spd', String(r.cpm)),
          el('span', 'num', r.acc + '%')
        );
        body.appendChild(row);
      });
    }

    // 右侧：全部记录的汇总
    const s = A.totals(all);
    const dash = (v) => (v == null ? '—' : v);
    right.textContent = '';
    right.append(
      rHead(t('hist.sum')),
      rCard(t('hist.times'), s.count, t('unit.times')),
      rCard(t('hist.avg'), dash(s.avg), t('u.cpm')),
      rCard(t('hist.best'), dash(s.best), t('u.cpm')),
      rHead(t('hist.acc'), null, true),
      ringWrap(ring(s.acc == null ? 0 : s.acc / 100, s.acc == null ? '—' : s.acc + '%', t('st.acc')))
    );
    const share = el('div');
    const split = el('div', 'split');
    const pct = (v) => (v == null ? '—' : v + '%');
    split.append(
      el('span', null, `${t('mode.ime')} ${pct(s.imeShare)}`),
      el('span', null, `${t('mode.key')} ${pct(s.imeShare == null ? null : 100 - s.imeShare)}`)
    );
    share.append(split, bar(s.imeShare || 0));
    right.appendChild(share);
  }
  $$('#hist-seg button').forEach((b) =>
    b.addEventListener('click', () => {
      state.histFilter = b.dataset.f;
      renderHistory();
    })
  );
  $('#btn-clear').addEventListener('click', async () => {
    const r = await confirmBox({
      iconName: 'trash',
      tone: 'danger',
      title: t('clear.title'),
      sub: t('clear.sub'),
      a: { text: t('cancel'), cls: 'soft' },
      b: { text: t('ok'), cls: 'danger' },
    });
    if (r === 'b') {
      TP.store.clearHistory();
      renderHistory();
      renderSide();
    }
  });

  openHome();
})((globalThis.TP = globalThis.TP || {}));
