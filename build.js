/*
  Website builder (runs on Netlify every time something changes in GitHub; see netlify.toml).
  Reads the content edited from /admin and writes the finished website into /dist.
  You never need to edit this file.
*/
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { marked } = require('marked');
const yaml = require('js-yaml');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const P = (...a) => path.join(ROOT, ...a);
const exists = f => fs.existsSync(P(f));
const warns = [];
const warn = m => { warns.push(m); console.warn('WARNING: ' + m); };

function readJSON(f, fallback) {
  try { return JSON.parse(fs.readFileSync(P(f), 'utf8')); }
  catch (e) { if (exists(f)) warn('Could not read ' + f + ': ' + e.message); return fallback; }
}

/* ------------------------------------------------------------------ small helpers */
const isObj = x => x && typeof x === 'object' && !Array.isArray(x);
const arr = x => (Array.isArray(x) ? x : []);
const str = x => (x === undefined || x === null ? '' : String(x));
const esc = s => str(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
function merge(base, over) {
  if (!isObj(base) || !isObj(over)) return over === undefined ? base : over;
  const out = Object.assign({}, base);
  for (const k of Object.keys(over)) {
    const v = over[k];
    if (v === undefined || v === null) continue;
    out[k] = isObj(base[k]) && isObj(v) ? merge(base[k], v) : v;
  }
  return out;
}

/* ------------------------------------------------------------------ site settings */
const DEFAULTS = {
  brand: { name: 'Bd Marketing Beast', logo: '/uploads/logo.png', logo_height: 50, favicon: '/uploads/favicon.png' },
  colors: { blue: '#1e6bff', cyan: '#38bdf8', background: '#05060a', text: '', mode: 'auto' },
  fonts: { heading: 'Syne', body: 'Manrope' },
  header: { button_text: 'Call {phone}', button_link: 'call', show_mobile_bar: true, mobile_call_text: '📞 Call', mobile_whatsapp_text: '💬 WhatsApp' },
  nav: [
    { label: 'Services', url: '/#services' }, { label: 'Process', url: '/#process' }, { label: 'Why Us', url: '/#why' },
    { label: 'FAQ', url: '/#faq' }, { label: 'Blog', url: '/blog/' }, { label: 'Contact', url: '/#contact' }
  ],
  footer: { text: '© {year} {brand}. All rights reserved.', show_phone: true, links: [], social: [] },
  contact: { phone_display: '01776272503', phone_intl: '8801776272503', whatsapp: '', email: '', address: '' },
  tracking: { gtm_id: '', head_code: '', body_code: '' },
  form: { web3forms_key: '', email_subject: 'New lead from the website' },
  site: { url: '', language: 'en', show_preloader: true, preloader_text: 'Loading the beast', area_served: 'Worldwide', business_type: 'ProfessionalService' },
  blog: {
    seo_title: 'Blog', seo_description: 'Marketing tips on Facebook Ads, Google Ads, websites and SEO.',
    eyebrow: 'The Beast Blog', title: 'Marketing tips that *actually grow* your business',
    intro: 'Practical advice on Facebook Ads, Google Ads, websites and SEO, written for business owners.',
    empty_text: 'Our first articles are on the way. Check back soon.',
    cta_title: 'Want results like these *for your business?*',
    cta_text: 'Book a free strategy call and we will show you where your next customers can come from.',
    cta_button: 'Get a free strategy call →', cta_link: '/#contact', cta_button2: '📞 {phone}', cta_link2: 'call'
  }
};
function legacySite(o) {
  // the very first version of the editor stored flat settings
  const s = {};
  if (o.phone_display || o.phone_intl) s.contact = { phone_display: o.phone_display, phone_intl: o.phone_intl };
  if (o.gtm_id) s.tracking = { gtm_id: o.gtm_id };
  if (o.web3forms_key) s.form = { web3forms_key: o.web3forms_key };
  if (o.site_url) s.site = { url: o.site_url };
  if (o.brand_blue || o.brand_cyan || o.brand_background) s.colors = { blue: o.brand_blue, cyan: o.brand_cyan, background: o.brand_background };
  if (Array.isArray(o.nav)) s.nav = o.nav;
  return s;
}
const site = merge(DEFAULTS, readJSON('content/site.json', null) || legacySite(readJSON('content/settings.json', {})));

/* ------------------------------------------------------------------ text, links, buttons */
const digits = s => str(s).replace(/\D/g, '');
const intl = () => digits(site.contact.phone_intl);
const waNum = () => digits(site.contact.whatsapp) || intl();
const year = String(new Date().getFullYear());
const tok = s => str(s).split('{phone}').join(str(site.contact.phone_display)).split('{brand}').join(str(site.brand.name)).split('{year}').join(year);
const T = s => esc(tok(s));
// *words* in a title become the blue gradient highlight
const H = s => esc(tok(s)).replace(/\*([^*]+)\*/g, '<span class="grad">$1</span>');
const md = s => marked.parse(str(s));
const slug = s => str(s).trim().toLowerCase().replace(/^#/, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
const idAttr = b => (b && b.anchor && slug(b.anchor) ? ` id="${esc(slug(b.anchor))}"` : '');
const rv = (i, n) => ['', ' d1', ' d2', ' d3'][i % (n || 3)];
const abs = u => (site.site.url ? str(site.site.url).replace(/\/+$/, '') : '') + u;
const hasUrl = () => !!str(site.site.url).trim();

function link(v) {
  v = str(v).trim();
  if (!v || v === 'call') return 'tel:+' + intl();
  if (v === 'whatsapp') return 'https://wa.me/' + waNum();
  if (v === 'email') return 'mailto:' + str(site.contact.email);
  return v;
}
function aAttrs(href) {
  return `href="${esc(href)}"` + (/^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener"' : '');
}
function btn(kind, text, href, extra) {
  if (!str(text).trim()) return '';
  return `<a class="btn ${kind}${extra ? ' ' + extra : ''}" ${aAttrs(link(href))}>${T(text)}</a>`;
}
function heading(b, center) {
  const parts = [];
  if (str(b.eyebrow).trim()) parts.push(`<span class="eyebrow rv">${T(b.eyebrow)}</span>`);
  if (str(b.title).trim()) parts.push(`<h2 class="rv">${H(b.title)}</h2>`);
  if (str(b.subtitle).trim()) parts.push(`<p class="sub rv">${T(b.subtitle)}</p>`);
  const html = parts.join('\n    ');
  return center && html ? `<div class="center">\n    ${html}\n  </div>` : html;
}
const secClass = (b, extra) => {
  const c = [extra, b.background === 'alt' ? 'alt' : ''].filter(Boolean).join(' ');
  return c ? ` class="${c}"` : '';
};
const img = (src, alt, cls, lazy) => `<img${cls ? ` class="${cls}"` : ''} src="${esc(src)}" alt="${esc(alt || '')}"${lazy === false ? '' : ' loading="lazy" decoding="async"'}>`;

/* ------------------------------------------------------------------ colors and fonts */
const hex2rgb = h => {
  h = str(h).trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const rgb2hex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);
const lum = ([r, g, b]) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
const sp = a => a.map(v => Math.round(v)).join(' ');

function paletteCSS() {
  const c = site.colors;
  const bg = hex2rgb(c.background) || [5, 6, 10], blue = hex2rgb(c.blue) || [30, 107, 255], cyan = hex2rgb(c.cyan) || [56, 189, 248];
  const mode = c.mode === 'dark' || c.mode === 'light' ? c.mode : (lum(bg) < 0.5 ? 'dark' : 'light');
  const dark = mode === 'dark';
  let v;
  if (dark && rgb2hex(bg) === '#05060a' && !str(c.text).trim()) {
    v = { bg2: '#0a0d16', card: '#0c101b', field: '#070a12', text: '#e8ecf5', t2: '#c5cee0', t3: '#aab4c9', muted: '#8b94a8', t5: '#4b556d', line: '120 150 255', ink: '255 255 255' };
  } else {
    const white = [255, 255, 255], black = [0, 0, 0];
    const text = hex2rgb(c.text) || (dark ? [232, 236, 245] : [15, 23, 42]);
    v = {
      bg2: rgb2hex(dark ? mix(bg, white, 0.03) : mix(bg, black, 0.04)),
      card: rgb2hex(dark ? mix(bg, white, 0.055) : mix(bg, white, 0.6)),
      field: rgb2hex(dark ? mix(bg, white, 0.015) : mix(bg, white, 0.85)),
      text: rgb2hex(text), t2: rgb2hex(mix(text, bg, 0.15)), t3: rgb2hex(mix(text, bg, 0.3)),
      muted: rgb2hex(mix(text, bg, dark ? 0.5 : 0.4)), t5: rgb2hex(mix(text, bg, 0.7)),
      line: dark ? '120 150 255' : '15 23 42', ink: dark ? '255 255 255' : '15 23 42'
    };
  }
  const h = parseInt(site.brand.logo_height, 10) || 50;
  return `:root{color-scheme:${dark ? 'dark' : 'light'};--bg:${rgb2hex(bg)};--bg2:${v.bg2};--card:${v.card};--field:${v.field};--blue:${rgb2hex(blue)};--cyan:${rgb2hex(cyan)};`
    + `--text:${v.text};--t2:${v.t2};--t3:${v.t3};--muted:${v.muted};--t5:${v.t5};--line:rgb(${v.line} / .14);--ink:${v.ink};`
    + `--blue-rgb:${sp(blue)};--cyan-rgb:${sp(cyan)};--bg-rgb:${sp(bg)};--grad:linear-gradient(135deg,var(--cyan),var(--blue));--r:18px;`
    + `--head-font:'${esc(site.fonts.heading)}';--body-font:'${esc(site.fonts.body)}';--logo-h:${h}px;--logo-h-big:${Math.round(h * 1.12)}px}`;
}
const FONT_RANGE = { 'Poppins': 'wght@400;500;600;700;800', 'Lora': 'wght@400..700', 'Space Grotesk': 'wght@400..700', 'Playfair Display': 'wght@400..800' };
function fontsLink() {
  const names = [...new Set([site.fonts.heading, site.fonts.body].map(str).filter(Boolean))];
  const fam = names.map(n => 'family=' + encodeURIComponent(n).replace(/%20/g, '+') + ':' + (FONT_RANGE[n] || 'wght@400..800')).join('&');
  return `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?${fam}&display=swap" rel="stylesheet">`;
}

/* ------------------------------------------------------------------ icons */
const ICONS = {
  megaphone: '<path d="M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1z"/><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  monitor: '<rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/>',
  trend: '<path d="M3 17l6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
  funnel: '<path d="M3 4h18l-7 8v6l-4 2v-8z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>',
  heart: '<path d="M12 21s-7-4.6-9.3-9A5.2 5.2 0 0 1 12 6.5 5.2 5.2 0 0 1 21.3 12C19 16.4 12 21 12 21z"/>',
  home: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  tools: '<path d="M14.7 6.3a4 4 0 0 0-5 5L3 18l3 3 6.7-6.7a4 4 0 0 0 5-5l-2.5 2.5-2.5-.5-.5-2.5z"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>'
};

/* ------------------------------------------------------------------ blocks (sections) */
const R = {};

R.hero = (b, x) => {
  const hf = isObj(b.form) && b.form.enabled ? b.form : null;
  if (hf) x.forms += 1;
  const buttons = [btn('primary', b.button_text, b.button_link), btn('ghost', b.button2_text, b.button2_link)].filter(Boolean).join('\n      ');
  const trust = arr(b.trust).map(str).filter(Boolean);
  return `<section class="hero${b.short ? ' short' : ''}${b.center ? ' center' : ''}"${idAttr(b)}>
  ${b.image ? img(b.image, '', 'bgimg', false) : ''}
  ${b.animation === false ? '' : '<canvas id="net"></canvas>'}
  <div class="wrap">
    ${str(b.badge).trim() ? `<span class="pill rv"><i></i> ${T(b.badge)}</span>` : ''}
    <h1 class="rv d1">${H(b.title)}</h1>
    ${str(b.lead).trim() ? `<p class="lead rv d2">${T(b.lead)}</p>` : ''}
    ${buttons ? `<div class="cta rv d3">\n      ${buttons}\n    </div>` : ''}
    ${hf ? formHTML(hf, 'rv d3 heroform') : ''}
    ${trust.length ? `<div class="trust rv d3">${trust.map(t => `<span>${T(t)}</span>`).join('')}</div>` : ''}
  </div>
</section>`;
};

R.marquee = (b) => `<div class="marquee" aria-hidden="true"${idAttr(b)}>
  <div class="track">${arr(b.words).map(w => `<span>${T(w)}<em>✦</em></span>`).join('')}</div>
</div>`;

R.cards = (b) => {
  const cols = [2, 3, 4].includes(+b.columns) ? +b.columns : 3;
  const cards = arr(b.cards).map((c, i) => {
    const bullets = arr(c.bullets).map(str).filter(Boolean);
    const more = str(c.link_url).trim() ? `<a class="more" ${aAttrs(link(c.link_url))}>${T(c.link_text || 'Learn more →')}</a>` : '';
    return `      <article class="card rv${rv(i)}">
        ${c.image ? img(c.image, c.title, 'thumb') : ''}
        ${!c.image && c.icon && c.icon !== 'none' ? `<div class="ico"><svg viewBox="0 0 24 24">${ICONS[c.icon] || ICONS.star}</svg></div>` : ''}
        <h3>${T(c.title)}</h3>
        ${str(c.text).trim() ? `<p>${T(c.text)}</p>` : ''}
        ${bullets.length ? `<ul>${bullets.map(x => `<li>${T(x)}</li>`).join('')}</ul>` : ''}
        ${more}
      </article>`;
  }).join('\n');
  return `<section${idAttr(b)}${secClass(b)}>
  <div class="wrap">
    ${heading(b)}
    <div class="grid${cols === 3 ? '' : ' c' + cols}">
${cards}
    </div>
  </div>
</section>`;
};

R.stats = (b) => {
  const items = arr(b.items);
  const html = items.map((s, i) => {
    const has = s.count !== undefined && s.count !== null && s.count !== '' && !isNaN(+s.count);
    const v = has ? `<b data-count="${Number(s.count)}"${str(s.suffix) ? ` data-suffix="${esc(s.suffix)}"` : ''}>0</b>` : `<b>${T(s.text)}</b>`;
    return `    <div class="stat rv${rv(i, 4)}">${v}<span>${T(s.label)}</span></div>`;
  }).join('\n');
  return `<div class="stats"${idAttr(b)}>
  <div class="wrap sgrid" style="--n:${Math.min(Math.max(items.length, 1), 6)}">
${html}
  </div>
</div>`;
};

R.steps = (b) => {
  const items = arr(b.steps);
  return `<section${idAttr(b)}${secClass(b)}>
  <div class="wrap">
    ${heading(b)}
    <div class="steps" style="--n:${Math.min(Math.max(items.length, 1), 5)}">
${items.map((s, i) => `      <div class="step rv${rv(i, 4)}"><h3>${T(s.title)}</h3><p>${T(s.text)}</p></div>`).join('\n')}
    </div>
  </div>
</section>`;
};

R.features = (b) => {
  const items = arr(b.items);
  const side = b.side === 'chart' || b.side === 'image' ? b.side : 'none';
  let panel = '';
  if (side === 'chart') {
    const vals = arr(b.chart_values).map(Number).filter(n => !isNaN(n));
    const max = Math.max.apply(null, vals.concat([1]));
    panel = `<div class="panel rv" id="panel">
      ${str(b.chart_title).trim() ? `<h4>${T(b.chart_title)}</h4>` : ''}
      <div class="bars">${vals.map(v => `<i style="--h:${Math.max(4, Math.round(v / max * 92))}%"></i>`).join('')}</div>
      ${str(b.chart_note).trim() ? `<small>${T(b.chart_note)}</small>` : ''}
    </div>`;
  } else if (side === 'image' && b.image) {
    panel = `<div class="panel photo rv">${img(b.image, b.title)}</div>`;
  }
  return `<section${idAttr(b)}${secClass(b)}>
  <div class="wrap why${panel ? '' : ' single'}">
    <div>
      ${heading(b)}
      <div class="feat">
${items.map((f, i) => `        <div class="rv${rv(i)}"><i>${i + 1}</i><span><b>${T(f.title)}</b><small>${T(f.text)}</small></span></div>`).join('\n')}
      </div>
    </div>
    ${panel}
  </div>
</section>`;
};

R.faq = (b, x) => {
  const items = arr(b.items).filter(q => str(q.question).trim());
  items.forEach(q => x.faq.push({ q: tok(q.question), a: tok(q.answer) }));
  return `<section${idAttr(b)}${secClass(b)}>
  <div class="wrap">
    ${heading(b, true)}
    <div class="faq">
${items.map(q => `      <details class="rv"><summary>${T(q.question)}</summary><p>${T(q.answer)}</p></details>`).join('\n')}
    </div>
  </div>
</section>`;
};

function formHTML(b, cls) {
  const opts = arr(b.services).map(str).filter(Boolean);
  const labels = {
    name: b.name_label || 'Your name', phone: b.phone_label || 'Phone or WhatsApp number', email: b.email_label || 'Email (optional)',
    biz: b.business_label || 'Business name', svc: b.service_label || 'What do you need?', msg: b.message_label || 'Tell us about your goal'
  };
  const f = site.form;
  return `<form class="${cls}" data-lead data-key="${esc(f.web3forms_key)}" data-subject="${esc(tok(b.email_subject || f.email_subject))}" data-from="${esc(site.brand.name)}" data-thanks="${esc(b.thank_you_url || '/thank-you.html')}" data-form-name="${esc(b.form_name || 'contact_form')}" data-sending="${esc(b.sending_text || 'Sending...')}" data-error="${esc(b.error_text || 'Something went wrong. Please call us instead.')}">
      <input type="checkbox" name="botcheck" tabindex="-1" autocomplete="off" style="display:none" aria-hidden="true">
      <label>${T(labels.name)}<input name="name" required placeholder="${esc(b.name_placeholder || 'John Smith')}"></label>
      <label>${T(labels.phone)}<input name="phone" type="tel" required placeholder="${esc(b.phone_placeholder || '+1 555 000 0000')}"></label>
      ${b.ask_email === false ? '' : `<label>${T(labels.email)}<input name="email" type="email" placeholder="you@company.com"></label>`}
      ${b.ask_business === false ? '' : `<label>${T(labels.biz)}<input name="biz" placeholder="${esc(b.business_placeholder || 'Your company')}"></label>`}
      ${opts.length ? `<label>${T(labels.svc)}\n        <select name="svc">${opts.map(o => `<option>${T(o)}</option>`).join('')}</select>\n      </label>` : ''}
      ${b.ask_message === false ? '' : `<label>${T(labels.msg)}<textarea name="msg" placeholder="${esc(b.message_placeholder || '')}"></textarea></label>`}
      <button class="btn primary" type="submit" style="justify-content:center">${T(b.button_text || 'Send my request →')}</button>
      <p class="status note" role="status" aria-live="polite"></p>
      ${str(b.note).trim() ? `<span class="note">${T(b.note)}</span>` : ''}
    </form>`;
}

R.contact = (b, x) => {
  x.forms += 1;
  return `<section${idAttr(b)} class="contact">
  <div class="wrap cgrid">
    <div class="cinfo">
      ${[b.eyebrow ? `<span class="eyebrow rv">${T(b.eyebrow)}</span>` : '', b.title ? `<h2 class="rv">${H(b.title)}</h2>` : ''].filter(Boolean).join('\n      ')}
      ${b.show_phone === false ? '' : `<a class="big rv" href="tel:+${intl()}">${esc(site.contact.phone_display)}</a>`}
      ${str(b.text).trim() ? `<p class="rv">${T(b.text)}</p>` : ''}
      ${b.show_buttons === false ? '' : `<div class="row rv">
        ${btn('primary', b.call_text || '📞 Call now', 'call')}
        ${btn('ghost', b.whatsapp_text || '💬 WhatsApp', 'whatsapp')}
      </div>`}
    </div>
    ${formHTML(b, 'rv')}
  </div>
</section>`;
};

R.cta = (b) => `<section class="band"${idAttr(b)}>
  <div class="wrap">
    ${b.title ? `<h2>${H(b.title)}</h2>` : ''}
    ${str(b.text).trim() ? `<p>${T(b.text)}</p>` : ''}
    <div class="cta">${btn('primary', b.button_text, b.button_link)}${btn('ghost', b.button2_text, b.button2_link)}</div>
  </div>
</section>`;

R.text = (b) => `<section${idAttr(b)}${secClass(b)}>
  <div class="${b.wide ? 'wrap' : 'narrow'} prose${b.align === 'center' ? ' center' : ''}">
    ${heading(b)}
    <div class="content rv">${md(b.body)}</div>
  </div>
</section>`;

R.image_text = (b) => `<section${idAttr(b)}${secClass(b)}>
  <div class="wrap split${b.image_side === 'right' ? ' right' : ''}">
    <div class="pic rv">${b.image ? img(b.image, b.image_alt || b.title) : ''}</div>
    <div>
      ${heading(b)}
      <div class="content rv" style="margin-top:18px">${md(b.body)}</div>
      ${btn('primary', b.button_text, b.button_link, 'rv')}
    </div>
  </div>
</section>`;

R.gallery = (b) => {
  const cols = [2, 3, 4].includes(+b.columns) ? +b.columns : 3;
  return `<section${idAttr(b)}${secClass(b)}>
  <div class="wrap">
    ${heading(b)}
    <div class="gal${cols === 3 ? '' : ' c' + cols}">
${arr(b.images).filter(i => i && i.image).map((i, n) => `      <figure class="rv${rv(n)}">${img(i.image, i.caption)}${str(i.caption).trim() ? `<figcaption>${T(i.caption)}</figcaption>` : ''}</figure>`).join('\n')}
    </div>
  </div>
</section>`;
};

R.logos = (b) => `<section class="logos"${idAttr(b)}>
  <div class="wrap">
    ${str(b.title).trim() ? `<p class="lead rv">${T(b.title)}</p>` : ''}
    <div class="row rv">${arr(b.images).filter(i => i && i.image).map(i => img(i.image, i.name)).join('')}</div>
  </div>
</section>`;

R.testimonials = (b) => `<section${idAttr(b)}${secClass(b)}>
  <div class="wrap">
    ${heading(b)}
    <div class="tgrid">
${arr(b.items).map((t, i) => `      <div class="tcard rv${rv(i)}"><blockquote>${T(t.quote)}</blockquote><div class="who">${t.photo ? img(t.photo, t.name) : ''}<span><b>${T(t.name)}</b><small>${T(t.role)}</small></span></div></div>`).join('\n')}
    </div>
  </div>
</section>`;

R.pricing = (b) => `<section${idAttr(b)}${secClass(b)}>
  <div class="wrap">
    ${heading(b)}
    <div class="plans">
${arr(b.plans).map((p, i) => `      <div class="plan rv${rv(i)}${p.popular ? ' hot' : ''}">
        ${p.popular ? `<span class="badge">${T(p.badge || 'Most popular')}</span>` : ''}
        <h3>${T(p.name)}</h3>
        <div class="price">${T(p.price)}${str(p.period).trim() ? ` <small>${T(p.period)}</small>` : ''}</div>
        ${str(p.text).trim() ? `<p>${T(p.text)}</p>` : ''}
        <ul>${arr(p.features).map(str).filter(Boolean).map(f => `<li>${T(f)}</li>`).join('')}</ul>
        ${btn(p.popular ? 'primary' : 'ghost', p.button_text || 'Get started', p.button_link)}
      </div>`).join('\n')}
    </div>
  </div>
</section>`;

function videoSrc(u) {
  u = str(u).trim();
  let m = u.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/))([\w-]{6,})/);
  if (m) return 'https://www.youtube-nocookie.com/embed/' + m[1];
  m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (m) return 'https://player.vimeo.com/video/' + m[1];
  return /^https:\/\//.test(u) ? u : '';
}
R.video = (b) => {
  const src = videoSrc(b.url);
  return `<section${idAttr(b)}${secClass(b)}>
  <div class="wrap center">
    ${heading(b)}
    ${src ? `<div class="vid rv"><iframe src="${esc(src)}" title="${esc(b.title || 'Video')}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>` : ''}
  </div>
</section>`;
};

R.embed = (b) => `<section${idAttr(b)}${secClass(b)}>
  <div class="wrap">
    ${heading(b)}
    <div class="embed">${str(b.code)}</div>
  </div>
</section>`;

R.thankyou = (b) => `<div class="thanks">
  <div class="tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
  <h1>${H(b.title)}</h1>
  ${str(b.text).trim() ? `<p>${T(b.text)}</p>` : ''}
  ${arr(b.steps).length ? `<div class="next">${arr(b.steps).map((s, i) => `<div><i>${i + 1}</i><span>${T(s.text || s)}</span></div>`).join('')}</div>` : ''}
  ${str(b.extra_text).trim() ? `<p style="margin-bottom:18px">${T(b.extra_text)}</p>` : ''}
  <div class="btns">${btn('primary', b.button_text, b.button_link)}${btn('ghost', b.button2_text, b.button2_link)}</div>
</div>`;

function renderSections(list, x) {
  return arr(list).map(b => {
    try {
      const fn = b && R[b.type];
      if (!fn) { warn('Unknown block type "' + (b && b.type) + '" was skipped'); return ''; }
      return fn(b, x);
    } catch (e) { warn('A "' + (b && b.type) + '" block failed and was skipped: ' + e.message); return ''; }
  }).filter(Boolean).join('\n\n');
}

/* ------------------------------------------------------------------ page shell */
const assetHash = f => crypto.createHash('md5').update(fs.readFileSync(P('src', f))).digest('hex').slice(0, 8);
const CSS_V = assetHash('site.css'), JS_V = assetHash('site.js');

function logoHTML() {
  if (str(site.brand.logo).trim()) return `<img class="logo-img" src="${esc(site.brand.logo)}" alt="${esc(site.brand.name)}">`;
  const w = str(site.brand.name).trim().split(/\s+/);
  const last = w.length > 1 ? ` <b>${esc(w.pop())}</b>` : '';
  return `<span class="logo-text">${esc(w.join(' '))}${last}</span>`;
}
function gtmHead() {
  const id = str(site.tracking.gtm_id).trim();
  return id ? `<!-- Google Tag Manager -->\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${esc(id)}');</script>\n<!-- End Google Tag Manager -->\n` : '';
}
function gtmBody() {
  const id = str(site.tracking.gtm_id).trim();
  return id ? `<!-- Google Tag Manager (noscript) -->\n<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${esc(id)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>\n<!-- End Google Tag Manager (noscript) -->\n` : '';
}
function navHTML(cur) {
  return arr(site.nav).filter(n => n && n.label).map(n => {
    const u = str(n.url);
    const on = u === cur || (u !== '/' && !u.includes('#') && u.endsWith('/') && cur.startsWith(u));
    return `<a ${aAttrs(u)}${on ? ' class="on"' : ''}>${T(n.label)}</a>`;
  }).join('\n      ');
}
function headerHTML(o) {
  const landing = o.layout === 'landing';
  const h = site.header;
  return `<header id="hd">
  <div class="wrap nav">
    <a href="/" class="logo" aria-label="${esc(site.brand.name)} home">${logoHTML()}</a>
    ${landing ? '' : `<nav class="links" id="links">\n      ${navHTML(o.path)}\n    </nav>`}
    ${btn('primary sm', h.button_text, h.button_link)}
    ${landing ? '' : '<button class="menu" id="menu" aria-label="Open menu">☰</button>'}
  </div>
</header>`;
}
function footerHTML(o) {
  const f = site.footer, landing = o.layout === 'landing';
  const links = landing ? [] : arr(f.links).concat(arr(f.social)).filter(l => l && l.label && l.url);
  return `<footer>
  <div class="wrap frow">
    <a href="/" class="logo">${logoHTML()}</a>
    <span>${T(f.text)}</span>
    ${links.length ? `<div class="fl">${links.map(l => `<a ${aAttrs(l.url)}>${T(l.label)}</a>`).join('')}</div>` : ''}
    ${f.show_phone === false ? '' : `<a href="tel:+${intl()}">${esc(site.contact.phone_display)}</a>`}
  </div>
</footer>`;
}
function callbar() {
  const h = site.header;
  if (h.show_mobile_bar === false) return '';
  const a = btn('primary', h.mobile_call_text, 'call'), w = waNum() ? btn('ghost', h.mobile_whatsapp_text, 'whatsapp') : '';
  if (!a && !w) return '';
  return `<div class="callbar${a && w ? '' : ' one'}">\n  ${a}\n  ${w}\n</div>`;
}

