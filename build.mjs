// MarginBird static site build: canvas .dc.html pages -> prerendered HTML + Preact hydration.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parse } from 'parse5';
import { h, Fragment, Component } from 'preact';
import { renderToString } from 'preact-render-to-string';
import * as esbuild from 'esbuild';
import sharp from 'sharp';
import { createDC } from './src/runtime/render.js';
import { transforms } from './transforms.mjs';

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
const SITE = process.env.SITE_URL || 'https://marginbird.netlify.app';
const CONFIG = { ga4: process.env.GA4_ID || '', pixel: process.env.META_PIXEL_ID || '', alertEndpoint: 'https://formsubmit.co/ajax/' + (process.env.ALERT_TO || 'aymankhak10@gmail.com') };
const seo = JSON.parse(fs.readFileSync(path.join(ROOT, 'seo.json'), 'utf8'));

const ROUTES = {
  Main: '/', Automation: '/services/automation', Ads: '/services/paid-ads', Websites: '/services/websites',
  Social: '/services/social-growth', Brand: '/services/brand-and-design', Work: '/work', Pricing: '/pricing',
  FreeAudit: '/free-audit', Legal: '/privacy'
};
const PAGES = [
  ['/', 'Main', {}], ['/services/automation', 'Automation', {}], ['/services/paid-ads', 'Ads', {}],
  ['/services/websites', 'Websites', {}], ['/services/social-growth', 'Social', {}], ['/services/brand-and-design', 'Brand', {}],
  ['/work', 'Work', {}], ['/pricing', 'Pricing', {}], ['/free-audit', 'FreeAudit', {}],
  ['/privacy', 'Legal', { tab: 'privacy' }], ['/terms', 'Legal', { tab: 'terms' }], ['/sms-terms', 'Legal', { tab: 'sms' }],
  ['/404', 'NotFound', {}], ['/thanks', 'Thanks', {}]
];
const CRUMB = { '/services/automation': 'Automation', '/services/paid-ads': 'Paid ads', '/services/websites': 'Websites', '/services/social-growth': 'Social growth', '/services/brand-and-design': 'Brand and design', '/work': 'Work', '/pricing': 'Pricing', '/free-audit': 'Free audit', '/privacy': 'Privacy Policy', '/terms': 'Terms of Service', '/sms-terms': 'SMS Terms' };

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'assets'), { recursive: true });
const hash = (buf) => crypto.createHash('sha256').update(buf).digest('hex').slice(0, 10);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

// ---------- assets ----------
const blobMap = {};
const imgInfo = {};
for (const f of fs.readdirSync(SRC).filter((f) => f.endsWith('.jpg'))) {
  const id = f.replace('.jpg', '');
  const img = sharp(path.join(SRC, f));
  const { width, height } = await img.metadata();
  await img.clone().webp({ quality: 82 }).toFile(path.join(OUT, 'assets', id + '.webp'));
  blobMap[id] = '/assets/' + id + '.webp';
  const variants = [];
  // Large photos get smaller copies so phones and small slots don't download the full file.
  for (const w of [400, 800]) {
    if (width > w * 1.25) { await img.clone().resize(w).webp({ quality: 80 }).toFile(path.join(OUT, 'assets', id + '-' + w + '.webp')); variants.push('/assets/' + id + '-' + w + '.webp ' + w + 'w'); }
  }
  imgInfo['/assets/' + id + '.webp'] = { width, height, srcset: variants.length ? variants.concat('/assets/' + id + '.webp ' + width + 'w').join(', ') : '' };
}
const mbBuf = fs.readFileSync(path.join(SRC, 'vendor', 'mbline.js'));
const mbName = '/assets/mbline-' + hash(mbBuf) + '.js';
fs.writeFileSync(path.join(OUT, mbName), mbBuf);
CONFIG.mbline = mbName;
const cssBuf = fs.readFileSync(path.join(SRC, 'shared.css'), 'utf8') + fs.readFileSync(path.join(SRC, 'extra.css'), 'utf8');
const cssName = '/assets/site-' + hash(cssBuf) + '.css';
fs.writeFileSync(path.join(OUT, cssName), cssBuf);

