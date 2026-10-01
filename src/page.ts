// The stats page: one HTML shell, its script and its style (served as files,
// so the Content-Security-Policy allows no inline script). No build step.

export const PAGE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>安装统计</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%232a78d6'/%3E%3Cpath d='M4 12V8M8 12V4M12 12V6' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="stylesheet" href="/app.css">
<script src="/app.js" defer></script>
</head>
<body>
<main id="app" class="wrap"><p class="muted" data-test="loading">读取中…</p></main>
</body>
</html>`

export const APP_CSS = `
:root {
  --bg: #f6f7f9; --surface: #fff; --surface-2: #f1f3f6; --border: #e3e6eb; --text: #1b1f24; --muted: #5f6b7a; --faint: #98a2b0;
  --accent: #2a78d6; --ok: #0d9488; --err: #d14343;
  --c0: #2a78d6; --c1: #0d9488; --c2: #eb6834; --c3: #4a3aa7; --c4: #c0407d; --c5: #b8860b; --c6: #5b9a5b; --c7: #7a8594;
  color-scheme: light;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0f1216; --surface: #171b21; --surface-2: #1d222a; --border: #2a313b; --text: #e6e9ee; --muted: #9aa5b3; --faint: #687382;
    --accent: #3987e5; --ok: #14a394; --err: #e06767;
    --c0: #3987e5; --c1: #14a394; --c2: #d95926; --c3: #9085e9; --c4: #d65c96; --c5: #d4a017; --c6: #6fb06f; --c7: #8c96a3;
    color-scheme: dark;
  }
}
* { box-sizing: border-box }
html, body { margin: 0; background: var(--bg); color: var(--text); font: 14px/1.5 system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif }
.wrap { max-width: 1180px; margin: 0 auto; padding: 24px 16px 48px }
h1 { font-size: 20px; margin: 0 }
h2 { font-size: 14px; margin: 0 0 12px; font-weight: 600 }
.muted { color: var(--muted) } .faint { color: var(--faint) } .small { font-size: 12.5px }
.mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px }
.head { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px }
.head .grow { flex: 1 }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px; min-width: 0 }
.grid { display: grid; gap: 14px }
.kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 14px }
.two { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); margin-top: 14px }
@media (max-width: 860px) { .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)) } .two { grid-template-columns: minmax(0, 1fr) } }
.kpi .label { color: var(--muted); font-size: 12.5px }
.kpi .value { font-size: 26px; font-weight: 700; font-variant-numeric: tabular-nums; margin-top: 2px }
.kpi .delta { font-size: 12px; color: var(--faint) }
.kpi .delta.up { color: var(--ok) } .kpi .delta.down { color: var(--err) }
button, select, input { font: inherit; color: inherit }
.btn { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 6px 12px; cursor: pointer }
.btn:hover { background: var(--surface-2) }
.btn.primary { background: var(--accent); border-color: var(--accent); color: #fff }
.seg { display: inline-flex; border: 1px solid var(--border); border-radius: 8px; overflow: hidden; background: var(--surface) }
.seg button { border: 0; background: transparent; padding: 6px 11px; cursor: pointer; color: var(--muted) }
.seg button + button { border-left: 1px solid var(--border) }
.seg button.on { background: var(--surface-2); color: var(--text); font-weight: 600 }
input.input { width: 100%; padding: 9px 11px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface) }
.login { max-width: 360px; margin: 12vh auto 0 }
.login form { display: grid; gap: 12px; margin-top: 14px }
.error { color: var(--err); font-size: 13px }
.chart-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 8px }
.chart-head .grow { flex: 1 }
.legend { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 10px }
.legend button { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--border); background: var(--surface); border-radius: 999px; padding: 2px 10px; cursor: pointer; font-size: 12.5px }
.legend button.off { opacity: .45 }
.legend i { width: 9px; height: 9px; border-radius: 3px; display: inline-block }
.chart { position: relative; outline: none }
.chart svg { display: block; width: 100%; overflow: visible }
.chart .axis { fill: var(--faint); font-size: 11px }
.chart .grid-line { stroke: var(--border); stroke-width: 1 }
.chart .hover-band { fill: var(--text); opacity: .06 }
.tip { position: absolute; pointer-events: none; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; box-shadow: 0 6px 20px rgba(0,0,0,.12); padding: 8px 10px; font-size: 12.5px; min-width: 160px; z-index: 2 }
.tip .t { font-weight: 600; margin-bottom: 4px }
.tip .r { display: flex; align-items: center; gap: 6px; white-space: nowrap }
.tip .r b { margin-left: auto; padding-left: 12px; font-variant-numeric: tabular-nums }
.tip i { width: 8px; height: 8px; border-radius: 2px; display: inline-block }
.table-wrap { overflow-x: auto }
table { width: 100%; border-collapse: collapse; font-variant-numeric: tabular-nums }
th, td { text-align: right; padding: 8px 10px; border-bottom: 1px solid var(--border); white-space: nowrap }
th:first-child, td:first-child { text-align: left }
th { color: var(--muted); font-weight: 500; font-size: 12.5px }
tr:last-child td { border-bottom: 0 }
tr.group td { background: var(--surface-2); font-weight: 600 }
tr.sub td:first-child { padding-left: 24px }
.dot { width: 9px; height: 9px; border-radius: 3px; display: inline-block; margin-right: 7px; vertical-align: 0 }
.bars { display: grid; gap: 7px }
.bar-row { display: grid; grid-template-columns: 92px minmax(0, 1fr) 64px; gap: 10px; align-items: center; font-size: 13px }
.bar-row .track { height: 8px; border-radius: 4px; background: var(--surface-2); overflow: hidden }
.bar-row .fill { height: 100%; border-radius: 4px; background: var(--accent) }
.bar-row .n { text-align: right; font-variant-numeric: tabular-nums }
.empty { color: var(--faint); padding: 18px 0; text-align: center }
.k0 { background: var(--c0) } .k1 { background: var(--c1) } .k2 { background: var(--c2) } .k3 { background: var(--c3) }
.k4 { background: var(--c4) } .k5 { background: var(--c5) } .k6 { background: var(--c6) } .k7 { background: var(--c7) }
.pull { margin-bottom: 8px } .mt { margin-top: 14px } .mt-lg { margin-top: 18px } .flat { margin: 0 }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0 }
footer { margin-top: 22px; text-align: center; color: var(--faint); font-size: 12px }
`

export const APP_JS = `
'use strict'
const app = document.getElementById('app')
const state = { days: 30, view: 'runs', off: new Set(), data: null }
const COLORS = 8
const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString('zh-CN'))
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const label = (host) => host.split('.')[0]
const color = (i) => 'var(--c' + (i % COLORS) + ')'   // for SVG fills
const kc = (i) => 'k' + (i % COLORS)                    // the same, as a class (no inline style under the CSP)
const sum = (a) => a.reduce((x, y) => x + y, 0)
const flag = (cc) => /^[A-Z]{2}$/.test(cc) && cc !== 'XX' && cc !== 'T1' ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐'
const short = (d) => d.slice(5).replace('-', '/')

