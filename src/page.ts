// The stats page: one HTML shell, its script and its style (served as files,
// so the Content-Security-Policy allows no inline script). No build step.

export const PAGE_HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Install stats</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%232a78d6'/%3E%3Cpath d='M4 12V8M8 12V4M12 12V6' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E">
<link rel="stylesheet" href="/app.css">
<script src="/app.js" defer></script>
</head>
<body>
<main id="app" class="wrap"><p class="muted" data-test="loading">…</p></main>
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
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; background: var(--surface-2); border-radius: 4px; padding: 1px 5px; word-break: break-all }
.help { color: var(--muted); font-size: 13px; margin: 0 0 12px }
.help li { margin: 4px 0 }
.rows { display: grid; gap: 12px }
.srow { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 2.4fr) minmax(0, 1fr) minmax(0, 1.4fr) auto; gap: 8px; align-items: start }
.srow .entry { grid-column: 1 / -1; margin-top: -4px }
.srow-head { color: var(--muted); font-size: 12.5px }
@media (max-width: 860px) { .srow { grid-template-columns: minmax(0, 1fr) } .srow-head { display: none } .srow { border-bottom: 1px solid var(--border); padding-bottom: 12px } }
input.input, select.input, textarea.input { width: 100%; padding: 7px 10px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface) }
textarea.input { min-height: 84px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12.5px; resize: vertical }
.actions { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; margin-top: 14px }
.ok-msg { color: var(--ok); font-size: 13px }
.btn.danger { color: var(--err) }
`


// (a template literal: no backtick, dollar-brace or backslash in it)
export const APP_JS = `
'use strict'
const app = document.getElementById('app')
const state = { tab: 'stats', days: 30, view: 'runs', off: new Set(), data: null, cfg: null, host: '', dirty: false }
const COLORS = 8

