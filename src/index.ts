// Install stats: the daily runs of one-line install scripts
// (`bash <(curl -sL https://example.com/tool)`), for any project. A script has
// a name and the URL it is served from; a request for it is answered with a
// redirect to that URL, and on the way a run is counted for its day, country
// and client. A script is reached two ways:
//   - at https://<this Worker's host>/<name>: a link to hand out, or the
//     target of an existing short domain's redirect rule (no route needed);
//   - on a hostname of its own, which a Worker route sends here.
// What is counted (the scripts, Docker Hub repositories, the time zone a day
// is counted in) is set on the stats page, behind the ADMIN_PASSWORD secret,
// and kept in D1.
//
// What a run is: a GET of the script by curl or wget, the way the scripts are
// run — browsers and crawlers are counted apart. Unique servers per day come
// from a hash of the address with a salt that changes every day and is deleted
// at its end, together with the hashes: no address is kept, nor anything that
// could be matched to one later.
//
// Scripts belong to projects: the one named, or else the GitHub repository
// each is served from. The public badges give a project's runs as one number;
// the details are for the stats page.
import { ensureSchema } from './schema'
import { APP_CSS, APP_JS, PAGE_HTML } from './page'

export type Env = {
  DB: D1Database
  ADMIN_PASSWORD?: string
}

type Script = { name: string; url: string; project: string; hosts: string[] }
type Config = { scripts: Script[]; timezone: string; dockerRepos: string[] }

const SESSION_DAYS = 30
const MAX_DAYS = 365
const MAX_SCRIPTS = 200
const MAX_REPOS = 20
// how long an isolate trusts the configuration it read (a change made on the
// stats page is seen by the isolate that made it at once, by others after this)
const CONFIG_TTL_MS = 30_000
// the stats page's own paths: no script is named so
const RESERVED = new Set(['api', 'badge', 'app.js', 'app.css', 'favicon.ico', 'robots.txt'])
const NAME = /^[a-z0-9][a-z0-9._-]{0,63}$/
const HOST = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const PROJECT = /^[\w.-]{1,64}$/
const REPO = /^[\w.-]{1,64}\/[\w.-]{1,64}$/

// ── configuration (D1) ───────────────────────────────────────────────────────
let cfgCache: { at: number; cfg: Config } | null = null

/** the configuration; fresh: read it now, whatever this isolate read before */
async function config(env: Env, fresh = false): Promise<Config> {
  if (!fresh && cfgCache && Date.now() - cfgCache.at < CONFIG_TTL_MS) return cfgCache.cfg
  try {
    await ensureSchema(env.DB)
    const [rows, settings] = (await env.DB.batch([
      env.DB.prepare('SELECT name, url, project, hosts FROM scripts ORDER BY pos, name'),
      env.DB.prepare('SELECT key, value FROM settings'),
    ])).map((r) => r.results as Record<string, string>[])
    const s = Object.fromEntries(settings.map((r) => [r.key, r.value]))
    const cfg: Config = {
      scripts: rows.map((r) => ({ name: r.name, url: r.url, project: r.project, hosts: r.hosts ? r.hosts.split(' ') : [] })),
      timezone: s.timezone || 'UTC',
      dockerRepos: s.docker_repos ? s.docker_repos.split(' ') : [],
    }
    cfgCache = { at: Date.now(), cfg }
    return cfg
  } catch (e) {
    // D1 not answering: the scripts keep being served from what was read last
    if (cfgCache) return cfgCache.cfg
    throw e
  }
}

const validZone = (tz: string) => { try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false } }

type Problem = { error: 'invalid'; field: string; value?: string }