async function api(path, init) {
  const r = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json' } })
  const body = await r.json().catch(() => ({}))
  return { status: r.status, body }
}

function showLogin(message) {
  app.innerHTML = '<div class="card login" data-test="login"><h1>安装统计</h1><p class="muted small">输入 ADMIN_PASSWORD 登录。</p>' +
    '<form><input class="input" type="password" autocomplete="current-password" placeholder="密码" data-test="password" required>' +
    '<button class="btn primary" type="submit" data-test="login-submit">登录</button><div class="error" data-test="login-error"></div></form></div>'
  const form = app.querySelector('form'), err = app.querySelector('.error')
  if (message) err.textContent = message
  form.querySelector('input').focus()
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    err.textContent = ''
    const { status, body } = await api('/api/login', { method: 'POST', body: JSON.stringify({ password: form.querySelector('input').value }) })
    if (status === 200) load()
    else err.textContent = body.error || ('HTTP ' + status)
  })
}

async function load() {
  const { status, body } = await api('/api/stats?days=' + state.days)
  if (status === 401) return showLogin()
  if (status === 503) { app.innerHTML = '<div class="card login"><h1>安装统计</h1><p class="error" data-test="not-configured">' + esc(body.error) + '</p></div>'; return }
  if (status !== 200) { app.innerHTML = '<p class="error">' + esc(body.error || ('HTTP ' + status)) + '</p>'; return }
  state.data = body
  render()
}