// ── language: the browser's, or the one picked (zh / en) ──
const TEXT = {
  zh: {
    title: '安装统计', signinHint: '输入 ADMIN_PASSWORD 登录。', password: '密码', signin: '登录', logout: '退出', other_lang: 'EN',
    tabStats: '统计', tabSettings: '设置', tz: (tz, d) => '按 ' + tz + ' 计日，今天 ' + d, range: (d) => (d === 365 ? '1 年' : d + ' 天'),
    kToday: '今日运行', kServers: '今日独立服务器', kPeriod: (n) => '近 ' + n + ' 天运行', kAll: '累计运行', delta: (d) => '较昨日 ' + d,
    chartRuns: '每日运行次数', chartServers: '每日独立服务器', vRuns: '运行次数', vServers: '独立服务器', chartAria: '每日柱状图，左右方向键查看每一天',
    table: '各项目和脚本', cols: (n) => ['脚本', '今日', '昨日', '近 7 天', '近 ' + n + ' 天', '累计', '今日服务器', '其他访问'],
    otherTitle: '浏览器、爬虫等不是 curl / wget 的访问', removed: '已不在设置里', nScripts: (n) => n + ' 个脚本', otherGroup: '其他',
    countries: '来源国家 / 地区', lastN: (n) => '近 ' + n + ' 天', unknown: '未知', noData: '还没有数据',
    clients: '客户端', otherClient: '其他（浏览器、爬虫）', pulls: 'Docker 拉取', noRepos: '没有设置 Docker 仓库', total: '累计', today: '今日',
    firstDay: '每天读一次，明天起有每日数据', footer: '运行 = curl / wget 取脚本一次；独立服务器按当天去重，不保存 IP。',
    tipRuns: (n) => n + ' 次', tipServers: (n) => n + ' 台', tipOwn: (n) => '（各脚本合计 ' + n + '）', none: '没有',
    empty: '还没有要统计的脚本。', toSettings: '去设置',
    scripts: '脚本', colName: '名字', colUrl: '脚本地址', colProject: '项目', colHosts: '独立域名（可选）',
    phName: '如 tool', phUrl: '如 https://raw.githubusercontent.com/you/tool/main/install.sh', phHosts: '可选，如 tool.example.com',
    phProject: '默认：GitHub 仓库名', entry: '入口：', remove: '删除', add: '添加脚本',
    repos: 'Docker Hub 仓库', reposHelp: '每行一个，写成 owner/name；每天记一次拉取数。',
    zone: '时区', zoneHelp: '按这个时区计算「一天」。', save: '保存', saved: '已保存', unsaved: '有未保存的修改',
    io: '导入 / 导出', ioHelp: 'JSON 格式，可以在不同的部署之间搬配置。', exportBtn: '导出当前配置', importBtn: '导入到上面的表单',
    badJson: '不是有效的 JSON', loaded: '已导入，检查后点「保存」',
    connect: '接入方式',
    connectBody: (h) => '<ol class="help"><li><b>路径</b>（不用改 Worker 的设置）：把 <code>https://' + h + '/名字</code> 发给用户，比如 <code>bash &lt;(curl -sL https://' + h + '/名字)</code>；已有短域名的，在 Cloudflare 里把它的重定向规则目标改成这个地址。</li>' +
      '<li><b>独立域名</b>：Cloudflare → Workers 和 Pages → 这个 Worker → 设置 → 域和路由 → 添加路由 <code>短域名/*</code>；删掉这个域名原来的重定向规则（重定向规则先于 Worker 执行）；再把它填进这个脚本的「独立域名」。</li></ol>',
    errors: {
      wrong_password: '密码不对', no_password: '先在 Worker 的「设置 → 变量和机密」里设置 ADMIN_PASSWORD（至少 8 位）', signin: '请先登录',
      forbidden: '拒绝：请求不是从这个页面发出的', internal: '服务出错了', not_found: '没有这个地址',
      name: '名字只能用小写字母、数字和 . _ -，最多 64 个：', reserved: '这个名字留给统计页自己用：', duplicate_name: '名字重复：',
      url: '脚本地址要以 https:// 开头：', project: '项目名只能用字母、数字和 . _ -：', host: '不是有效的域名：', duplicate_host: '域名重复：',
      stats_host: '这是统计页自己的域名，不能给脚本用：', timezone: '不认识的时区：', repo: 'Docker 仓库要写成 owner/name：',
      too_many_scripts: '脚本太多：', too_many_repos: 'Docker 仓库太多：', scripts: '配置里要有 scripts 列表',
    },
  },
  en: {
    title: 'Install stats', signinHint: 'Sign in with ADMIN_PASSWORD.', password: 'Password', signin: 'Sign in', logout: 'Sign out', other_lang: '中文',
    tabStats: 'Stats', tabSettings: 'Settings', tz: (tz, d) => 'Days in ' + tz + ', today ' + d, range: (d) => (d === 365 ? '1 year' : d + ' days'),
    kToday: 'Runs today', kServers: 'Servers today', kPeriod: (n) => 'Runs, last ' + n + ' days', kAll: 'Runs, all time', delta: (d) => d + ' vs yesterday',
    chartRuns: 'Daily runs', chartServers: 'Daily servers', vRuns: 'Runs', vServers: 'Servers', chartAria: 'Daily bars; the arrow keys move through the days',
    table: 'Projects and scripts', cols: (n) => ['Script', 'Today', 'Yesterday', '7 days', n + ' days', 'All time', 'Servers today', 'Other'],
    otherTitle: 'Browsers, crawlers: anything but curl / wget', removed: 'No longer in the settings', nScripts: (n) => n + (n === 1 ? ' script' : ' scripts'), otherGroup: 'Other',
    countries: 'Countries / regions', lastN: (n) => 'last ' + n + ' days', unknown: 'Unknown', noData: 'No data yet',
    clients: 'Clients', otherClient: 'Other (browsers, crawlers)', pulls: 'Docker pulls', noRepos: 'No Docker repositories set', total: 'total', today: 'today',
    firstDay: 'read once a day; daily numbers from tomorrow', footer: 'A run is curl / wget fetching a script once; servers are counted once a day, and no IP is kept.',
    tipRuns: (n) => n + ' runs', tipServers: (n) => n + ' servers', tipOwn: (n) => ' (the scripts’ own: ' + n + ')', none: 'none',
    empty: 'No scripts to count yet.', toSettings: 'Go to the settings',
    scripts: 'Scripts', colName: 'Name', colUrl: 'Script URL', colProject: 'Project', colHosts: 'Own hostnames (optional)',
    phName: 'e.g. tool', phUrl: 'e.g. https://raw.githubusercontent.com/you/tool/main/install.sh', phHosts: 'Optional, e.g. tool.example.com',
    phProject: 'Default: its GitHub repository', entry: 'Entry: ', remove: 'Remove', add: 'Add a script',
    repos: 'Docker Hub repositories', reposHelp: 'One per line, as owner/name; the pull count is read once a day.',
    zone: 'Time zone', zoneHelp: 'A day is counted in this time zone.', save: 'Save', saved: 'Saved', unsaved: 'Unsaved changes',
    io: 'Import / export', ioHelp: 'JSON, to move a configuration between deployments.', exportBtn: 'Export the configuration', importBtn: 'Load into the form above',
    badJson: 'Not valid JSON', loaded: 'Loaded: check it, then Save',
    connect: 'Connecting a script',
    connectBody: (h) => '<ol class="help"><li><b>Path</b> (nothing to change on the Worker): hand out <code>https://' + h + '/name</code>, as in <code>bash &lt;(curl -sL https://' + h + '/name)</code>; for an existing short domain, point its redirect rule in Cloudflare at this address.</li>' +
      '<li><b>Own hostname</b>: Cloudflare → Workers &amp; Pages → this Worker → Settings → Domains &amp; Routes → Add route <code>short.domain/*</code>; delete the hostname’s old redirect rule (redirect rules run before Workers); then enter it under the script’s own hostnames.</li></ol>',
    errors: {
      wrong_password: 'Wrong password', no_password: 'Set the ADMIN_PASSWORD secret (8+ characters) under the Worker’s Settings → Variables and Secrets first', signin: 'Please sign in',
      forbidden: 'Refused: the request did not come from this page', internal: 'Something went wrong', not_found: 'Not found',
      name: 'A name is lower-case letters, digits and . _ - (up to 64): ', reserved: 'This name is the stats page’s own: ', duplicate_name: 'A name twice: ',
      url: 'A script URL starts with https://: ', project: 'A project is letters, digits and . _ -: ', host: 'Not a valid hostname: ', duplicate_host: 'A hostname twice: ',
      stats_host: 'This is the stats page’s own hostname: ', timezone: 'Unknown time zone: ', repo: 'A Docker repository is owner/name: ',
      too_many_scripts: 'Too many scripts: ', too_many_repos: 'Too many Docker repositories: ', scripts: 'The configuration needs a scripts list',
    },
  },
}
function pickLang() {
  let saved = ''
  try { saved = localStorage.getItem('lang') || '' } catch (e) { /* no storage */ }
  if (saved === 'zh' || saved === 'en') return saved
  return (navigator.language || '').toLowerCase().startsWith('zh') ? 'zh' : 'en'
}
let lang = pickLang()
const T = (k, ...a) => { const v = TEXT[lang][k]; return typeof v === 'function' ? v(...a) : v }
const errText = (b) => {
  const e = TEXT[lang].errors
  if (b && b.error === 'invalid') return (e[b.field] || b.field) + (b.value !== undefined ? b.value : '')
  return (b && e[b.error]) || (b && b.error) || ''
}
function setLang(l) {
  lang = l
  try { localStorage.setItem('lang', l) } catch (e) { /* no storage */ }
  applyLang()
}
function applyLang() {
  document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en'
  document.title = T('title')
}
applyLang()

