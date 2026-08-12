import { cp, mkdir, writeFile } from 'node:fs/promises';

await mkdir('dist/server', { recursive: true });
await mkdir('dist/.openai', { recursive: true });
await mkdir('dist/.openai/drizzle', { recursive: true });
await writeFile(
  'dist/server/index.js',
  `const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
export default { async fetch(request, env) {
  const url = new URL(request.url);
  if (url.pathname !== "/api/presence") return env.ASSETS.fetch(request);
  if (!env.DB) return json({ active: 1 });
  const now = Date.now();
  const activeCutoff = now - 70000;
  const purgeCutoff = now - 86400000;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS active_presence (session_id TEXT PRIMARY KEY, station_id TEXT NOT NULL, last_seen INTEGER NOT NULL)").run();
  await env.DB.prepare("DELETE FROM active_presence WHERE last_seen < ?").bind(purgeCutoff).run();
  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!/^[a-z0-9-]{8,80}$/i.test(body.sessionId || "") || !/^[a-z0-9-]{2,40}$/i.test(body.stationId || "")) return json({ error: "invalid presence" }, 400);
    if (body.active === false) await env.DB.prepare("DELETE FROM active_presence WHERE session_id = ?").bind(body.sessionId).run();
    else await env.DB.prepare("INSERT INTO active_presence (session_id, station_id, last_seen) VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET station_id = excluded.station_id, last_seen = excluded.last_seen").bind(body.sessionId, body.stationId, now).run();
  }
  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM active_presence WHERE last_seen >= ?").bind(activeCutoff).first();
  return json({ active: Number(row?.count || 0) });
} };\n`,
);
await cp('.openai/hosting.json', 'dist/.openai/hosting.json');
await cp('.openai/drizzle', 'dist/.openai/drizzle', { recursive: true });