function seoTags(o) {
  const t = [];
  t.push(`<meta property="og:title" content="${esc(o.title)}">`);
  t.push(`<meta property="og:description" content="${esc(o.description)}">`);
  t.push(`<meta property="og:type" content="${o.ogType || 'website'}">`);
  if (o.image) t.push(`<meta property="og:image" content="${esc(abs(o.image))}">`);
  if (hasUrl()) t.push(`<link rel="canonical" href="${esc(abs(o.path))}">`);
  if (o.noindex) t.push('<meta name="robots" content="noindex,nofollow">');
  return t.join('\n');
}

function layoutHTML(o) {
  // o: path, title, description, image, layout(standard|landing|thank-you), main (html), noindex, preloader, jsonld[], event, ogType
  const minimal = o.layout === 'thank-you';
  const jsonld = arr(o.jsonld).map(j => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n');
  const body = minimal
    ? `<body class="minimal" data-thankyou-event="${esc(o.event || 'lead_thank_you_view')}">
${gtmBody()}${str(site.tracking.body_code)}
<a href="/" class="logo" aria-label="${esc(site.brand.name)} home">${logoHTML()}</a>
<main>
${o.main}
</main>
<a class="back" href="/">${T(o.backText || '← Back to homepage')}</a>`
    : `<body${o.layout === 'landing' ? ' class="landing"' : ''}>
${gtmBody()}${str(site.tracking.body_code)}
${o.preloader ? `<div id="pre"><div class="box"><div class="num"><span id="pn">0</span>%</div><div class="bar"><i id="pb"></i></div><p>${T(site.site.preloader_text)}</p></div></div>\n` : ''}${headerHTML(o)}

<main>
${o.main}
</main>

${footerHTML(o)}

${o.nocallbar ? '' : callbar()}`;
  return `<!doctype html>
<html lang="${esc(site.site.language || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.description)}">
<meta name="theme-color" content="${esc(rgb2hex(hex2rgb(site.colors.background) || [5, 6, 10]))}">
${str(site.brand.favicon).trim() ? `<link rel="icon" type="image/png" href="${esc(site.brand.favicon)}">\n` : ''}${gtmHead()}${str(site.tracking.head_code)}
${seoTags(o)}
${fontsLink()}
<style>${paletteCSS()}</style>
<link rel="stylesheet" href="/assets/site.css?v=${CSS_V}">
${jsonld}
</head>
${body}
<script src="/assets/site.js?v=${JS_V}" defer></script>
</body>
</html>
`;
}

/* ------------------------------------------------------------------ content loading */
function parseMd(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  let fm = {};
  try { fm = m ? (yaml.load(m[1]) || {}) : {}; } catch (e) { warn('Could not read the top of ' + path.basename(file) + ': ' + e.message); }
  return { fm, body: m ? m[2] : raw };
}
function loadMd(dir) {
  const d = P(dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => f.endsWith('.md')).map(f => {
    const { fm, body } = parseMd(path.join(d, f));
    return { slug: f.replace(/\.md$/, ''), fm, body };
  }).filter(x => x.fm.draft !== true);
}
const toDate = v => { const d = v instanceof Date ? v : new Date(v); return isNaN(d) ? new Date() : d; };
const fmtDate = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

function out(rel, content) {
  const f = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}
const newCtx = () => ({ faq: [], forms: 0 });
function faqLD(x) {
  return x.faq.length ? [{ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: x.faq.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) }] : [];
}
const bandHTML = () => {
  const b = site.blog;
  return R.cta({ title: b.cta_title, text: b.cta_text, button_text: b.cta_button, button_link: b.cta_link, button2_text: b.cta_button2, button2_link: b.cta_link2 });
};

