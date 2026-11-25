# Plan: skill-based marking of students' trees

Students are given a sentence and draw its X-bar tree, either in the page or from a photo. They get immediate red/green feedback, fix it, and resubmit.
Grading is **pass/fail per skill**, not per tree. The aim is that every student passes every skill.

## Design decisions

1. **Compare constituents, not whole trees.** Each node becomes `(span of words it covers, label)` and is diffed against the key.
   - Right span, wrong label: the label goes red.
   - Span not in the key: the node and its branch go red (wrong attachment or grouping).
   - Key constituent missing: a vague hint ("something is missing around *the cat*"), never the answer.
   - Chains of nodes over one span (NP > N' > N) are compared as label sequences.
2. **The sentence's words are fixed leaves.** The student builds structure over them, so a misread photo is never mistaken for a student error.
3. **Photos are confirmed before marking.** Photo -> bracketing -> editor -> the student fixes misreads -> Check. The sentence is passed to the photo reader to help it.
4. **Keys.** The teacher draws the key in the same editor. Alternate keys are allowed (e.g. flat vs binary); feedback is given against the closest one. Strictness options per assignment (ignore subscripts, accept triangles, etc.).
5. **Each key node is tagged with the skill it tests.** Defaults are inferred from node shape; the teacher can override. Error classification is rule-based and deterministic, never an LLM.
6. **Exercises come from a grammar** (small CFG plus lexicon), so keys are correct by construction. An LLM may write explanations, but never keys on the grading path.
7. **Marking moves server-side once there are accounts**, so the key never reaches the browser. Until then it is practice mode and the key is in the assignment file.

## Skills (X-bar)

1. Heads and projection: X0, X' and XP levels; every phrase has a head
2. Category labelling: N/V/A/P/Adv and their phrases
3. Complements: sister of X0 is an XP, under X'
4. Adjuncts: adjoin to X' or XP, recursive
5. Specifiers: Spec-XP, e.g. the subject in Spec-TP
6. PP attachment: noun-modifying vs verb-modifying
7. Inflection: I/T and the IP/TP structure
8. Clauses: CP, complementizers, embedded clauses
9. Determiners: DP vs NP
10. Binary branching
11. Movement and traces

(Coordination is deliberately left out.)

## How a skill is passed

- A skill is **passed for good**; a later error never takes it away.
- Default rule: **correct on N independent items** (N = 2 or 3, set by the teacher), each a different sentence.
- An item is evidence for a skill if every key node tagged with that skill is right in the final tree. A corrected retry counts.
- The first-try result is recorded separately and gives an optional "clean pass" badge. It never decides pass/fail.
- A student short of N for a skill gets more generated items for it.

## Build order

| Phase | What | Done when |
|---|---|---|
| 1. Marking engine | Pure ES module `marking.js`, no DOM: label normalisation (V' / V-bar, `^0`, case, subscripts), constituents, diff, skill tagging, per-skill result. Tests with `node --test`. | About 30 student-vs-key fixtures, grouped by skill, pass. |
| 2. Practice mode UI | A **Marking** tab (like Glosses). Locked words, Check button, `paintTree` gets a node-status map for red/green, retry loop. Assignment = JSON file or link. Teacher "save as answer key" button. | A student can open an assignment, get red feedback, fix it, and finish. |
| 3. Skill ledger | Per-skill progress and pass rule ("Complements: 1 of 3"), immutable first-try record, clean-pass badge. A `Store` interface over `localStorage` so the server can replace it later. | Pass rule unit-tested, including skills passing on the same tree. |
| 4. Photo path | Worker accepts the known sentence; confirm step before Check. | A photo reaches the same feedback screen. |
| 5. Exercise generator | Grammar-based items per skill driving the ledger; optional LLM explanations. | Every generated key passes the marking engine. |
| 6. Accounts and classes | Worker + D1; class join codes; teacher grid of students x skills (pass / in progress / not started); server-side marking. | Teacher and student can run an assignment end to end. |
| 7. Polish and privacy | Accessibility (a second cue besides red), mobile, README/About data-handling statement (the README currently says nothing is stored on a server). | |

## Open questions

- Is "correct on N items" the right pass rule, or should it be a fixed set of required trees?
- Sample sentences, keys and typical student mistakes, to use as test fixtures.
- The "tree sandbox" page in the other repo isn't attached to this session; attach it if its red-highlight behaviour should be matched.
