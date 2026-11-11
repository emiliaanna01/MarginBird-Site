import fs from 'node:fs'; import path from 'node:path'; import http from 'node:http';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const DIST = path.resolve('dist');
const srv = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); let f = path.join(DIST, p); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html'); if (!fs.existsSync(f)) { res.statusCode = 404; return res.end(); } const t = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml' }[path.extname(f)]; if (t) res.setHeader('content-type', t); res.end(fs.readFileSync(f)); }).listen(4322);
const b = await chromium.launch();
const routes = ['/', '/services/automation', '/services/paid-ads', '/services/websites', '/services/social-growth', '/services/brand-and-design', '/work', '/pricing', '/free-audit', '/privacy'];
for (const r of routes) {
  for (const vw of [[1440, 900], [390, 844]]) {
    const p = await b.newPage({ viewport: { width: vw[0], height: vw[1] }, deviceScaleFactor: 2 });
    await p.goto('http://localhost:4322' + r, { waitUntil: 'load' }); await p.waitForTimeout(400);
    await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 40)); } });
    await p.waitForTimeout(600);
    const info = await p.evaluate(() => {
      const imgs = [...document.images].map((i) => ({ src: i.currentSrc.split('/').pop().slice(0, 14), nat: i.naturalWidth + 'x' + i.naturalHeight, shown: Math.round(i.getBoundingClientRect().width) + 'x' + Math.round(i.getBoundingClientRect().height), alt: i.hasAttribute('alt') ? (i.alt || '(empty)') : 'MISSING', wh: i.hasAttribute('width') && i.hasAttribute('height') }));
      const hs = [...document.querySelectorAll('h1,h2,h3,h4')].map((h) => h.tagName);
      const skips = []; let last = 1; hs.forEach((t) => { const n = +t[1]; if (n > last + 1) skips.push(t + ' after H' + last); last = n; });
      const badLinks = [...document.querySelectorAll('a')].filter((a) => !(a.textContent.trim() || a.getAttribute('aria-label') || a.querySelector('img[alt]:not([alt=""])'))).length;
      const badBtns = [...document.querySelectorAll('button')].filter((a) => !(a.textContent.trim() || a.getAttribute('aria-label'))).length;
      const overflow = document.documentElement.scrollWidth - innerWidth;
      return { imgs, h1: hs.filter((t) => t === 'H1').length, skips: [...new Set(skips)], badLinks, badBtns, overflow };
    });
    if (vw[0] === 1440 || info.overflow > 0) console.log(r, vw[0], JSON.stringify({ h1: info.h1, skips: info.skips, badLinks: info.badLinks, badBtns: info.badBtns, overflow: info.overflow }));
    if (info.imgs.length) console.log('   imgs@' + vw[0], info.imgs.map((i) => `${i.src} nat ${i.nat} shown ${i.shown} alt:${String(i.alt).slice(0, 30)} wh:${i.wh}`).join('\n   '));
    await p.close();
  }
}
await b.close(); srv.close();