const fmt = (n) => (n === null || n === undefined ? '—' : Number(n).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-US'))
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const color = (i) => 'var(--c' + (i % COLORS) + ')'   // for SVG fills
const kc = (i) => 'k' + (i % COLORS)                    // the same, as a class (no inline style under the CSP)
const sum = (a) => a.reduce((x, y) => x + y, 0)
const flag = (cc) => /^[A-Z]{2}$/.test(cc) && cc !== 'XX' && cc !== 'T1' ? String.fromCodePoint(...[...cc].map((c) => 0x1f1a5 + c.charCodeAt(0))) : '🌐'
const short = (d) => d.slice(5).replace('-', '/')
// a list typed into a field: split at anything a hostname or owner/name never has
const words = (s) => String(s || '').split(/[^A-Za-z0-9._/-]+/).filter(Boolean)

async function api(path, init) {
  const r = await fetch(path, { ...init, headers: { 'Content-Type': 'application/json' } })
  const body = await r.json().catch(() => ({}))
  return { status: r.status, body }
}

function langButton() {
  return '<button class="btn" type="button" id="lang" data-test="lang">' + T('other_lang') + '</button>'
}
function bindLang(again) {
  const b = document.getElementById('lang')
  if (b) b.addEventListener('click', () => { setLang(lang === 'zh' ? 'en' : 'zh'); again() })
}

function showLogin(message) {
  stopChart()
  state.data = null; state.cfg = null
  app.innerHTML = '<div class="card login" data-test="login"><div class="head"><h1>' + T('title') + '</h1><span class="grow"></span>' + langButton() + '</div>' +
    '<p class="muted small">' + T('signinHint') + '</p>' +
    '<form><input class="input" type="password" autocomplete="current-password" placeholder="' + T('password') + '" data-test="password" required>' +
    '<button class="btn primary" type="submit" data-test="login-submit">' + T('signin') + '</button><div class="error" data-test="login-error"></div></form></div>'
  const form = app.querySelector('form'), err = app.querySelector('.error')
  if (message) err.textContent = message
  bindLang(() => showLogin())
  form.querySelector('input').focus()
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    err.textContent = ''
    const { status, body } = await api('/api/login', { method: 'POST', body: JSON.stringify({ password: form.querySelector('input').value }) })
    if (status === 200) load()
    else err.textContent = errText(body) || ('HTTP ' + status)
  })
}

