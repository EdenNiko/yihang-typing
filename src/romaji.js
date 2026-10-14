// 假名 → 罗马字候选，以及把一行的“原子”切成可逐键匹配的块
(function (TP) {
  const T = {
    あ: ['a'], い: ['i', 'yi'], う: ['u', 'wu'], え: ['e'], お: ['o'],
    か: ['ka', 'ca'], き: ['ki'], く: ['ku', 'cu', 'qu'], け: ['ke'], こ: ['ko', 'co'],
    さ: ['sa'], し: ['shi', 'si', 'ci'], す: ['su'], せ: ['se', 'ce'], そ: ['so'],
    た: ['ta'], ち: ['chi', 'ti'], つ: ['tsu', 'tu'], て: ['te'], と: ['to'],
    な: ['na'], に: ['ni'], ぬ: ['nu'], ね: ['ne'], の: ['no'],
    は: ['ha'], ひ: ['hi'], ふ: ['fu', 'hu'], へ: ['he'], ほ: ['ho'],
    ま: ['ma'], み: ['mi'], む: ['mu'], め: ['me'], も: ['mo'],
    や: ['ya'], ゆ: ['yu'], よ: ['yo'],
    ら: ['ra'], り: ['ri'], る: ['ru'], れ: ['re'], ろ: ['ro'],
    わ: ['wa'], を: ['wo'],
    が: ['ga'], ぎ: ['gi'], ぐ: ['gu'], げ: ['ge'], ご: ['go'],
    ざ: ['za'], じ: ['ji', 'zi'], ず: ['zu'], ぜ: ['ze'], ぞ: ['zo'],
    だ: ['da'], ぢ: ['di'], づ: ['du'], で: ['de'], ど: ['do'],
    ば: ['ba'], び: ['bi'], ぶ: ['bu'], べ: ['be'], ぼ: ['bo'],
    ぱ: ['pa'], ぴ: ['pi'], ぷ: ['pu'], ぺ: ['pe'], ぽ: ['po'],
    ゔ: ['vu'],
    ぁ: ['xa', 'la'], ぃ: ['xi', 'li'], ぅ: ['xu', 'lu'], ぇ: ['xe', 'le'], ぉ: ['xo', 'lo'],
    ゃ: ['xya', 'lya'], ゅ: ['xyu', 'lyu'], ょ: ['xyo', 'lyo'], ゎ: ['xwa', 'lwa'],
    ー: ['-'],
    // 拗音
    しゃ: ['sha', 'sya'], しゅ: ['shu', 'syu'], しょ: ['sho', 'syo'], しぇ: ['she', 'sye'],
    ちゃ: ['cha', 'tya', 'cya'], ちゅ: ['chu', 'tyu', 'cyu'], ちょ: ['cho', 'tyo', 'cyo'], ちぇ: ['che', 'tye'],
    じゃ: ['ja', 'zya', 'jya'], じゅ: ['ju', 'zyu', 'jyu'], じょ: ['jo', 'zyo', 'jyo'], じぇ: ['je', 'zye'],
    ふぁ: ['fa'], ふぃ: ['fi'], ふぇ: ['fe'], ふぉ: ['fo'],
    うぃ: ['wi'], うぇ: ['we'], うぉ: ['who'],
    てぃ: ['thi'], でぃ: ['dhi'], てゅ: ['thu'], でゅ: ['dhu'],
    とぅ: ['twu'], どぅ: ['dwu'],
    ゔぁ: ['va'], ゔぃ: ['vi'], ゔぇ: ['ve'], ゔぉ: ['vo'],
    つぁ: ['tsa'], つぃ: ['tsi'], つぇ: ['tse'], つぉ: ['tso'],
    くぁ: ['qa'], ぐぁ: ['gwa'],
  };
  // 规则的 ○ゃ ○ゅ ○ょ
  const Y = { き: 'ky', ぎ: 'gy', に: 'ny', ひ: 'hy', び: 'by', ぴ: 'py', み: 'my', り: 'ry', ぢ: 'dy' };
  for (const k in Y) {
    T[k + 'ゃ'] = [Y[k] + 'a'];
    T[k + 'ゅ'] = [Y[k] + 'u'];
    T[k + 'ょ'] = [Y[k] + 'o'];
  }

  const SMALL = 'ぁぃぅぇぉゃゅょゎ';
  // ん 后面是这些假名时必须打 nn
  const N_STRICT = 'あいうえおやゆよなにぬねのん';
  const SOKUON = ['xtu', 'ltu', 'xtsu', 'ltsu'];

  function toHiragana(s) {
    return s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
  }

  function uniq(a) {
    return [...new Set(a)];
  }

  // atoms: [{k:'kana', ch}, {k:'key', cands}, {k:'skip'}]
  // 返回 chunks: [{cands, start, end, skip}]，start/end 为 atom 下标（end 不含）
  function buildChunks(atoms) {
    const isKana = (i) => i < atoms.length && atoms[i].k === 'kana';
    const chunks = [];

    // 从 i 开始读一个普通假名块（不处理 っ、ん）
    function plain(i) {
      const a = atoms[i].ch;
      if (isKana(i + 1) && SMALL.includes(atoms[i + 1].ch)) {
        const b = atoms[i + 1].ch;
        const direct = T[a + b] || [];
        const split = T[a] && T[b] ? T[a].flatMap((x) => T[b].map((y) => x + y)) : [];
        if (direct.length || split.length) return { cands: uniq([...direct, ...split]), len: 2 };
      }
      return T[a] ? { cands: T[a].slice(), len: 1 } : null;
    }

    let i = 0;
    while (i < atoms.length) {
      const at = atoms[i];
      if (at.k === 'key') {
        chunks.push({ cands: at.cands, start: i, end: i + 1, skip: false });
        i++;
      } else if (at.k !== 'kana') {
        chunks.push({ cands: [], start: i, end: i + 1, skip: true });
        i++;
      } else if (at.ch === 'ん') {
        const next = atoms[i + 1];
        const loose = next && !(next.k === 'kana' && N_STRICT.includes(next.ch));
        chunks.push({ cands: loose ? ['n', 'nn', 'xn'] : ['nn', 'xn'], start: i, end: i + 1, skip: false });
        i++;
      } else if (at.ch === 'っ') {
        const nx = isKana(i + 1) && atoms[i + 1].ch !== 'っ' && atoms[i + 1].ch !== 'ん' ? plain(i + 1) : null;
        const doubled = nx ? nx.cands.filter((c) => !'aiueon-'.includes(c[0])) : [];
        if (doubled.length) {
          const cands = doubled.map((c) => c[0] + c);
          doubled.forEach((c) => c.startsWith('ch') && cands.push('t' + c));
          SOKUON.forEach((s) => nx.cands.forEach((c) => cands.push(s + c)));
          chunks.push({ cands: uniq(cands), start: i, end: i + 1 + nx.len, skip: false });
          i += 1 + nx.len;
        } else {
          chunks.push({ cands: SOKUON.slice(), start: i, end: i + 1, skip: false });
          i++;
        }
      } else {
        const p = plain(i);
        if (p) {
          chunks.push({ cands: p.cands, start: i, end: i + p.len, skip: false });
          i += p.len;
        } else {
          chunks.push({ cands: [], start: i, end: i + 1, skip: true });
          i++;
        }
      }
    }
    return chunks;
  }

  // 逐键匹配器
  function createMatcher(chunks) {
    let ci = 0;
    let buf = '';
    const typed = chunks.map(() => '');

    function skipForward() {
      while (ci < chunks.length && chunks[ci].skip) ci++;
    }
    function hasLater() {
      for (let j = ci + 1; j < chunks.length; j++) if (!chunks[j].skip) return true;
      return false;
    }
    function advance() {
      typed[ci] = buf;
      buf = '';
      ci++;
      skipForward();
    }
    skipForward();

    // 返回 true 表示按键被接受
    function press(ch) {
      if (ci >= chunks.length) return false;
      const cands = chunks[ci].cands;
      const nb = buf + ch;
      if (cands.some((c) => c.startsWith(nb))) {
        buf = nb;
        const longer = cands.some((c) => c !== buf && c.startsWith(buf));
        if (cands.includes(buf) && (!longer || !hasLater())) advance();
        return true;
      }
      // 例如 ん 已经打了 n，下一键属于后面的假名
      if (cands.includes(buf)) {
        const saveCi = ci;
        const saveBuf = buf;
        advance();
        if (press(ch)) return true;
        ci = saveCi;
        buf = saveBuf;
        typed[ci] = '';
      }
      return false;
    }

    return {
      press,
      get index() { return ci; },
      get buffer() { return buf; },
      get done() { return ci >= chunks.length; },
      typedOf: (j) => typed[j],
      // 当前块剩余的提示
      hint() {
        if (ci >= chunks.length) return '';
        const c = chunks[ci].cands.find((x) => x.startsWith(buf)) || '';
        return c.slice(buf.length);
      },
    };
  }

  TP.romaji = { toHiragana, buildChunks, createMatcher, table: T };
})((globalThis.TP = globalThis.TP || {}));
