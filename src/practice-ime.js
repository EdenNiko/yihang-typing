// 输入法模式：用自己的输入法把原文打出来，上屏后逐字比对
(function (TP) {
  // 全角/半角、大小写视为相同
  const norm = (c) => c.normalize('NFKC').toLowerCase();

  TP.createImeSession = function ({ lines, stats, timer, startLine = 0, onUpdate, onLine, onFinish, onHit, onMiss }) {
    const t = TP.i18n.t;
    let li = 0;
    let composing = false;
    let prev = [];
    let doneChars = 0;
    let finished = false;

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'ime-input';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = t('ime.ph');

    // 输入框下面的一行：左边提示，右边「已打 / 本行字数」
    const foot = document.createElement('div');
    foot.className = 'ime-foot';
    const msg = document.createElement('span');
    const cnt = document.createElement('span');
    foot.append(msg, cnt);

    function setFoot(typed, bad) {
      cnt.textContent = `${typed} / ${lines[li].chars.length}`;
      msg.textContent = bad ? t('ime.err', { n: bad }) : t('ime.auto');
      msg.classList.toggle('bad', !!bad);
    }

    function enter(i) {
      li = i;
      const ln = lines[li];
      ln.el.classList.add('current');
      ln.slot.append(input, foot);
      input.value = '';
      input.classList.remove('over');
      prev = [];
      setFoot(0, 0);
      input.focus();
      ln.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    function next() {
      const ln = lines[li];
      ln.el.classList.remove('current');
      ln.el.classList.add('done');
      doneChars += ln.chars.filter((c) => c.el.classList.contains('ok')).length;
      stats.chars = doneChars;
      onLine(li);
      if (li + 1 >= lines.length) {
        finished = true;
        input.remove();
        foot.remove();
        onUpdate();
        onFinish();
      } else {
        enter(li + 1);
        onUpdate();
      }
    }

    function evaluate() {
      if (finished) return;
      const val = [...input.value];
      const tg = lines[li].chars;

      // 只统计相对上次新打出来的字
      let p = 0;
      while (p < prev.length && p < val.length && prev[p] === val[p]) p++;
      const wrongBefore = stats.wrong;
      for (let j = p; j < val.length; j++) {
        stats.typed++;
        if (j >= tg.length || norm(val[j]) !== norm(tg[j].c)) stats.wrong++;
      }
      prev = val;
      // 新上屏的字里有错字
      if (stats.wrong > wrongBefore) onMiss();

      let ok = 0;
      tg.forEach((c, i) => {
        c.el.classList.remove('ok', 'bad');
        if (i >= val.length) return;
        if (norm(val[i]) === norm(c.c)) {
          c.el.classList.add('ok');
          ok++;
        } else {
          c.el.classList.add('bad');
        }
      });
      input.classList.toggle('over', val.length > tg.length);
      setFoot(val.length, val.length - ok);
      stats.chars = doneChars + ok;
      onUpdate();
      if (val.length === tg.length && ok === tg.length) next();
    }

    input.addEventListener('compositionstart', () => {
      composing = true;
    });
    input.addEventListener('compositionend', () => {
      composing = false;
      setTimeout(evaluate, 0);
    });
    input.addEventListener('input', (e) => {
      if (!composing && !e.isComposing) evaluate();
    });
    // 用输入法时拼写过程也算在敲键盘，每按一下都响
    input.addEventListener('keydown', (e) => !e.repeat && onHit());
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || composing || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      // 打够字数后可以带着错字进入下一行
      if ([...input.value].length >= lines[li].chars.length) next();
    });
    input.addEventListener('paste', (e) => e.preventDefault());
    input.addEventListener('drop', (e) => e.preventDefault());

    // 继续上次：前面的行直接算作已完成
    for (let i = 0; i < startLine; i++) {
      lines[i].el.classList.add('done');
      lines[i].chars.forEach((c) => c.el.classList.add('ok'));
      doneChars += lines[i].chars.length;
    }
    enter(startLine);

    return {
      get index() { return li; },
      focus: () => input.focus(),
      setPaused(p) {
        input.disabled = p;
        if (!p) input.focus();
      },
      destroy() {
        finished = true;
        input.remove();
        foot.remove();
      },
    };
  };
})((globalThis.TP = globalThis.TP || {}));
