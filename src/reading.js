// 把文章文本解析成带读音的 token，并切分成练习用的行
(function (TP) {
  const HAN = /[㐀-䶿一-鿿豈-﫿々〆]/;
  const KANA = /[ぁ-ゖァ-ヶー]/;

  // 标点 → 按键（按键跟打模式用）
  const PUNCT = {
    '，': [','], '。': ['.'], '、': [',', '\\', '/'], '！': ['!'], '？': ['?'],
    '：': [':'], '；': [';'], '（': ['('], '）': [')'],
    '“': ['"'], '”': ['"'], '‘': ["'"], '’': ["'"],
    '「': ['['], '」': [']'], '『': ['['], '』': [']'],
    '《': ['<'], '》': ['>'], '・': ['/'], '〜': ['~'], '～': ['~'],
    '　': [' '], ' ': [' '],
  };

  // 标点符号（设置里开了「去除标点符号」时，练习内容里不出现）。～ 在 Unicode 里算数学符号，单独加上
  const MARK = /^[\p{P}～]$/u;

  const END = '。！？!?…';
  const CLOSER = '」』”’）)》';
  const CLAUSE = '，、,；;：:';
  const MAX_LINE = 30;

  function otherAtom(c) {
    if (PUNCT[c]) return { k: 'key', cands: PUNCT[c] };
    const code = c.charCodeAt(0);
    if (code >= 0xff01 && code <= 0xff5e) return { k: 'key', cands: [String.fromCharCode(code - 0xfee0).toLowerCase()] };
    if (code > 0x20 && code < 0x7f) return { k: 'key', cands: [c.toLowerCase()] };
    return { k: 'skip' };
  }

  // 日语：{漢字|よみ} 标记
  function tokenizeJa(text) {
    const tokens = [];
    const re = /\{([^|{}]+)\|([^{}]+)\}|([\s\S])/gu;
    let m;
    while ((m = re.exec(text))) {
      if (m[1]) {
        const reading = m[2].trim();
        const atoms = [...TP.romaji.toHiragana(reading)].map((ch) => ({ k: 'kana', ch }));
        tokens.push({ base: m[1], ruby: reading, atoms, src: m[0] });
      } else {
        const c = m[3];
        if (c === '\n') tokens.push({ nl: true });
        else if (c === '\r') continue;
        else if (KANA.test(c)) tokens.push({ base: c, ruby: '', atoms: [{ k: 'kana', ch: TP.romaji.toHiragana(c) }], src: c });
        else if (HAN.test(c)) tokens.push({ base: c, ruby: '', atoms: [], unk: true, src: c });
        else tokens.push({ base: c, ruby: '', atoms: [otherAtom(c)], src: c });
      }
    }
    return tokens;
  }

  // pinyin-pro 在这些词上会选错多音字读音
  const PINYIN_FIX = {
    项目的: 'xiàng mù de',
    请假: 'qǐng jià',
    做得: 'zuò de',
    逾期不还: 'yú qī bù huán',
    切菜: 'qiē cài',
    文件夹: 'wén jiàn jiā',
    有空: 'yǒu kòng',
    借期为: 'jiè qī wéi',
    困得: 'kùn de',
    只想: 'zhǐ xiǎng',
    天天遛: 'tiān tiān liù',
  };
  let fixed = false;

  function pinyinOf(line, toneType) {
    if (!fixed) {
      globalThis.pinyinPro.customPinyin(PINYIN_FIX);
      fixed = true;
    }
    return globalThis.pinyinPro.pinyin(line, { toneType, type: 'array', v: true });
  }

  // 多音字的其他读音也接受，避免自动注音选错时卡住
  function otherReadings(c) {
    return globalThis.pinyinPro
      .pinyin(c, { toneType: 'none', type: 'array', v: true, multiple: true })
      .map((p) => p.toLowerCase().replace(/ü/g, 'v'));
  }

  // 带声调的拼音 → 键盘上要敲的字母（ü 用 v）
  function toKeys(py) {
    return py
      .toLowerCase()
      .replace(/[üǖǘǚǜ]/g, 'v')
      .normalize('NFD')
      .replace(/[^a-z]/g, '');
  }

  // 中文：拼音自动生成；{行|háng} 这样的标记可以手动指定读音
  function tokenizeZh(text) {
    const tokens = [];
    text.replace(/\r/g, '').split('\n').forEach((rawLine, li) => {
      if (li > 0) tokens.push({ nl: true });
      // 先去掉标记得到整行文字（自动拼音要看上下文），并记下手动指定的位置
      const chars = [];
      const manual = new Map();
      const re = /\{([^|{}]+)\|([^{}]+)\}|([\s\S])/gu;
      let m;
      while ((m = re.exec(rawLine))) {
        if (m[1]) {
          manual.set(chars.length, { base: m[1], reading: m[2].trim(), src: m[0] });
          chars.push(...m[1]);
        } else {
          chars.push(m[3]);
        }
      }
      const line = chars.join('');
      let plain = pinyinOf(line, 'none');
      let tone = pinyinOf(line, 'symbol');
      if (plain.length !== chars.length || tone.length !== chars.length) {
        plain = chars.map((c) => pinyinOf(c, 'none')[0] || c);
        tone = chars.map((c) => pinyinOf(c, 'symbol')[0] || c);
      }
      let skip = 0;
      chars.forEach((c, i) => {
        if (skip) return skip--;
        const fix = manual.get(i);
        if (fix) {
          const atoms = fix.reading.split(/\s+/).map(toKeys).filter(Boolean).map((k) => ({ k: 'key', cands: [k] }));
          tokens.push({ base: fix.base, ruby: fix.reading, atoms, src: fix.src });
          skip = [...fix.base].length - 1;
          return;
        }
        if (HAN.test(c)) {
          const py = plain[i].toLowerCase().replace(/ü/g, 'v');
          // 互为前缀的读音（如 na / nan）会让逐键匹配产生歧义，不收
          const alt = otherReadings(c).filter((o) => !o.startsWith(py) && !py.startsWith(o));
          const cands = [...new Set([py, ...alt])];
          tokens.push({ base: c, ruby: tone[i], atoms: [{ k: 'key', cands }], src: c });
        } else {
          tokens.push({ base: c, ruby: '', atoms: [otherAtom(c)], src: c });
        }
      });
    });
    return tokens;
  }

  const len = (toks) => toks.reduce((n, t) => n + [...t.base].length, 0);

  function chop(toks, out) {
    let cur = [];
    for (const t of toks) {
      if (cur.length && len(cur) + [...t.base].length > MAX_LINE) {
        out.push(cur);
        cur = [];
      }
      cur.push(t);
    }
    if (cur.length) out.push(cur);
  }

  // 过长的句子在逗号处断开
  function splitSentence(sent, out) {
    if (len(sent) <= MAX_LINE) return out.push(sent);
    const pieces = [];
    let cur = [];
    sent.forEach((t) => {
      cur.push(t);
      if (CLAUSE.includes(t.base)) {
        pieces.push(cur);
        cur = [];
      }
    });
    if (cur.length) pieces.push(cur);
    let acc = [];
    for (const p of pieces) {
      if (acc.length && len(acc) + len(p) > MAX_LINE) {
        out.push(acc);
        acc = [];
      }
      if (len(p) > MAX_LINE) chop(p, out);
      else acc = acc.concat(p);
    }
    if (acc.length) out.push(acc);
  }

  function splitLines(tokens, noPunct) {
    const groups = [];
    let sent = [];
    const flush = () => {
      if (sent.length) splitSentence(sent, groups);
      sent = [];
    };
    tokens.forEach((t, i) => {
      if (t.nl) return flush();
      sent.push(t);
      const next = tokens[i + 1];
      const stay = next && !next.nl && (END.includes(next.base) || CLOSER.includes(next.base));
      const prevEnd = sent.length > 1 && END.includes(sent[sent.length - 2].base);
      if (!stay && (END.includes(t.base) || (CLOSER.includes(t.base) && prevEnd))) flush();
    });
    flush();

    const isBlank = (t) => /^\s*$/.test(t.base);
    return groups
      .map((g) => {
        // 分句要靠标点，所以分好以后再去掉
        if (noPunct) g = g.filter((t) => !MARK.test(t.base));
        while (g.length && isBlank(g[0])) g.shift();
        while (g.length && isBlank(g[g.length - 1])) g.pop();
        return g;
      })
      .filter((g) => g.length)
      .map((g) => ({ tokens: g, plain: g.map((t) => t.base).join('') }));
  }

  // noPunct：去掉标点符号，只留要打的字（练习时用；编辑文章时的预览和整理不去）
  function lines(lang, text, noPunct) {
    return splitLines(lang === 'ja' ? tokenizeJa(text) : tokenizeZh(text), noPunct);
  }

  // 去掉注音标记后的纯文本
  function plainText(lang, text) {
    return text.replace(/\{([^|{}]+)\|[^{}]+\}/g, '$1');
  }

  // 把文本整理成一句一行（保留读音标记），添加文章时用
  function format(lang, text) {
    return lines(lang, text).map((l) => l.tokens.map((t) => t.src).join('')).join('\n');
  }

  function charCount(lang, text, noPunct) {
    const chars = [...plainText(lang, text).replace(/\s/g, '')];
    return noPunct ? chars.filter((c) => !MARK.test(c)).length : chars.length;
  }

  // 日语文章里是否有没注音的汉字（有则不能用按键跟打模式）
  function hasUnknownReading(lang, text) {
    return lang === 'ja' && HAN.test(text.replace(/\{[^|{}]+\|[^{}]+\}/g, ''));
  }

  TP.reading = { lines, plainText, format, charCount, hasUnknownReading, tokenizeJa };
})((globalThis.TP = globalThis.TP || {}));