function kpi(labelText, value, delta, test) {
  let d = ''
  if (delta !== undefined && delta !== null) {
    const cls = delta > 0 ? 'up' : delta < 0 ? 'down' : ''
    d = '<div class="delta ' + cls + '">较昨日 ' + (delta > 0 ? '+' : '') + fmt(delta) + '</div>'
  }
  return '<div class="card kpi" data-test="' + test + '"><div class="label">' + labelText + '</div><div class="value">' + value + '</div>' + d + '</div>'
}

function render() {
  const s = state.data, n = s.days.length, t = n - 1
  const hosts = s.hosts.map((h) => h.host)
  const at = (series, i) => sum(hosts.map((h) => series[h][i] || 0))
  const period = sum(hosts.map((h) => sum(s.runs[h])))
  const all = sum(Object.values(s.totals).map((x) => x.all))
  app.innerHTML =
    '<div class="head"><h1>安装统计</h1><span class="muted small">按 ' + esc(s.timezone) + ' 计日，今天 ' + esc(s.today) + '</span><span class="grow"></span>' +
    '<div class="seg" role="radiogroup" aria-label="时间范围">' + [7, 30, 90, 365].map((d) =>
      '<button type="button" role="radio" aria-checked="' + (d === state.days) + '" class="' + (d === state.days ? 'on' : '') + '" data-days="' + d + '" data-test="days-' + d + '">' + (d === 365 ? '1 年' : d + ' 天') + '</button>').join('') + '</div>' +
    '<button class="btn" type="button" data-test="logout" id="logout">退出</button></div>' +
    '<div class="grid kpis">' +
      kpi('今日运行', fmt(at(s.runs, t)), at(s.runs, t) - at(s.runs, t - 1), 'kpi-today') +
      kpi('今日独立服务器', fmt(s.uniqueAll[t]), s.uniqueAll[t] - s.uniqueAll[t - 1], 'kpi-unique') +
      kpi('近 ' + n + ' 天运行', fmt(period), null, 'kpi-period') +
      kpi('累计运行', fmt(all), null, 'kpi-all') +
    '</div>' +
    '<div class="card"><div class="chart-head"><h2 class="flat">每日' + (state.view === 'runs' ? '运行次数' : '独立服务器') + '</h2><span class="grow"></span>' +
      '<div class="seg" role="radiogroup" aria-label="指标"><button type="button" data-view="runs" data-test="view-runs" class="' + (state.view === 'runs' ? 'on' : '') + '">运行次数</button>' +
      '<button type="button" data-view="unique" data-test="view-unique" class="' + (state.view === 'unique' ? 'on' : '') + '">独立服务器</button></div></div>' +
      '<div class="legend" data-test="legend">' + hosts.map((h, i) =>
        '<button type="button" class="' + (state.off.has(h) ? 'off' : '') + '" data-host="' + esc(h) + '" title="' + esc(h) + '" aria-pressed="' + !state.off.has(h) + '"><i class="' + kc(i) + '"></i>' + esc(label(h)) + '</button>').join('') + '</div>' +
      '<div class="chart" id="chart" tabindex="0" data-test="chart" aria-label="每日柱状图，左右方向键查看每一天"></div></div>' +
    '<div class="card mt"><h2>各项目和脚本</h2><div class="table-wrap"><table data-test="scripts"><thead><tr><th>脚本</th><th>今日</th><th>昨日</th><th>近 7 天</th><th>近 ' + n + ' 天</th><th>累计</th><th>今日服务器</th><th title="浏览器、爬虫等不是 curl / wget 的访问">其他访问</th></tr></thead><tbody>' +
      groups(s).map((g) => projectRow(s, g, t) + g.hosts.map((host) => {
        const i = hosts.indexOf(host), h = s.hosts[i]
        const r = s.runs[host], u = s.unique[host], o = s.other[host]
        return '<tr class="sub" data-test="row-' + esc(label(host)) + '"><td><span class="dot ' + kc(i) + '"></span><span title="' + esc(h.target || '已不在 TARGETS 中') + '">' + esc(host) + '</span></td>' +
          '<td>' + fmt(r[t]) + '</td><td>' + fmt(r[t - 1]) + '</td><td>' + fmt(sum(r.slice(-7))) + '</td><td>' + fmt(sum(r)) + '</td>' +
          '<td>' + fmt(s.totals[host] ? s.totals[host].all : 0) + '</td><td>' + fmt(u[t]) + '</td><td class="faint">' + fmt(sum(o)) + '</td></tr>'
      }).join('')).join('') + '</tbody></table></div></div>' +
    '<div class="grid two">' +
      '<div class="card"><h2>来源国家 / 地区 <span class="faint small">近 ' + n + ' 天</span></h2><div class="bars" data-test="countries">' + countries(s.countries) + '</div></div>' +
      '<div class="card"><h2>客户端 <span class="faint small">近 ' + n + ' 天</span></h2><div class="bars" data-test="agents">' + agents(s.agents) + '</div>' +
        '<h2 class="mt-lg">Docker 拉取</h2><div data-test="pulls">' + pulls(s) + '</div></div>' +
    '</div>' +
    '<footer>运行 = curl / wget 取脚本一次；独立服务器按当天去重，不保存 IP。</footer>'

  app.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => { state.days = Number(b.dataset.days); load() }))
  app.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { state.view = b.dataset.view; render() }))
  app.querySelectorAll('[data-host]').forEach((b) => b.addEventListener('click', () => {
    const h = b.dataset.host
    state.off.has(h) ? state.off.delete(h) : state.off.add(h)
    render()
  }))
  // widths through the CSSOM, which the CSP allows (a style attribute it does not)
  app.querySelectorAll('[data-w]').forEach((el) => { el.style.width = el.dataset.w + '%' })
  document.getElementById('logout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); showLogin() })
  drawChart()
}