/* ------------------------------------------------------------------ build */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });
fs.copyFileSync(P('src', 'site.css'), path.join(DIST, 'assets', 'site.css'));
fs.copyFileSync(P('src', 'site.js'), path.join(DIST, 'assets', 'site.js'));
const urls = [];
let pageCount = 0;

/* home page */
(function () {
  const home = readJSON('content/home-page.json', null) || {};
  const x = newCtx();
  const main = renderSections(home.sections, x);
  const title = str(home.seo_title).trim() || site.brand.name;
  const description = str(home.seo_description).trim();
  const ld = [{
    '@context': 'https://schema.org', '@type': site.site.business_type || 'ProfessionalService', name: site.brand.name,
    telephone: '+' + intl(), areaServed: site.site.area_served, description,
    ...(hasUrl() ? { url: abs('/') } : {}), ...(site.brand.logo && hasUrl() ? { logo: abs(site.brand.logo) } : {})
  }].concat(faqLD(x));
  out('index.html', layoutHTML({ path: '/', title, description, image: home.seo_image, layout: 'standard', main, preloader: site.site.show_preloader !== false, jsonld: ld }));
  urls.push('/');
})();

/* thank-you page (the form sends people here) */
(function () {
  const ty = readJSON('content/thank-you.json', null) || {};
  const x = newCtx();
  out('thank-you.html', layoutHTML({ path: '/thank-you.html', title: str(ty.seo_title).trim() || 'Thank You | ' + site.brand.name, description: 'Thank you for your request.', layout: 'thank-you', noindex: true, main: renderSections(ty.sections, x), event: ty.event, backText: ty.back_text }));
})();

