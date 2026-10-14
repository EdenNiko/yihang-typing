// 主进程里运行：用 kuromoji 给日语文本里的汉字自动加读音，输出 {漢字|よみ} 标记
const path = require('path');
const kuromoji = require('kuromoji');

const HAN = '\\u3400-\\u4dbf\\u4e00-\\u9fff\\uf900-\\ufaff々〆';
const HAS_HAN = new RegExp(`[${HAN}]`);
const PARTS = new RegExp(`[${HAN}]+|[^${HAN}]+`, 'g');
const MARKUP = /(\{[^|{}]+\|[^{}]+\})/;

let ready = null;
function tokenizer() {
  if (!ready) {
    const dicPath = path.join(path.dirname(require.resolve('kuromoji/package.json')), 'dict');
    ready = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath }).build((err, t) => (err ? reject(err) : resolve(t)));
    });
  }
  return ready;
}

const toHiragana = (s) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// 食べる + タベル → {食|た}べる；送り仮名不放进标记里
function annotateToken(surface, reading) {
  if (!HAS_HAN.test(surface) || !reading || reading === '*') return surface;
  const r = toHiragana(reading);
  const parts = surface.match(PARTS);
  const re = new RegExp('^' + parts.map((p) => (HAS_HAN.test(p) ? '(.+?)' : escape(toHiragana(p)))).join('') + '$');
  const m = r.match(re);
  if (!m) return `{${surface}|${r}}`;
  let g = 1;
  return parts.map((p) => (HAS_HAN.test(p) ? `{${p}|${m[g++]}}` : p)).join('');
}

// 已经写了 {漢字|よみ} 的部分原样保留，只处理其余文字
async function annotate(text) {
  const t = await tokenizer();
  return text
    .split('\n')
    .map((line) =>
      line
        .split(MARKUP)
        .map((seg) => {
          if (!seg || MARKUP.test(seg)) return seg;
          return t.tokenize(seg).map((k) => annotateToken(k.surface_form, k.reading)).join('');
        })
        .join('')
    )
    .join('\n');
}

module.exports = { annotate, annotateToken };
