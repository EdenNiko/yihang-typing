// 从历史成绩里算出主页、侧栏、右侧面板要显示的各种统计
(function (TP) {
  const DAY = 86400000;
  const dayStart = (ts) => {
    const d = new Date(ts);
    return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  };
  // 一周从周一开始
  const weekStart = (ts) => {
    const d = new Date(dayStart(ts));
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  };
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const round1 = (n) => Math.round(n * 10) / 10;

  // 某一天的练习：分钟数、完成篇数、最快速度
  function day(hist, ts) {
    const s = dayStart(ts);
    const rs = hist.filter((r) => r.ts >= s && r.ts < s + DAY);
    return {
      date: new Date(s),
      // 练过就至少算 1 分钟
      minutes: rs.length ? Math.max(1, Math.round(rs.reduce((n, r) => n + r.seconds, 0) / 60)) : 0,
      seconds: rs.reduce((n, r) => n + r.seconds, 0),
      count: rs.length,
      best: rs.length ? Math.max(...rs.map((r) => r.cpm)) : null,
    };
  }

  // 最近 n 天（含今天），从早到晚
  function lastDays(hist, n, now = Date.now()) {
    const out = [];
    for (let i = n - 1; i >= 0; i--) out.push(day(hist, dayStart(now) - i * DAY));
    return out;
  }

  // 连续练习天数：今天还没练时，从昨天往前数
  function streak(hist, now = Date.now()) {
    const days = new Set(hist.map((r) => dayStart(r.ts)));
    let t = dayStart(now);
    if (!days.has(t)) t -= DAY;
    let n = 0;
    while (days.has(t)) {
      n++;
      t = dayStart(t - DAY / 2);
    }
    return n;
  }

  // 一批记录的速度和错误率。stat 取 'avg'（平均）或 'best'（最好：速度取最快，错误率取最低）
  function trendPoint(rs, stat) {
    if (!rs.length) return { cpm: null, err: null };
    const cpm = rs.map((r) => r.cpm);
    const err = rs.map((r) => 100 - r.acc);
    return stat === 'best' ? { cpm: Math.max(...cpm), err: round1(Math.min(...err)) } : { cpm: Math.round(avg(cpm)), err: round1(avg(err)) };
  }

  // 最近 n 周某种语言每周的速度和错误率
  function weeks(hist, lang, stat, n = 7, now = Date.now()) {
    const cur = weekStart(now);
    const out = [];
    for (let i = n - 1; i >= 0; i--) {
      const s = weekStart(cur - i * 7 * DAY + DAY);
      const e = weekStart(s + 7 * DAY + DAY);
      const rs = hist.filter((r) => r.lang === lang && r.ts >= s && r.ts < e);
      out.push({ start: new Date(s), current: i === 0, ...trendPoint(rs, stat) });
    }
    return out;
  }

  // 最近 n 天某种语言每天的速度和错误率（格式和 weeks 一样，趋势图两种都能画）
  function days(hist, lang, stat, n = 7, now = Date.now()) {
    const own = hist.filter((r) => r.lang === lang);
    return lastDays(own, n, now).map((d, i) => {
      const s = d.date.getTime();
      return { start: d.date, current: i === n - 1, ...trendPoint(own.filter((r) => r.ts >= s && r.ts < s + DAY), stat) };
    });
  }

  // 最近 7 天的平均值，以及和再往前 7 天相比的变化
  function compare(hist, now = Date.now()) {
    const a = hist.filter((r) => r.ts > now - 7 * DAY);
    const b = hist.filter((r) => r.ts <= now - 7 * DAY && r.ts > now - 14 * DAY);
    const cur = a.length ? a : hist;
    const metric = (pick, list) => avg(list.map(pick).filter((v) => v != null));
    const one = (pick, asPoints, filter = () => true) => {
      const v = metric(pick, cur.filter(filter));
      const p = metric(pick, b.filter(filter));
      const n = a.length ? metric(pick, a.filter(filter)) : null;
      let delta = null;
      if (n != null && p) delta = asPoints ? round1(n - p) : round1(((n - p) / p) * 100);
      return { value: v, delta };
    };
    return {
      cpm: one((r) => r.cpm, false),
      kpm: one((r) => r.kpm, false, (r) => r.mode === 'key'),
      acc: one((r) => r.acc, true),
    };
  }

  // 某种语言两种打字方式各自的最好成绩
  function bestByMode(hist, lang) {
    const out = {};
    ['ime', 'key'].forEach((m) => {
      const rs = hist.filter((r) => r.lang === lang && r.mode === m);
      out[m] = rs.length ? rs.reduce((x, y) => (y.cpm > x.cpm ? y : x)) : null;
    });
    return out;
  }

  // 某篇文章的最好和平均速度（可排除某一条记录）
  function article(hist, id, exceptTs) {
    const rs = hist.filter((r) => r.articleId === id && r.ts !== exceptTs);
    return { count: rs.length, best: rs.length ? Math.max(...rs.map((r) => r.cpm)) : null, avg: rs.length ? Math.round(avg(rs.map((r) => r.cpm))) : null };
  }

  function totals(hist) {
    const share = hist.length ? Math.round((hist.filter((r) => r.mode === 'ime').length / hist.length) * 100) : null;
    return {
      count: hist.length,
      avg: hist.length ? Math.round(avg(hist.map((r) => r.cpm))) : null,
      best: hist.length ? Math.max(...hist.map((r) => r.cpm)) : null,
      acc: hist.length ? round1(avg(hist.map((r) => r.acc))) : null,
      imeShare: share,
    };
  }

  TP.analytics = { day, lastDays, streak, weeks, days, compare, bestByMode, article, totals, practiced: (hist) => new Set(hist.map((r) => r.articleId)) };
})((globalThis.TP = globalThis.TP || {}));
