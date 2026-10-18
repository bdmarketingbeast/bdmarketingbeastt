/*
  Bd Marketing Beast: site builder.
  Runs on Netlify every time something changes in GitHub (see netlify.toml).
  Reads the content files edited from /admin and writes the finished website into /dist.
  You never need to edit this file.
*/
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const yaml = require('js-yaml');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const P = (...a) => path.join(ROOT, ...a);
const read = f => fs.readFileSync(P(f), 'utf8');
const readJSON = f => JSON.parse(read(f));
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ---------- content ---------- */
const S = Object.assign({
  phone_display: '01776272503', phone_intl: '8801776272503', gtm_id: '', web3forms_key: '',
  site_url: '', brand_blue: '#1e6bff', brand_cyan: '#38bdf8', brand_background: '#05060a', nav: []
}, readJSON('content/settings.json'));
const H = readJSON('content/home.json');

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
  chart: '<path d="M4 20V10M10 20V4M16 20v-8M22 20H2"/>'
};

/* ---------- helpers ---------- */
function fill(html, name, inner) {
  const re = new RegExp('<!--@' + name + '-->[\\s\\S]*?<!--@/' + name + '-->');
  if (!re.test(html)) throw new Error('Template marker missing: ' + name);
  return html.replace(re, () => inner);
}

