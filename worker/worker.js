// Tree studio: photo -> labelled bracketing (default), or photo -> glossed examples (mode: 'gloss').
// A tiny Cloudflare Worker that holds the Anthropic API key so students don't need one.
// It accepts one JPEG/PNG/WebP photo, asks a vision model to read the drawn tree, and returns the bracketing text.
// Nothing is stored; photos are forwarded to the model provider and discarded.

const MAX_B64 = 4_000_000;                       // ~3 MB of image after base64
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const PROMPT = `You are reading a photo of a hand-drawn linguistics syntax tree. Reply with the tree as a labelled bracketing and NOTHING else (no explanation, no code fence).

Format:
- Each node is [Label child child ...]. A word at the bottom is plain text: [N dog]. The whole tree is one outer bracket.
- Copy labels exactly as drawn (S, NP, T', VP, DP, CP, etc.). Do not correct the analysis or add nodes that are not drawn.
- Subscripts: NP_i, NP_{ij}. Superscripts: T^0, XP^{max}. Primes: V'.
- A label or word with a space in it goes in braces: {the dog}.
- A triangle over a phrase means the words under it are not analysed further: write \\roof as the first thing after the label, then the words: [NP \\roof the mat].
- A crossed-out item (e.g. a trace or deleted copy) is written \\sout{t}.
- Movement arrows (curved lines with an arrowhead, from a trace or lower position up to where the item moved to) are NOT written in the brackets. List each one on its own line AFTER the tree: @arrow FROM -> TO
  FROM is where the arrow starts (the tail, usually the trace), TO is the node it points to (the arrowhead). Name each end exactly as written in your brackets: a category label or a word, e.g. t_i or DP_i.
  If that exact text appears more than once, add #n for which occurrence it is, counting left to right through your brackets: @arrow t#2 -> NP#1
  Only list arrows you can actually see. Ignore any other text outside the tree.
- If a label is illegible, write your best guess followed by ?.

Example without arrows: [S [NP [Det the] [N cat]] [VP [V sat] [PP [P on] [NP \\roof the mat]]]]

Example with arrows:
[CP [DP_i what] [C' [C did_j] [TP [DP John] [T' [T t_j] [VP [V buy] [DP t_i]]]]]]
@arrow t_j -> did_j
@arrow t_i -> DP_i

If the image does not contain a syntax tree, reply exactly: NOTREE`;

const GLOSS_PROMPT = `You are reading a photo of interlinear glossed examples from linguistics: an example line in some language, a word-by-word gloss line under it, and usually a free translation. Reply with JSON and NOTHING else (no explanation, no code fence), in exactly this shape:
{"examples":[{"src":"...","gloss":"...","trans":"..."}]}

Rules:
- One entry per glossed example, in reading order. Sub-examples (a, b, c) are separate entries. Ignore example numbers and letters, language names, and citations.
- "src" is the example line. Separate words with single spaces. Keep every hyphen, equals sign, dot and tilde exactly as written. Transcribe special characters faithfully (IPA symbols, diacritics, tone marks).
- "gloss" is the gloss line, ONE item for each word of "src", separated by single spaces, so the two lines have the same number of space-separated items. If one gloss item is several words (for example 'the dog'), join them in braces: {the dog}. Keep grammatical labels in capitals exactly as written (3SG, PST, NOM.SG).
- If a word of the example is also a multi-word unit that you had to keep together, put it in braces too: {word one}.
- "trans" is the free translation without its quotation marks. Use "" if there is none.
- If the example has an extra line (for example a native script line above a transcription), use the line that is glossed word-by-word as "src" and ignore the other.
- If something is illegible, write your best guess followed by ?.
- If the image contains no glossed example, reply exactly: {"examples":[]}`;

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const ok = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': ok ? origin : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
    if (!ok) return json({ error: 'Not allowed from this site' }, 403);

    // per-visitor rate limit (see the [[unsafe.bindings]] / ratelimits block in wrangler.toml)
    if (env.LIMITER) {
      const ip = req.headers.get('CF-Connecting-IP') || 'anon';
      const { success } = await env.LIMITER.limit({ key: ip });
      if (!success) return json({ error: 'Too many photos just now. Wait a minute and try again.' }, 429);
    }

    let body;
    try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
    const { image, media_type, mode } = body || {};
    const gloss = mode === 'gloss';
    if (typeof image !== 'string' || !TYPES.includes(media_type)) return json({ error: 'Send a JPEG, PNG or WebP image' }, 400);
    if (image.length > MAX_B64) return json({ error: 'That photo is too large' }, 413);
    if (!/^[A-Za-z0-9+/=]+$/.test(image)) return json({ error: 'Bad image data' }, 400);

    let r;
    try {
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({
          model: env.MODEL || 'claude-sonnet-5-5',
          max_tokens: gloss ? 3000 : 1500,
          messages: [{ role: 'user', content: [
            { type: 'image', source: { type: 'base64', media_type, data: image } },
            { type: 'text', text: gloss ? GLOSS_PROMPT : PROMPT },
          ] }],
        }),
      });
    } catch { return json({ error: 'Could not reach the reading service' }, 502); }
    if (!r.ok) return json({ error: 'The reading service had a problem. Try again in a moment.' }, 502);

    const data = await r.json();
    let text = ((data.content || []).find(c => c.type === 'text') || {}).text || '';
    text = text.trim().replace(/^```[a-z]*\n?|\n?```$/g, '').trim();
    if (gloss) {
      let parsed;
      try { parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)); } catch { parsed = null; }
      const clean = v => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, 400) : '');
      const examples = ((parsed && Array.isArray(parsed.examples)) ? parsed.examples : []).slice(0, 12)
        .map(e => ({ src: clean(e && e.src), gloss: clean(e && e.gloss), trans: clean(e && e.trans) }))
        .filter(e => e.src || e.gloss);
      if (!examples.length) return json({ error: 'No glossed examples found in that photo. Try a clearer, well-lit shot.' }, 422);
      return json({ examples });
    }
    // "@arrow FROM -> TO" lines are pulled out of the bracketing and returned separately
    const arrows = [];
    text = text.replace(/@arrow\s+([^\n@]+?)\s*(?:->|→|=>)\s*([^\n@]+?)[ \t]*(?=@arrow|\n|$)/g, (_, f, t) => { if (arrows.length < 12) arrows.push([f.trim(), t.trim()]); return ''; });
    text = text.trim();
    if (text === 'NOTREE' || !text.startsWith('[')) return json({ error: 'No tree found in that photo. Try a clearer, well-lit shot.' }, 422);
    return json({ tree: text, arrows });
  },
};
