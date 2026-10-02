// The Worker creates its own tables: on the first request of each isolate it
// applies whatever file in migrations/ is not applied yet (each in one batch,
// so all or nothing). Files applied with `wrangler d1 migrations apply` count.
import m0001 from '../migrations/0001_init.sql'
import m0002 from '../migrations/0002_scripts.sql'

const MIGRATIONS: [name: string, sql: string][] = [
  ['0001_init.sql', m0001],
  ['0002_scripts.sql', m0002],
]

let ready: Promise<void> | null = null

export function ensureSchema(db: D1Database): Promise<void> {
  // a failed attempt (two isolates racing on a fresh database) is retried by the next request
  ready ??= migrate(db).catch((e) => { ready = null; throw e })
  return ready
}

async function migrate(db: D1Database) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS stats_migrations (
    name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT (datetime('now')))`).run()
  const done = new Set((await db.prepare('SELECT name FROM stats_migrations').all<{ name: string }>()).results.map((r) => r.name))
  if (await db.prepare(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'd1_migrations'`).first())
    for (const r of (await db.prepare('SELECT name FROM d1_migrations').all<{ name: string }>()).results) done.add(r.name)
  for (const [name, sql] of MIGRATIONS) {
    if (done.has(name)) continue
    await db.batch([
      ...statements(sql).map((s) => db.prepare(s)),
      db.prepare('INSERT OR IGNORE INTO stats_migrations (name) VALUES (?)').bind(name),
    ])
  }
}

/** The statements of a migration file (comments dropped; they hold no ';' or '--' inside strings). */
function statements(sql: string): string[] {
  return sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean)
}