function showProblem(status, body) {
  if (status === 401) return showLogin()
  stopChart()
  app.innerHTML = '<div class="card login"><div class="head"><h1>' + T('title') + '</h1><span class="grow"></span>' + langButton() + '</div>' +
    '<p class="error" data-test="' + (status === 503 ? 'not-configured' : 'error') + '">' + esc(errText(body) || ('HTTP ' + status)) + '</p></div>'
  bindLang(() => showProblem(status, body))
}

async function load() {
  if (state.tab === 'settings') return loadSettings()
  const { status, body } = await api('/api/stats?days=' + state.days)
  if (status !== 200) return showProblem(status, body)
  state.data = body
  render()
}

async function loadSettings() {
  const { status, body } = await api('/api/config')
  if (status !== 200) return showProblem(status, body)
  setCfg(body)
  // a deployment with nothing set yet: the browser's time zone to start from
  if (!state.cfg.scripts.length && !state.cfg.dockerRepos.length && state.cfg.timezone === 'UTC') {
    try { state.cfg.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' } catch (e) { /* keep UTC */ }
  }
  renderSettings()
}

function setCfg(body) {
  // the scripts' entries hang off the address this page is on
  state.host = location.host
  state.cfg = {
    scripts: (body.scripts || []).map((s) => ({ name: s.name, url: s.url, project: s.project || '', hosts: (s.hosts || []).join(' ') })),
    timezone: body.timezone || 'UTC',
    dockerRepos: body.dockerRepos || [],
  }
  state.dirty = false
}

// the header both views share: the title, the tabs, the language, signing out
function header(extra) {
  return '<div class="head"><h1>' + T('title') + '</h1>' + (extra || '') + '<span class="grow"></span>' +
    '<div class="seg" role="tablist">' +
      '<button type="button" role="tab" data-tab="stats" data-test="tab-stats" class="' + (state.tab === 'stats' ? 'on' : '') + '">' + T('tabStats') + '</button>' +
      '<button type="button" role="tab" data-tab="settings" data-test="tab-settings" class="' + (state.tab === 'settings' ? 'on' : '') + '">' + T('tabSettings') + '</button></div>' +
    langButton() + '<button class="btn" type="button" data-test="logout" id="logout">' + T('logout') + '</button></div>'
}
function bindHeader(again) {
  app.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    if (state.tab === b.dataset.tab) return
    state.tab = b.dataset.tab
    if (state.tab === 'stats' && state.data) render()
    else if (state.tab === 'settings' && state.cfg) renderSettings()
    else load()
  }))
  bindLang(again)
  document.getElementById('logout').addEventListener('click', async () => { await api('/api/logout', { method: 'POST' }); showLogin() })
}

function kpi(labelText, value, delta, test) {
  let d = ''
  if (delta !== undefined && delta !== null) {
    const cls = delta > 0 ? 'up' : delta < 0 ? 'down' : ''
    d = '<div class="delta ' + cls + '">' + T('delta', (delta > 0 ? '+' : '') + fmt(delta)) + '</div>'
  }
  return '<div class="card kpi" data-test="' + test + '"><div class="label">' + labelText + '</div><div class="value">' + value + '</div>' + d + '</div>'
}