/** a configuration posted from the stats page (or imported), checked; statsHost is the page's own */
function checked(body: unknown, statsHost: string): { cfg: Config } | { problem: Problem } {
  const b = (body ?? {}) as Record<string, unknown>
  const bad = (field: string, value?: unknown) => ({ problem: { error: 'invalid' as const, field, value: value === undefined ? undefined : String(value).slice(0, 200) } })
  if (!Array.isArray(b.scripts)) return bad('scripts')
  if (b.scripts.length > MAX_SCRIPTS) return bad('too_many_scripts', b.scripts.length)
  const scripts: Script[] = [], names = new Set<string>(), hosts = new Set<string>()
  for (const raw of b.scripts as Record<string, unknown>[]) {
    const name = String(raw?.name ?? '').trim().toLowerCase()
    if (!NAME.test(name)) return bad('name', name)
    if (RESERVED.has(name)) return bad('reserved', name)
    if (names.has(name)) return bad('duplicate_name', name)
    names.add(name)
    const url = String(raw?.url ?? '').trim()
    let ok = url.length <= 2048
    try { ok &&= new URL(url).protocol === 'https:' } catch { ok = false }
    if (!ok) return bad('url', url)
    const project = String(raw?.project ?? '').trim()
    if (project && !PROJECT.test(project)) return bad('project', project)
    const list = (Array.isArray(raw?.hosts) ? raw.hosts : String(raw?.hosts ?? '').split(/[\s,]+/))
      .map((h) => String(h).trim().toLowerCase().replace(/\.$/, '')).filter(Boolean)
    for (const h of list) {
      if (!HOST.test(h)) return bad('host', h)
      if (h === statsHost) return bad('stats_host', h)
      if (hosts.has(h)) return bad('duplicate_host', h)
      hosts.add(h)
    }
    scripts.push({ name, url, project, hosts: list })
  }
  const timezone = String(b.timezone ?? 'UTC').trim()
  if (!validZone(timezone)) return bad('timezone', timezone)
  const repos = (Array.isArray(b.dockerRepos) ? b.dockerRepos : String(b.dockerRepos ?? '').split(/[\s,]+/))
    .map((r) => String(r).trim()).filter(Boolean)
  if (repos.length > MAX_REPOS) return bad('too_many_repos', repos.length)
  for (const r of repos) if (!REPO.test(r)) return bad('repo', r)
  return { cfg: { scripts, timezone, dockerRepos: [...new Set(repos)] } }
}

async function saveConfig(env: Env, cfg: Config) {
  await ensureSchema(env.DB)
  const setting = (key: string, value: string) => env.DB.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').bind(key, value)
  // one batch: all of it or none
  await env.DB.batch([
    env.DB.prepare('DELETE FROM scripts'),
    ...cfg.scripts.map((s, i) => env.DB.prepare('INSERT INTO scripts (name, url, project, hosts, pos) VALUES (?, ?, ?, ?, ?)')
      .bind(s.name, s.url, s.project, s.hosts.join(' '), i)),
    setting('timezone', cfg.timezone),
    setting('docker_repos', cfg.dockerRepos.join(' ')),
  ])
  cfgCache = { at: Date.now(), cfg }
}

/** a script's project: the one named, or the GitHub repository it is served from, or its own name */
const projectOf = (s: Script) => s.project || /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/([^/]+)\//.exec(s.url)?.[1] || s.name

/** project → its scripts' names, in the order of the scripts */
function projects(cfg: Config): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const s of cfg.scripts) out.set(projectOf(s), [...(out.get(projectOf(s)) ?? []), s.name])
  return out
}

/** a project by its name, with or without ".sh" (snell → snell.sh) */
const projectNamed = (cfg: Config, name: string) => [...projects(cfg).keys()].find((k) => k === name || k.replace(/\.sh$/, '') === name)

/** "?, ?, ?" for an IN list of n */
const marks = (n: number) => Array(n).fill('?').join(', ')

/** The date (YYYY-MM-DD) in the configured time zone. */
function dayOf(cfg: Config, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: cfg.timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
  } catch {
    return at.toISOString().slice(0, 10)
  }
}

/** YYYY-MM-DD plus n days (calendar arithmetic, no time zone involved). */
function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

// ── counting ─────────────────────────────────────────────────────────────────
function agentOf(ua: string): 'curl' | 'wget' | 'other' {
  const u = ua.toLowerCase()
  if (u.startsWith('curl/')) return 'curl'
  if (u.startsWith('wget/')) return 'wget'
  return 'other'
}

async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
  return [...d].map((b) => b.toString(16).padStart(2, '0')).join('')
}

const randomHex = (bytes: number) => [...crypto.getRandomValues(new Uint8Array(bytes))].map((b) => b.toString(16).padStart(2, '0')).join('')

