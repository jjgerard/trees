// Marking engine for syntax trees: pure functions, no DOM, so it can run in the browser, in a Worker and under `node --test`.
// Skill 1 only so far: "heads and projection" (X0, X' and XP levels; every phrase has a head).
// Trees are { id, label, children, word?, tri? }, as produced by parseBracket().

export const SKILLS = {
  'heads-projection': {
    name: 'Heads and projection',
    blurb: "Every phrase XP has an X' and an X⁰ of the same category; heads sit over words.",
  },
};

// ---------------------------------------------------------------- reading a tree

function tokenize(src) {
  const toks = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === '[' || c === ']') { toks.push({ t: c, pos: i }); i++; continue; }
    let j = i, depth = 0, v = '';
    while (j < n) {
      const d = src[j];
      if (d === '\\') { v += d; j++; if (j < n) { v += src[j]; j++; } continue; }
      if (d === '{') depth++;
      else if (d === '}') depth = Math.max(0, depth - 1);
      else if (depth === 0 && (/\s/.test(d) || d === '[' || d === ']')) break;
      v += d; j++;
    }
    toks.push({ t: 'a', v, pos: i });
    i = j;
  }
  return toks;
}
const unbrace = v => (v[0] === '{' && v[v.length - 1] === '}' ? v.slice(1, -1) : v);

// "[IP [NP [N' [N Pat]]] ...]" -> tree. A word is plain text; "\roof" right after a label makes a triangle.
export function parseBracket(src) {
  const toks = tokenize(String(src));
  let p = 0;
  const node = () => {
    const open = toks[p++];
    const n = { label: '', children: [] };
    if (toks[p] && toks[p].t === 'a' && toks[p].v !== '\\roof') n.label = unbrace(toks[p++].v);
    while (p < toks.length && toks[p].t !== ']') {
      const k = toks[p];
      if (k.t === '[') n.children.push(node());
      else {
        p++;
        if (k.v === '\\roof') n.tri = true;
        else n.children.push({ label: unbrace(k.v), children: [], word: true });
      }
    }
    if (p >= toks.length) throw new Error('This [ is never closed with a ] (character ' + open.pos + ').');
    p++;
    return n;
  };
  if (!toks.length || toks[0].t !== '[') throw new Error('A tree starts with [.');
  const root = node();
  if (p < toks.length) throw new Error('Unexpected text after the end of the tree.');
  return root;
}

// ---------------------------------------------------------------- labels

// Known categories. A label is a category, optionally with a bar (V'), a 0 (V^0) or P (VP).
const CATS = new Set(['Adv', 'Infl', 'Comp', 'Det', 'Aux', 'Mod', 'Neg', 'Num', 'Deg', 'Conj',
  'N', 'V', 'A', 'P', 'T', 'C', 'D', 'I', 'X', 'Y', 'Z', 'K', 'M', 'Q']);
const ALIAS = { Infl: 'I', Comp: 'C', Det: 'D' };

// -> { cat, level } with level 0 (head), 1 (X') or 2 (XP); level is null if it is not an X-bar label.
export function parseLabel(label) {
  let s = String(label || '').trim();
  s = s.replace(/\?+$/, '');                                              // "NP?" (an illegible guess from a photo)
  s = s.replace(/_\{[^}]*\}$|_[A-Za-z0-9]+$/, (m) => (/^_bar$/i.test(m) ? m : ''));   // subscripts: NP_i, NP_{ij}
  let level = null;
  let m;
  if ((m = s.match(/^(.*?)(?:\^\{?0\}?|\\zero|⁰)$/))) { s = m[1]; level = 0; }
  else if ((m = s.match(/^(.*?)(?:['′’]|-bar|_bar|\\bar|\^\{?\\prime\}?|\^\{?'\}?)$/i))) { s = m[1]; level = 1; }
  else if ((m = s.match(/^(.*?)(?:\^\{?(?:max|2)\}?)$/))) { s = m[1]; level = 2; }
  const cat = c => ALIAS[c] || c;
  if (level === null) {
    if (CATS.has(s)) return { cat: cat(s), level: 0 };
    if ((m = s.match(/^(.+)P$/)) && CATS.has(m[1])) return { cat: cat(m[1]), level: 2 };
    return { cat: null, level: null };
  }
  if (level === 2 && (m = s.match(/^(.+)P$/)) && CATS.has(m[1])) s = m[1];
  if (!CATS.has(s)) return { cat: null, level: null };
  return { cat: cat(s), level };
}

// ---------------------------------------------------------------- annotating a tree

// Gives every node an id (pre-order, so the same shape always numbers the same), a span of word positions,
// its parsed label, and its parent. Returns { root, nodes (non-word, pre-order), words }.
export function annotate(tree) {
  const nodes = [], words = [];
  let id = 0;
  const walk = (n, parent, insideTri) => {
    n.id = id++;
    n.parent = parent;
    n.insideTri = insideTri;
    if (n.word) { n.span = [words.length, words.length + 1]; words.push(n.label); return; }
    nodes.push(n);
    const start = words.length;
    Object.assign(n, parseLabel(n.label));
    for (const c of n.children) walk(c, n, insideTri || !!n.tri);
    n.span = [start, words.length];
  };
  walk(tree, null, false);
  return { root: tree, nodes, words };
}

const spanKey = n => n.span[0] + '-' + n.span[1];