globalThis.MB_IMG = imgInfo;
// ---------- compile components ----------
function attrsOf(el) { return (el.attrs || []).map((a) => [a.prefix ? a.prefix + ':' + a.name : a.name, a.value]); }
function kids(el) { return el.nodeName === 'template' ? el.content.childNodes : el.childNodes; }
function toTpl(nodes) {
  const out = [];
  for (const n of nodes) {
    if (n.nodeName === '#text') { const v = n.value; out.push([0, /^\s+$/.test(v) ? ' ' : v]); continue; }
    if (n.nodeName === '#comment') continue;
    if (n.nodeName === 'template') {
      const a = Object.fromEntries(attrsOf(n));
      if (a['data-sc'] === 'for') { out.push([2, a.list.replace(/^\{\{\s*|\s*\}\}$/g, ''), a.as, 0, toTpl(kids(n))]); continue; }
      if (a['data-sc'] === 'if') { out.push([3, a.value.replace(/^\{\{\s*|\s*\}\}$/g, ''), toTpl(kids(n))]); continue; }
    }
    if (n.nodeName === 'dc-import') { const a = attrsOf(n); const name = a.find((x) => x[0] === 'name')[1]; out.push([4, name, a.filter((x) => x[0] !== 'name')]); continue; }
    let at = attrsOf(n);
    if (n.tagName === 'img') {
      if (!at.some((x) => x[0] === 'loading')) at.push(['loading', 'lazy']);
      if (!at.some((x) => x[0] === 'decoding')) at.push(['decoding', 'async']);
    }
    out.push([1, n.tagName, at, toTpl(kids(n))]);
  }
  // collapse runs of whitespace-only text
  return out.filter((x, i) => !(x[0] === 0 && x[1] === ' ' && (i === 0 || i === out.length - 1)));
}
function find(node, pred) {
  if (pred(node)) return node;
  for (const c of (node.childNodes || [])) { const r = find(c, pred); if (r) return r; }
  if (node.content) { const r = find(node.content, pred); if (r) return r; }
  return null;
}
function serialize(n) {
  if (n.nodeName === 'style') return '<style>' + n.childNodes.map((c) => c.value).join('') + '</style>';
  if (n.nodeName === 'link') return '<link ' + attrsOf(n).map(([k, v]) => k + '="' + esc(v) + '"').join(' ') + '>';
  return '';
}

const comps = {};
for (const f of fs.readdirSync(path.join(SRC, 'pages')).filter((f) => f.endsWith('.dc.html'))) {
  const name = f.replace('.dc.html', '');
  let src = fs.readFileSync(path.join(SRC, 'pages', f), 'utf8');
  // global rewrites
  src = src.replace(/<script src="\/_blob\/[0-9a-f]+"><\/script>/g, '').replace(/<script src="\.\/support\.js"><\/script>/g, '');
  src = src.replace(/<link rel="stylesheet" href="\/_blob\/[0-9a-f]+">/g, '');
  src = src.replace(/\/_blob\/([0-9a-f]{32})/g, (m, id) => blobMap[id] || m);
  src = src.replace(/\b(Main|Automation|Ads|Websites|Social|Brand|Work|Pricing|FreeAudit|Legal)\.dc\.html/g, (m, k) => ROUTES[k]);
  for (const [a, b] of (transforms[name] || [])) {
    if (!src.includes(a)) throw new Error(name + ': transform target not found: ' + a.slice(0, 80));
    src = src.split(a).join(b);
  }
  // loops/conditions -> <template> so table rows survive HTML parsing
  src = src.replace(/<sc-for\b/g, '<template data-sc="for"').replace(/<\/sc-for>/g, '</template>')
    .replace(/<sc-if\b/g, '<template data-sc="if"').replace(/<\/sc-if>/g, '</template>');
  const doc = parse(src);
  const xdc = find(doc, (n) => n.nodeName === 'x-dc');
  const helmet = xdc.childNodes.find((n) => n.nodeName === 'helmet');
  const head = helmet ? helmet.childNodes.map(serialize).filter(Boolean) : [];
  const tpl = toTpl(xdc.childNodes.filter((n) => n !== helmet));
  const script = find(doc, (n) => n.nodeName === 'script' && (n.attrs || []).some((a) => a.name === 'data-dc-script'));
  const code = script.childNodes.map((c) => c.value).join('');
  const imports = [...new Set([...src.matchAll(/<dc-import name="(\w+)"/g)].map((m) => m[1]))];
  const lowered = JSON.stringify(tpl);
  if (/\.dc\.html/.test(lowered)) console.warn('WARN unmapped .dc.html link in', name);
  comps[name] = { tpl, code, head, imports };
}

