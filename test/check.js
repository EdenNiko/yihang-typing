// 罗马字引擎与内置文章数据的自检：node test/check.js
const assert = require('assert');
globalThis.pinyinPro = require('pinyin-pro');
require('../src/romaji.js');
require('../src/reading.js');
require('../src/data/zh.js');
require('../src/data/ja.js');
const { romaji, reading, data } = globalThis.TP;

function typeKana(kana, keys) {
  const chunks = romaji.buildChunks([...kana].map((ch) => ({ k: 'kana', ch })));
  const m = romaji.createMatcher(chunks);
  for (const k of keys) if (!m.press(k)) return false;
  return m.done;
}

const good = [
  ['しゃしん', 'shashinn'], ['しゃしん', 'syasinn'], ['しゃしん', 'sixyasinn'],
  ['がっこう', 'gakkou'], ['がっこう', 'gaxtukou'],
  ['こんにちは', 'konnnichiha'], ['こんにちは', 'konnnitiha'],
  ['しんぶん', 'shinbunn'], ['しんぶん', 'sinnbunn'],
  ['きょう', 'kyou'], ['きょう', 'kilyou'],
  ['まっちゃ', 'maccha'], ['まっちゃ', 'mattya'], ['まっちゃ', 'matcha'],
  ['おっけー', 'okke-'], ['ふぉるだ', 'foruda'], ['じゅっさつ', 'jussatsu'], ['じゅっさつ', 'zyussatu'],
  ['ほんを', 'honwo'], ['さんぽ', 'sanpo'], ['かんない', 'kannnai'],
];
const bad = [
  ['こんにちは', 'konichiha'], ['しんぶん', 'shinbun'], ['がっこう', 'gakou'], ['きょう', 'kiyou'], ['かんない', 'kannai'],
];
good.forEach(([k, r]) => assert.ok(typeKana(k, r), `应接受 ${k} ← ${r}`));
bad.forEach(([k, r]) => assert.ok(!typeKana(k, r), `应拒绝 ${k} ← ${r}`));

// 内置文章：每个 token 都能打，且默认提示能完整打完一行
let lineCount = 0;
for (const lang of ['zh', 'ja']) {
  for (const a of data[lang]) {
    assert.ok(!reading.hasUnknownReading(lang, a.text), `${a.id} 有未注音的汉字`);
    for (const ln of reading.lines(lang, a.text)) {
      lineCount++;
      assert.ok([...ln.plain].length <= 30, `${a.id} 行过长: ${ln.plain}`);
      const atoms = ln.tokens.flatMap((t) => t.atoms);
      const chunks = romaji.buildChunks(atoms);
      chunks.forEach((c) => assert.ok(!c.skip && c.cands.length, `${a.id} 有无法输入的字符: ${ln.plain}`));
      const m = romaji.createMatcher(chunks);
      const keys = chunks.map((c) => c.cands[0]).join('');
      for (const k of keys) assert.ok(m.press(k), `${a.id} 默认提示打不通: ${ln.plain} @ ${k}`);
      assert.ok(m.done, `${a.id} 未打完: ${ln.plain}`);
    }
    // 去除标点符号：每一行都不带标点，字数和文章卡片上显示的一致
    const bare = reading.lines(lang, a.text, true);
    bare.forEach((ln) => assert.ok(!/\p{P}/u.test(ln.plain), `${a.id} 去标点后还有标点: ${ln.plain}`));
    assert.strictEqual(bare.reduce((n, ln) => n + [...ln.plain].length, 0), reading.charCount(lang, a.text, true), `${a.id} 去标点后字数对不上`);
  }
}

const fixes = reading.lines('zh', '项目的沟通。请假一天。做得好吃。逾期不还。切菜。文件夹。有空吗？借期为两周。');
assert.strictEqual(
  fixes.map((l) => l.tokens.filter((t) => t.ruby).map((t) => t.ruby).join(' ')).join('|'),
  'xiàng mù de gōu tōng|qǐng jià yì tiān|zuò de hǎo chī|yú qī bù huán|qiē cài|wén jiàn jiā|yǒu kòng ma|jiè qī wéi liǎng zhōu'
);
const zh = reading.lines('zh', '我们一起去银行，好吗？女儿在旅行。');
console.log(zh.map((l) => l.tokens.map((t) => t.atoms[0].cands[0]).join(' ')).join(' | '));
const ja = reading.lines('ja', data.ja[0].text)[0];
console.log(ja.plain, '→', romaji.buildChunks(ja.tokens.flatMap((t) => t.atoms)).map((c) => c.cands[0]).join(''));
console.log(`OK：${good.length + bad.length} 个罗马字用例，${data.zh.length + data.ja.length} 篇文章，${lineCount} 行`);