// the scripts under their project (the repository they come from), and any
// no longer in TARGETS under 其他
function groups(s) {
  const out = s.projects.map((p) => ({ name: p.name, hosts: p.hosts, unique: p.unique }))
  const known = new Set(out.flatMap((g) => g.hosts))
  const rest = s.hosts.map((h) => h.host).filter((h) => !known.has(h))
  if (rest.length) out.push({ name: '其他', hosts: rest, unique: null })
  return out
}

// a project's own row: its scripts added up; its servers each once
function projectRow(s, g, t) {
  const add = (pick) => sum(g.hosts.map((h) => pick(h)))
  return '<tr class="group" data-test="project-' + esc(g.name) + '"><td>' + esc(g.name) + ' <span class="faint small">' + g.hosts.length + ' 个脚本</span></td>' +
    '<td>' + fmt(add((h) => s.runs[h][t])) + '</td><td>' + fmt(add((h) => s.runs[h][t - 1])) + '</td>' +
    '<td>' + fmt(add((h) => sum(s.runs[h].slice(-7)))) + '</td><td>' + fmt(add((h) => sum(s.runs[h]))) + '</td>' +
    '<td>' + fmt(add((h) => (s.totals[h] ? s.totals[h].all : 0))) + '</td><td>' + (g.unique ? fmt(g.unique[t]) : '—') + '</td>' +
    '<td class="faint">' + fmt(add((h) => sum(s.other[h]))) + '</td></tr>'
}