// Chains: nodes sharing one span (NP > N' > N over "dogs"), top-down, never counting what sits inside a triangle.
function chains(nodes) {
  const map = new Map();
  for (const n of nodes) {
    if (n.insideTri || n.span[0] === n.span[1]) continue;
    const k = spanKey(n);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(n);
  }
  for (const list of map.values()) {                       // a triangle ends its chain: nothing below it counts
    const t = list.findIndex(n => n.tri);
    if (t >= 0) list.truncated = true, list.length = t + 1;
  }
  return map;
}
const parentSpan = list => (list[0].parent ? spanKey(list[0].parent) : 'root');

// ---------------------------------------------------------------- marking

const REASON = {
  'bad-label': n => `“${n.label}” isn't an X-bar label. Use a head (V), an intermediate level (V′) or a phrase (VP).`,
  'no-head': n => n.level === 2
    ? `A ${n.label} needs a head: it must contain a ${n.cat}′ or ${n.cat} (or another ${n.label}) of the same category.`
    : `A ${n.label} needs a ${n.cat}′ or ${n.cat} of the same category inside it.`,
  'head-dominates-phrase': n => `${n.label} is a head, so it sits directly over a word, not over other phrases.`,
  'level-mismatch': () => 'This node is at the wrong level: check whether it should be a head (X), an intermediate level (X′) or a phrase (XP).',
  'missing-level': () => 'A level is missing around here. Check which of XP, X′ and X are needed between the phrase and its head.',
  'extra-level': () => 'There is a level too many here.',
};

function markWellFormed(n, flag) {
  if (n.insideTri) return;
  if (n.level === null) return flag(n, 'bad-label');
  const kids = n.children.filter(c => !c.word);
  if (n.level === 0) { if (kids.length) flag(n, 'head-dominates-phrase'); return; }
  if (n.tri) return;
  // Any daughter of the same category will do here; whether it is at the right level is that daughter's own business,
  // so one wrong node does not turn its mother red as well.
  if (!kids.some(c => c.cat === n.cat)) flag(n, 'no-head');
}

// Compares one chain of the student's tree with the key's chain over the same span.
function compareChain(sc, kc, flag) {
  if (sc.some(n => n.level === null)) return;               // already flagged as a bad label
  if (parentSpan(sc) !== parentSpan(kc)) return;            // the attachment differs: that is another skill, so say nothing here
  const trunc = sc.truncated || kc.truncated;
  if (trunc) {
    const L = Math.min(sc.length, kc.length);
    for (let i = 0; i < L; i++) if (sc[i].level !== kc[i].level) return void flag(sc[i], 'level-mismatch');
    return;
  }
  const sl = sc.map(n => n.level), kl = kc.map(n => n.level);
  if (sl.length === kl.length && sl.every((l, i) => l === kl[i])) return;
  const firstUnmatched = (small, big) => { let j = 0; const miss = []; for (let i = 0; i < big.length; i++) { if (j < small.length && small[j] === big[i]) j++; else miss.push(i); } return j === small.length ? miss : null; };
  if (sl.length < kl.length) {
    const miss = firstUnmatched(sl, kl);
    if (miss) return void flag(sc[Math.min(Math.max(miss[0] - 1, 0), sc.length - 1)], 'missing-level');
  } else if (sl.length > kl.length) {
    const extra = firstUnmatched(kl, sl);
    if (extra) return void flag(sc[extra[0]], 'extra-level');
  }
  const i = sl.findIndex((l, i) => l !== kl[i]);
  flag(sc[Math.max(i, 0)], 'level-mismatch');
}

function markAgainst(student, key) {
  const marks = new Map();                                  // student node id -> [reason codes]
  const flag = (n, code) => { const a = marks.get(n.id) || []; if (!a.includes(code)) a.push(code); marks.set(n.id, a); };
  for (const n of student.nodes) markWellFormed(n, flag);
  const sc = chains(student.nodes), kc = chains(key.nodes);
  for (const [k, list] of sc) if (kc.has(k)) compareChain(list, kc.get(k), flag);
  return marks;
}

const norm = w => String(w).toLowerCase();
const asTree = t => (typeof t === 'string' ? parseBracket(t) : t);

// mark(student, keys): student is a bracketing or a tree; keys is one key or an array of acceptable keys.
// Returns { wordsMatch, keyIndex, nodes: [{ id, label, span, status, reasons: [{ code, message }] }],
//           skills: { 'heads-projection': { pass, wrongNodeIds } } }
export function mark(student, keys) {
  const s = annotate(asTree(student));
  const ks = (Array.isArray(keys) ? keys : [keys]).map(k => annotate(asTree(k)));
  const same = k => k.words.length === s.words.length && k.words.every((w, i) => norm(w) === norm(s.words[i]));
  const candidates = ks.map((k, i) => ({ k, i })).filter(({ k }) => same(k));
  if (!candidates.length) {
    return { wordsMatch: false, keyIndex: -1, nodes: [], skills: { 'heads-projection': { pass: false, wrongNodeIds: [] } } };
  }
  let best = null;
  for (const { k, i } of candidates) {
    const marks = markAgainst(s, k);
    if (!best || marks.size < best.marks.size) best = { marks, i };
  }
  const nodes = s.nodes.map(n => {
    const codes = best.marks.get(n.id) || [];
    return {
      id: n.id, label: n.label, span: n.span, status: codes.length ? 'wrong' : 'ok',
      reasons: codes.map(code => ({ code, message: REASON[code](n) })),
    };
  });
  const wrongNodeIds = nodes.filter(n => n.status === 'wrong').map(n => n.id);
  return { wordsMatch: true, keyIndex: best.i, nodes, skills: { 'heads-projection': { pass: !wrongNodeIds.length, wrongNodeIds } } };
}
