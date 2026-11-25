import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mark, parseLabel, parseBracket } from '../marking.js';

const SKILL = 'heads-projection';
const pass = (student, keys) => mark(student, keys).skills[SKILL].pass;
const wrong = (student, keys) => mark(student, keys).nodes.filter(n => n.status === 'wrong');
const codes = (student, keys) => wrong(student, keys).flatMap(n => n.reasons.map(r => r.code));

// "Pat will sleep"
const SLEEP = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V' [V sleep]]]]]";
// "Pat will see dogs"
const SEE = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V' [V see] [NP [N' [N dogs]]]]]]]";
// "Pat will see dogs in parks", PP attached to the verb
const PP_V = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V' [V' [V see] [NP [N' [N dogs]]]] [PP [P' [P in] [NP [N' [N parks]]]]]]]]]";
// the same words, PP attached to the noun
const PP_N = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V' [V see] [NP [N' [N' [N dogs]] [PP [P' [P in] [NP [N' [N parks]]]]]]]]]]]";

test('labels: heads, bars and phrases', () => {
  assert.deepEqual(parseLabel('V'), { cat: 'V', level: 0 });
  assert.deepEqual(parseLabel("V'"), { cat: 'V', level: 1 });
  assert.deepEqual(parseLabel('V′'), { cat: 'V', level: 1 });
  assert.deepEqual(parseLabel('V-bar'), { cat: 'V', level: 1 });
  assert.deepEqual(parseLabel('V^0'), { cat: 'V', level: 0 });
  assert.deepEqual(parseLabel('V^{0}'), { cat: 'V', level: 0 });
  assert.deepEqual(parseLabel('VP'), { cat: 'V', level: 2 });
  assert.deepEqual(parseLabel('PP'), { cat: 'P', level: 2 });
  assert.deepEqual(parseLabel('P'), { cat: 'P', level: 0 });
  assert.deepEqual(parseLabel('AdvP'), { cat: 'Adv', level: 2 });
  assert.deepEqual(parseLabel('NP_i'), { cat: 'N', level: 2 });
  assert.deepEqual(parseLabel('NP_{ij}'), { cat: 'N', level: 2 });
  assert.deepEqual(parseLabel('NP?'), { cat: 'N', level: 2 });
  assert.deepEqual(parseLabel('IP'), { cat: 'I', level: 2 });
  assert.equal(parseLabel('S').level, null);
  assert.equal(parseLabel('Sentence').level, null);
  assert.equal(parseLabel('').level, null);
});

test('a correct tree passes and nothing is red', () => {
  for (const t of [SLEEP, SEE, PP_V, PP_N]) {
    assert.equal(pass(t, t), true);
    assert.deepEqual(wrong(t, t), []);
  }
});

test('notation variants of the same tree still pass', () => {
  const alt = "[IP [NP [N′ [N^0 Pat]]] [I-bar [I will] [VP [V′ [V sleep]]]]]";
  assert.equal(pass(alt, SLEEP), true);
  assert.equal(pass("[IP [NP_i [N' [N Pat]]] [I' [I will] [VP [V' [V sleep]]]]]", SLEEP), true);
});

test('word case is ignored, but different words are not marked', () => {
  assert.equal(pass(SLEEP.replace('Pat', 'pat'), SLEEP), true);
  const r = mark(SLEEP.replace('sleep', 'run'), SLEEP);
  assert.equal(r.wordsMatch, false);
  assert.equal(r.skills[SKILL].pass, false);
});

test('a head labelled as a phrase is flagged at that node', () => {
  const s = "[IP [NP [N' [NP Pat]]] [I' [I will] [VP [V' [V sleep]]]]]";
  const w = wrong(s, SLEEP);
  assert.deepEqual(w.map(n => n.label), ['NP']);                  // only the node itself, not its mother N'
  assert.ok(w[0].reasons.some(r => r.code === 'level-mismatch'));
});

test('a head over another phrase is flagged', () => {
  const s = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V' [V [V sleep]]]]]]";
  assert.ok(codes(s, SLEEP).includes('head-dominates-phrase'));
});

test('a phrase labelled as a head is flagged as the wrong level', () => {
  const s = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V' [VP sleep]]]]]";
  assert.deepEqual(wrong(s, SLEEP).map(n => n.label), ['VP']);
  assert.ok(codes(s, SLEEP).includes('level-mismatch'));
});

test("a missing X' level is reported", () => {
  const s = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V sleep]]]]";          // VP straight over V
  const r = mark(s, SLEEP);
  assert.equal(r.skills[SKILL].pass, false);
  assert.deepEqual(codes(s, SLEEP), ['missing-level']);
});

test("a missing X' between VP and its daughters is reported", () => {
  const s = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V see] [NP [N' [N dogs]]]]]]";
  assert.deepEqual(codes(s, SEE), ['missing-level']);
  assert.equal(pass(s, SEE), false);
});

test('a missing NP layer over a noun is reported', () => {
  const s = "[IP [N' [N Pat]] [I' [I will] [VP [V' [V sleep]]]]]";
  assert.equal(pass(s, SLEEP), false);
  assert.ok(codes(s, SLEEP).includes('missing-level'));
});

test('an extra level is reported', () => {
  const s = "[IP [NP [N' [N' [N Pat]]]] [I' [I will] [VP [V' [V sleep]]]]]";
  assert.deepEqual(codes(s, SLEEP), ['extra-level']);
});

test('a phrase with no head of its own category is flagged', () => {
  const s = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [N' [N sleep]]]]]";     // VP over an N'
  assert.ok(codes(s, SLEEP).includes('no-head'));
  assert.equal(pass(s, SLEEP), false);
});

test('an X-bar level over the wrong category is flagged', () => {
  const s = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V' [N sleep]]]]]";     // V' over an N
  assert.ok(codes(s, SLEEP).includes('no-head'));
});

test('labels that are not X-bar labels are flagged', () => {
  const s = "[S [NP [N' [N Pat]]] [I' [I will] [VP [V' [V sleep]]]]]";
  const w = wrong(s, SLEEP);
  assert.deepEqual(w.map(n => n.label), ['S']);
  assert.deepEqual(w[0].reasons.map(r => r.code), ['bad-label']);
});

test('a level error leaves the other nodes green', () => {
  const s = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V sleep]]]]";
  const r = mark(s, SLEEP);
  assert.deepEqual(r.nodes.filter(n => n.status === 'wrong').map(n => n.label), ['VP']);
  assert.equal(r.nodes.filter(n => n.status === 'ok').length, r.nodes.length - 1);
});

test('wrong attachment alone does not fail this skill', () => {
  assert.equal(pass(PP_N, PP_V), true);        // the PP sits on the noun but the levels are all sound
  assert.equal(pass(PP_V, PP_N), true);
});

test('wrong attachment with a level error still fails, and flags the level error', () => {
  const s = PP_N.replace("[P in] [NP [N' [N parks]]]", "[P in] [N' [N parks]]");   // PP on the noun, and no NP over parks
  const r = mark(s, PP_V);
  assert.equal(r.skills[SKILL].pass, false);
  assert.deepEqual(r.nodes.filter(n => n.status === 'wrong').map(n => n.label), ["N'"]);
  assert.deepEqual(codes(s, PP_V), ['missing-level']);
});

test('triangles: a collapsed phrase is accepted where the key spells it out', () => {
  const s = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V' [V see] [NP \\roof dogs]]]]]";
  assert.equal(pass(s, SEE), true);
});

test('triangles: a key triangle accepts an expanded student phrase', () => {
  const key = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V' [V see] [NP \\roof dogs]]]]]";
  assert.equal(pass(SEE, key), true);
});

test('a triangle on the wrong level is flagged', () => {
  const s = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V' [V see] [N' \\roof dogs]]]]]";
  assert.equal(pass(s, SEE), false);
});

test('several acceptable keys: feedback comes from the closest one', () => {
  const flat = "[IP [NP [N' [N Pat]]] [I' [I will] [VP [V sleep]]]]";
  const r = mark(flat, [SLEEP, flat]);
  assert.equal(r.skills[SKILL].pass, true);
  assert.equal(r.keyIndex, 1);
  const r2 = mark(SLEEP, [flat, SLEEP]);
  assert.equal(r2.keyIndex, 1);
});

test('nodes come back in pre-order with the ids of the tree they were read from', () => {
  const r = mark(SLEEP, SLEEP);
  assert.deepEqual(r.nodes.map(n => n.label), ['IP', 'NP', "N'", 'N', "I'", 'I', 'VP', "V'", 'V']);
  assert.deepEqual(r.nodes.map(n => n.span), [[0, 3], [0, 1], [0, 1], [0, 1], [1, 3], [1, 2], [2, 3], [2, 3], [2, 3]]);
  assert.equal(new Set(r.nodes.map(n => n.id)).size, r.nodes.length);
});

test('parseBracket reports unbalanced brackets', () => {
  assert.throws(() => parseBracket('[IP [NP dogs]'), /never closed/);
  assert.throws(() => parseBracket('IP'), /starts with/);
});