function countries(rows) {
  if (!rows.length) return '<div class="empty">还没有数据</div>'
  const max = Math.max(...rows.map((r) => r.n))
  return rows.map((r) => '<div class="bar-row"><span>' + flag(r.country) + ' ' + esc(r.country || '未知') + '</span><div class="track"><div class="fill" data-w="' + (r.n / max * 100).toFixed(1) + '"></div></div><span class="n">' + fmt(r.n) + '</span></div>').join('')
}

function agents(a) {
  const rows = [['curl', a.curl || 0], ['wget', a.wget || 0], ['其他（浏览器、爬虫）', a.other || 0]]
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return rows.map((r) => '<div class="bar-row"><span>' + r[0] + '</span><div class="track"><div class="fill" data-w="' + (r[1] / max * 100).toFixed(1) + '"></div></div><span class="n">' + fmt(r[1]) + '</span></div>').join('')
}

function pulls(s) {
  if (!s.pulls.length) return '<div class="empty">没有配置 DOCKER_REPOS</div>'
  return s.pulls.map((p) => {
    const known = p.days.filter((x) => x !== null)
    return '<div class="small pull"><span class="mono">' + esc(p.repo) + '</span> · 累计 <b>' + fmt(p.total) + '</b>' +
      (known.length ? ' · 近 ' + known.length + ' 天 <b>' + fmt(sum(known)) + '</b> · 今日 <b>' + fmt(p.days[p.days.length - 1]) + '</b>' : ' · <span class="faint">每天 00:05 读一次，明天起有每日数据</span>') + '</div>'
  }).join('')
}

// the chart, drawn at the width it is given, and again only when that width
// changes: the observer also reports once as it starts, and a repaint then
// wiped a tooltip the mouse had just opened
let resizer = null, paintedWidth = 0
function drawChart() {
  const box = document.getElementById('chart')
  if (!box) return
  if (resizer) resizer.disconnect()
  paint(box)
  paintedWidth = box.clientWidth
  resizer = new ResizeObserver(() => {
    if (box.clientWidth === paintedWidth) return
    paintedWidth = box.clientWidth
    paint(box)
  })
  resizer.observe(box)
}