// ---------- server render ----------
const server = createDC(h, Fragment, Component);
for (const [name, c] of Object.entries(comps)) server.define(name, c.tpl, new Function('DCLogic', c.code + '\nreturn Component;'));
const deps = (n, acc = new Set()) => { acc.add(n); comps[n].imports.forEach((d) => !acc.has(d) && deps(d, acc)); return acc; };

// ---------- client bundles ----------
const GEN = path.join(ROOT, '.gen');
fs.rmSync(GEN, { recursive: true, force: true });
fs.mkdirSync(path.join(GEN, 'comps'), { recursive: true });
for (const [name, c] of Object.entries(comps)) {
  fs.writeFileSync(path.join(GEN, 'comps', name + '.js'),
    'export const tpl = ' + JSON.stringify(c.tpl) + ';\nexport function factory(DCLogic) {\n' + c.code + '\nreturn Component;\n}\n');
}
const entries = {};
for (const [, name] of PAGES) {
  if (entries[name]) continue;
  const list = [...deps(name)];
  const file = path.join(GEN, 'page-' + name + '.js');
  fs.writeFileSync(file,
    "import { h, Fragment, Component, hydrate } from 'preact';\nimport { createDC } from '../src/runtime/render.js';\nimport '../src/runtime/site.js';\n" +
    list.map((n) => `import * as c_${n} from './comps/${n}.js';`).join('\n') +
    '\nconst dc = createDC(h, Fragment, Component);\n' +
    list.map((n) => `dc.define('${n}', c_${n}.tpl, c_${n}.factory);`).join('\n') +
    `\nconst root = document.getElementById('app');\nhydrate(h(dc.registry['${name}'], JSON.parse(root.dataset.props || '{}')), root);\n`);
  entries[name] = file;
}
const result = await esbuild.build({
  entryPoints: Object.values(entries), bundle: true, splitting: true, format: 'esm', minify: true,
  outdir: path.join(OUT, 'assets', 'js'), entryNames: '[name]-[hash]', chunkNames: 'chunk-[hash]',
  metafile: true, target: ['es2019'], logLevel: 'warning'
});
const entryOut = {};
for (const [out, meta] of Object.entries(result.metafile.outputs)) {
  if (meta.entryPoint) entryOut[path.basename(meta.entryPoint).replace(/^page-|\.js$/g, '')] = '/' + path.relative(OUT, out);
}

// ---------- fonts: merge Google Fonts requests ----------
function mergeFonts(links) {
  const fam = {};
  for (const l of links) {
    const m = /href="([^"]*fonts\.googleapis\.com\/css2[^"]*)"/.exec(l); if (!m) continue;
    const u = new URL(m[1].replace(/&amp;/g, '&'));
    for (const spec of u.searchParams.getAll('family')) {
      const [f, axes] = spec.split(':');
      if (!axes) { fam[f] = fam[f] || { axes: '', vals: new Set() }; continue; }
      const [axisNames, vals] = axes.split('@');
      fam[f] = fam[f] || { axes: axisNames, vals: new Set() };
      vals.split(';').forEach((v) => fam[f].vals.add(v));
    }
  }
  const parts = Object.entries(fam).map(([f, { axes, vals }]) => {
    if (!axes) return 'family=' + f;
    const sorted = [...vals].sort((a, b) => { const x = a.split(',').map(parseFloat), y = b.split(',').map(parseFloat); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] - y[i]; return 0; });
    return 'family=' + f + ':' + axes + '@' + sorted.join(';');
  });
  return parts.length ? 'https://fonts.googleapis.com/css2?' + parts.join('&') + '&display=swap' : null;
}