function render() {
  const s = state.data, n = s.days.length, t = n - 1
  const names = s.scripts.map((x) => x.name)
  const info = '<span class="muted small">' + esc(T('tz', s.timezone, s.today)) + '</span>'
  const days = '<div class="seg" role="radiogroup">' + [7, 30, 90, 365].map((d) =>
    '<button type="button" role="radio" aria-checked="' + (d === state.days) + '" class="' + (d === state.days ? 'on' : '') + '" data-days="' + d + '" data-test="days-' + d + '">' + T('range', d) + '</button>').join('') + '</div>'
  if (!names.length) {
    stopChart()
    app.innerHTML = header(info) + '<div class="card empty" data-test="empty"><p>' + T('empty') + '</p><button class="btn primary" type="button" id="to-settings" data-test="to-settings">' + T('toSettings') + '</button></div>'
    bindHeader(render)
    document.getElementById('to-settings').addEventListener('click', () => { state.tab = 'settings'; load() })
    return
  }
  const at = (series, i) => sum(names.map((h) => series[h][i] || 0))
  const period = sum(names.map((h) => sum(s.runs[h])))
  const all = sum(Object.values(s.totals).map((x) => x.all))
  const cols = T('cols', n)
  app.innerHTML = header(info) +
    '<div class="head">' + days + '</div>' +
    '<div class="grid kpis">' +
      kpi(T('kToday'), fmt(at(s.runs, t)), at(s.runs, t) - at(s.runs, t - 1), 'kpi-today') +
      kpi(T('kServers'), fmt(s.uniqueAll[t]), s.uniqueAll[t] - s.uniqueAll[t - 1], 'kpi-unique') +
      kpi(T('kPeriod', n), fmt(period), null, 'kpi-period') +
      kpi(T('kAll'), fmt(all), null, 'kpi-all') +
    '</div>' +
    '<div class="card"><div class="chart-head"><h2 class="flat">' + (state.view === 'runs' ? T('chartRuns') : T('chartServers')) + '</h2><span class="grow"></span>' +
      '<div class="seg" role="radiogroup"><button type="button" data-view="runs" data-test="view-runs" class="' + (state.view === 'runs' ? 'on' : '') + '">' + T('vRuns') + '</button>' +
      '<button type="button" data-view="unique" data-test="view-unique" class="' + (state.view === 'unique' ? 'on' : '') + '">' + T('vServers') + '</button></div></div>' +
      '<div class="legend" data-test="legend">' + names.map((h, i) =>
        '<button type="button" class="' + (state.off.has(h) ? 'off' : '') + '" data-script="' + esc(h) + '" aria-pressed="' + !state.off.has(h) + '"><i class="' + kc(i) + '"></i>' + esc(h) + '</button>').join('') + '</div>' +
      '<div class="chart" id="chart" tabindex="0" data-test="chart" aria-label="' + T('chartAria') + '"></div></div>' +
    '<div class="card mt"><h2>' + T('table') + '</h2><div class="table-wrap"><table data-test="scripts"><thead><tr>' +
      cols.map((c, i) => '<th' + (i === 7 ? ' title="' + T('otherTitle') + '"' : '') + '>' + c + '</th>').join('') + '</tr></thead><tbody>' +
      groups(s).map((g) => projectRow(s, g, t) + g.scripts.map((name) => {
        const i = names.indexOf(name), sc = s.scripts[i]
        const r = s.runs[name], u = s.unique[name], o = s.other[name]
        return '<tr class="sub" data-test="row-' + esc(name) + '"><td><span class="dot ' + kc(i) + '"></span><span title="' + esc(sc.url || T('removed')) + '">' + esc(name) + '</span></td>' +
          '<td>' + fmt(r[t]) + '</td><td>' + fmt(r[t - 1]) + '</td><td>' + fmt(sum(r.slice(-7))) + '</td><td>' + fmt(sum(r)) + '</td>' +
          '<td>' + fmt(s.totals[name] ? s.totals[name].all : 0) + '</td><td>' + fmt(u[t]) + '</td><td class="faint">' + fmt(sum(o)) + '</td></tr>'
      }).join('')).join('') + '</tbody></table></div></div>' +
    '<div class="grid two">' +
      '<div class="card"><h2>' + T('countries') + ' <span class="faint small">' + T('lastN', n) + '</span></h2><div class="bars" data-test="countries">' + countries(s.countries) + '</div></div>' +
      '<div class="card"><h2>' + T('clients') + ' <span class="faint small">' + T('lastN', n) + '</span></h2><div class="bars" data-test="agents">' + agents(s.agents) + '</div>' +
        '<h2 class="mt-lg">' + T('pulls') + '</h2><div data-test="pulls">' + pulls(s) + '</div></div>' +
    '</div>' +
    '<footer>' + T('footer') + '</footer>'

  bindHeader(render)
  app.querySelectorAll('[data-days]').forEach((b) => b.addEventListener('click', () => { state.days = Number(b.dataset.days); load() }))
  app.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => { state.view = b.dataset.view; render() }))
  app.querySelectorAll('[data-script]').forEach((b) => b.addEventListener('click', () => {
    const h = b.dataset.script
    state.off.has(h) ? state.off.delete(h) : state.off.add(h)
    render()
  }))
  // widths through the CSSOM, which the CSP allows (a style attribute it does not)
  app.querySelectorAll('[data-w]').forEach((el) => { el.style.width = el.dataset.w + '%' })
  drawChart()
}

// the scripts under their project, and any no longer in the settings under Other
function groups(s) {
  const out = s.projects.map((p) => ({ name: p.name, scripts: p.scripts, unique: p.unique }))
  const known = new Set(out.flatMap((g) => g.scripts))
  const rest = s.scripts.map((x) => x.name).filter((n) => !known.has(n))
  if (rest.length) out.push({ name: T('otherGroup'), scripts: rest, unique: null })
  return out
}

