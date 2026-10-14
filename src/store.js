// localStorage 读写：自定义文章、历史成绩、设置
(function (TP) {
  const K = { custom: 'tp.custom', history: 'tp.history', settings: 'tp.settings', resume: 'tp.resume' };

  function load(key, fallback) {
    try {
      const v = JSON.parse(localStorage.getItem(key));
      return v == null ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }
  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  const DEFAULTS = {
    mode: 'ime',
    theme: 'system',
    countdown: 3,
    textSize: 'normal',
    noPunct: false, // 去除标点符号：练习内容里不出现标点，不用打
    dailyGoal: 20,
    sound: true,
    soundVolume: 60, // 0 ~ 100
    soundKey: true, // 打字按键音
    soundCue: true, // 提示音：倒数、换行、完成、暂停
    soundUi: true, // 界面点击音
    lastLang: 'ja',
    // 主页趋势图
    trendUnit: 'week', // 按周（week）还是按日（day）
    trendStat: 'avg', // 每一段取平均（avg）还是最好成绩（best）
    trendShow: 'speed', // 画速度（speed）、错误率（error），还是两条都画（both）
    ruby: { 'ja-ime': true, 'ja-key': true, 'zh-ime': false, 'zh-key': true },
  };

  TP.store = {
    customArticles: () => load(K.custom, []),
    addArticle(a) {
      const list = load(K.custom, []);
      list.push(a);
      save(K.custom, list);
    },
    updateArticle(a) {
      save(K.custom, load(K.custom, []).map((x) => (x.id === a.id ? a : x)));
    },
    removeArticle(id) {
      save(K.custom, load(K.custom, []).filter((a) => a.id !== id));
    },

    history: () => load(K.history, []),
    addRecord(r) {
      const list = load(K.history, []);
      list.push(r);
      save(K.history, list);
    },
    clearHistory: () => save(K.history, []),
    // 某篇文章在某模式下的最好速度
    best(articleId, mode) {
      const rs = load(K.history, []).filter((r) => r.articleId === articleId && r.mode === mode);
      return rs.length ? Math.max(...rs.map((r) => r.cpm)) : null;
    },

    // 中途退出的练习，主页上可以「继续上次」
    resume: () => load(K.resume, null),
    saveResume: (r) => save(K.resume, r),
    clearResume: () => localStorage.removeItem(K.resume),

    settings() {
      const s = load(K.settings, {});
      return { ...DEFAULTS, ...s, ruby: { ...DEFAULTS.ruby, ...(s.ruby || {}) } };
    },
    saveSettings: (s) => save(K.settings, s),
  };
})((globalThis.TP = globalThis.TP || {}));
