// 音效：全部用 Web Audio 现场合成，不带音频文件。TP.sound.play('key') 这样用
(function (TP) {
  let ctx = null;
  let master = null;
  let noise = null;

  // 第一次要出声时才建，之后一直用这一个
  function ready() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.connect(ctx.destination);
      // 一小段白噪声，按键的「嗒」声用它过滤出来
      noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // 音量包络：很快起来，再滑到听不见，避免「啪」的爆音
  function envelope(vol, t, dur) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(master);
    return g;
  }

  // 一个音：f0 滑到 f1，持续 dur 秒，at 是延后多少秒再响
  function tone(f0, dur, vol, { f1 = f0, type = 'sine', at = 0 } = {}) {
    const t = ctx.currentTime + at;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(envelope(vol, t, dur));
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  // 一下短促的「嗒」：白噪声过一个带通滤波
  function click(freq, dur, vol) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.4;
    src.connect(f).connect(envelope(vol, t, dur));
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // 一串依次响起的音
  const notes = (list, gap, dur, vol, type) => list.forEach((f, i) => tone(f, i === list.length - 1 ? dur * 2 : dur, vol, { at: i * gap, type }));

  const SOUNDS = {
    // 打对一个键：音高每次略有不同，连着打不会像机关枪
    key() {
      click(2100 + Math.random() * 700, 0.03, 0.2);
      tone(260, 0.04, 0.05, { f1: 170 });
    },
    // 打错：低一点、闷一点
    miss() {
      click(650, 0.05, 0.16);
      tone(200, 0.13, 0.2, { f1: 105, type: 'triangle' });
    },
    // 打完一行
    line: () => notes([784, 1175], 0.07, 0.1, 0.09),
    // 倒数的每一秒，和最后开始的那一声
    count: () => tone(660, 0.12, 0.15),
    go: () => notes([990, 1320], 0.09, 0.14, 0.15),
    // 打完一篇；破了自己的纪录时多两个音
    finish: () => notes([523, 659, 784, 1047], 0.09, 0.2, 0.12, 'triangle'),
    record: () => notes([523, 659, 784, 1047, 1319, 1568], 0.085, 0.2, 0.12, 'triangle'),
    // 点按钮、换页
    tap: () => tone(520, 0.05, 0.07, { f1: 380 }),
    pause: () => notes([660, 494], 0.08, 0.1, 0.1),
    resume: () => notes([494, 660], 0.08, 0.1, 0.1),
  };

  // 每个声音属于哪一类，设置里可以分别开关：key 打字按键音，ui 界面点击音，其余都是 cue 提示音
  const GROUP = { key: 'key', miss: 'key', tap: 'ui' };

  TP.sound = {
    enabled: true,
    volume: 0.6, // 0 ~ 1
    groups: { key: true, cue: true, ui: true },
    play(name) {
      if (!this.enabled || !SOUNDS[name] || !this.groups[GROUP[name] || 'cue'] || !ready()) return;
      master.gain.value = this.volume;
      SOUNDS[name]();
    },
  };
})((globalThis.TP = globalThis.TP || {}));