// about four steps of 1, 2 or 5 × 10ⁿ (counts are whole numbers)
function niceScale(v) {
  const raw = Math.max(1, v / 4), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p
  const step = Math.max(1, (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p)
  return { step, max: Math.max(step, Math.ceil(v / step) * step) }
}

function paint(box) {
  const s = state.data, series = state.view === 'runs' ? s.runs : s.unique
  const hosts = s.hosts.map((h, i) => ({ h: h.host, i })).filter((x) => !state.off.has(x.h))
  const W = Math.max(280, box.clientWidth), H = 260, L = 44, R = 8, T = 10, B = 26
  const n = s.days.length, cw = (W - L - R) / n, bw = Math.max(1, Math.min(28, cw * 0.72))
  const totals = s.days.map((_, d) => sum(hosts.map((x) => series[x.h][d] || 0)))
  const { step, max } = niceScale(Math.max(1, ...totals)), y = (v) => T + (H - T - B) * (1 - v / max)
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" height="' + H + '" role="img" aria-hidden="true">'
  for (let v = 0; v <= max; v += step) {
    const yy = y(v)
    svg += '<line class="grid-line" x1="' + L + '" x2="' + (W - R) + '" y1="' + yy + '" y2="' + yy + '"/>' +
      '<text class="axis" x="' + (L - 6) + '" y="' + (yy + 4) + '" text-anchor="end">' + fmt(Math.round(v)) + '</text>'
  }
  const every = Math.ceil(n / Math.max(2, Math.floor((W - L - R) / 56)))
  s.days.forEach((d, i) => {
    const x = L + cw * i + cw / 2
    if ((n - 1 - i) % every === 0) svg += '<text class="axis" x="' + x + '" y="' + (H - 8) + '" text-anchor="middle">' + short(d) + '</text>'
    let base = 0
    for (const { h, i: ci } of hosts) {
      const v = series[h][i] || 0
      if (!v) continue
      svg += '<rect x="' + (x - bw / 2) + '" y="' + y(base + v) + '" width="' + bw + '" height="' + Math.max(0.5, y(base) - y(base + v)) + '" fill="' + color(ci) + '" rx="1.5"/>'
      base += v
    }
  })
  svg += '<rect class="hover-band" id="band" x="0" y="' + T + '" width="' + cw + '" height="' + (H - T - B) + '" visibility="hidden"/></svg>'
  // for screen readers: the same numbers as a table (in a div: a table keeps its rows' height)
  const sr = '<div class="sr-only"><table><caption>每日' + (state.view === 'runs' ? '运行次数' : '独立服务器') + '</caption><tbody>' +
    s.days.map((d, i) => '<tr><th scope="row">' + d + '</th><td>' + totals[i] + '</td></tr>').join('') + '</tbody></table></div>'
  box.innerHTML = svg + sr + '<div class="tip" id="tip" data-test="chart-tip" hidden></div>'
  const band = box.querySelector('#band'), tip = box.querySelector('#tip')
  let cur = -1
  const show = (i) => {
    if (i < 0 || i >= n) return hide()
    cur = i
    band.setAttribute('x', L + cw * i)
    band.setAttribute('visibility', 'visible')
    const rows = hosts.map(({ h, i: ci }) => ({ h, ci, v: series[h][i] || 0 })).filter((r) => r.v).sort((a, b) => b.v - a.v)
    // servers: each once over every script, and the scripts' own counts (a server may run two)
    const head = state.view === 'runs' ? fmt(totals[i]) + ' 次'
      : fmt(s.uniqueAll[i]) + ' 台' + (totals[i] !== s.uniqueAll[i] ? '<span class="faint">（各脚本合计 ' + fmt(totals[i]) + '）</span>' : '')
    tip.innerHTML = '<div class="t">' + s.days[i] + ' · ' + head + '</div>' +
      (rows.length ? rows.map((r) => '<div class="r"><i class="' + kc(r.ci) + '"></i>' + esc(label(r.h)) + '<b>' + fmt(r.v) + '</b></div>').join('') : '<div class="faint">没有</div>')
    tip.hidden = false
    const bx = L + cw * i + cw / 2, tw = tip.offsetWidth
    tip.style.left = Math.min(Math.max(0, bx + 12 + tw > box.clientWidth ? bx - 12 - tw : bx + 12), box.clientWidth - tw) + 'px'
    tip.style.top = T + 'px'
  }
  const hide = () => { cur = -1; band.setAttribute('visibility', 'hidden'); tip.hidden = true }
  const svgEl = box.querySelector('svg')
  svgEl.addEventListener('mousemove', (e) => {
    const r = svgEl.getBoundingClientRect(), x = (e.clientX - r.left) * (W / r.width)
    show(Math.floor((x - L) / cw))
  })
  svgEl.addEventListener('mouseleave', hide)
  box.onkeydown = (e) => {
    if (e.key === 'ArrowLeft') { show(cur < 0 ? n - 1 : Math.max(0, cur - 1)); e.preventDefault() }
    else if (e.key === 'ArrowRight') { show(cur < 0 ? n - 1 : Math.min(n - 1, cur + 1)); e.preventDefault() }
    else if (e.key === 'Escape') hide()
  }
  box.onblur = hide
}

load()
`