function hexToRgb(h) {
  h = String(h).replace('#', '').trim();
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function brand(html) {
  const b = S.brand_blue || '#1e6bff', c = S.brand_cyan || '#38bdf8', g = S.brand_background || '#05060a';
  const [br, bg, bb] = hexToRgb(b), [cr, cg, cb] = hexToRgb(c), [gr, gg, gb] = hexToRgb(g);
  return html
    .replace(/rgba\(30,107,255,/g, () => `rgba(${br},${bg},${bb},`)
    .replace(/rgba\(56,189,248,/g, () => `rgba(${cr},${cg},${cb},`)
    .replace(/rgba\(5,6,10,/g, () => `rgba(${gr},${gg},${gb},`)
    .replace(/#1e6bff/gi, () => b)
    .replace(/#38bdf8/gi, () => c)
    .replace(/#05060a/gi, () => g);
}

function phone(html) {
  const intl = String(S.phone_intl).replace(/\D/g, '');
  return html
    .split('+8801776272503').join('@@TEL@@')
    .split('8801776272503').join('@@INTL@@')
    .split('01776272503').join('@@DISP@@')
    .split('@@TEL@@').join('+' + intl)
    .split('@@INTL@@').join(intl)
    .split('@@DISP@@').join(S.phone_display);
}

function gtmHead() {
  const id = String(S.gtm_id || '').trim();
  if (!id) return '';
  return `<!-- Google Tag Manager -->\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${esc(id)}');</script>\n<!-- End Google Tag Manager -->\n`;
}
function gtmBody() {
  const id = String(S.gtm_id || '').trim();
  if (!id) return '';
  return `<!-- Google Tag Manager (noscript) -->\n<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${esc(id)}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>\n<!-- End Google Tag Manager (noscript) -->\n`;
}

function navHTML(current) {
  const items = (S.nav || []).map(n =>
    `<a href="${esc(n.url)}"${n.url === current ? ' class="on"' : ''}>${esc(n.label)}</a>`).join('\n      ');
  return `<nav class="links" id="links">\n      ${items}\n    </nav>`;
}

/* applies the settings that every page shares */
function finish(html, current) {
  html = html.replace(/<nav class="links" id="links">[\s\S]*?<\/nav>/, () => navHTML(current));
  html = html.replace(/<!-- Google Tag Manager: replace[\s\S]*?<!-- End Google Tag Manager -->\n?/, () => gtmHead());
  html = html.replace(/<!-- Google Tag Manager \(noscript\)[\s\S]*?<!-- End Google Tag Manager \(noscript\) -->\n?/, () => gtmBody());
  html = html
    .split('href="index.html#').join('href="/#')
    .split('href="index.html"').join('href="/"')
    .split('href="blog.html"').join('href="/blog/"');
  return brand(phone(html));
}

function parseMd(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  return { fm: m ? (yaml.load(m[1]) || {}) : {}, body: m ? m[2] : raw };
}
function loadMd(dir) {
  const d = P(dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => f.endsWith('.md')).map(f => {
    const { fm, body } = parseMd(path.join(d, f));
    return { slug: f.replace(/\.md$/, ''), fm, body };
  }).filter(x => x.fm.draft !== true);
}
function toDate(v) {
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? new Date() : d;
}
const fmtDate = d => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const abs = u => (S.site_url ? String(S.site_url).replace(/\/+$/, '') : '') + u;
const hasSite = () => !!S.site_url;

function out(rel, content) {
  const f = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, content);
}

/* wraps a page body in the blog template (header, footer, styles, tracking) */
function shell(tpl, o) {
  let h = tpl;
  h = h.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(o.title)}</title>`);
  h = h.replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${esc(o.desc)}">`);
  h = h.replace(/<main>[\s\S]*<\/main>/, () => `<main>\n${o.main}\n</main>`);
  if (o.head) h = h.replace('</head>', () => o.head + '\n</head>');
  return finish(h, o.current);
}

/* ---------- build ---------- */
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

/* home page */
(function () {
  const dd4 = ['', ' d1', ' d2', ' d3'], dd3 = ['', ' d1', ' d2'];
  let h = read('src/index.html');

  h = fill(h, 'hero', [
    `<span class="pill rv"><i></i> ${esc(H.hero_badge)}</span>`,
    `<h1 class="rv d1">${esc(H.hero_title)} <span class="grad">${esc(H.hero_highlight)}</span></h1>`,
    `<p class="lead rv d2">${esc(H.hero_lead)}</p>`,
    `<div class="cta rv d3">`,
    `  <a class="btn primary" href="#contact">${esc(H.cta_primary)}</a>`,
    `  <a class="btn ghost" href="tel:+8801776272503">${esc(H.cta_secondary || '📞 {phone}').split('{phone}').join('01776272503')}</a>`,
    `</div>`,
    `<div class="trust rv d3">${(H.trust || []).map(t => `<span>${esc(t)}</span>`).join('')}</div>`
  ].join('\n    '));

  h = fill(h, 'marquee', (H.marquee || []).map(t => `<span>${esc(t)}<em>✦</em></span>`).join(''));

  h = fill(h, 'services', '\n' + (H.services || []).map((s, i) => [
    `      <article class="card rv${dd3[i % 3]}">`,
    `        <div class="ico"><svg viewBox="0 0 24 24">${ICONS[s.icon] || ICONS.star}</svg></div>`,
    `        <h3>${esc(s.title)}</h3>`,
    `        <p>${esc(s.text)}</p>`,
    `        <ul>${(s.bullets || []).map(b => `<li>${esc(b)}</li>`).join('')}</ul>`,
    `      </article>`
  ].join('\n')).join('\n') + '\n    ');

  h = fill(h, 'stats', '\n' + (H.stats || []).map((s, i) => {
    const has = s.count !== undefined && s.count !== null && s.count !== '';
    const b = has
      ? `<b data-count="${Number(s.count)}"${s.suffix ? ` data-suffix="${esc(s.suffix)}"` : ''}>0</b>`
      : `<b>${esc(s.text)}</b>`;
    return `    <div class="stat rv${dd4[i % 4]}">${b}<span>${esc(s.label)}</span></div>`;
  }).join('\n') + '\n  ');

  h = fill(h, 'steps', '\n' + (H.process || []).map((s, i) =>
    `      <div class="step rv${dd4[i % 4]}"><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></div>`).join('\n') + '\n    ');

  h = fill(h, 'faq', '\n' + (H.faq || []).map(q =>
    `      <details class="rv"><summary>${esc(q.question)}</summary><p>${esc(q.answer)}</p></details>`).join('\n') + '\n    ');

  h = fill(h, 'options', '\n' + (H.services || []).map(s => `          <option>${esc(s.title)}</option>`).join('\n')
    + '\n          <option>Not sure yet</option>\n        ');

  h = h.replace(/<title>[\s\S]*?<\/title>/, () => `<title>${esc(H.seo_title)}</title>`);
  h = h.replace(/<meta name="description" content="[^"]*">/, () => `<meta name="description" content="${esc(H.seo_description)}">`);
  h = h.replace(/WEB3FORMS_KEY:'[^']*'/, () => `WEB3FORMS_KEY:'${String(S.web3forms_key).replace(/'/g, '')}'`);
  if (hasSite()) h = h.replace('</head>', () => `<link rel="canonical" href="${esc(abs('/'))}">\n</head>`);

  out('index.html', finish(h, null));
})();

/* thank-you page */
out('thank-you.html', finish(read('src/thank-you.html'), null));

/* blog + custom pages */
const BLOG_TPL = read('src/blog.html').replace(/<!--\s*NEW POSTS GO HERE[\s\S]*?-->/, '');
const bandMatch = BLOG_TPL.match(/<section class="band">[\s\S]*?<\/section>/);
const BAND = bandMatch ? bandMatch[0] : '';
const urls = ['/', '/blog/'];

const posts = loadMd('content/blog')
  .map(x => Object.assign(x, { date: toDate(x.fm.date) }))
  .sort((a, b) => b.date - a.date);

/* blog index */
const cards = posts.map(x => {
  const f = x.fm;
  return `<a class="post" href="/blog/${esc(x.slug)}/">`
    + (f.image ? `<img class="thumb" src="${esc(f.image)}" alt="" loading="lazy">` : '')
    + `<span class="tag">${esc(f.category || 'Marketing')}</span>`
    + `<h3>${esc(f.title || x.slug)}</h3>`
    + `<p>${esc(f.summary || '')}</p>`
    + `<div class="meta"><span>${esc(fmtDate(x.date))}</span><b>Read →</b></div></a>`;
}).join('\n        ');
let blogIdx = BLOG_TPL.replace('<!--POSTS-->', () => cards);
if (hasSite()) blogIdx = blogIdx.replace('</head>', () => `<link rel="canonical" href="${esc(abs('/blog/'))}">\n</head>`);
out('blog/index.html', finish(blogIdx, '/blog/'));

/* each blog post */
posts.forEach(x => {
  const f = x.fm, title = f.title || x.slug;
  const url = `/blog/${x.slug}/`;
  const desc = f.summary || title;
  const ld = {
    '@context': 'https://schema.org', '@type': 'BlogPosting', headline: title,
    datePublished: x.date.toISOString(), description: desc,
    author: { '@type': 'Organization', name: 'Bd Marketing Beast' }
  };
  if (f.image) ld.image = abs(f.image);
  const head = [
    `<meta property="og:type" content="article">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
    f.image ? `<meta property="og:image" content="${esc(abs(f.image))}">` : '',
    hasSite() ? `<link rel="canonical" href="${esc(abs(url))}">` : '',
    `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`
  ].filter(Boolean).join('\n');
  const main = `<article class="article"><div class="narrow">
  <a class="back" href="/blog/">← All articles</a>
  ${f.category ? `<span class="tag">${esc(f.category)}</span>` : ''}
  <h1>${esc(title)}</h1>
  <p class="byline">${esc(fmtDate(x.date))} · Bd Marketing Beast</p>
  ${f.image ? `<img class="cover" src="${esc(f.image)}" alt="${esc(title)}">` : ''}
  <div class="content">${marked.parse(x.body)}</div>
</div></article>
${BAND}`;
  out(`blog/${x.slug}/index.html`, shell(BLOG_TPL, { title: `${title} | Bd Marketing Beast`, desc, main, head, current: '/blog/' }));
  urls.push(url);
});

/* extra pages (About, landing pages, etc.) */
const RESERVED = ['blog', 'admin', 'uploads', 'thank-you', 'index'];
loadMd('content/pages').forEach(x => {
  if (RESERVED.includes(x.slug)) { console.warn('Skipped page with reserved name: ' + x.slug); return; }
  const f = x.fm, title = f.title || x.slug, url = `/${x.slug}/`;
  const main = `<article class="article"><div class="narrow">
  <h1>${esc(title)}</h1>
  <div class="content">${marked.parse(x.body)}</div>
</div></article>
${BAND}`;
  const head = [
    `<meta property="og:title" content="${esc(title)}">`,
    hasSite() ? `<link rel="canonical" href="${esc(abs(url))}">` : ''
  ].filter(Boolean).join('\n');
  out(`${x.slug}/index.html`, shell(BLOG_TPL, { title: `${title} | Bd Marketing Beast`, desc: f.description || title, main, head, current: url }));
  urls.push(url);
});

/* admin panel + uploaded images */
fs.cpSync(P('admin'), path.join(DIST, 'admin'), { recursive: true });
if (fs.existsSync(P('uploads'))) fs.cpSync(P('uploads'), path.join(DIST, 'uploads'), { recursive: true });

/* search engine files */
out('robots.txt', 'User-agent: *\nDisallow: /admin/\n' + (hasSite() ? `Sitemap: ${abs('/sitemap.xml')}\n` : ''));
if (hasSite()) {
  out('sitemap.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(u => `  <url><loc>${esc(abs(u))}</loc></url>`).join('\n') + '\n</urlset>\n');
}

console.log(`Built: home, thank-you, blog index, ${posts.length} post(s), ${urls.length - 2 - posts.length} extra page(s).`);
