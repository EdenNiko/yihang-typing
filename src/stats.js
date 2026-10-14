// 计时与成绩计算
(function (TP) {
  // initial：继续上次练习时，从已经用掉的时间接着计
  function createTimer(initial = 0) {
    let acc = initial;
    let since = null;
    return {
      get running() { return since !== null; },
      get started() { return since !== null || acc > 0; },
      start() { if (since === null) since = performance.now(); },
      pause() {
        if (since !== null) {
          acc += performance.now() - since;
          since = null;
        }
      },
      ms() { return acc + (since !== null ? performance.now() - since : 0); },
    };
  }

  // stats: { typed, wrong, chars }；typed/wrong 在输入法模式是字数，在按键模式是击键数
  function summarize(stats, ms) {
    // 刚开始的一秒内数值没有意义
    const min = ms < 1000 ? 0 : ms / 60000;
    return {
      seconds: Math.round(ms / 1000),
      cpm: min > 0 ? Math.round(stats.chars / min) : 0,
      kpm: min > 0 ? Math.round((stats.typed - stats.wrong) / min) : 0,
      acc: stats.typed ? Math.round(((stats.typed - stats.wrong) / stats.typed) * 1000) / 10 : 100,
      errors: stats.wrong,
      chars: stats.chars,
    };
  }

  function fmtTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  }

  TP.stats = { createTimer, summarize, fmtTime };
})((globalThis.TP = globalThis.TP || {}));