/* blog */
const posts = loadMd('content/blog').map(p => Object.assign(p, { date: toDate(p.fm.date) })).sort((a, b) => b.date - a.date);
(function () {
  const b = site.blog;
  const cards = posts.map(p => {
    const f = p.fm;
    return `<a class="post" href="/blog/${esc(p.slug)}/">${f.image ? img(f.image, '', 'thumb') : ''}<span class="tag">${T(f.category || 'Marketing')}</span><h3>${T(f.title || p.slug)}</h3><p>${T(f.summary || '')}</p><div class="meta"><span>${esc(fmtDate(p.date))}</span><b>Read →</b></div></a>`;
  }).join('\n        ');
  const main = `<section class="top">
  <div class="wrap">
    ${str(b.eyebrow).trim() ? `<span class="eyebrow">${T(b.eyebrow)}</span>` : ''}
    <h1>${H(b.title)}</h1>
    ${str(b.intro).trim() ? `<p>${T(b.intro)}</p>` : ''}
  </div>
</section>

<section style="padding-top:20px">
  <div class="wrap">
    <div class="posts${posts.length ? '' : ' empty'}" id="posts">${posts.length ? '\n        ' + cards + '\n      ' : `<span class="none">${T(b.empty_text)}</span>`}</div>
  </div>
</section>

${bandHTML()}`;
  out('blog/index.html', layoutHTML({ path: '/blog/', title: `${b.seo_title} | ${site.brand.name}`, description: b.seo_description, layout: 'standard', main }));
  urls.push('/blog/');
})();

