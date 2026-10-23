// Cloudflare Pages Function: POST /api/log
// Stores one anonymous game answer in the D1 database bound as `DB` (see schema.sql and README).
// If no database is bound, requests are accepted and discarded, so the game keeps working.
const CONDS = new Set(['C0', 'C1', 'C2', 'C3', 'C4', 'C5', 'C6']);

export async function onRequestPost({ request, env }) {
  if (!env.DB) return new Response(null, { status: 204 });
  let b;
  try {
    const text = await request.text();
    if (text.length > 2000) return new Response('too large', { status: 413 });
    b = JSON.parse(text);
  } catch (e) {
    return new Response('bad json', { status: 400 });
  }
  const str = (v, n) => (typeof v === 'string' ? v.slice(0, n) : '');
  const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
  const row = {
    sid: str(b.sid, 40), mode: str(b.mode, 20), round: int(b.round, 0, 99), t: str(b.t, 10), q: str(b.q, 40),
    c: CONDS.has(b.c) ? b.c : null, choice: int(b.choice, -1, 5), answer: int(b.answer, 0, 5),
    correct: int(b.correct, 0, 1), rt_ms: int(b.rt_ms, 0, 600000), gal: int(b.gal, 0, 5), terr: int(b.terr, 0, 5),
    v: int(b.v, 0, 1000) ?? 1,
  };
  if (!row.sid || !row.q || row.c === null || row.choice === null || row.answer === null || row.correct === null) {
    return new Response('invalid', { status: 400 });
  }
  await env.DB.prepare(
    `INSERT INTO answers (ts, sid, mode, round, terrain, query, cond, choice, answer, correct, rt_ms, ai_gal, ai_terr, version)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(new Date().toISOString(), row.sid, row.mode, row.round, row.t, row.q, row.c, row.choice, row.answer,
         row.correct, row.rt_ms, row.gal, row.terr, row.v).run();
  return new Response(null, { status: 204 });
}

export async function onRequest() {
  return new Response('method not allowed', { status: 405, headers: { Allow: 'POST' } });
}
