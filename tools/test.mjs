import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const DIST = path.resolve('dist'); const posts = [];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain' };
const srv = http.createServer((req, res) => {
  if (req.method === 'POST') { let b = ''; req.on('data', (c) => b += c); req.on('end', () => { posts.push(b); res.end('ok'); }); return; }
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(DIST, p);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.statusCode = 404; f = path.join(DIST, '404.html'); }
  res.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); res.end(fs.readFileSync(f));
}).listen(4321);
const b = await chromium.launch();
const routes = ['/', '/services/automation', '/services/paid-ads', '/services/websites', '/services/social-growth', '/services/brand-and-design', '/work', '/pricing', '/free-audit', '/privacy', '/terms', '/sms-terms', '/thanks', '/nope'];
for (const r of routes) {
  const p = await b.newPage({ viewport: { width: 1366, height: 900 } }); const errs = [];
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 200)));
  p.on('requestfailed', (q) => { if (!q.url().includes('fonts.g') && !q.url().includes('calendly')) errs.push('reqfail: ' + q.url()); });
  await p.goto('http://localhost:4321' + r, { waitUntil: 'load' }); await p.waitForTimeout(700);
  const h1 = await p.$eval('h1', (e) => e.textContent.trim().slice(0, 60)).catch(() => '(no h1)');
  // hydration check: open Services menu (desktop) if present
  let menu = 'n/a'; const btn = await p.$('nav button[aria-expanded]');
  if (btn) { await btn.click(); await p.waitForTimeout(200); menu = await btn.getAttribute('aria-expanded'); }
  console.log(r.padEnd(28), '| h1:', h1, '| menu opens:', menu, errs.length ? '\n   ' + errs.join('\n   ') : '');
  await p.close();
}
// form tests
for (const [r, sel] of [['/', '#audit form'], ['/free-audit?plan=grow&utm_source=coldemail&utm_campaign=medspa', 'form[name="audit"]']]) {
  const p = await b.newPage(); await p.goto('http://localhost:4321' + r); await p.waitForTimeout(500);
  const f = await p.$(sel); if (!f) { console.log('NO FORM', r); continue; }
  if (await f.$('input[name="name"]')) await f.$eval('input[name="name"]', (e) => e.value = 'Test Owner');
  await f.$eval('input[name="email"]', (e) => e.value = 'owner@example.com');
  const chip = await p.$('button[aria-pressed]'); if (chip && r !== '/') await chip.click();
  const picked = await p.textContent('form').then((t) => /You picked the Grow plan/.test(t));
  await p.click(sel + ' button[type="submit"]'); await p.waitForTimeout(600);
  const txt = await p.textContent('body'); console.log('FORM', r.split('?')[0], 'success shown:', /on the list|Audit requested/.test(txt), 'plan line:', picked);
  await p.close();
}
console.log('POSTS:\n' + posts.join('\n'));
// mobile screenshots
const m = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
await m.goto('http://localhost:4321/'); await m.waitForTimeout(1200); await m.screenshot({ path: '/tmp/claude-0/-home-claude/a0a374d3-89c1-5fe3-a51c-bb4b22442d75/scratchpad/m-home.png' });
const ov = await m.evaluate(() => document.documentElement.scrollWidth); console.log('mobile scrollWidth', ov);
await m.click('button.menubtn'); await m.waitForTimeout(300); await m.screenshot({ path: '/tmp/claude-0/-home-claude/a0a374d3-89c1-5fe3-a51c-bb4b22442d75/scratchpad/m-menu.png' });
const d = await b.newPage({ viewport: { width: 1440, height: 900 } }); await d.goto('http://localhost:4321/'); await d.waitForTimeout(1500);
await d.screenshot({ path: '/tmp/claude-0/-home-claude/a0a374d3-89c1-5fe3-a51c-bb4b22442d75/scratchpad/d-home.png' });
await d.goto('http://localhost:4321/pricing'); await d.waitForTimeout(800); await d.screenshot({ path: '/tmp/claude-0/-home-claude/a0a374d3-89c1-5fe3-a51c-bb4b22442d75/scratchpad/d-pricing.png', fullPage: false });
await b.close(); srv.close();
