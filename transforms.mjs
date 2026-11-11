// Build-time edits that turn canvas mockup behaviour into production behaviour.
// Each entry: [exact text in the canvas source, replacement]. The build fails if a target is missing,
// so a canvas change that breaks one of these is caught instead of silently shipping.
const HIDDEN = (name) => `<input type="hidden" name="form-name" value="${name}">` +
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'landing_page'].map((k) => `<input type="hidden" name="${k}" value="">`).join('');
const NETLIFY = (name) => `name="${name}" method="POST" action="/thanks" data-netlify="true" netlify-honeypot="company_url" `;

const LEGAL_CONTACT = 'the form on our free audit page (marginbird.netlify.app/free-audit)';

export const transforms = {
  Main: [
    ['<form onSubmit="{{submitAudit}}" style=', '<form ' + NETLIFY('audit-quick') + 'onSubmit="{{submitAudit}}" style='],
    ['<input type="text" name="company_url" tabindex="-1"', HIDDEN('audit-quick') + '<input type="text" name="company_url" tabindex="-1"'],
    ['if (fm && fm.company_url && fm.company_url.value) return; this.setState({ sent: true }); },',
      "if (fm && fm.company_url && fm.company_url.value) return; window.mbSubmit(fm, 'audit-quick').then(() => this.setState({ sent: true })); },"],
    ['You are on the list. Check your inbox.', "You're on the list. We'll reply within one business day."]
  ],
  FreeAudit: [
    ['<form onSubmit="{{submit}}" style=', '<form ' + NETLIFY('audit') + 'onSubmit="{{submit}}" style='],
    ['<input type="text" name="company_url" tabindex="-1"',
      HIDDEN('audit') + '<input type="hidden" name="need" value="{{needVal}}"><input type="hidden" name="plan" value="{{planVal}}"><input type="text" name="company_url" tabindex="-1"'],
    ['<h2 style="font-weight: 500; font-size: 26px; letter-spacing: -0.02em; margin: 0">Book your free audit</h2>',
      '<h2 style="font-weight: 500; font-size: 26px; letter-spacing: -0.02em; margin: 0">Book your free audit</h2>\n<sc-if value="{{planLabel}}" hint-placeholder-val="{{ false }}"><p style="margin: -4px 0 0; font-size: 15px; color: #DCD2FF">You picked the {{planLabel}} plan. We will tailor the audit to it.</p></sc-if>'],
    ['if (fm && fm.company_url && fm.company_url.value) return; this.setState({ sent: true }); },',
      "if (fm && fm.company_url && fm.company_url.value) return; window.mbSubmit(fm, 'audit').then(() => this.setState({ sent: true })); },"],
    ['      t, theme, needs,\n', "      t, theme, needs, needVal: this.state.need || '', planVal: this.state.plan || '', planLabel: ({ launch: 'Launch', grow: 'Grow', scale: 'Scale' })[this.state.plan] || '',\n"],
    ['  renderVals() {', "  componentDidMount() { try { const p = new URLSearchParams(location.search).get('plan'); if (p && /^(launch|grow|scale)$/.test(p)) this.setState({ plan: p }); } catch (e) { /* ignore */ } }\n  renderVals() {"],
    ['Your video arrives within 48 hours. Check your inbox for a confirmation now.', "Your video arrives within 48 hours. We'll send it to the email you gave us."],
    ['Book a 30-minute call</a>\n</div>\n</section>',
      'Book a 30-minute call</a>\n</div>\n<div class="calendly-inline-widget" data-url="https://calendly.com/aymankhak10/30min?hide_gdpr_banner=1&amp;background_color=0a0f1a&amp;text_color=f4efe6&amp;primary_color=a78bff" style="min-width: 320px; height: 720px; margin-top: 20px; border-radius: 24px; overflow: hidden"></div>\n</section>']
  ],
  Footer: [
    ['<a href="mailto:{{email}}" style="color: #BAC2D0; text-decoration: none">{{email}}</a>', ''],
    ['<a href="/privacy" style="color: #BAC2D0; text-decoration: none">Terms</a>', '<a href="/terms" style="color: #BAC2D0; text-decoration: none">Terms</a>'],
    ['<a href="/privacy" style="color: #BAC2D0; text-decoration: none">SMS Terms</a>', '<a href="/sms-terms" style="color: #BAC2D0; text-decoration: none">SMS Terms</a><a href="#cookie-settings" style="color: #BAC2D0; text-decoration: none">Cookie settings</a>']
  ],
  Legal: [
    ["this.state = { tab: 'privacy' };", "this.state = { tab: props.tab || 'privacy' };"],
    ['pick: () => this.setState({ tab: id }) };', "pick: () => { this.setState({ tab: id }); try { history.replaceState(null, '', ({ privacy: '/privacy', terms: '/terms', sms: '/sms-terms' })[id]); } catch (e) { /* ignore */ } } };"],
    ['Effective [Effective date] · Questions: [Business email]', 'Effective 8 November 2026'],
    ['[Effective date]', '8 November 2026'],
    ['Email us at [Business email] and', 'Contact us through ' + LEGAL_CONTACT + ' and'],
    ['Questions or requests: [Business email] or MarginBird LLC, [Mailing address].', 'Questions or requests: contact MarginBird LLC through ' + LEGAL_CONTACT + '.'],
    ['Questions: [Business email] or MarginBird LLC, [Mailing address].', 'Questions: contact MarginBird LLC through ' + LEGAL_CONTACT + '.'],
    ['You can also reach MarginBird at [Business email].', 'You can also reach MarginBird through ' + LEGAL_CONTACT + '.'],
    ['[Governing law jurisdiction]', 'the U.S. state in which MarginBird LLC is registered'],
    ['such as Google (Google Workspace and Google Sheets for storing leads and sending alerts, Google Analytics), Meta (if you consent to marketing cookies), and our website hosting provider.',
      'such as Netlify (website hosting and storing form submissions), FormSubmit (emailing us a copy of each form submission), Calendly (call booking), Google (Google Analytics, if you consent) and Meta (if you consent to marketing cookies).'],
    ['<p style="margin: 56px 0 0; font-size: 13px; line-height: 1.6; color: #77809A">Template drafted for review. Have a lawyer check it before launch.</p>\n', '']
  ]
};