/* blog posts */
posts.forEach(p => {
  const f = p.fm, title = str(f.title || p.slug), url = `/blog/${p.slug}/`, description = str(f.summary || title);
  const ld = { '@context': 'https://schema.org', '@type': 'BlogPosting', headline: title, datePublished: p.date.toISOString(), description, author: { '@type': 'Organization', name: site.brand.name } };
  if (f.image) ld.image = abs(f.image);
  const main = `<article class="article"><div class="narrow">
  <a class="back" href="/blog/">← All articles</a>
  ${f.category ? `<span class="tag">${T(f.category)}</span>` : ''}
  <h1>${T(title)}</h1>
  <p class="byline">${esc(fmtDate(p.date))} · ${esc(site.brand.name)}</p>
  ${f.image ? img(f.image, title, 'cover', false) : ''}
  <div class="content">${md(p.body)}</div>
</div></article>
${bandHTML()}`;
  out(`blog/${p.slug}/index.html`, layoutHTML({ path: url, title: `${title} | ${site.brand.name}`, description, image: f.image, layout: 'standard', main, jsonld: [ld], ogType: 'article', noindex: f.noindex === true }));
  if (f.noindex !== true) urls.push(url);
  pageCount++;
});

/* extra pages: About, landing pages, custom thank-you pages */
const RESERVED = ['blog', 'admin', 'uploads', 'assets', 'thank-you', 'index', '404'];
loadMd('content/pages').forEach(p => {
  if (RESERVED.includes(p.slug)) { warn('The page "' + p.slug + '" was skipped because that name is reserved. Rename it.'); return; }
  const f = p.fm, title = str(f.title || p.slug), url = `/${p.slug}/`;
  const layout = ['landing', 'thank-you'].includes(f.layout) ? f.layout : 'standard';
  const x = newCtx();
  const sections = renderSections(f.sections, x);
  const startsHero = arr(f.sections)[0] && arr(f.sections)[0].type === 'hero';
  let intro = '';
  if (layout !== 'thank-you') {
    const bodyHtml = str(p.body).trim() ? md(p.body) : '';
    const showTitle = f.show_title !== false && !startsHero;
    if (bodyHtml) intro = `<article class="article"><div class="narrow">${showTitle ? `<h1>${T(title)}</h1>` : ''}<div class="content">${bodyHtml}</div></div></article>`;
    else if (showTitle && !sections) intro = `<article class="article"><div class="narrow"><h1>${T(title)}</h1></div></article>`;
    else if (showTitle) intro = `<div class="pagehead"><div class="narrow"><h1 style="font-size:clamp(2rem,5vw,3.2rem);font-weight:800">${T(title)}</h1></div></div>`;
  }
  const noindex = f.noindex === true || layout === 'thank-you';
  out(`${p.slug}/index.html`, layoutHTML({
    path: url, title: `${title} | ${site.brand.name}`, description: str(f.description || title), image: f.image, layout, noindex,
    main: [intro, sections].filter(Boolean).join('\n\n'), preloader: f.preloader === true, jsonld: faqLD(x), event: f.event, backText: f.back_text, nocallbar: layout === 'landing' && x.forms > 0
  }));
  if (!noindex) urls.push(url);
  pageCount++;
});

