import sharp from 'sharp';
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
const svg = await import('node:fs').then((fs) => fs.readFileSync('static/favicon.svg'));
for (const [n, s] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) await sharp(svg, { density: 600 }).resize(s, s).png().toFile('static/' + n);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await p.setContent(`<html><head><link href="https://fonts.googleapis.com/css2?family=Geist:wght@500;600&family=Fraunces:ital,opsz,wght@1,9..144,300&display=swap" rel="stylesheet"></head>
<body style="margin:0;width:1200px;height:630px;background:#06050B;color:#F4EFE6;font-family:Geist,system-ui,sans-serif;overflow:hidden;position:relative">
<div style="position:absolute;top:-260px;left:50%;transform:translateX(-50%) rotate(-8deg);width:1400px;height:620px;background:radial-gradient(closest-side,rgba(167,139,255,.55),rgba(167,139,255,.14) 45%,transparent 75%);filter:blur(30px)"></div>
<div style="position:absolute;left:80px;top:72px;display:flex;align-items:center;gap:14px"><svg width="48" height="35" viewBox="0 0 30 22"><path d="M1 19.5C7 18.8 12 15.8 15.5 10.5" stroke="#A78BFF" stroke-width="1.2" stroke-linecap="round" stroke-dasharray="1 3" fill="none"/><path d="M12.5 12.5c3.2-5.4 7.2-7.4 11.6-6.2l5.4-4.8-1.8 7.4c-2 4-6.6 6-12.6 5.3z" fill="#A78BFF"/></svg><span style="font-weight:600;font-size:34px;letter-spacing:-.03em">MarginBird</span></div>
<div style="position:absolute;left:80px;right:80px;top:200px;font-weight:500;font-size:84px;line-height:.98;letter-spacing:-.05em"><span style="color:#8F99AD">Agencies sell tasks.</span><br>We build business <span style="font-family:Fraunces,serif;font-weight:300;font-style:italic;color:#DCD2FF">systems.</span></div>
<div style="position:absolute;left:80px;bottom:64px;font-size:26px;color:#BAC2D0">Brand · Websites · Ads · Social · Automation</div>
<div style="position:absolute;right:80px;bottom:56px;padding:14px 26px;border-radius:999px;background:linear-gradient(110deg,#6C4FE0,#DCD2FF 28%,#A78BFF 52%,#F3EEFF 72%,#7A5CF0);color:#120A2A;font-weight:600;font-size:24px">Free business audit</div>
</body></html>`, { waitUntil: 'networkidle' }).catch(() => {});
await p.waitForTimeout(500);
await p.screenshot({ path: 'static/og-image.png' }); await b.close(); console.log('images ok');