// the day's salt: one per day, shared by every isolate through D1
let saltCache: { day: string; salt: string } | null = null
async function saltFor(env: Env, day: string): Promise<string> {
  if (saltCache?.day === day) return saltCache.salt
  await env.DB.prepare('INSERT OR IGNORE INTO salts (day, salt) VALUES (?, ?)').bind(day, randomHex(32)).run()
  const row = await env.DB.prepare('SELECT salt FROM salts WHERE day = ?').bind(day).first<{ salt: string }>()
  saltCache = { day, salt: row!.salt }
  return row!.salt
}

async function count(req: Request, env: Env, cfg: Config, script: string) {
  const day = dayOf(cfg)
  const agent = agentOf(req.headers.get('User-Agent') ?? '')
  const cf = (req as Request & { cf?: { country?: unknown } }).cf
  const country = typeof cf?.country === 'string' ? cf.country.slice(0, 2).toUpperCase() : ''
  const stmts = [
    env.DB.prepare(`INSERT INTO hits (day, script, country, agent, n) VALUES (?, ?, ?, ?, 1)
                    ON CONFLICT (day, script, country, agent) DO UPDATE SET n = n + 1`).bind(day, script, country, agent),
  ]
  const ip = req.headers.get('CF-Connecting-IP')
  if (agent !== 'other' && ip) {
    const h = (await sha256Hex(`${await saltFor(env, day)}|${ip}`)).slice(0, 20)
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO seen (day, script, h) VALUES (?, ?, ?)').bind(day, script, h))
  }
  await env.DB.batch(stmts)
}

/** Off to the script, counted (when it is a run) after the answer is sent. */
function serveScript(req: Request, env: Env, ctx: ExecutionContext, cfg: Config, s: Script, counted: boolean): Response {
  if (counted && req.method === 'GET') ctx.waitUntil(count(req, env, cfg, s.name).catch((e) => console.error('count', s.name, e)))
  return new Response(null, { status: 302, headers: { Location: s.url, 'Cache-Control': 'no-store' } })
}

