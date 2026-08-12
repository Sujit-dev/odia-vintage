const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  },
});

const indiaDay = (date = new Date()) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kolkata",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(date);

export async function onRequest({ request, env }) {
  if (!env.DB) return json({ error: "Presence database is unavailable" }, 503);
  if (!["GET", "POST"].includes(request.method)) return json({ error: "Method not allowed" }, 405);

  const now = Date.now();
  const activeCutoff = now - 70000;
  const purgeCutoff = now - 86400000;

  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS active_presence (session_id TEXT PRIMARY KEY, station_id TEXT NOT NULL, last_seen INTEGER NOT NULL)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS daily_presence_peak (day TEXT PRIMARY KEY, peak INTEGER NOT NULL, updated_at INTEGER NOT NULL)"),
    env.DB.prepare("DELETE FROM active_presence WHERE last_seen < ?").bind(purgeCutoff),
  ]);

  if (request.method === "POST") {
    const body = await request.json().catch(() => ({}));
    if (!/^[a-z0-9-]{8,80}$/i.test(body.sessionId || "") || !/^[a-z0-9-]{2,40}$/i.test(body.stationId || "")) {
      return json({ error: "Invalid presence payload" }, 400);
    }
    if (body.active === false) {
      await env.DB.prepare("DELETE FROM active_presence WHERE session_id = ?").bind(body.sessionId).run();
    } else {
      await env.DB.prepare("INSERT INTO active_presence (session_id, station_id, last_seen) VALUES (?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET station_id = excluded.station_id, last_seen = excluded.last_seen")
        .bind(body.sessionId, body.stationId, now).run();
    }
  }

  const row = await env.DB.prepare("SELECT COUNT(*) AS count FROM active_presence WHERE last_seen >= ?").bind(activeCutoff).first();
  const active = Number(row?.count || 0);
  const day = indiaDay();
  await env.DB.prepare("INSERT INTO daily_presence_peak (day, peak, updated_at) VALUES (?, ?, ?) ON CONFLICT(day) DO UPDATE SET peak = MAX(peak, excluded.peak), updated_at = excluded.updated_at")
    .bind(day, active, now).run();
  const peakRow = await env.DB.prepare("SELECT peak FROM daily_presence_peak WHERE day = ?").bind(day).first();

  return json({ active, peakToday: Number(peakRow?.peak || active), day, timezone: "Asia/Kolkata" });
}