// a project's own row: its scripts added up; its servers each once
function projectRow(s, g, t) {
  const add = (pick) => sum(g.scripts.map((h) => pick(h)))
  return '<tr class="group" data-test="project-' + esc(g.name) + '"><td>' + esc(g.name) + ' <span class="faint small">' + T('nScripts', g.scripts.length) + '</span></td>' +
    '<td>' + fmt(add((h) => s.runs[h][t])) + '</td><td>' + fmt(add((h) => s.runs[h][t - 1])) + '</td>' +
    '<td>' + fmt(add((h) => sum(s.runs[h].slice(-7)))) + '</td><td>' + fmt(add((h) => sum(s.runs[h]))) + '</td>' +
    '<td>' + fmt(add((h) => (s.totals[h] ? s.totals[h].all : 0))) + '</td><td>' + (g.unique ? fmt(g.unique[t]) : '—') + '</td>' +
    '<td class="faint">' + fmt(add((h) => sum(s.other[h]))) + '</td></tr>'
}

function countries(rows) {
  if (!rows.length) return '<div class="empty">' + T('noData') + '</div>'
  const max = Math.max(...rows.map((r) => r.n))
  return rows.map((r) => '<div class="bar-row"><span>' + flag(r.country) + ' ' + esc(r.country || T('unknown')) + '</span><div class="track"><div class="fill" data-w="' + (r.n / max * 100).toFixed(1) + '"></div></div><span class="n">' + fmt(r.n) + '</span></div>').join('')
}

function agents(a) {
  const rows = [['curl', a.curl || 0], ['wget', a.wget || 0], [T('otherClient'), a.other || 0]]
  const max = Math.max(1, ...rows.map((r) => r[1]))
  return rows.map((r) => '<div class="bar-row"><span>' + r[0] + '</span><div class="track"><div class="fill" data-w="' + (r[1] / max * 100).toFixed(1) + '"></div></div><span class="n">' + fmt(r[1]) + '</span></div>').join('')
}

function pulls(s) {
  if (!s.pulls.length) return '<div class="empty">' + T('noRepos') + '</div>'
  return s.pulls.map((p) => {
    const known = p.days.filter((x) => x !== null)
    return '<div class="small pull"><span class="mono">' + esc(p.repo) + '</span> · ' + T('total') + ' <b>' + fmt(p.total) + '</b>' +
      (known.length ? ' · ' + T('lastN', known.length) + ' <b>' + fmt(sum(known)) + '</b> · ' + T('today') + ' <b>' + fmt(p.days[p.days.length - 1]) + '</b>' : ' · <span class="faint">' + T('firstDay') + '</span>') + '</div>'
  }).join('')
}

// ── the settings ──
function zoneOptions(current) {
  let zones = []
  try { zones = Intl.supportedValuesOf('timeZone') } catch (e) { /* an older browser: a text field */ }
  if (!zones.length) return '<input class="input" id="tz" data-test="timezone" value="' + esc(current) + '">'
  if (!zones.includes('UTC')) zones = ['UTC', ...zones]
  if (!zones.includes(current)) zones = [current, ...zones]
  return '<select class="input" id="tz" data-test="timezone">' + zones.map((z) => '<option' + (z === current ? ' selected' : '') + '>' + esc(z) + '</option>').join('') + '</select>'
}

function entryOf(name) {
  return name ? T('entry') + '<code>https://' + esc(state.host) + '/' + esc(name) + '</code>' : ''
}

function scriptRow(sc, i) {
  return '<div class="srow" data-test="srow-' + i + '">' +
    '<input class="input" data-i="' + i + '" data-k="name" data-test="name-' + i + '" placeholder="' + T('phName') + '" value="' + esc(sc.name) + '" aria-label="' + T('colName') + '">' +
    '<input class="input" data-i="' + i + '" data-k="url" data-test="url-' + i + '" placeholder="' + T('phUrl') + '" value="' + esc(sc.url) + '" aria-label="' + T('colUrl') + '">' +
    '<input class="input" data-i="' + i + '" data-k="project" data-test="project-' + i + '" placeholder="' + T('phProject') + '" value="' + esc(sc.project) + '" aria-label="' + T('colProject') + '">' +
    '<input class="input" data-i="' + i + '" data-k="hosts" data-test="hosts-' + i + '" placeholder="' + T('phHosts') + '" value="' + esc(sc.hosts) + '" aria-label="' + T('colHosts') + '">' +
    '<button class="btn danger" type="button" data-remove="' + i + '" data-test="remove-' + i + '">' + T('remove') + '</button>' +
    '<div class="small muted entry" id="entry-' + i + '">' + entryOf(sc.name) + '</div></div>'
}

