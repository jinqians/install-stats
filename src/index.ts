// Install stats: a Worker in front of the short domains of one-line install
// scripts (`bash <(curl -sL snell.jinqians.com)`). Each request is answered,
// as the redirect rules it replaces did, with a redirect to the script on
// GitHub; on the way, a run is counted for its day, script, country and client.
// Any other hostname shows the stats page (password: the ADMIN_PASSWORD secret).
//
// What a run is: a GET of "/" by curl or wget, the way the scripts are run —
// browsers and crawlers are counted apart. Unique servers per day come from a
// hash of the address with a salt that changes every day and is deleted at its
// end, together with the hashes: no address is kept, nor anything that could
// be matched to one later.
//
// Scripts belong to projects: the GitHub repository each is served from
// (install, snell, menu … are all snell.sh). The public badges give a
// project's runs as one number; the details are for the stats page.
import { ensureSchema } from './schema'
import { APP_CSS, APP_JS, PAGE_HTML } from './page'

export type Env = {
  DB: D1Database
  ADMIN_PASSWORD?: string
  /**
   * hostname → the script's URL, or { url, project } to name its project
   * (otherwise the GitHub repository it is served from)
   */
  TARGETS?: Record<string, Target> | string
  /** Docker Hub repositories ("owner/name") whose pulls are recorded daily */
  DOCKER_REPOS?: string[] | string
  /** what a day is: an IANA time zone (default Asia/Shanghai) */
  TIMEZONE?: string
}

type Target = string | { url?: unknown; project?: unknown }

const SESSION_DAYS = 30
const MAX_DAYS = 365

// ── configuration ────────────────────────────────────────────────────────────
function parsed<T>(v: T | string | undefined, fallback: T): T {
  if (v === undefined || v === '') return fallback
  if (typeof v !== 'string') return v
  try { return JSON.parse(v) as T } catch { return fallback }
}