// ── the hourly job ───────────────────────────────────────────────────────────
async function hubPulls(repo: string): Promise<number | null> {
  try {
    const r = await fetch(`https://hub.docker.com/v2/repositories/${repo}/`, {
      headers: { 'User-Agent': 'install-stats (+https://github.com/jinqians/install-stats)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return null
    const n = (await r.json<{ pull_count?: unknown }>()).pull_count
    return typeof n === 'number' && Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/**
 * Every hour, so that a day ends on time in any time zone: the days before
 * today are closed (their unique servers counted, their hashes and salt
 * deleted), and Docker Hub is read once a day, at the day's first run (a day's
 * pulls are the growth from its reading to the next day's).
 */
async function hourly(env: Env) {
  const cfg = await config(env, true)
  const today = dayOf(cfg)
  await env.DB.batch([
    env.DB.prepare(`INSERT OR REPLACE INTO uniques (day, script, n) SELECT day, script, COUNT(*) FROM seen WHERE day < ? GROUP BY day, script`).bind(today),
    // and over every script ("*"): the day's salt is one, so a server that ran two has one hash
    env.DB.prepare(`INSERT OR REPLACE INTO uniques (day, script, n) SELECT day, '*', COUNT(DISTINCT h) FROM seen WHERE day < ? GROUP BY day`).bind(today),
    // and over each project's scripts ("@snell.sh")
    ...[...projects(cfg)].map(([key, names]) => env.DB.prepare(
      `INSERT OR REPLACE INTO uniques (day, script, n) SELECT day, ?, COUNT(DISTINCT h) FROM seen WHERE day < ? AND script IN (${marks(names.length)}) GROUP BY day`)
      .bind(`@${key}`, today, ...names)),
    env.DB.prepare('DELETE FROM seen WHERE day < ?').bind(today),
    env.DB.prepare('DELETE FROM salts WHERE day < ?').bind(today),
  ])
  for (const repo of cfg.dockerRepos) {
    if (await env.DB.prepare('SELECT 1 FROM pulls WHERE day = ? AND repo = ?').bind(today, repo).first()) continue
    const total = await hubPulls(repo)
    if (total !== null) await env.DB.prepare('INSERT OR IGNORE INTO pulls (day, repo, total) VALUES (?, ?, ?)').bind(today, repo, total).run()
    else console.error('docker hub', repo, 'unreadable')
  }
}

// ── the stats page: sign-in ──────────────────────────────────────────────────
const enc = new TextEncoder()
const b64url = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

async function sessionKey(password: string): Promise<CryptoKey> {
  const raw = await crypto.subtle.digest('SHA-256', enc.encode(`install-stats session|${password}`))
  return crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
}

async function sessionToken(password: string, exp: number): Promise<string> {
  return `${exp}.${b64url(await crypto.subtle.sign('HMAC', await sessionKey(password), enc.encode(String(exp))))}`
}

/** a and b equal, in time that does not depend on where they differ */
async function same(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([a, b].map((s) => crypto.subtle.digest('SHA-256', enc.encode(s))))
  return crypto.subtle.timingSafeEqual(x, y)
}

const configured = (env: Env) => (env.ADMIN_PASSWORD ?? '').length >= 8

async function signedIn(req: Request, env: Env): Promise<boolean> {
  if (!configured(env)) return false
  const m = /(?:^|;\s*)st=(\d+)\.([\w-]+)/.exec(req.headers.get('Cookie') ?? '')
  if (!m || Number(m[1]) < Date.now() / 1000) return false
  return same(`${m[1]}.${m[2]}`, await sessionToken(env.ADMIN_PASSWORD!, Number(m[1])))
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
}
// errors are codes; the page says them in its language
const json = (v: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...extra } })

/**
 * The hostname asked for. On Cloudflare it is the URL's; `wrangler dev`
 * rewrites every URL to its own address, but keeps the Host header.
 */
const hostOf = (req: Request) => (req.headers.get('Host') ?? new URL(req.url).host).replace(/:\d+$/, '').toLowerCase()

/** a change from another site (a form posted at the page) is refused */
function sameOrigin(req: Request): boolean {
  const site = req.headers.get('Sec-Fetch-Site')
  if (site) return site === 'same-origin' || site === 'none'
  const origin = req.headers.get('Origin')
  if (!origin) return true
  try { return new URL(origin).host === req.headers.get('Host') } catch { return false }   // "null", say
}

async function login(req: Request, env: Env): Promise<Response> {
  if (!configured(env)) return json({ error: 'no_password' }, 503)
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403)
  const body = await req.json<{ password?: unknown }>().catch(() => ({ password: '' }))
  if (!(await same(String(body.password ?? ''), env.ADMIN_PASSWORD!))) {
    await new Promise((r) => setTimeout(r, 1000))   // guessing costs a second a try
    return json({ error: 'wrong_password' }, 401)
  }
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400
  return json({ ok: true }, 200, {
    'Set-Cookie': `st=${await sessionToken(env.ADMIN_PASSWORD!, exp)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Strict`,
  })
}

// ── the stats ────────────────────────────────────────────────────────────────
type Row = Record<string, string | number | null>

async function stats(env: Env, cfg: Config, days: number) {
  await ensureSchema(env.DB)
  const today = dayOf(cfg)
  const from = addDays(today, -(days - 1))
  const list = Array.from({ length: days }, (_, i) => addDays(from, i))
  const proj = [...projects(cfg)]
  const [hits, uniq, countries, agents, totals, pulls, ...projLive] = (await env.DB.batch([
    env.DB.prepare(`SELECT day, script, CASE WHEN agent = 'other' THEN 'other' ELSE 'runs' END AS kind, SUM(n) AS n
                      FROM hits WHERE day >= ? GROUP BY day, script, kind`).bind(from),
    env.DB.prepare(`SELECT day, script, n FROM uniques WHERE day >= ?
                    UNION ALL SELECT day, script, COUNT(*) FROM seen WHERE day >= ? GROUP BY day, script
                    UNION ALL SELECT day, '*', COUNT(DISTINCT h) FROM seen WHERE day >= ? GROUP BY day`).bind(from, from, from),
    env.DB.prepare(`SELECT country, SUM(n) AS n FROM hits WHERE day >= ? AND agent != 'other' GROUP BY country ORDER BY n DESC LIMIT 20`).bind(from),
    env.DB.prepare(`SELECT agent, SUM(n) AS n FROM hits WHERE day >= ? GROUP BY agent`).bind(from),
    env.DB.prepare(`SELECT script, SUM(n) AS n, MIN(day) AS since FROM hits WHERE agent != 'other' GROUP BY script`),
    // the reading before the first day too: the first day's growth needs it
    env.DB.prepare('SELECT day, repo, total FROM pulls WHERE day >= ? ORDER BY day').bind(addDays(from, -1)),
    // each project's servers today (and any day not closed yet), each once
    ...proj.map(([key, names]) => env.DB.prepare(
      `SELECT day, ? AS script, COUNT(DISTINCT h) AS n FROM seen WHERE day >= ? AND script IN (${marks(names.length)}) GROUP BY day`)
      .bind(`@${key}`, from, ...names)),
  ])).map((r) => r.results as Row[])

  // every script configured, then any that has runs but was taken out
  const byName = new Map(cfg.scripts.map((s) => [s.name, s]))
  const names = [...byName.keys(), ...[...new Set(totals.map((r) => String(r.script)))].filter((n) => !byName.has(n)).sort()]
  const index = new Map(list.map((d, i) => [d, i]))
  const zeros = () => list.map(() => 0)
  const runs: Record<string, number[]> = {}, other: Record<string, number[]> = {}, unique: Record<string, number[]> = {}
  for (const n of names) { runs[n] = zeros(); other[n] = zeros(); unique[n] = zeros() }
  for (const r of hits) {
    const i = index.get(String(r.day)), n = String(r.script)
    if (i === undefined || !runs[n]) continue
    ;(r.kind === 'other' ? other : runs)[n][i] += Number(r.n)
  }
  // servers over every script ("*") and over each project's ("@name"), each once
  const uniqueAll = zeros()
  const projUnique: Record<string, number[]> = Object.fromEntries(proj.map(([key]) => [key, zeros()]))
  for (const r of [...uniq, ...projLive.flat()]) {
    const i = index.get(String(r.day)), n = String(r.script)
    if (i === undefined) continue
    if (n === '*') uniqueAll[i] += Number(r.n)
    else if (n.startsWith('@')) { if (projUnique[n.slice(1)]) projUnique[n.slice(1)][i] += Number(r.n) }
    else if (unique[n]) unique[n][i] += Number(r.n)
  }

  // pulls on a day: the next day's reading minus its own; today's, the live
  // count minus this morning's reading (best effort)
  const pullRows: { repo: string; total: number | null; days: (number | null)[] }[] = []
  for (const repo of cfg.dockerRepos) {
    const snap = new Map(pulls.filter((p) => p.repo === repo).map((p) => [String(p.day), Number(p.total)]))
    const live = await hubPulls(repo)
    const at = (d: string) => (d === addDays(today, 1) ? live ?? undefined : snap.get(d))
    const daysOut = list.map((d) => {
      const a = snap.get(d), b = at(addDays(d, 1))
      return a !== undefined && b !== undefined ? Math.max(0, b - a) : null
    })
    pullRows.push({ repo, total: live ?? (snap.size ? Math.max(...snap.values()) : null), days: daysOut })
  }

  return {
    timezone: cfg.timezone, today, days: list,
    scripts: names.map((n) => ({ name: n, url: byName.get(n)?.url ?? null, hosts: byName.get(n)?.hosts ?? [] })),
    projects: proj.map(([name, ns]) => ({ name, scripts: ns, unique: projUnique[name] })),
    runs, unique, uniqueAll, other,
    totals: Object.fromEntries(totals.map((r) => [String(r.script), { all: Number(r.n), since: String(r.since) }])),
    countries: countries.map((r) => ({ country: String(r.country || ''), n: Number(r.n) })),
    agents: Object.fromEntries(agents.map((r) => [String(r.agent), Number(r.n)])),
    pulls: pullRows,
  }
}

// A public number for a README badge (shields.io's endpoint format): a
// project's runs, all its scripts as one — which script, where from, how many
// servers stay on the stats page. /badge/snell.json?period=today|7d|30d|all&label=…&lang=en|zh
const BADGE_LABELS: Record<string, Record<string, string>> = {
  en: { today: 'runs today', '7d': 'runs (7 days)', '30d': 'runs (30 days)', all: 'runs' },
  zh: { today: '今日运行', '7d': '近 7 天运行', '30d': '近 30 天运行', all: '累计运行' },
}

async function badge(env: Env, cfg: Config, key: string, q: URLSearchParams): Promise<Response> {
  const name = projectNamed(cfg, key)
  if (!name) return json({ error: 'not_found' }, 404)
  const names = projects(cfg).get(name)!
  await ensureSchema(env.DB)
  const period = ['today', '7d', '30d', 'all'].includes(q.get('period') ?? '') ? q.get('period')! : 'all'
  const today = dayOf(cfg)
  const from = period === 'today' ? today : period === '7d' ? addDays(today, -6) : period === '30d' ? addDays(today, -29) : '0000-00-00'
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(n), 0) AS n FROM hits WHERE day >= ? AND agent != 'other' AND script IN (${marks(names.length)})`)
    .bind(from, ...names).first<{ n: number }>()
  const n = row?.n ?? 0
  const short = n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${+(n / 1e3).toFixed(1)}k` : String(n)
  const labels = BADGE_LABELS[q.get('lang') === 'zh' ? 'zh' : 'en']
  return json({
    schemaVersion: 1, label: q.get('label')?.slice(0, 40) || labels[period],
    message: short, color: '2a78d6', cacheSeconds: 1800,
  }, 200, { 'Cache-Control': 'public, max-age=1800', 'Access-Control-Allow-Origin': '*' })
}

const PAGE_HEADERS = {
  ...SECURITY_HEADERS,
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
}

async function statsPage(req: Request, env: Env, cfg: Config): Promise<Response> {
  const url = new URL(req.url)
  const p = url.pathname
  if (p === '/' && req.method === 'GET') return new Response(PAGE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...PAGE_HEADERS } })
  if (p === '/app.js') return new Response(APP_JS, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', ...PAGE_HEADERS } })
  if (p === '/app.css') return new Response(APP_CSS, { headers: { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-cache', ...PAGE_HEADERS } })
  if (p === '/api/login' && req.method === 'POST') return login(req, env)
  if (p === '/api/logout' && req.method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': 'st=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict' })
  }
  if (p === '/api/stats' || p === '/api/config') {
    if (!configured(env)) return json({ error: 'no_password' }, 503)
    if (!(await signedIn(req, env))) return json({ error: 'signin' }, 401)
    if (p === '/api/stats' && req.method === 'GET') {
      const days = Math.min(Math.max(Math.floor(Number(url.searchParams.get('days'))) || 30, 7), MAX_DAYS)
      return json(await stats(env, await config(env, true), days))
    }
    // the stats page's own host: the scripts' paths hang off it, and no script may take it
    if (p === '/api/config' && req.method === 'GET') return json({ ...(await config(env, true)), host: hostOf(req) })
    if (p === '/api/config' && req.method === 'PUT') {
      if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403)
      const body = await req.json().catch(() => null)
      const r = checked(body, hostOf(req))
      if ('problem' in r) return json(r.problem, 400)
      await saveConfig(env, r.cfg)
      return json({ ok: true, ...r.cfg, host: hostOf(req) })
    }
  }
  const b = /^\/badge\/([a-z0-9.-]{1,80})\.json$/.exec(p)
  if (b && req.method === 'GET') return badge(env, cfg, b[1], url.searchParams)
  return json({ error: 'not_found' }, 404)
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const cfg = await config(env)
      const host = hostOf(req)
      const path = new URL(req.url).pathname
      // a script's own hostname: "/" is the script; anything else (a favicon,
      // a crawler's guess) goes to it as well, uncounted
      const onHost = cfg.scripts.find((s) => s.hosts.includes(host))
      if (onHost) return serveScript(req, env, ctx, cfg, onHost, path === '/')
      // https://<this host>/<name>
      const m = /^\/([a-z0-9][a-z0-9._-]{0,63})$/i.exec(path)
      const named = m && !RESERVED.has(m[1].toLowerCase()) ? cfg.scripts.find((s) => s.name === m[1].toLowerCase()) : undefined
      if (named) return serveScript(req, env, ctx, cfg, named, true)
      return await statsPage(req, env, cfg)
    } catch (e) {
      console.error(e)
      return json({ error: 'internal' }, 500)
    }
  },
  scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(hourly(env).catch((e) => console.error('hourly', e)))
  },
} satisfies ExportedHandler<Env>
