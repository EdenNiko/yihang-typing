// 按键跟打模式：照着拼音 / 罗马字逐键敲，不使用输入法
(function (TP) {
  TP.createKeySession = function ({ lines, stats, timer, startLine = 0, onUpdate, onLine, onFinish, onImeWarning, onGuide, onHit, onMiss }) {
    let li = 0;
    let m = null;
    let doneChars = 0;
    let paused = false;
    let finished = false;

    const guide = document.createElement('div');
    guide.className = 'guide';

    function prepare(ln) {
      if (ln.chunks) return;
      const atoms = [];
      ln.ranges = ln.tokens.map((t) => {
        const s = atoms.length;
        atoms.push(...t.atoms);
        return [s, atoms.length];
      });
      ln.atomCount = atoms.length;
      ln.chunks = TP.romaji.buildChunks(atoms);
    }

    function position() {
      const ln = lines[li];
      return m.done ? ln.atomCount : ln.chunks[m.index].start;
    }

    // 下一个要按的键、正在打的字和它的整串按键，给屏幕键盘用
    function nextKey() {
      const k = m.hint()[0];
      if (k) return k;
      const later = lines[li].chunks.slice(m.index + 1).find((c) => !c.skip);
      return later ? later.cands[0][0] : '';
    }

    function report() {
      const ln = lines[li];
      if (m.done) return onGuide(null);
      const next = nextKey();
      const pos = position();
      const ti = ln.ranges.findIndex(([s, e]) => s <= pos && pos < e);
      const [s, e] = ln.ranges[ti];
      const keys = ln.chunks
        .map((c, j) => (c.skip || c.end <= s || c.start >= e ? '' : j < m.index ? m.typedOf(j) : j === m.index ? m.buffer + m.hint() : c.cands[0]))
        .join('');
      onGuide({ next, base: ln.tokens[ti].base, keys });
    }

    function render() {
      const ln = lines[li];
      const pos = position();
      let chars = 0;
      ln.tokEls.forEach((el, i) => {
        const [s, e] = ln.ranges[i];
        const done = e <= pos;
        el.classList.toggle('ok', done);
        el.classList.toggle('cur', !done && s <= pos);
        if (done) chars += [...ln.tokens[i].base].length;
      });
      stats.chars = doneChars + chars;

      guide.textContent = '';
      const show = (s) => s.replace(/ /g, '␣');
      ln.chunks.forEach((c, j) => {
        if (c.skip) return;
        const span = document.createElement('span');
        span.className = 'g';
        if (j < m.index) {
          span.classList.add('g-done');
          span.textContent = show(m.typedOf(j));
        } else if (j === m.index) {
          span.classList.add('g-cur');
          const a = document.createElement('b');
          a.textContent = show(m.buffer);
          span.append(a, show(m.hint()));
        } else {
          span.textContent = show(c.cands[0]);
        }
        guide.appendChild(span);
      });
      report();
    }

    function enter(i) {
      li = i;
      const ln = lines[li];
      prepare(ln);
      m = TP.romaji.createMatcher(ln.chunks);
      ln.el.classList.add('current');
      ln.slot.appendChild(guide);
      render();
      ln.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      if (m.done) next();
    }

    function next() {
      const ln = lines[li];
      ln.el.classList.remove('current');
      ln.el.classList.add('done');
      ln.tokEls.forEach((el) => el.classList.remove('cur'));
      doneChars += ln.chars.length;
      stats.chars = doneChars;
      onLine(li);
      if (li + 1 >= lines.length) {
        finished = true;
        guide.remove();
        document.removeEventListener('keydown', onKey);
        onGuide(null);
        onUpdate();
        onFinish();
      } else {
        enter(li + 1);
      }
    }

    function flash() {
      const cur = lines[li].tokEls.find((el) => el.classList.contains('cur'));
      if (!cur) return;
      cur.classList.remove('miss');
      void cur.offsetWidth;
      cur.classList.add('miss');
    }

    function onKey(e) {
      if (paused || finished || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Process' || e.keyCode === 229) {
        onImeWarning(true);
        return;
      }
      if (e.key.length !== 1) return;
      e.preventDefault();
      onImeWarning(false);
      stats.typed++;
      if (m.press(e.key.toLowerCase())) {
        onHit();
        render();
        if (m.done) next();
      } else {
        stats.wrong++;
        flash();
        // 记下本该按的键和实际按下的键
        onMiss(nextKey(), e.key.toLowerCase());
      }
      onUpdate();
    }

    document.addEventListener('keydown', onKey);
    // 继续上次：前面的行直接算作已完成
    for (let i = 0; i < startLine; i++) {
      lines[i].el.classList.add('done');
      lines[i].tokEls.forEach((el) => el.classList.add('ok'));
      doneChars += lines[i].chars.length;
    }
    enter(startLine);

    return {
      get index() { return li; },
      focus() {},
      setPaused(p) { paused = p; },
      destroy() {
        finished = true;
        guide.remove();
        document.removeEventListener('keydown', onKey);
      },
    };
  };
})((globalThis.TP = globalThis.TP || {}));