/** TARGETS, checked: hostname → its script's https URL and its project */
function scripts(env: Env): Map<string, { url: string; project: string }> {
  const out = new Map<string, { url: string; project: string }>()
  for (const [h, t] of Object.entries(parsed<Record<string, Target>>(env.TARGETS, {}))) {
    const url = typeof t === 'string' ? t : String(t?.url ?? '')
    if (!/^https:\/\//.test(url)) continue
    // a project named, or the GitHub repository it is served from, or its own hostname
    const named = typeof t === 'object' && typeof t?.project === 'string' && /^[\w.-]{1,64}$/.test(t.project) ? t.project : ''
    const repo = /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/([^/]+)\//.exec(url)?.[1] ?? ''
    out.set(h.toLowerCase(), { url, project: named || repo || h.toLowerCase() })
  }
  return out
}

const targets = (env: Env) => new Map([...scripts(env)].map(([h, s]) => [h, s.url]))

/** project → its hostnames, in TARGETS order */
function projects(env: Env): Map<string, string[]> {
  const out = new Map<string, string[]>()
  for (const [h, { project }] of scripts(env)) out.set(project, [...(out.get(project) ?? []), h])
  return out
}

/** a project by its repository's name, with or without ".sh" (snell → snell.sh) */
const projectNamed = (env: Env, name: string) => [...projects(env).keys()].find((k) => k === name || k.replace(/\.sh$/, '') === name)

/** "?, ?, ?" for an IN list of n */
const marks = (n: number) => Array(n).fill('?').join(', ')

const repos = (env: Env) => parsed<string[]>(env.DOCKER_REPOS, []).filter((r) => /^[\w.-]+\/[\w.-]+$/.test(r))

/** The date (YYYY-MM-DD) in TIMEZONE. */
function dayOf(env: Env, at = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: env.TIMEZONE || 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
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

async function count(req: Request, env: Env, host: string) {
  await ensureSchema(env.DB)
  const day = dayOf(env)
  const agent = agentOf(req.headers.get('User-Agent') ?? '')
  const cf = (req as Request & { cf?: { country?: unknown } }).cf
  const country = typeof cf?.country === 'string' ? cf.country.slice(0, 2).toUpperCase() : ''
  const stmts = [
    env.DB.prepare(`INSERT INTO hits (day, host, country, agent, n) VALUES (?, ?, ?, ?, 1)
                    ON CONFLICT (day, host, country, agent) DO UPDATE SET n = n + 1`).bind(day, host, country, agent),
  ]
  const ip = req.headers.get('CF-Connecting-IP')
  if (agent !== 'other' && ip) {
    const h = (await sha256Hex(`${await saltFor(env, day)}|${ip}`)).slice(0, 20)
    stmts.push(env.DB.prepare('INSERT OR IGNORE INTO seen (day, host, h) VALUES (?, ?, ?)').bind(day, host, h))
  }
  await env.DB.batch(stmts)
}

/** A script's hostname: off to the script, counted after the answer is sent. */
function serveScript(req: Request, env: Env, ctx: ExecutionContext, host: string, target: string): Response {
  const path = new URL(req.url).pathname
  // the script is "/"; anything else (a favicon, a crawler's guess) goes to it
  // as well, uncounted
  if (req.method === 'GET' && path === '/') ctx.waitUntil(count(req, env, host).catch((e) => console.error('count', host, e)))
  return new Response(null, { status: 302, headers: { Location: target, 'Cache-Control': 'no-store' } })
}

// ── the daily job ────────────────────────────────────────────────────────────
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

/** The day before closed (its unique servers counted, their hashes and salt deleted); Docker Hub read. */
async function daily(env: Env) {
  await ensureSchema(env.DB)
  const today = dayOf(env)
  await env.DB.batch([
    env.DB.prepare(`INSERT OR REPLACE INTO uniques (day, host, n) SELECT day, host, COUNT(*) FROM seen WHERE day < ? GROUP BY day, host`).bind(today),
    // and over every script ("*"): the day's salt is one, so a server that ran two has one hash
    env.DB.prepare(`INSERT OR REPLACE INTO uniques (day, host, n) SELECT day, '*', COUNT(DISTINCT h) FROM seen WHERE day < ? GROUP BY day`).bind(today),
    // and over each project's scripts ("@snell.sh")
    ...[...projects(env)].map(([key, hosts]) => env.DB.prepare(
      `INSERT OR REPLACE INTO uniques (day, host, n) SELECT day, ?, COUNT(DISTINCT h) FROM seen WHERE day < ? AND host IN (${marks(hosts.length)}) GROUP BY day`)
      .bind(`@${key}`, today, ...hosts)),
    env.DB.prepare('DELETE FROM seen WHERE day < ?').bind(today),
    env.DB.prepare('DELETE FROM salts WHERE day < ?').bind(today),
  ])
  for (const repo of repos(env)) {
    const total = await hubPulls(repo)
    if (total !== null) await env.DB.prepare('INSERT OR REPLACE INTO pulls (day, repo, total) VALUES (?, ?, ?)').bind(today, repo, total).run()
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
const json = (v: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(v), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...SECURITY_HEADERS, ...extra } })

/**
 * The hostname asked for. On Cloudflare it is the URL's; `wrangler dev`
 * rewrites every URL to the first route's host, but keeps the Host header.
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
  if (!configured(env)) return json({ error: '先设置 ADMIN_PASSWORD（至少 8 位）' }, 503)
  if (!sameOrigin(req)) return json({ error: 'forbidden' }, 403)
  const body = await req.json<{ password?: unknown }>().catch(() => ({ password: '' }))
  if (!(await same(String(body.password ?? ''), env.ADMIN_PASSWORD!))) {
    await new Promise((r) => setTimeout(r, 1000))   // guessing costs a second a try
    return json({ error: '密码不对' }, 401)
  }
  const exp = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400
  return json({ ok: true }, 200, {
    'Set-Cookie': `st=${await sessionToken(env.ADMIN_PASSWORD!, exp)}; Path=/; Max-Age=${SESSION_DAYS * 86400}; HttpOnly; Secure; SameSite=Strict`,
  })
}

// ── the stats ────────────────────────────────────────────────────────────────
type Row = Record<string, string | number | null>

async function stats(env: Env, days: number) {
  await ensureSchema(env.DB)
  const today = dayOf(env)
  const from = addDays(today, -(days - 1))
  const list = Array.from({ length: days }, (_, i) => addDays(from, i))
  const proj = [...projects(env)]
  const [hits, uniq, countries, agents, totals, pulls, ...projLive] = (await env.DB.batch([
    env.DB.prepare(`SELECT day, host, CASE WHEN agent = 'other' THEN 'other' ELSE 'runs' END AS kind, SUM(n) AS n
                      FROM hits WHERE day >= ? GROUP BY day, host, kind`).bind(from),
    env.DB.prepare(`SELECT day, host, n FROM uniques WHERE day >= ?
                    UNION ALL SELECT day, host, COUNT(*) FROM seen WHERE day >= ? GROUP BY day, host
                    UNION ALL SELECT day, '*', COUNT(DISTINCT h) FROM seen WHERE day >= ? GROUP BY day`).bind(from, from, from),
    env.DB.prepare(`SELECT country, SUM(n) AS n FROM hits WHERE day >= ? AND agent != 'other' GROUP BY country ORDER BY n DESC LIMIT 20`).bind(from),
    env.DB.prepare(`SELECT agent, SUM(n) AS n FROM hits WHERE day >= ? GROUP BY agent`).bind(from),
    env.DB.prepare(`SELECT host, SUM(n) AS n, MIN(day) AS since FROM hits WHERE agent != 'other' GROUP BY host`),
    // the reading before the first day too: the first day's growth needs it
    env.DB.prepare('SELECT day, repo, total FROM pulls WHERE day >= ? ORDER BY day').bind(addDays(from, -1)),
    // each project's servers today (and any day not closed yet), each once
    ...proj.map(([key, hosts]) => env.DB.prepare(
      `SELECT day, ? AS host, COUNT(DISTINCT h) AS n FROM seen WHERE day >= ? AND host IN (${marks(hosts.length)}) GROUP BY day`)
      .bind(`@${key}`, from, ...hosts)),
  ])).map((r) => r.results as Row[])

  // every script in TARGETS, then any that has runs but was taken out of it
  const t = targets(env)
  const hosts = [...t.keys(), ...[...new Set(totals.map((r) => String(r.host)))].filter((h) => !t.has(h)).sort()]
  const index = new Map(list.map((d, i) => [d, i]))
  const zeros = () => list.map(() => 0)
  const runs: Record<string, number[]> = {}, other: Record<string, number[]> = {}, unique: Record<string, number[]> = {}
  for (const h of hosts) { runs[h] = zeros(); other[h] = zeros(); unique[h] = zeros() }
  for (const r of hits) {
    const i = index.get(String(r.day)), h = String(r.host)
    if (i === undefined || !runs[h]) continue
    ;(r.kind === 'other' ? other : runs)[h][i] += Number(r.n)
  }
  // servers over every script ("*") and over each project's ("@name"), each once
  const uniqueAll = zeros()
  const projUnique: Record<string, number[]> = Object.fromEntries(proj.map(([key]) => [key, zeros()]))
  for (const r of [...uniq, ...projLive.flat()]) {
    const i = index.get(String(r.day)), h = String(r.host)
    if (i === undefined) continue
    if (h === '*') uniqueAll[i] += Number(r.n)
    else if (h.startsWith('@')) { if (projUnique[h.slice(1)]) projUnique[h.slice(1)][i] += Number(r.n) }
    else if (unique[h]) unique[h][i] += Number(r.n)
  }

  // pulls on a day: the next day's reading minus its own; today's, the live
  // count minus this morning's reading (best effort)
  const pullRows: { repo: string; total: number | null; days: (number | null)[] }[] = []
  for (const repo of repos(env)) {
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
    timezone: env.TIMEZONE || 'Asia/Shanghai', today, days: list,
    hosts: hosts.map((h) => ({ host: h, target: t.get(h) ?? null })),
    projects: proj.map(([name, hs]) => ({ name, hosts: hs, unique: projUnique[name] })),
    runs, unique, uniqueAll, other,
    totals: Object.fromEntries(totals.map((r) => [String(r.host), { all: Number(r.n), since: String(r.since) }])),
    countries: countries.map((r) => ({ country: String(r.country || ''), n: Number(r.n) })),
    agents: Object.fromEntries(agents.map((r) => [String(r.agent), Number(r.n)])),
    pulls: pullRows,
  }
}

// A public number for a README badge (shields.io's endpoint format): a
// project's runs, all its scripts as one — which script, where from, how many
// servers stay on the stats page. /badge/snell.json?period=today|7d|30d|all&label=…
async function badge(env: Env, key: string, q: URLSearchParams): Promise<Response> {
  const name = projectNamed(env, key)
  if (!name) return json({ error: 'no such project' }, 404)
  const hosts = projects(env).get(name)!
  await ensureSchema(env.DB)
  const period = ['today', '7d', '30d', 'all'].includes(q.get('period') ?? '') ? q.get('period')! : 'all'
  const today = dayOf(env)
  const from = period === 'today' ? today : period === '7d' ? addDays(today, -6) : period === '30d' ? addDays(today, -29) : '0000-00-00'
  const row = await env.DB.prepare(
    `SELECT COALESCE(SUM(n), 0) AS n FROM hits WHERE day >= ? AND agent != 'other' AND host IN (${marks(hosts.length)})`)
    .bind(from, ...hosts).first<{ n: number }>()
  const n = row?.n ?? 0
  const short = n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${+(n / 1e3).toFixed(1)}k` : String(n)
  const labels: Record<string, string> = { today: '今日', '7d': '近 7 天', '30d': '近 30 天', all: '累计' }
  return json({
    schemaVersion: 1, label: q.get('label')?.slice(0, 40) || `${labels[period]}运行`,
    message: short, color: '2a78d6', cacheSeconds: 1800,
  }, 200, { 'Cache-Control': 'public, max-age=1800', 'Access-Control-Allow-Origin': '*' })
}

const PAGE_HEADERS = {
  ...SECURITY_HEADERS,
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
}

async function statsPage(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const p = url.pathname
  if (p === '/' && req.method === 'GET') return new Response(PAGE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', ...PAGE_HEADERS } })
  if (p === '/app.js') return new Response(APP_JS, { headers: { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache', ...PAGE_HEADERS } })
  if (p === '/app.css') return new Response(APP_CSS, { headers: { 'Content-Type': 'text/css; charset=utf-8', 'Cache-Control': 'no-cache', ...PAGE_HEADERS } })
  if (p === '/api/login' && req.method === 'POST') return login(req, env)
  if (p === '/api/logout' && req.method === 'POST') {
    return json({ ok: true }, 200, { 'Set-Cookie': 'st=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict' })
  }
  if (p === '/api/stats' && req.method === 'GET') {
    if (!configured(env)) return json({ error: '先设置 ADMIN_PASSWORD（至少 8 位）', configured: false }, 503)
    if (!(await signedIn(req, env))) return json({ error: '请先登录' }, 401)
    const days = Math.min(Math.max(Math.floor(Number(url.searchParams.get('days'))) || 30, 7), MAX_DAYS)
    return json(await stats(env, days))
  }
  const b = /^\/badge\/([a-z0-9.-]{1,80})\.json$/.exec(p)
  if (b && req.method === 'GET') return badge(env, b[1], url.searchParams)
  return json({ error: 'not found' }, 404)
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const host = hostOf(req)
    const target = targets(env).get(host)
    if (target) return serveScript(req, env, ctx, host, target)
    try {
      return await statsPage(req, env)
    } catch (e) {
      console.error(e)
      return json({ error: 'internal error' }, 500)
    }
  },
  scheduled(_c: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(daily(env).catch((e) => console.error('daily', e)))
  },
} satisfies ExportedHandler<Env>
