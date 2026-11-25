// A small panel to try out marking in the tree editor (skill 1: heads and projection).
// It loads only if the browser can import modules (not from file://), and shows its button only then.
import { mark } from './marking.js';

const TS = window.TreeStudio && window.TreeStudio.marking;
const btn = document.getElementById('btn-mark-demo');

const SENTENCES = [
  { text: 'Pat will sleep', words: ['Pat', 'will', 'sleep'],
    key: "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V' [V sleep]]]]]",
    flawed: "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V sleep]]]]" },
  { text: 'Pat will see dogs', words: ['Pat', 'will', 'see', 'dogs'],
    key: "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V' [V see] [NP [N' [N dogs]]]]]]]",
    flawed: "[IP [NP [N Pat]] [I' [I will] [VP [V' [V see] [NP [N' [N dogs]]]]]]]" },
  { text: 'Pat will see dogs in parks', words: ['Pat', 'will', 'see', 'dogs', 'in', 'parks'],
    key: "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V' [V' [V see] [NP [N' [N dogs]]]] [PP [P' [P in] [NP [N' [N parks]]]]]]]]]",
    flawed: "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V' [V see] [NP [N' [N' [N dogs]] [PP [P in] [NP [N' [N parks]]]]]]]]]]" },
];

if (TS && btn) {
  btn.hidden = false;
  let panel = null, cur = SENTENCES[0], attempts = 0, passedAt = 0;

  const el = (tag, attrs, parent, text) => {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) e[k] = v;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  };

  const build = () => {
    panel = el('div', { id: 'mark-demo', role: 'dialog', ariaLabel: 'Marking demo' }, document.body);
    el('button', { className: 'x', title: 'Close', ariaLabel: 'Close' }, panel, '×').onclick = () => { panel.hidden = true; TS.setMarks(null); };
    const mn = el('button', { className: 'mn', title: 'Shrink or grow this box', ariaLabel: 'Shrink or grow' }, panel, '▾');
    const setMin = on => { panel.classList.toggle('min', on); mn.textContent = on ? '▴' : '▾'; };
    mn.onclick = () => setMin(!panel.classList.contains('min'));
    const narrow = () => window.matchMedia('(max-width: 900px)').matches;
    el('h3', {}, panel, 'Marking demo');
    el('div', { className: 'sub' }, panel, 'Skill 1: heads and projection. Build the tree, then Check.');
    const sel = el('select', {}, panel);
    SENTENCES.forEach((s, i) => el('option', { value: i }, sel, s.text));
    const sent = el('div', { className: 'sent' }, panel, cur.text);
    const row = el('div', { className: 'row' }, panel);
    const start = el('button', {}, row, 'Start: just the words');
    const flawed = el('button', {}, row, 'Load a flawed attempt');
    const row2 = el('div', { className: 'row act' }, panel);
    const check = el('button', { className: 'go' }, row2, 'Check');
    const answer = el('button', {}, row2, 'Show a correct tree');
    const res = el('div', { className: 'res' }, panel);
    res.hidden = true;

    const reset = () => { attempts = 0; passedAt = 0; res.hidden = true; TS.setMarks(null); };
    sel.onchange = () => { cur = SENTENCES[+sel.value]; sent.textContent = cur.text; reset(); };
    // on a phone the box shrinks out of the way once the tree is on the page, and grows again to show the result
    start.onclick = () => { reset(); TS.startWords(cur.words); if (narrow()) setMin(true); };
    flawed.onclick = () => { reset(); TS.loadBracket(cur.flawed); if (narrow()) setMin(true); };
    answer.onclick = () => { reset(); TS.loadBracket(cur.key); if (narrow()) setMin(true); };

    check.onclick = () => {
      res.hidden = false; res.className = 'res'; res.textContent = '';
      if (narrow()) setMin(false);
      const trees = TS.trees();
      if (!trees.length) { res.textContent = 'Nothing on the page yet. Press “Start: just the words”.'; return; }
      if (trees.length > 1) { res.textContent = `There are ${trees.length} separate pieces on the page. Join everything into one tree first.`; return; }
      let r;
      try { r = mark(trees[0], cur.key); } catch (e) { res.textContent = 'Could not read that tree.'; return; }
      if (!r.wordsMatch) { res.textContent = `The words in your tree are not “${cur.text}”. Keep the words as given.`; TS.setMarks(null); return; }
      attempts++;
      const m = new Map();
      for (const n of r.nodes) m.set(n.ref, n.status);
      TS.setMarks(m);
      const skill = r.skills['heads-projection'];
      const head = el('div', {}, res);
      if (skill.pass) {
        res.className = 'res pass';
        if (!passedAt) passedAt = attempts;
        el('b', {}, head, '✓ Heads and projection: passed');
        if (passedAt === 1) el('b', { className: 'badge' }, head, '★ clean pass, first try');
        else el('div', {}, res, `Passed on check ${passedAt}. A pass stays passed.`);
      } else {
        res.className = 'res fail';
        el('b', {}, head, `Not yet. ${skill.wrongNodeIds.length === 1 ? '1 node needs' : skill.wrongNodeIds.length + ' nodes need'} another look (shown in red).`);
        const ul = el('ul', {}, res);
        for (const n of r.nodes.filter(x => x.status === 'wrong')) {
          const li = el('li', {}, ul);
          el('span', { className: 'lab' }, li, n.label + ': ');
          li.appendChild(document.createTextNode(n.reasons.map(x => x.message).join(' ')));
        }
        el('div', { className: 'sub' }, res, 'Fix it and press Check again. Editing clears the red.');
      }
      el('div', { className: 'sub' }, res, `Check ${attempts}`);
    };
  };

  btn.addEventListener('click', () => {
    if (!panel) build(); else { panel.hidden = !panel.hidden; if (panel.hidden) TS.setMarks(null); }
  });
}
