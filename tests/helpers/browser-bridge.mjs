import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname, join } from 'node:path'
import { chromium } from 'playwright'
// Real browser requests reach the application's production handlers. Only the
// existing runtime's mail and source network edges may be faked.
export async function browserBridge(app, folder) {
 let origin
 const server = createServer(async (req, res) => {
  try {
   const url = new URL(req.url, origin), path = resolve('public', '.' + url.pathname)
   if (path.startsWith(resolve('public') + '/') && /\.(css|woff2?|svg|png|js)$/.test(path)) {
    res.writeHead(200, { 'content-type': ({ '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.js': 'text/javascript' })[extname(path)] }); res.end(await readFile(path)); return
   }
   const chunks = []; for await (const chunk of req) chunks.push(chunk)
   const headers = { ...req.headers, cookie: req.headers.cookie ?? '', host: new URL(app.origin).host }
   if (headers.origin === origin) headers.origin = app.origin
   const r = await app.fetch(url.pathname + url.search, { method: req.method, headers, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }) })
   const out = Object.fromEntries(r.headers)
   if (out.location?.startsWith(app.origin)) out.location = origin + out.location.slice(app.origin.length)
   res.writeHead(r.status, out); res.end(Buffer.from(await r.arrayBuffer()))
  } catch (error) {
   if (req.aborted || res.destroyed) return
   console.error('Browser bridge failed:', error.message)
   if (res.headersSent) { res.destroy(error); return }
   res.writeHead(500); res.end('Transport unavailable')
  }
 })
 await new Promise(done => server.listen(0, '127.0.0.1', done)); origin = 'http://127.0.0.1:' + server.address().port
 const browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] })
 const output = resolve(process.env.EVIDENCE_BROWSER_OUTPUT ?? '.cache/browser', folder); await mkdir(output, { recursive: true })
 const context = async (width, cookie = '') => {
  const c = await browser.newContext({ viewport: { width, height: 1000 } })
  if (cookie) await c.addCookies(cookie.split('; ').map(pair => { const at = pair.indexOf('='); return { name: pair.slice(0, at), value: pair.slice(at + 1), url: origin } }))
  return c
 }
 const capture = async (page, name, mask = []) => {
  await page.evaluate(() => document.fonts.ready)
  const missingTooltips = await page.locator('a,button,summary').evaluateAll(items => items.filter(el => el.getClientRects().length && !/[A-Za-z]/.test(el.innerText) && el.querySelector('svg,img') && !el.getAttribute('aria-describedby')).length)
  if (missingTooltips) throw Error(name + ' has an icon-only control without a tooltip')
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
  if (overflow) throw Error(name + ' overflows at ' + page.viewportSize().width)
  await page.screenshot({ path: join(output, page.viewportSize().width + '-' + name + '.png'), fullPage: true, mask })
 }
 return { origin, context, capture, close: async () => { await browser.close(); await new Promise(done => server.close(done)) } }
}