/* 404 page */
out('404.html', layoutHTML({
  path: '/404', title: `Page not found | ${site.brand.name}`, description: 'Page not found', layout: 'standard', noindex: true,
  main: `<section class="top"><div class="wrap"><span class="eyebrow">404</span><h1>This page *could not be found*</h1><p>The link may be old or mistyped.</p><div class="cta">${btn('primary', 'Go to the homepage', '/')}</div></div></section>`.replace('*could not be found*', '<span class="grad">could not be found</span>')
}));

/* images and the editor */
if (exists('admin')) fs.cpSync(P('admin'), path.join(DIST, 'admin'), { recursive: true });
if (exists('uploads')) fs.cpSync(P('uploads'), path.join(DIST, 'uploads'), { recursive: true });

/* search engine files */
out('robots.txt', 'User-agent: *\nDisallow: /admin/\n' + (hasUrl() ? `Sitemap: ${abs('/sitemap.xml')}\n` : ''));
if (hasUrl()) {
  out('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(u => `  <url><loc>${esc(abs(u))}</loc></url>`).join('\n') + '\n</urlset>\n');
}

console.log(`Built: home, thank-you, blog (${posts.length} post(s)), ${pageCount - posts.length} extra page(s).` + (warns.length ? ` ${warns.length} warning(s).` : ''));