// ---------- page shell ----------
const org = seo.schema.organization;
function jsonld(route, name) {
  const graph = [org];
  if (CRUMB[route]) {
    graph.push({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' },
      ...(route.startsWith('/services/') ? [{ '@type': 'ListItem', position: 2, name: 'Services', item: SITE + '/#services' }] : []),
      { '@type': 'ListItem', position: route.startsWith('/services/') ? 3 : 2, name: CRUMB[route], item: SITE + route }
    ] });
  }
  if (seo.schema.services[route]) graph.push(seo.schema.services[route]);
  if (name === 'Main') {
    const inst = new server.registry.Main({ theme: 'violet' });
    const faqs = inst.renderVals().faqs || [];
    graph.push({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) });
  }
  return graph.map((g) => '<script type="application/ld+json">' + JSON.stringify(g).replace(/</g, '\\u003c') + '</script>').join('\n');
}

const sitemap = [];
for (const [route, name, props] of PAGES) {
  const NOINDEX = route === '/404' || route === '/thanks';
  const meta = route === '/404'
    ? { title: 'Page not found | MarginBird', description: 'This page does not exist. Head back to the MarginBird home page or book a free business audit.' }
    : route === '/thanks' ? { title: 'Thank you | MarginBird', description: 'Your free audit request reached MarginBird. We reply within one business day.' } : seo.pages[route];
  if (!meta) throw new Error('no seo for ' + route);
  const used = [...deps(name)];
  const headBits = used.flatMap((n) => comps[n].head);
  const fontUrl = mergeFonts(headBits.filter((x) => x.startsWith('<link')));
  const styles = [...new Set(headBits.filter((x) => x.startsWith('<style')))].join('\n');
  const body = renderToString(h(server.registry[name], props));
  const canonical = SITE + (route === '/' ? '/' : route);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(meta.title)}</title>
<meta name="description" content="${esc(meta.description)}">
${NOINDEX ? '<meta name="robots" content="noindex">' : `<link rel="canonical" href="${canonical}">`}
<meta property="og:type" content="website">
<meta property="og:site_name" content="MarginBird">
<meta property="og:locale" content="en_US">
<meta property="og:title" content="${esc(meta.title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(seo.site.defaultOgAlt || 'MarginBird: Agencies sell tasks. We build business systems.')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(meta.title)}">
<meta name="twitter:description" content="${esc(meta.description)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<meta name="theme-color" content="#06050B">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="icon" href="/favicon-32.png" sizes="32x32" type="image/png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
${fontUrl ? `<link rel="stylesheet" href="${esc(fontUrl)}">` : ''}
<link rel="stylesheet" href="${cssName}">
${styles}
<script>window.MB_CONFIG=${JSON.stringify(CONFIG)};window.MB_IMG=${JSON.stringify(imgInfo)};</script>
${jsonld(route, name)}
</head>
<body>
<div id="app" data-props='${JSON.stringify(props).replace(/'/g, '&#39;')}'>${body}</div>
<script type="module" src="${entryOut[name]}"></script>
</body>
</html>
`;
  const file = route === '/' ? 'index.html' : route === '/404' ? '404.html' : route.slice(1) + '/index.html';
  fs.mkdirSync(path.dirname(path.join(OUT, file)), { recursive: true });
  fs.writeFileSync(path.join(OUT, file), html);
  if (!NOINDEX) sitemap.push(canonical);
  const leftovers = body.match(/\[[A-Z][A-Za-z ]{2,40}\]/g);
  if (leftovers) console.warn('PLACEHOLDERS on', route, [...new Set(leftovers)].join(', '));
}

// ---------- SEO + host files ----------
const today = new Date().toISOString().slice(0, 10);
fs.writeFileSync(path.join(OUT, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  sitemap.map((u) => `  <url><loc>${u}</loc><lastmod>${today}</lastmod><priority>${u === SITE + '/' ? '1.0' : u.includes('/services/') || u.endsWith('/free-audit') || u.endsWith('/pricing') ? '0.8' : '0.5'}</priority></url>`).join('\n') + '\n</urlset>\n');
fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);
fs.writeFileSync(path.join(OUT, 'llms.txt'), seo.llms_txt.trim() + '\n');
for (const f of fs.readdirSync(path.join(ROOT, 'static'))) fs.copyFileSync(path.join(ROOT, 'static', f), path.join(OUT, f));
console.log('Built', PAGES.length, 'pages ->', OUT);
