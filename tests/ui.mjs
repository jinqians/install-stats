// The stats page in a real browser, after tests/e2e.sh has counted its runs
// (today: snell 6 from 4 servers, menu 1 from one of them): signing in, the numbers, the chart
// and its tooltip (mouse and keyboard), the legend, the views and ranges, a
// phone's width, the dark theme, signing out — and no script error or CSP
// violation on the way. Usage: node ui.mjs <url> <screenshot dir> <password>
import { chromium } from 'playwright'

const [base, out, password] = process.argv.slice(2)
let failed = 0
const ok = (m) => console.log(`ok   ${m}`)
const bad = (m, e) => { failed++; console.log(`FAIL ${m}${e ? `: ${e.message ?? e}` : ''}`) }
async function step(name, fn) { try { await fn(); ok(name) } catch (e) { bad(name, e) } }
const sel = (t) => `[data-test="${t}"]`

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1360, height: 900 }, locale: 'zh-CN' })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
// (a 401 before signing in is the page asking, not an error)
page.on('console', (m) => { if (m.type() === 'error' && !/status of 401/.test(m.text())) errors.push(m.text()) })

await step('the sign-in form; a wrong password is said so', async () => {
  await page.goto(base)
  await page.waitForSelector(sel('login'))
  await page.fill(sel('password'), 'wrong-wrong')
  await page.click(sel('login-submit'))
  await page.waitForFunction((s) => document.querySelector(s)?.textContent.includes('密码不对'), sel('login-error'), { timeout: 8000 })
})
await page.screenshot({ path: `${out}/login.png` })

await step('signed in: today 7 runs from 4 servers (each once over both scripts)', async () => {
  await page.fill(sel('password'), password)
  await page.click(sel('login-submit'))
  await page.waitForSelector(sel('kpi-today'), { timeout: 10000 })
  const t = await page.textContent(`${sel('kpi-today')} .value`), u = await page.textContent(`${sel('kpi-unique')} .value`)
  if (t !== '7' || u !== '4') throw new Error(`today ${t}, servers ${u}`)
})

await step('the scripts table: snell 6 today, 4 yesterday, 10 in all, 4 servers, 1 other', async () => {
  const cells = await page.$$eval(`${sel('row-snell')} td`, (td) => td.map((x) => x.textContent.trim()))
  // 脚本 今日 昨日 近7天 近30天 累计 今日服务器 其他访问
  if (cells[1] !== '6' || cells[2] !== '4' || cells[5] !== '10' || cells[6] !== '4' || cells[7] !== '1') throw new Error(cells.join(' | '))
})

await step('… under their project: snell.sh 7 today, 11 in all, 4 servers (each once)', async () => {
  const cells = await page.$$eval(`${sel('project-snell.sh')} td`, (td) => td.map((x) => x.textContent.trim()))
  if (!cells[0].startsWith('snell.sh') || !cells[0].includes('6 个脚本') || cells[1] !== '7' || cells[2] !== '4' || cells[5] !== '11' || cells[6] !== '4' || cells[7] !== '1') throw new Error(cells.join(' | '))
  const order = await page.$$eval(`${sel('scripts')} tbody tr`, (tr) => tr.map((r) => r.dataset.test))
  if (order.slice(0, 7).join() !== 'project-snell.sh,row-install,row-snell,row-snell-centos,row-snell-docker,row-snell-alpine,row-menu') throw new Error(order.join())
})