function renderSettings(message, isError) {
  stopChart()
  const c = state.cfg
  app.innerHTML = header() +
    '<div class="card"><h2>' + T('scripts') + '</h2>' +
      '<div class="rows" data-test="script-rows"><div class="srow srow-head"><span>' + T('colName') + '</span><span>' + T('colUrl') + '</span><span>' + T('colProject') + '</span><span>' + T('colHosts') + '</span><span></span></div>' +
      c.scripts.map(scriptRow).join('') + '</div>' +
      '<div class="actions"><button class="btn" type="button" id="add" data-test="add">' + T('add') + '</button></div></div>' +
    '<div class="grid two">' +
      '<div class="card"><h2>' + T('repos') + '</h2><p class="help">' + T('reposHelp') + '</p>' +
        '<textarea class="input" id="repos" data-test="repos" placeholder="owner/name">' + esc(c.dockerRepos.join(String.fromCharCode(10))) + '</textarea></div>' +
      '<div class="card"><h2>' + T('zone') + '</h2><p class="help">' + T('zoneHelp') + '</p>' + zoneOptions(c.timezone) + '</div>' +
    '</div>' +
    '<div class="actions"><button class="btn primary" type="button" id="save" data-test="save">' + T('save') + '</button>' +
      '<span id="msg" data-test="save-msg" class="' + (isError ? 'error' : message ? 'ok-msg' : 'muted small') + '">' + esc(message || (state.dirty ? T('unsaved') : '')) + '</span></div>' +
    '<div class="card mt"><h2>' + T('connect') + '</h2>' + T('connectBody', esc(state.host)) + '</div>' +
    '<div class="card mt"><h2>' + T('io') + '</h2><p class="help">' + T('ioHelp') + '</p>' +
      '<textarea class="input" id="io" data-test="io"></textarea>' +
      '<div class="actions"><button class="btn" type="button" id="export" data-test="export">' + T('exportBtn') + '</button>' +
      '<button class="btn" type="button" id="import" data-test="import">' + T('importBtn') + '</button><span id="io-msg" data-test="io-msg" class="small"></span></div></div>'

  bindHeader(() => renderSettings())
  const touched = () => { state.dirty = true; const m = document.getElementById('msg'); m.className = 'muted small'; m.textContent = T('unsaved') }
  app.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('input', () => {
    const i = Number(el.dataset.i)
    state.cfg.scripts[i][el.dataset.k] = el.value
    if (el.dataset.k === 'name') document.getElementById('entry-' + i).innerHTML = entryOf(el.value.trim().toLowerCase())
    touched()
  }))
  app.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
    state.cfg.scripts.splice(Number(b.dataset.remove), 1)
    state.dirty = true
    renderSettings()
  }))
  document.getElementById('add').addEventListener('click', () => {
    state.cfg.scripts.push({ name: '', url: '', project: '', hosts: '' })
    state.dirty = true
    renderSettings()
    const last = app.querySelector('[data-test="name-' + (state.cfg.scripts.length - 1) + '"]')
    if (last) last.focus()
  })
  document.getElementById('repos').addEventListener('input', (e) => { state.cfg.dockerRepos = words(e.target.value); touched() })
  document.getElementById('tz').addEventListener('change', (e) => { state.cfg.timezone = e.target.value; touched() })
  document.getElementById('tz').addEventListener('input', (e) => { state.cfg.timezone = e.target.value; touched() })
  document.getElementById('save').addEventListener('click', save)
  document.getElementById('export').addEventListener('click', () => {
    document.getElementById('io').value = JSON.stringify(outgoing(), null, 2)
  })
  document.getElementById('import').addEventListener('click', () => {
    const m = document.getElementById('io-msg')
    let v
    try { v = JSON.parse(document.getElementById('io').value) } catch (e) { m.className = 'small error'; m.textContent = T('badJson'); return }
    setCfg({ host: state.host, scripts: v.scripts || [], timezone: v.timezone || state.cfg.timezone, dockerRepos: v.dockerRepos || [] })
    state.dirty = true
    renderSettings(T('loaded'))
  })
}

// the form as the Worker takes it
function outgoing() {
  return {
    scripts: state.cfg.scripts.map((s) => ({ name: s.name.trim().toLowerCase(), url: s.url.trim(), project: s.project.trim(), hosts: words(s.hosts) })),
    timezone: state.cfg.timezone,
    dockerRepos: state.cfg.dockerRepos,
  }
}

