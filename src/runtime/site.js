// Browser-only helpers: lead submission (Netlify Forms), UTM capture, consent + GA4/Meta Pixel,
// event tracking, and lazy loading for the 3D team cards and the Calendly embed.
const CFG = window.MB_CONFIG || {};
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
const store = {
  get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode */ } },
  sget(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
  sset(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* private mode */ } }
};

// ---------- UTM capture (first touch per session) ----------
(function captureUtm() {
  const q = new URLSearchParams(location.search);
  if (UTM_KEYS.some((k) => q.get(k)) && !store.sget('mb_utm')) {
    const o = {}; UTM_KEYS.forEach((k) => { if (q.get(k)) o[k] = q.get(k).slice(0, 120); });
    store.sset('mb_utm', JSON.stringify(o));
  }
  if (!store.sget('mb_landing')) store.sset('mb_landing', location.pathname + location.search);
})();

// ---------- tracking ----------
window.dataLayer = window.dataLayer || [];
const PIXEL_MAP = { generate_lead: 'Lead', book_call: 'Schedule', select_plan: 'ViewContent' };
function track(name, params) {
  const p = Object.assign({ page_path: location.pathname }, params || {});
  window.dataLayer.push(Object.assign({ event: name }, p));
  if (window.gtag) window.gtag('event', name, p);
  if (window.fbq) { const std = PIXEL_MAP[name]; std ? window.fbq('track', std, p) : window.fbq('trackCustom', name, p); }
}
window.mbTrack = track;

// ---------- lead submission ----------
window.mbSubmit = function (form, formName) {
  if (!form) return Promise.reject(new Error('no form'));
  let utm = {}; try { utm = JSON.parse(store.sget('mb_utm') || '{}'); } catch (e) { /* ignore */ }
  UTM_KEYS.forEach((k) => { if (form.elements[k]) form.elements[k].value = utm[k] || ''; });
  if (form.elements.landing_page) form.elements.landing_page.value = store.sget('mb_landing') || location.pathname;
  const data = new FormData(form);
  data.set('form-name', formName);
  const btn = form.querySelector('button[type="submit"]');
  if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Sending…'; }
  return fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(data).toString() })
    .then((r) => {
      if (!r.ok) throw new Error('status ' + r.status);
      track('generate_lead', { form_name: formName });
      sendAlert(data, formName);
      return true;
    })
    .catch(() => {
      // Network or form error: fall back to a normal post so the lead is never lost.
      if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Book my free audit'; }
      form.submit();
      return new Promise(() => {});
    });
};

// ---------- free email alert (FormSubmit) ----------
// Netlify stores every lead; this only emails a copy. It never blocks the visitor.
function sendAlert(data, formName) {
  if (!CFG.alertEndpoint) return;
  const o = { _subject: 'New ' + (formName === 'audit' ? 'audit request' : 'audit email') + ': ' + (data.get('email') || ''), _template: 'table', _captcha: 'false', form: formName };
  data.forEach((v, k) => { if (v && k !== 'company_url' && k !== 'form-name') o[k] = v; });
  try {
    fetch(CFG.alertEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(o), keepalive: true }).catch(() => {});
  } catch (e) { /* alerts are best effort */ }
}

// ---------- click tracking ----------
document.addEventListener('click', (e) => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (href === '#cookie-settings') { e.preventDefault(); openConsent(true); return; }
  if (href.indexOf('calendly.com') >= 0) track('book_call_click', { link_text: a.textContent.trim().slice(0, 60) });
  else if (href.indexOf('/free-audit') === 0) track('cta_click', { link_text: a.textContent.trim().slice(0, 60) });
  if (href.indexOf('plan=') >= 0) track('select_plan', { plan: (href.split('plan=')[1] || '').split('&')[0] });
}, true);
window.addEventListener('message', (e) => {
  if (e.origin === 'https://calendly.com' && e.data && e.data.event === 'calendly.event_scheduled') track('book_call');
});

// ---------- consent + tags ----------
const HAS_TAGS = !!(CFG.ga4 || CFG.pixel);
const GPC = navigator.globalPrivacyControl === true;
function loadScript(src) { const s = document.createElement('script'); s.async = true; s.src = src; document.head.appendChild(s); return s; }
function loadTags(choice) {
  if (CFG.ga4 && (choice.analytics) && !window.gtag) {
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('js', new Date());
    window.gtag('config', CFG.ga4, { anonymize_ip: true });
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(CFG.ga4));
  }
  if (CFG.pixel && choice.marketing && !GPC && !window.fbq) {
    /* eslint-disable */
    !function (f, b, e, v, n, t, s) { if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments) }; if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = '2.0'; n.queue = []; t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s) }(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    window.fbq('init', CFG.pixel);
    window.fbq('track', 'PageView');
  }
}
function saved() { try { return JSON.parse(store.get('mb_consent') || 'null'); } catch (e) { return null; } }
function decide(choice) { store.set('mb_consent', JSON.stringify(choice)); closeConsent(); loadTags(choice); }
let banner = null;
function closeConsent() { if (banner) { banner.remove(); banner = null; } }
function openConsent(force) {
  if (!HAS_TAGS && !force) return;
  if (banner) return;
  banner = document.createElement('div');
  banner.className = 'mb-consent';
  banner.setAttribute('role', 'dialog');
  banner.setAttribute('aria-label', 'Cookie choices');
  banner.innerHTML = HAS_TAGS
    ? '<p>We use analytics to see which pages help, and a Meta pixel to measure ads, only if you say yes. <a href="/privacy">Privacy</a></p><div class="mb-consent-actions"><button type="button" data-c="none">Essential only</button><button type="button" data-c="analytics">Analytics only</button><button type="button" data-c="all" class="mb-consent-yes">Accept all</button></div>'
    : '<p>This site uses no analytics or advertising cookies right now. <a href="/privacy">Privacy</a></p><div class="mb-consent-actions"><button type="button" data-c="close" class="mb-consent-yes">Close</button></div>';
  banner.addEventListener('click', (e) => {
    const c = e.target.getAttribute && e.target.getAttribute('data-c');
    if (!c) return;
    if (c === 'close') return closeConsent();
    decide({ analytics: c !== 'none', marketing: c === 'all', at: Date.now() });
  });
  document.body.appendChild(banner);
}
if (HAS_TAGS) { const s = saved(); s ? loadTags(s) : setTimeout(() => openConsent(false), 1200); }

// ---------- lazy loaders ----------
function whenNear(selector, fn) {
  const el = document.querySelector(selector);
  if (!el) return;
  if (!('IntersectionObserver' in window)) return fn(el);
  const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { io.disconnect(); fn(el); } }, { rootMargin: '600px 0px' });
  io.observe(el);
}
whenNear('.tl-canvas', () => { if (!window.MBLine && CFG.mbline) loadScript(CFG.mbline); });
whenNear('.calendly-inline-widget', () => loadScript('https://assets.calendly.com/assets/external/widget.js'));