await step('the chart: bars, and the mouse over today shows its runs per script', async () => {
  const bars = await page.$$(`${sel('chart')} svg rect[fill]`)
  if (bars.length < 3) throw new Error(`${bars.length} bars`)
  const b = await page.$eval(`${sel('chart')} svg`, (s) => { const r = s.getBoundingClientRect(); return { x: r.right - 20, y: r.top + 120 } })
  await page.mouse.move(b.x, b.y)
  const tip = await page.waitForSelector(`${sel('chart-tip')}:not([hidden])`, { timeout: 3000 })
  const text = await tip.innerText()
  if (!text.includes('7 次') || !/snell\s*6/.test(text) || !/menu\s*1/.test(text)) throw new Error(text)
  await page.screenshot({ path: `${out}/dashboard.png` })
  await page.mouse.move(5, 5)
  if (!(await page.$eval(sel('chart-tip'), (t) => t.hidden))) throw new Error('the tooltip stays after the mouse left')
})

await step('… by keyboard too: ← → move through the days', async () => {
  await page.focus(sel('chart'))
  await page.keyboard.press('ArrowLeft')
  const today = await page.$eval(sel('chart-tip'), (t) => t.querySelector('.t').textContent)
  await page.keyboard.press('ArrowLeft')
  const before = await page.$eval(sel('chart-tip'), (t) => t.querySelector('.t').textContent)
  if (today === before || !before.includes('4 次')) throw new Error(`${today} / ${before}`)
  await page.keyboard.press('Escape')
})

await step('the legend: snell off takes it out of the chart', async () => {
  await page.click(`${sel('legend')} [data-host="snell.jinqians.com"]`)
  const b = await page.$eval(`${sel('chart')} svg`, (s) => { const r = s.getBoundingClientRect(); return { x: r.right - 20, y: r.top + 120 } })
  await page.mouse.move(b.x, b.y)
  const text = await (await page.waitForSelector(`${sel('chart-tip')}:not([hidden])`)).innerText()
  if (text.includes('snell') || !text.includes('1 次')) throw new Error(text)
  await page.click(`${sel('legend')} [data-host="snell.jinqians.com"]`)
})

await step('独立服务器: 4 servers, and the scripts\' own counts (5: one ran both)', async () => {
  await page.click(sel('view-unique'))
  const b = await page.$eval(`${sel('chart')} svg`, (s) => { const r = s.getBoundingClientRect(); return { x: r.right - 20, y: r.top + 120 } })
  await page.mouse.move(b.x, b.y)
  const text = await (await page.waitForSelector(`${sel('chart-tip')}:not([hidden])`)).innerText()
  if (!text.includes('4 台') || !text.includes('合计 5') || !/snell\s*4/.test(text)) throw new Error(text)
  await page.mouse.move(5, 5)
})

await step('90 days: the range changes, the chart follows', async () => {
  await page.click(sel('days-90'))
  await page.waitForFunction((s) => document.querySelector(s)?.textContent.includes('近 90 天'), sel('kpi-period'), { timeout: 8000 })
})

await step('countries, clients, Docker pulls', async () => {
  const a = await page.textContent(sel('agents'))
  if (!/curl\s*10/.test(a) || !/wget\s*1/.test(a)) throw new Error(a)
  const p = await page.textContent(sel('pulls'))
  if (!p.includes('jinqians/snell-server') || !p.includes('累计')) throw new Error(p)
})

await step('on a phone: nothing wider than the screen', async () => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  if (over > 1) throw new Error(`${over}px too wide`)
  await page.screenshot({ path: `${out}/phone.png`, fullPage: true })
  await page.setViewportSize({ width: 1360, height: 900 })
})

await step('the dark theme follows the system', async () => {
  await page.emulateMedia({ colorScheme: 'dark' })
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
  if (bg !== 'rgb(15, 18, 22)') throw new Error(bg)
  await page.screenshot({ path: `${out}/dark.png` })
  await page.emulateMedia({ colorScheme: 'light' })
})

await step('signing out: back to the form, and the stats closed again', async () => {
  await page.click(sel('logout'))
  await page.waitForSelector(sel('login'))
  await page.reload()
  await page.waitForSelector(sel('login'))
})

await step('no script error, no CSP violation', async () => {
  if (errors.length) throw new Error(errors.join(' | '))
})

await browser.close()
process.exit(failed ? 1 : 0)
