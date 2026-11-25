// Gloss studio: the "Glosses" tab of Tree studio.
// Interlinear glossed examples: each word of the example sits over its gloss, with a free translation under.
// Typed or pasted (gb4e / linguex / expex), read from a photo, drawn as SVG, exported as SVG / PNG / PDF / LaTeX.
// Self-contained, no build step. All sizes are in points (1 unit = 1 pt).
(() => {
'use strict';

const STORE = 'trees-studio-gloss-v1';
const NS = 'http://www.w3.org/2000/svg';
const $ = id => document.getElementById(id);
const TS = window.TreeStudio || {};
const toast = t => (TS.toast ? TS.toast(t) : console.log(t));
const body = document.body;

// ------------------------------------------------------------------ the document
const DEFAULT_OPTS = () => ({
  numbering: 'each', start: 1,
  family: '"Times New Roman", Times, serif', size: 12, gsize: 12, tsize: 12,
  italic: false, sc: true, quotes: 'single',
  gap: 12, wrap: 0, margin: 10, transparent: false,
});
let G = { ex: [{ src: '', gloss: '', trans: '' }], opts: DEFAULT_OPTS(), pkg: 'gb4e' };

const SAMPLES = {
  'Turkish': [{ src: 'Ben ev-e git-ti-m', gloss: '1SG house-DAT go-PST-1SG', trans: 'I went home.' }],
  'Japanese': [{ src: 'Taro-ga hon-o yon-da', gloss: 'Taro-NOM book-ACC read-PST', trans: 'Taro read a book.' }],
  'Latin': [{ src: 'Puell-a aqu-am port-at', gloss: 'girl-NOM.SG water-ACC.SG carry-3SG.PRS', trans: 'The girl carries water.' }],
  'German': [{ src: 'Ich habe ihn gesehen', gloss: 'I.NOM have.1SG him.ACC see.PTCP', trans: 'I have seen him.' }],
  'Turkish, a set (a. b.)': [
    { src: 'Ben ev-e git-ti-m', gloss: '1SG house-DAT go-PST-1SG', trans: 'I went home.' },
    { src: 'Ben ev-e git-me-di-m', gloss: '1SG house-DAT go-NEG-PST-1SG', trans: 'I did not go home.' }],
};

function normG(g) {
  const o = Object.assign(DEFAULT_OPTS(), (g && g.opts) || {});
  const ex = ((g && g.ex) || []).filter(e => e && typeof e === 'object')
    .map(e => ({ src: String(e.src || ''), gloss: String(e.gloss || ''), trans: String(e.trans || '') }));
  return { ex: ex.length ? ex : [{ src: '', gloss: '', trans: '' }], opts: o, pkg: ['gb4e', 'linguex', 'expex', 'plain'].includes(g && g.pkg) ? g.pkg : 'gb4e' };
}

// ------------------------------------------------------------------ words and markup
// A line is split at spaces, except inside { }. A word that is entirely {…} gives one item that may contain spaces.
function matchBrace(s, i) {                     // s[i] === '{': index of the matching '}' (or the end of the string)
  let d = 0;
  for (let k = i; k < s.length; k++) {
    if (s[k] === '\\') { k++; continue; }
    if (s[k] === '{') d++;
    else if (s[k] === '}' && --d === 0) return k;
  }
  return s.length;
}
function tokens(line) {
  const out = []; let cur = '', d = 0;
  for (const ch of line) {
    if (ch === '{') d++;
    else if (ch === '}') d = Math.max(0, d - 1);
    if (/\s/.test(ch) && d === 0) { if (cur) { out.push(cur); cur = ''; } } else cur += ch;
  }
  if (cur) out.push(cur);
  return out.map(raw => {
    const grouped = raw[0] === '{' && matchBrace(raw, 0) === raw.length - 1;
    return { raw, text: grouped ? raw.slice(1, -1) : raw, grouped };
  });
}
// CAPITALS in a gloss (3SG, PST, NOM.SG): a run of 2+ capitals, maybe after a person digit, not part of a longer word
const SC = /(^|[^A-Za-z0-9\\])([123]?[A-Z]{2,}[A-Z0-9]*)(?![A-Za-z])/g;

function parseMarkup(s, st, out) {
  let buf = '';
  const flush = () => { if (buf) { out.push(Object.assign({ t: buf }, st)); buf = ''; } };
  for (let i = 0; i < s.length;) {
    const c = s[i];
    if (c === '\\') {
      const m = /^\\(emph|textit|textbf|textsc)\{/.exec(s.slice(i));
      if (m) {
        const open = i + m[0].length - 1, close = matchBrace(s, open);
        flush();
        const st2 = Object.assign({}, st);
        if (m[1] === 'emph' || m[1] === 'textit') st2.i = !st.i; else if (m[1] === 'textbf') st2.b = true; else st2.sc = true;
        parseMarkup(s.slice(open + 1, close), st2, out);
        i = close + 1; continue;
      }
      if (/^\\[&%#$_{}~^]/.test(s.slice(i, i + 2))) { buf += s[i + 1]; i += 2; continue; }
      buf += c; i++; continue;
    }
    if (c === '{' || c === '}') { i++; continue; }
    buf += c; i++;
  }
  flush();
}
function runsOf(str, autoSc) {
  const raw = [];
  parseMarkup(str, { i: false, b: false, sc: false }, raw);
  if (!autoSc) return raw;
  const out = [];
  for (const r of raw) {
    if (r.sc) { out.push(r); continue; }
    let last = 0, m;
    SC.lastIndex = 0;
    while ((m = SC.exec(r.t))) {
      const start = m.index + m[1].length;
      if (start > last) out.push(Object.assign({}, r, { t: r.t.slice(last, start) }));
      out.push(Object.assign({}, r, { t: m[2], sc: true }));
      last = start + m[2].length;
    }
    if (last < r.t.length) out.push(Object.assign({}, r, { t: r.t.slice(last) }));
  }
  return out;
}

// ------------------------------------------------------------------ measuring and drawing
const ctx = document.createElement('canvas').getContext('2d');
const SCALE = 0.8;                                           // synthetic small caps: capitals at 80%
const runSize = (r, size) => size * (r.sc ? SCALE : 1);
const runText = r => (r.sc ? r.t.toUpperCase() : r.t);
function runWidth(r, size, family) {
  ctx.font = `${r.i ? 'italic ' : ''}${r.b ? 'bold ' : ''}${runSize(r, size)}px ${family}`;
  return ctx.measureText(runText(r)).width;
}
const widthOf = (runs, size, family) => runs.reduce((a, r) => a + runWidth(r, size, family), 0);
function mk(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function drawRuns(parent, x, y, runs, size, family, fill) {
  const t = mk('text', { x, y, 'font-family': family, 'font-size': size, fill: fill || '#111', 'xml:space': 'preserve' }, parent);
  for (const r of runs) {
    const a = {};
    if (r.sc) a['font-size'] = runSize(r, size);
    if (r.i) a['font-style'] = 'italic';
    if (r.b) a['font-weight'] = 'bold';
    mk('tspan', a, t).textContent = runText(r);
  }
}
function wrapRuns(runs, avail, size, family) {              // greedy word wrap of styled runs: returns lines of runs
  const pieces = [];
  for (const r of runs) for (const p of r.t.split(/(\s+)/)) if (p) pieces.push(Object.assign({}, r, { t: p }));
  const lines = [[]]; let w = 0;
  for (const p of pieces) {
    const pw = runWidth(p, size, family), blank = /^\s+$/.test(p.t);
    const cur = lines[lines.length - 1];
    if (!blank && cur.length && w + pw > avail) { lines.push([p]); w = pw; continue; }
    if (blank && !cur.length) continue;                      // no space at the start of a line
    cur.push(p); w += pw;
  }
  return lines;
}
const letter = i => String.fromCharCode(97 + (i % 26));

// Lay the examples out. Returns { svg, w, h, empty, issues } (issues: examples whose two lines have different word counts)
function build(interactive) {
  const o = G.opts, F = o.family, m = o.margin;
  const E = G.ex.map(e => ({ s: tokens(e.src), g: tokens(e.gloss), t: e.trans.trim() })).map((e, i) => Object.assign(e, { i }));
  const used = E.filter(e => e.s.length || e.g.length || e.t);
  const svg = mk('svg', { xmlns: NS });
  const g = mk('g', {}, svg);
  const grp = o.numbering === 'group' && used.length > 1;
  const numbered = o.numbering !== 'none';
  const plainRun = t => [{ t, i: false, b: false, sc: false }];
  const sp = o.size * 0.9;
  let numW = 0, subW = 0;
  if (numbered) numW = Math.max(...used.map((_, k) => widthOf(plainRun('(' + (o.start + (grp ? 0 : k)) + ')'), o.size, F)), 0) + sp;
  if (grp) subW = widthOf(plainRun('m.'), o.size, F) + sp;
  const textX = m + numW + subW;
  const avail = o.wrap > 0 ? Math.max(40, o.wrap - m - numW - subW) : Infinity;
  let y = m, maxX = textX;
  const issues = [];
  used.forEach((e, k) => {
    const cols = [], n = Math.max(e.s.length, e.g.length);
    for (let c = 0; c < n; c++) {
      const sr = e.s[c] ? runsOf(e.s[c].text, false).map(r => Object.assign(r, o.italic ? { i: !r.i } : {})) : null;
      const gr = e.g[c] ? runsOf(e.g[c].text, o.sc) : null;
      const sw = sr ? widthOf(sr, o.size, F) : 0, gw = gr ? widthOf(gr, o.gsize, F) : 0;
      cols.push({ sr, gr, w: Math.max(sw, gw, o.size * 0.6) });
    }
    if (e.s.length !== e.g.length && e.s.length && e.g.length) issues.push(e.i);
    // flow the columns into lines
    const flows = [[]]; let fw = 0;
    for (const c of cols) {
      if (flows[flows.length - 1].length && fw + c.w > avail) { flows.push([]); fw = 0; }
      flows[flows.length - 1].push(c); fw += c.w + o.gap;
    }
    if (!cols.length) flows[0] = [];
    let first = true;
    for (const line of flows) {
      if (!line.length && !first) continue;
      const by = y + o.size;                                  // baseline of the example line
      const gy = by + o.gsize * 1.3;                          // baseline of the gloss line
      if (first) {
        if (numbered && (k === 0 || !grp)) drawRuns(g, m, by, plainRun('(' + (o.start + (grp ? 0 : k)) + ')'), o.size, F);
        if (grp) drawRuns(g, m + numW, by, plainRun(letter(k) + '.'), o.size, F);
      }
      let x = textX;
      for (const c of line) {
        if (c.sr) drawRuns(g, x, by, c.sr, o.size, F);
        else if (interactive) mk('rect', { x, y: by - o.size * 0.8, width: c.w, height: o.size, fill: 'none', stroke: '#b3261e', 'stroke-dasharray': '2 2', 'stroke-width': 0.8 }, g);
        if (c.gr) drawRuns(g, x, gy, c.gr, o.gsize, F);
        else if (interactive) mk('rect', { x, y: gy - o.gsize * 0.8, width: c.w, height: o.gsize, fill: 'none', stroke: '#b3261e', 'stroke-dasharray': '2 2', 'stroke-width': 0.8 }, g);
        x += c.w + o.gap;
      }
      maxX = Math.max(maxX, x - o.gap);
      y = gy + o.gsize * 0.35;
      first = false;
    }
    if (e.t) {
      const q = { single: ['\u2018', '\u2019'], double: ['\u201C', '\u201D'], none: ['', ''] }[o.quotes] || ['', ''];
      const runs = runsOf(e.t, false);
      if (q[0]) runs.unshift({ t: q[0], i: false, b: false, sc: false });
      if (q[1]) runs.push({ t: q[1], i: false, b: false, sc: false });
      const lines = Number.isFinite(avail) ? wrapRuns(runs, avail, o.tsize, F) : [runs];
      y += o.tsize * 0.25;
      for (const ln of lines) {
        y += o.tsize * 1.3;
        drawRuns(g, textX, y - o.tsize * 0.3, ln, o.tsize, F);
        maxX = Math.max(maxX, textX + widthOf(ln, o.tsize, F));
      }
      y += o.tsize * 0.1;
    }
    y += o.size * 0.9;                                        // space before the next example
  });
  const w = Math.max(maxX + m, 20), h = Math.max(y - o.size * 0.9 + m, 20);
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('width', w + 'pt'); svg.setAttribute('height', h + 'pt');
  if (!o.transparent) svg.insertBefore(mk('rect', { x: 0, y: 0, width: w, height: h, fill: '#fff' }), svg.firstChild);
  return { svg, w, h, empty: !used.length, issues };
}

// ------------------------------------------------------------------ LaTeX out
const esc = s => s.replace(/(^|[^\\])([&%#$_])/g, '$1\\$2').replace(/(^|[^\\])([&%#$_])/g, '$1\\$2');
function texWord(tok, kind) {
  let t = esc(tok.text);
  if (kind === 'gloss' && G.opts.sc) t = t.replace(SC, (mm, p, w) => p + '\\textsc{' + w.toLowerCase() + '}');
  if (kind === 'src' && G.opts.italic) t = '\\textit{' + t + '}';
  return /\s/.test(tok.text) ? '{' + t + '}' : t;
}
function texQuote(t) {
  t = esc(t);
  return { single: "`" + t + "'", double: "``" + t + "''", none: t }[G.opts.quotes] || t;
}
function exData() {
  return G.ex.map(e => ({ s: tokens(e.src), g: tokens(e.gloss), t: e.trans.trim() })).filter(e => e.s.length || e.g.length || e.t);
}
function snippet(pkg) {
  const E = exData();
  if (!E.length) return '';
  const grp = G.opts.numbering === 'group' && E.length > 1;
  const row = (toks, kind) => toks.map(t => texWord(t, kind)).join(' ');
  const L = [];
  const note = (G.opts.numbering === 'none' && pkg !== 'plain') ? ['% (this package numbers every example)'] : [];
  if (pkg === 'gb4e') {
    const gll = e => '\\gll ' + row(e.s, 'src') + '\\\\\n' + row(e.g, 'gloss') + '\\\\' + (e.t ? '\n\\trans ' + texQuote(e.t) : '');
    L.push('% needs \\usepackage{gb4e}', ...note, '\\begin{exe}');
    if (grp) { L.push('\\ex', '\\begin{xlist}'); E.forEach(e => L.push('\\ex ' + gll(e))); L.push('\\end{xlist}'); }
    else E.forEach(e => L.push('\\ex ' + gll(e)));
    L.push('\\end{exe}');
  } else if (pkg === 'linguex') {
    const gll = e => '\\gll ' + row(e.s, 'src') + '\\\\\n' + row(e.g, 'gloss') + '\\\\' + (e.t ? '\n\\trans ' + texQuote(e.t) : '');
    L.push('% needs \\usepackage{linguex}', ...note);
    if (grp) { L.push('\\ex.'); E.forEach((e, k) => L.push('\\' + letter(k) + '. ' + gll(e))); }
    else E.forEach((e, k) => L.push((k ? '\n' : '') + '\\ex. ' + gll(e)));
  } else if (pkg === 'expex') {
    const gl = e => ['\\begingl', '\\gla ' + row(e.s, 'src') + '//', '\\glb ' + row(e.g, 'gloss') + '//', ...(e.t ? ['\\glft ' + texQuote(e.t) + '//'] : []), '\\endgl'];
    L.push('% needs \\usepackage{expex}', ...note);
    if (grp) { L.push('\\pex'); E.forEach(e => { L.push('\\a', ...gl(e)); }); L.push('\\xe'); }
    else E.forEach((e, k) => { L.push((k ? '\n' : '') + '\\ex', ...gl(e), '\\xe'); });
  } else {
    L.push('% no package needed');
    E.forEach((e, k) => {
      const n = Math.max(e.s.length, e.g.length, 1);
      const numbered = G.opts.numbering !== 'none';
      const lead = [];                                          // the number, and the a. b. c. letter, in columns of their own
      if (numbered) lead.push(grp ? (k === 0 ? '(' + G.opts.start + ')' : '') : '(' + (G.opts.start + k) + ')');
      if (grp) lead.push(letter(k) + '.');
      const cell = (toks, kind, c) => (toks[c] ? texWord(toks[c], kind) : '');
      const cols = '@{}' + Array(lead.length + n).fill('l').join('@{\\hspace{1em}}') + '@{}';
      L.push('\\noindent\\begin{tabular}[t]{' + cols + '}');
      L.push([...lead, ...Array.from({ length: n }, (_, c) => cell(e.s, 'src', c))].join(' & ') + ' \\\\');
      L.push([...lead.map(() => ''), ...Array.from({ length: n }, (_, c) => cell(e.g, 'gloss', c))].join(' & ') + ' \\\\');
      if (e.t) L.push([...lead.map(() => ''), '\\multicolumn{' + n + '}{@{}l@{}}{' + texQuote(e.t) + '}'].join(' & ') + ' \\\\');
      L.push('\\end{tabular}\\par' + (k < E.length - 1 ? '\\medskip' : ''));
    });
  }
  return L.join('\n');
}
function texDoc(pkg) {
  const use = { gb4e: '\\usepackage{gb4e}\n\\noautomath', linguex: '\\usepackage{linguex}', expex: '\\usepackage{expex}', plain: '' }[pkg];
  return '\\documentclass{article}\n\\usepackage{iftex}\n\\ifPDFTeX\n  \\usepackage[utf8]{inputenc}\n  \\usepackage[T1]{fontenc}\n\\else\n  \\usepackage{fontspec}\n\\fi\n'
    + (use ? use + '\n' : '') + '\\pagestyle{empty}\n\\begin{document}\n\n' + snippet(pkg) + '\n\n\\end{document}\n';
}

// ------------------------------------------------------------------ LaTeX in
function parseLatex(text) {
  const t = text.replace(/(^|[^\\])%.*$/gm, '$1');
  const found = [];
  const fix = s => s.replace(/\\textsc\{([^{}]*)\}/g, (m, x) => x.toUpperCase()).replace(/\\textit\{([^{}]*)\}/g, '$1')
    .replace(/\\\\/g, ' ').replace(/\s+/g, ' ').trim();
  const unq = s => s.replace(/^\s*(?:``|`|\u2018|\u201C|")\s*/, '').replace(/\s*(?:''|'|\u2019|\u201D|")\s*$/, '').replace(/\s+/g, ' ').trim();
  const g1 = /\\gll\s*([\s\S]*?)\\\\\s*([\s\S]*?)\\\\\s*(?:\\(?:trans|glt)\s*([\s\S]*?))?(?=\\ex\b|\\exi\b|\\a\b|\\b\b|\\c\b|\\d\b|\\e\b|\\f\b|\\end\b|\\xe\b|\\gll\b|\\pex\b|$)/g;
  let m;
  while ((m = g1.exec(t))) found.push({ at: m.index, src: fix(m[1]), gloss: fix(m[2]), trans: unq(m[3] || '').replace(/\\\\/g, ' ') });
  const g2 = /\\gla\s*([\s\S]*?)\/\/\s*\\glb\s*([\s\S]*?)\/\/\s*(?:\\glft\s*([\s\S]*?)\/\/)?/g;
  while ((m = g2.exec(t))) found.push({ at: m.index, src: fix(m[1]), gloss: fix(m[2]), trans: unq(m[3] || '') });
  return found.sort((a, b) => a.at - b.at).map(({ src, gloss, trans }) => ({ src, gloss, trans }));
}

// ------------------------------------------------------------------ undo and saving
let undoStack = [], redoStack = [], lastKey = null, lastAt = 0;
const snapshot = () => JSON.stringify(G);
function pushUndo(key) {
  const now = Date.now();
  if (key && key === lastKey && now - lastAt < 900) { lastAt = now; return; }     // a burst of typing is one undo step
  lastKey = key || null; lastAt = now;
  undoStack.push(snapshot()); if (undoStack.length > 200) undoStack.shift();
  redoStack = [];
  refreshUndo();
}
function restore(s) { G = normG(JSON.parse(s)); lastKey = null; renderAll(); save(); }
function undo() { if (!undoStack.length) return; redoStack.push(snapshot()); restore(undoStack.pop()); refreshUndo(); }
function redo() { if (!redoStack.length) return; undoStack.push(snapshot()); restore(redoStack.pop()); refreshUndo(); }
function refreshUndo() { $('g-undo').disabled = !undoStack.length; $('g-redo').disabled = !redoStack.length; }
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { localStorage.setItem(STORE, JSON.stringify(G)); } catch (e) { /* full or blocked */ } }, 200);
}

// ------------------------------------------------------------------ the editor on the left
function counts(e) {
  const a = tokens(e.src).length, b = tokens(e.gloss).length;
  return a && b && a !== b ? `The example has ${a} word${a === 1 ? '' : 's'} but the gloss has ${b}. The empty place is marked in red; put {braces} round a gloss item that has a space in it.` : '';
}
function renderList() {
  const list = $('g-list');
  list.innerHTML = '';
  G.ex.forEach((e, i) => {
    const card = document.createElement('div');
    card.className = 'gex';
    card.innerHTML = `<div class="gh"><b>Example ${i + 1}</b>
        <button data-a="up" title="Move up" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button data-a="down" title="Move down" ${i === G.ex.length - 1 ? 'disabled' : ''}>↓</button>
        <button data-a="dup" title="Copy this example">Copy</button>
        <button data-a="del" class="x" title="Delete this example">✕</button></div>
      <label class="f">Example <input type="text" data-f="src" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" placeholder="Pat sleep-s often"></label>
      <label class="f">Gloss <input type="text" data-f="gloss" spellcheck="false" autocomplete="off" autocapitalize="off" autocorrect="off" placeholder="Pat sleep-3SG often"></label>
      <label class="f">Translation <input type="text" data-f="trans" spellcheck="false" autocomplete="off" placeholder="Pat often sleeps."></label>
      <div class="warn" role="status"></div>`;
    for (const f of ['src', 'gloss', 'trans']) card.querySelector(`[data-f="${f}"]`).value = e[f];
    card.querySelector('.warn').textContent = counts(e);
    card.dataset.i = i;
    list.appendChild(card);
  });
}
$('g-list').addEventListener('input', e => {
  const inp = e.target.closest('input[data-f]');
  if (!inp) return;
  const card = inp.closest('.gex'), i = +card.dataset.i;
  pushUndo('type' + i + inp.dataset.f);
  G.ex[i][inp.dataset.f] = inp.value;
  card.querySelector('.warn').textContent = counts(G.ex[i]);
  renderPreview(); syncOut(); save();
});
$('g-list').addEventListener('click', e => {
  const b = e.target.closest('button[data-a]');
  if (!b) return;
  const i = +b.closest('.gex').dataset.i, a = b.dataset.a;
  pushUndo();
  if (a === 'up' && i > 0) [G.ex[i - 1], G.ex[i]] = [G.ex[i], G.ex[i - 1]];
  else if (a === 'down' && i < G.ex.length - 1) [G.ex[i + 1], G.ex[i]] = [G.ex[i], G.ex[i + 1]];
  else if (a === 'dup') G.ex.splice(i + 1, 0, Object.assign({}, G.ex[i]));
  else if (a === 'del') { G.ex.splice(i, 1); if (!G.ex.length) G.ex.push({ src: '', gloss: '', trans: '' }); }
  renderAll(); save();
});
$('g-add').addEventListener('click', () => {
  pushUndo();
  G.ex.push({ src: '', gloss: '', trans: '' });
  renderAll(); save();
  const inputs = $('g-list').querySelectorAll('.gex:last-child input');
  if (inputs[0]) inputs[0].focus();
});
// Enter in an example box moves on to the next box; after the last box it opens a new example
$('g-list').addEventListener('keydown', e => {
  if (e.key !== 'Enter' || !e.target.matches('input[data-f]')) return;
  e.preventDefault();
  const all = [...$('g-list').querySelectorAll('input[data-f]')], k = all.indexOf(e.target);
  if (k < all.length - 1) all[k + 1].focus(); else $('g-add').click();
});

// ------------------------------------------------------------------ the preview and the LaTeX box
function renderPreview() {
  const r = build(true), paper = $('g-paper');
  paper.innerHTML = '';
  $('g-empty').hidden = !r.empty;
  paper.hidden = r.empty;
  paper.classList.toggle('tr', G.opts.transparent);
  const stage = $('g-stage');
  const room = stage.clientWidth - 48;
  const k = Math.max(0.5, Math.min(2, room > 0 ? room / (r.w * 4 / 3) : 1.5, 1.6));      // 1 pt = 4/3 px at 100%
  r.svg.setAttribute('width', r.w * (4 / 3) * k); r.svg.setAttribute('height', r.h * (4 / 3) * k);
  paper.appendChild(r.svg);
}
function syncOut() {
  const out = $('g-out');
  if (document.activeElement === out) return;                      // the box follows you, but never fights you while you type in it
  out.value = snippet(G.pkg);
  $('g-err').textContent = ''; $('g-err').className = '';
}
$('g-out').addEventListener('input', () => {
  const ex = parseLatex($('g-out').value), err = $('g-err');
  if (!ex.length) { err.className = ''; err.textContent = $('g-out').value.trim() ? 'No \\gll (or \\gla … \\glb …) found yet.' : ''; return; }
  pushUndo('latex');
  G.ex = ex; renderList(); renderPreview(); save();
  err.className = 'ok'; err.textContent = `Read ${ex.length} example${ex.length === 1 ? '' : 's'}.`;
});
$('g-out').addEventListener('blur', syncOut);
$('g-pkg').addEventListener('change', () => { G.pkg = $('g-pkg').value; syncOut(); save(); });
$('g-copy').addEventListener('click', async () => {
  const v = snippet(G.pkg);
  try { await navigator.clipboard.writeText(v); toast('Copied'); }
  catch (e) { $('g-out').focus(); $('g-out').select(); toast('Press Ctrl+C to copy'); }
});

// ------------------------------------------------------------------ the options on the right
function refreshOpts() {
  for (const el of document.querySelectorAll('[data-g]')) {
    const v = G.opts[el.dataset.g];
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
  }
  $('g-pkg').value = G.pkg;
}
for (const el of document.querySelectorAll('[data-g]')) {
  el.addEventListener(el.type === 'checkbox' || el.tagName === 'SELECT' ? 'change' : 'input', () => {
    const k = el.dataset.g;
    let v = el.type === 'checkbox' ? el.checked : el.type === 'number' ? parseFloat(el.value) : el.value;
    if (el.type === 'number' && !Number.isFinite(v)) return;
    pushUndo('opt' + k);
    G.opts[k] = v;
    renderPreview(); syncOut(); save();
  });
}

function renderAll() { renderList(); refreshOpts(); renderPreview(); syncOut(); refreshUndo(); }

// ------------------------------------------------------------------ examples, new, photo
for (const k of Object.keys(SAMPLES)) { const o = document.createElement('option'); o.textContent = k; $('g-examples').appendChild(o); }
$('g-examples').addEventListener('change', () => {
  const s = SAMPLES[$('g-examples').value];
  $('g-examples').value = '';
  if (!s) return;
  pushUndo();
  G.ex = s.map(e => Object.assign({}, e));
  G.opts.numbering = s.length > 1 ? 'group' : (G.opts.numbering === 'group' ? 'each' : G.opts.numbering);
  renderAll(); save();
});
$('g-new').addEventListener('click', () => {
  if (G.ex.some(e => e.src || e.gloss || e.trans) && !confirm('Clear all the examples? (Undo brings them back.)')) return;
  pushUndo();
  G.ex = [{ src: '', gloss: '', trans: '' }];
  renderAll(); save();
});
$('g-undo').addEventListener('click', undo);
$('g-redo').addEventListener('click', redo);

let photoBusy = false;
async function readPhoto(file) {
  if (photoBusy || !file || !/^image\//.test(file.type)) return;
  photoBusy = true;
  const btn = $('g-photo'), was = btn.textContent; btn.disabled = true; btn.textContent = 'Reading…';
  try {
    const image = await TS.photoToJpeg(file);
    const r = await fetch(TS.PHOTO_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image, media_type: 'image/jpeg', mode: 'gloss' }) });
    const d = await r.json().catch(() => ({}));
    if (!Array.isArray(d.examples)) {
      // an older worker only knows trees and answers "No tree found": say what is really wrong
      toast(!d.error ? 'Could not read that photo' : /tree/i.test(d.error) ? 'The photo service needs updating to read glosses (see worker/README.md).' : d.error);
      return;
    }
    const ex = d.examples.filter(e => e && (e.src || e.gloss)).map(e => ({ src: String(e.src || ''), gloss: String(e.gloss || ''), trans: String(e.trans || '') }));
    if (!ex.length) { toast('No glossed examples found in that photo. Try a clearer, well-lit shot.'); return; }
    pushUndo();
    G.ex = ex;
    if (ex.length > 1 && G.opts.numbering === 'each') G.opts.numbering = 'group';
    renderAll(); save();
    const bad = ex.filter(e => counts(e)).length;
    toast(`Read ${ex.length} example${ex.length === 1 ? '' : 's'} from your photo.` + (bad ? ` ${bad} ha${bad === 1 ? 's' : 've'} a different number of words in the two lines: check ${bad === 1 ? 'it' : 'them'}.` : ' Check every word.'));
  } catch (e) { toast('Could not read that photo'); }
  finally { photoBusy = false; btn.disabled = false; btn.textContent = was; }
}
if (TS.PHOTO_ENDPOINT) {
  $('g-photo').hidden = false;
  $('g-photo-note').hidden = false;
  $('g-photo').addEventListener('click', () => $('g-photo-file').click());
  $('g-photo-file').addEventListener('change', e => { readPhoto(e.target.files[0]); e.target.value = ''; });
  const stage = $('g-stage');
  stage.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) e.preventDefault(); });
  stage.addEventListener('drop', e => { const f = e.dataTransfer?.files?.[0]; if (f && /^image\//.test(f.type)) { e.preventDefault(); readPhoto(f); } });
  document.addEventListener('paste', e => {
    if (!body.classList.contains('gloss-tab')) return;
    const f = [...(e.clipboardData?.files || [])].find(x => /^image\//.test(x.type));
    if (f) { e.preventDefault(); readPhoto(f); }
  });
}

// ------------------------------------------------------------------ exporting
const download = (blob, name) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
const xmlOf = svg => '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
function exportable() { const r = build(false); if (r.empty) { toast('There is nothing to export yet'); return null; } return r; }
$('g-export').addEventListener('click', () => $('dlg-gexport').showModal());
$('g-help').addEventListener('click', () => $('dlg-ghelp').showModal());
$('gx-svg').addEventListener('click', () => { const r = exportable(); if (r) download(new Blob([xmlOf(r.svg)], { type: 'image/svg+xml' }), 'gloss.svg'); });
$('gx-png').addEventListener('click', () => {
  const r = exportable(); if (!r) return;
  const dpi = parseFloat($('gx-dpi').value) || 300;
  const s = Math.min(dpi / 72, 16000 / Math.max(r.w, r.h));
  const W = Math.max(1, Math.round(r.w * s)), H = Math.max(1, Math.round(r.h * s));
  r.svg.setAttribute('width', W); r.svg.setAttribute('height', H);
  const url = URL.createObjectURL(new Blob([xmlOf(r.svg)], { type: 'image/svg+xml' }));
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').drawImage(img, 0, 0, W, H);
    c.toBlob(b => { download(b, 'gloss.png'); URL.revokeObjectURL(url); }, 'image/png');
  };
  img.onerror = () => { toast('Could not make the PNG'); URL.revokeObjectURL(url); };
  img.src = url;
});
$('gx-tex').addEventListener('click', () => { if (exportable()) download(new Blob([texDoc(G.pkg)], { type: 'text/x-tex' }), 'gloss.tex'); });
$('gx-pdf').addEventListener('click', () => {
  const r = exportable(); if (!r) return;
  const host = $('print-host');
  host.innerHTML = ''; host.appendChild(r.svg);
  $('dlg-gexport').close();
  setTimeout(() => window.print(), 80);
});
$('gx-json').addEventListener('click', () => download(new Blob([JSON.stringify({ app: 'trees-studio-gloss', version: 1, G }, null, 1)], { type: 'application/json' }), 'gloss.json'));
$('gx-open').addEventListener('click', () => $('gx-file').click());
$('gx-file').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (!j || !j.G || !Array.isArray(j.G.ex)) throw new Error('not a gloss file');
    pushUndo();
    G = normG(j.G); renderAll(); save(); $('dlg-gexport').close();
  } catch (err) { toast('That is not a saved set of examples'); }
});
for (const d of [$('dlg-gexport'), $('dlg-ghelp')]) {
  d.addEventListener('click', e => {
    if (e.target !== d) return;
    const r = d.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close();
  });
}

// ------------------------------------------------------------------ keys and tabs
document.addEventListener('keydown', e => {
  if (!body.classList.contains('gloss-tab') || document.querySelector('dialog[open]')) return;
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (!mod || e.target.matches('input, textarea, select')) return;      // inside a box the browser's own undo is the right one
  if (k === 'z') { e.preventDefault(); (e.shiftKey ? redo : undo)(); }
  else if (k === 'y') { e.preventDefault(); redo(); }
});
function setTab(tab, push) {
  const g = tab === 'gloss';
  body.classList.toggle('gloss-tab', g);
  for (const b of $('seg-tab').querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === tab);
  document.title = g ? 'Gloss studio' : 'Tree studio';
  if (push) history.replaceState(null, '', g ? '#gloss' : location.pathname + location.search);
  if (g) renderPreview(); else if (TS.onShow) TS.onShow();
}
$('seg-tab').addEventListener('click', e => { const b = e.target.closest('button[data-tab]'); if (b) setTab(b.dataset.tab, true); });
window.addEventListener('hashchange', () => setTab(location.hash === '#gloss' ? 'gloss' : 'trees', false));
window.addEventListener('resize', () => { if (body.classList.contains('gloss-tab')) renderPreview(); });

// ------------------------------------------------------------------ start
try { const s = JSON.parse(localStorage.getItem(STORE)); if (s && Array.isArray(s.ex)) G = normG(s); } catch (e) { /* ignore */ }
renderAll();
setTab(location.hash === '#gloss' ? 'gloss' : 'trees', false);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (body.classList.contains('gloss-tab')) renderPreview(); });

})();