async function save() {
  const { status, body } = await api('/api/config', { method: 'PUT', body: JSON.stringify(outgoing()) })
  if (status === 401) return showLogin()
  if (status !== 200) return renderSettings(errText(body) || ('HTTP ' + status), true)
  setCfg(body)
  state.data = null   // the stats follow the new scripts
  renderSettings(T('saved'))
}

// ── the chart ──
// drawn at the width it is given, and again only when that width changes: the
// observer also reports once as it starts, and a repaint then wiped a tooltip
// the mouse had just opened
let resizer = null, paintedWidth = 0
function drawChart() {
  const box = document.getElementById('chart')
  if (!box) return
  if (resizer) resizer.disconnect()
  paint(box)
  paintedWidth = box.clientWidth
  resizer = new ResizeObserver(() => {
    // a chart no longer on the page (another view drawn since) is not painted again
    if (!box.isConnected || !state.data) return stopChart()
    if (box.clientWidth === paintedWidth) return
    paintedWidth = box.clientWidth
    paint(box)
  })
  resizer.observe(box)
}

function stopChart() {
  if (resizer) resizer.disconnect()
  resizer = null
}

// about four steps of 1, 2 or 5 × 10ⁿ (counts are whole numbers)
function niceScale(v) {
  const raw = Math.max(1, v / 4), p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p
  const step = Math.max(1, (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p)
  return { step, max: Math.max(step, Math.ceil(v / step) * step) }
}

function paint(box) {
  const s = state.data, series = state.view === 'runs' ? s.runs : s.unique
  const shown = s.scripts.map((x, i) => ({ h: x.name, i })).filter((x) => !state.off.has(x.h))
  const W = Math.max(280, box.clientWidth), H = 260, L = 44, R = 8, Tp = 10, B = 26
  const n = s.days.length, cw = (W - L - R) / n, bw = Math.max(1, Math.min(28, cw * 0.72))
  const totals = s.days.map((_, d) => sum(shown.map((x) => series[x.h][d] || 0)))
  const { step, max } = niceScale(Math.max(1, ...totals)), y = (v) => Tp + (H - Tp - B) * (1 - v / max)
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
    for (const { h, i: ci } of shown) {
      const v = series[h][i] || 0
      if (!v) continue
      svg += '<rect x="' + (x - bw / 2) + '" y="' + y(base + v) + '" width="' + bw + '" height="' + Math.max(0.5, y(base) - y(base + v)) + '" fill="' + color(ci) + '" rx="1.5"/>'
      base += v
    }
  })
  svg += '<rect class="hover-band" id="band" x="0" y="' + Tp + '" width="' + cw + '" height="' + (H - Tp - B) + '" visibility="hidden"/></svg>'
  // for screen readers: the same numbers as a table (in a div: a table keeps its rows' height)
  const sr = '<div class="sr-only"><table><caption>' + (state.view === 'runs' ? T('chartRuns') : T('chartServers')) + '</caption><tbody>' +
    s.days.map((d, i) => '<tr><th scope="row">' + d + '</th><td>' + totals[i] + '</td></tr>').join('') + '</tbody></table></div>'
  box.innerHTML = svg + sr + '<div class="tip" id="tip" data-test="chart-tip" hidden></div>'
  const band = box.querySelector('#band'), tip = box.querySelector('#tip')
  let cur = -1
  const show = (i) => {
    if (i < 0 || i >= n) return hide()
    cur = i
    band.setAttribute('x', L + cw * i)
    band.setAttribute('visibility', 'visible')
    const rows = shown.map(({ h, i: ci }) => ({ h, ci, v: series[h][i] || 0 })).filter((r) => r.v).sort((a, b) => b.v - a.v)
    // servers: each once over every script, and the scripts' own counts (a server may run two)
    const head = state.view === 'runs' ? T('tipRuns', fmt(totals[i]))
      : T('tipServers', fmt(s.uniqueAll[i])) + (totals[i] !== s.uniqueAll[i] ? '<span class="faint">' + T('tipOwn', fmt(totals[i])) + '</span>' : '')
    tip.innerHTML = '<div class="t">' + s.days[i] + ' · ' + head + '</div>' +
      (rows.length ? rows.map((r) => '<div class="r"><i class="' + kc(r.ci) + '"></i>' + esc(r.h) + '<b>' + fmt(r.v) + '</b></div>').join('') : '<div class="faint">' + T('none') + '</div>')
    tip.hidden = false
    const bx = L + cw * i + cw / 2, tw = tip.offsetWidth
    tip.style.left = Math.min(Math.max(0, bx + 12 + tw > box.clientWidth ? bx - 12 - tw : bx + 12), box.clientWidth - tw) + 'px'
    tip.style.top = Tp + 'px'
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
