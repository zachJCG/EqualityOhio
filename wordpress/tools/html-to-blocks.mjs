#!/usr/bin/env node
/**
 * Converts the handoff's page contents (content/main/*.html, the <main> of
 * each Next.js page) into WordPress block markup, one file per page, plus the
 * page registry the importer and the SEO output read.
 *
 *   node tools/html-to-blocks.mjs [--handoff <dir>] [--check] [--today YYYY-MM-DD]
 *
 * Outputs (all committed; a rerun must change nothing):
 *   plugins/eo-site/content/pages/<page>.html   block markup
 *   plugins/eo-site/data/pages.json             registry: path, slug, parent, title, description, card, template…
 *   themes/equality-ohio/assets/css/eo-utilities.css  classes generated from the source's inline style="" attributes
 *   docs/conversion-report.md                   every raw HTML block, staging note, dropped block and text change
 *
 * Rules applied on the way in (see HANDOFF.md §7 Traps):
 *   - expired data-expires blocks are dropped (not re-dated)
 *   - staging-only lines get the class eo-staging-note
 *   - internal links get a trailing slash; tel: links get the leading +
 *   - style="" attributes become utility classes; data-cta becomes .clinic-cta
 *   - /assets/… becomes {{THEME_URI}}/assets/…; PDFs become {{DOC:name.pdf}} (the importer resolves both)
 *   - the two clinic-availability lines on /legal-clinic/intake/ use the live site's wording (checked 2026-11-20)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { parseHTML } from 'linkedom';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const args = process.argv.slice(2);
const arg = (name, def) => { const i = args.indexOf(name); return i === -1 ? def : args[i + 1]; };
const CHECK = args.includes('--check');
const TODAY = arg('--today', new Date().toISOString().slice(0, 10));
const HANDOFF = resolve(arg('--handoff', process.env.EO_HANDOFF || join(root, 'source')));
if (!existsSync(join(HANDOFF, 'content', 'pages.json'))) {
  console.error(`Handoff package not found at ${HANDOFF}. Pass --handoff <dir> or set EO_HANDOFF.`);
  process.exit(2);
}

const pages = JSON.parse(readFileSync(join(HANDOFF, 'content/pages.json'), 'utf8')).filter((p) => p.url !== '/gate');
const siteData = JSON.parse(readFileSync(join(HANDOFF, 'content/chrome/site-data.json'), 'utf8'));

/* ------------------------------------------------------------------ helpers */
const BLOCK_TAGS = new Set(['section', 'div', 'article', 'aside', 'header', 'footer', 'nav', 'main', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'form', 'fieldset', 'blockquote', 'figure', 'figcaption', 'picture', 'table', 'hr', 'pre', 'details', 'dl', 'dt', 'dd', 'address']);
const GROUP_TAGS = new Set(['section', 'div', 'article', 'aside', 'header', 'footer', 'nav', 'main']);
const GROUP_TAG_ATTR = new Set(['div', 'header', 'main', 'section', 'article', 'aside', 'footer']); // core/group tagName options
const TEXT_TAGS = new Set(['div', 'span', 'blockquote', 'small', 'cite', 'address', 'figcaption', 'dt', 'dd']);
const RAW_TAGS = new Set(['form', 'svg', 'picture', 'table', 'iframe', 'video', 'audio', 'details', 'dl', 'pre', 'fieldset', 'select', 'input', 'textarea', 'button', 'label']);

const json = (o) => JSON.stringify(o);
const collapse = (s) => s.replace(/\s+/g, ' ');
const attrJSON = (attrs) => { const o = {}; for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null && v !== '' && v !== false) o[k] = v; return Object.keys(o).length ? ' ' + json(o) : ''; };

/** Utility classes generated from style="" declarations. */
const utilities = new Map(); // class -> css declarations
function classesForStyle(style) {
  const out = [];
  for (const decl of style.split(';')) {
    const [prop, ...rest] = decl.split(':');
    if (!prop || !rest.length) continue;
    const p = prop.trim(); const v = rest.join(':').trim();
    const num = (x) => x.replace(/rem|em|px|%/g, '').replace(/\./g, '-').replace(/^-/, '').replace(/\s+/g, '_');
    let cls;
    if (p === 'max-width') cls = `u-maxw-${num(v)}`;
    else if (p === 'padding-top') cls = `u-pt-${num(v)}`;
    else if (p === 'padding') cls = `u-pad-${num(v)}`;
    else if (p === 'margin-top') cls = `u-mt-${num(v)}`;
    else if (p === 'margin-bottom') cls = `u-mb-${num(v)}`;
    else if (p === 'margin-left') cls = `u-ml-${num(v)}`;
    else if (p === 'margin') cls = `u-m-${num(v)}`;
    else if (p === 'font-size') cls = `u-fs-${num(v)}`;
    else if (p === 'display') cls = `u-${v}`;
    else if (p === 'width') cls = `u-w-${num(v)}`;
    else if (p === 'height') cls = `u-h-${num(v)}`;
    else if (p === 'border-radius') cls = `u-radius-${v.replace(/[^a-z]/g, '').replace('vareoradius', '')}`;
    else if (p === 'box-shadow') cls = `u-shadow-${v.replace(/[^a-z]/g, '').replace('vareoshadow', '')}`;
    else throw new Error(`No utility mapping for style "${p}: ${v}"`);
    const css = `${p}: ${v};`;
    if (utilities.has(cls) && utilities.get(cls) !== css) throw new Error(`Utility class clash ${cls}`);
    utilities.set(cls, css);
    out.push(cls);
  }
  return out;
}

/** Links: trailing slash on internal paths, + on tel:, placeholders for assets. */
function fixHref(href) {
  if (!href) return href;
  if (/^tel:/i.test(href)) return href.replace(/^tel:(?!\+)/i, 'tel:+');
  if (/^(https?:|mailto:|#)/i.test(href)) return href;
  if (href.startsWith('/assets/docs/')) return `{{DOC:${href.slice('/assets/docs/'.length)}}}`;
  if (href.startsWith('/assets/')) return `{{THEME_URI}}${href}`;
  if (href.startsWith('/')) {
    const m = href.match(/^([^#?]*)(#.*)?$/);
    let path = m[1]; const hash = m[2] || '';
    if (path !== '/' && !path.endsWith('/')) path += '/';
    return path + hash;
  }
  return href;
}
function fixSrc(src) {
  if (!src) return src;
  if (src.startsWith('/assets/')) return `{{THEME_URI}}${src}`;
  return src;
}

/* ------------------------------------------------------------ conversion */
const report = { raw: [], staging: [], dropped: [], textChanges: [], images: [], warnings: [] };

function normalizeTree(root, page, document) {
  // 1. Expired blocks go. Nothing is re-dated.
  for (const el of [...root.querySelectorAll('[data-expires]')]) {
    const date = el.getAttribute('data-expires');
    if (date && date < TODAY) {
      report.dropped.push({ page: page.url, tag: el.tagName.toLowerCase(), cls: el.getAttribute('class'), expires: date, text: collapse(el.textContent).trim().slice(0, 80) });
      el.remove();
    } else {
      el.classList.add(`expires-${date}`);
      el.removeAttribute('data-expires');
      report.warnings.push(`${page.url}: data-expires=${date} kept as class expires-${date}`);
    }
  }
  // 2. Comments go (ELECTION / EVENT / authoring notes).
  const walker = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 8) child.remove();
      else if (child.nodeType === 1) walker(child);
    }
  };
  walker(root);
  // 3. data-cta -> class hook the help-bar script watches.
  for (const el of root.querySelectorAll('[data-cta]')) { el.classList.add('clinic-cta'); el.removeAttribute('data-cta'); }
  // 4. Links, phones, assets.
  for (const a of root.querySelectorAll('a[href]')) a.setAttribute('href', fixHref(a.getAttribute('href')));
  for (const el of root.querySelectorAll('[src]')) el.setAttribute('src', fixSrc(el.getAttribute('src')));
  for (const el of root.querySelectorAll('[srcset]')) el.setAttribute('srcset', el.getAttribute('srcset').replace(/\/assets\//g, '{{THEME_URI}}/assets/'));
  // 5. Inline styles -> utility classes (kept verbatim inside raw HTML blocks, which core/html preserves).
  for (const el of root.querySelectorAll('[style]')) {
    if (el.closest('form, picture, svg')) continue;
    for (const c of classesForStyle(el.getAttribute('style'))) el.classList.add(c);
    el.removeAttribute('style');
  }
  // 6. Staging-only lines carry one class, so one search finds them at launch.
  const lines = (page.staging_copy_lines || []).map((l) => collapse(l.text).trim());
  const candidates = [...root.querySelectorAll('p, div, h2, h3, h4, span, li')];
  for (const line of lines) {
    const key = line.slice(0, 60);
    let hit = null;
    for (const el of candidates) {
      const t = collapse(el.textContent).trim();
      if (t.startsWith(key) && (!hit || el.textContent.length < hit.textContent.length)) hit = el;
    }
    if (!hit) { report.warnings.push(`${page.url}: staging line not found: ${key}`); continue; }
    // Mark the smallest element that holds the whole line (not its inline children).
    hit.classList.add('eo-staging-note');
    report.staging.push({ page: page.url, tag: hit.tagName.toLowerCase(), text: line.slice(0, 120) });
  }
  // 7. Clinic availability wording on the intake page: EO's live sentence (equalityohio.org/legal-clinic/intake/, read 2026-11-20).
  if (page.url === '/legal-clinic/intake') {
    const EO = 'If you aren&rsquo;t able to complete this form, you can give us a call at <strong>855&#8209;LGBT&#8209;LAW</strong> and leave us a message. Please note that we return voicemails on Tuesday and Thursday each week.';
    let n = 0;
    for (const p of root.querySelectorAll('p')) {
      const html = p.innerHTML;
      const re1 = /If you need legal help today, call <strong>855.LGBT.LAW<\/strong>\./u;
      const re2 = /Need help right now\? Call <strong>855.LGBT.LAW<\/strong>\./u;
      if (re1.test(html)) { p.innerHTML = html.replace(re1, EO); n++; }
      else if (re2.test(html)) { p.innerHTML = html.replace(re2, EO); n++; }
    }
    if (n !== 2) throw new Error(`intake: expected 2 clinic-availability lines, replaced ${n}`);
    report.textChanges.push({ page: page.url, what: 'Two clinic-availability lines now use the live intake page sentence (voicemails returned Tuesday and Thursday).' });
  }
}

/** Inline content of an element, whitespace-collapsed, as the editor would store it. */
function inlineHTML(el) {
  return collapse(el.innerHTML).trim();
}
function hasBlockChild(el) {
  return [...el.children].some((c) => BLOCK_TAGS.has(c.tagName.toLowerCase()) || c.tagName.toLowerCase() === 'img');
}
function hasRawDescendant(el) {
  return [...el.querySelectorAll('*')].some((c) => RAW_TAGS.has(c.tagName.toLowerCase()));
}
function classList(el, drop = []) {
  const list = (el.getAttribute('class') || '').split(/\s+/).filter(Boolean).filter((c) => !drop.includes(c));
  return list.join(' ');
}

function raw(el, page, why) {
  const html = el.outerHTML;
  report.raw.push({ page: page.url, tag: el.tagName.toLowerCase(), cls: el.getAttribute('class') || '', why, chars: html.length });
  return `<!-- wp:html -->\n${html}\n<!-- /wp:html -->`;
}

function convertChildren(el, page) {
  const out = [];
  const kids = [...el.childNodes];
  for (let i = 0; i < kids.length; i++) {
    const n = kids[i];
    if (n.nodeType === 3) {
      if (n.textContent.trim()) throw new Error(`${page.url}: stray text inside <${el.tagName.toLowerCase()} class="${el.getAttribute('class')}">: "${n.textContent.trim().slice(0, 40)}"`);
      continue;
    }
    if (n.nodeType !== 1) continue;
    const tag = n.tagName.toLowerCase();
    // Consecutive .btn links become one Buttons block.
    if (tag === 'a' && n.classList.contains('btn')) {
      const group = [n];
      let j = i + 1;
      while (j < kids.length) {
        const m = kids[j];
        if (m.nodeType === 3 && !m.textContent.trim()) { j++; continue; }
        if (m.nodeType === 1 && m.tagName.toLowerCase() === 'a' && m.classList.contains('btn')) { group.push(m); j++; continue; }
        break;
      }
      out.push(buttons(group, null, page));
      i = j - 1;
      continue;
    }
    out.push(convert(n, page));
  }
  return out.filter(Boolean).join('\n\n');
}

/** .btn classes become registered block styles (functions.php): the wrapper
 *  must not carry .btn itself, or eo-site.css would pad and color it too. */
function buttonClass(a) {
  return classList(a).split(' ').filter(Boolean).map((c) => {
    if (c === 'btn') return null;
    const m = c.match(/^btn--(primary|outline|gold|on-dark)$/);
    if (m) return `is-style-eo-${m[1]}`;
    if (c === 'btn--lg') return 'eo-btn-lg';
    return c; // mt-1 etc. stay utility classes on the wrapper
  }).filter(Boolean).join(' ');
}

function buttons(links, wrapperClass, page) {
  const inner = links.map((a) => {
    const attrs = { className: buttonClass(a) };
    const href = a.getAttribute('href');
    const target = a.getAttribute('target');
    const rel = a.getAttribute('rel');
    if (target) attrs.linkTarget = target;
    if (rel) attrs.rel = rel;
    if (a.id) attrs.anchor = a.id;
    let aAttrs = ` class="wp-block-button__link wp-element-button"`;
    if (a.id) aAttrs += ` id="${a.id}"`;
    aAttrs += ` href="${href}"`;
    if (target) aAttrs += ` target="${target}"`;
    if (rel) aAttrs += ` rel="${rel}"`;
    return `<!-- wp:button${attrJSON(attrs)} -->\n<div class="wp-block-button${attrs.className ? ' ' + attrs.className : ''}"><a${aAttrs}>${inlineHTML(a)}</a></div>\n<!-- /wp:button -->`;
  }).join('\n\n');
  const attrs = wrapperClass ? { className: wrapperClass } : {};
  return `<!-- wp:buttons${attrJSON(attrs)} -->\n<div class="wp-block-buttons${wrapperClass ? ' ' + wrapperClass : ''}">${inner}</div>\n<!-- /wp:buttons -->`;
}

function convert(el, page) {
  const tag = el.tagName.toLowerCase();
  const cls = classList(el);
  const id = el.getAttribute('id') || '';

  if (RAW_TAGS.has(tag)) return raw(el, page, `<${tag}> has no core block`);

  if (/^h[1-6]$/.test(tag)) {
    if (hasBlockChild(el)) return raw(el, page, 'heading with block children');
    const level = Number(tag[1]);
    const attrs = { level: level === 2 ? undefined : level, className: cls || undefined, anchor: id || undefined };
    const classes = ['wp-block-heading', cls].filter(Boolean).join(' ');
    return `<!-- wp:heading${attrJSON(attrs)} -->\n<${tag} class="${classes}"${id ? ` id="${id}"` : ''}>${inlineHTML(el)}</${tag}>\n<!-- /wp:heading -->`;
  }

  if (tag === 'p') {
    if (hasBlockChild(el)) return raw(el, page, 'paragraph with block children');
    const attrs = { className: cls || undefined, anchor: id || undefined };
    return `<!-- wp:paragraph${attrJSON(attrs)} -->\n<p${cls ? ` class="${cls}"` : ''}${id ? ` id="${id}"` : ''}>${inlineHTML(el)}</p>\n<!-- /wp:paragraph -->`;
  }

  if (tag === 'ul' || tag === 'ol') {
    const items = [...el.children];
    if (items.some((li) => li.tagName.toLowerCase() !== 'li' || hasBlockChild(li))) {
      return raw(el, page, `${tag} whose items hold block-level content (${cls || 'no class'})`);
    }
    const attrs = { ordered: tag === 'ol' ? true : undefined, className: cls || undefined, anchor: id || undefined };
    const classes = ['wp-block-list', cls].filter(Boolean).join(' ');
    const inner = items.map((li) => `<!-- wp:list-item -->\n<li>${inlineHTML(li)}</li>\n<!-- /wp:list-item -->`).join('\n\n');
    return `<!-- wp:list${attrJSON(attrs)} -->\n<${tag} class="${classes}"${id ? ` id="${id}"` : ''}>${inner}</${tag}>\n<!-- /wp:list -->`;
  }

  if (tag === 'img') {
    const src = el.getAttribute('src'); const alt = el.getAttribute('alt') || '';
    const w = el.getAttribute('width'); const h = el.getAttribute('height');
    report.images.push({ page: page.url, src, alt, w, h });
    const attrs = { url: src, alt, className: cls || undefined, anchor: id || undefined };
    if (w) attrs.width = `${w}px`;
    if (h) attrs.height = `${h}px`;
    const fig = ['wp-block-image', w ? 'is-resized' : '', cls].filter(Boolean).join(' ');
    const style = w ? ` style="width:${w}px;height:${h ? h + 'px' : 'auto'}"` : '';
    return `<!-- wp:image${attrJSON(attrs)} -->\n<figure class="${fig}"${id ? ` id="${id}"` : ''}><img src="${src}" alt="${alt.replace(/"/g, '&quot;')}"${style}/></figure>\n<!-- /wp:image -->`;
  }

  if (tag === 'a') {
    // A block-level link: a card link, the callout phone, or a linked picture.
    if (hasBlockChild(el) || hasRawDescendant(el)) return raw(el, page, 'link wrapping an image or block');
    const wrap = cls.split(' ')[0] ? `${cls.split(' ')[0]}-wrap` : 'link-wrap';
    const a = el.cloneNode(true);
    return `<!-- wp:paragraph {"className":"${wrap}"} -->\n<p class="${wrap}">${collapse(a.outerHTML).trim()}</p>\n<!-- /wp:paragraph -->`;
  }

  if (GROUP_TAGS.has(tag) || TEXT_TAGS.has(tag) || tag === 'span' || tag === 'blockquote') {
    if (hasRawDescendant(el) && !hasBlockChild(el)) return raw(el, page, `<${tag}.${cls}> contains form controls or media`);
    // Only .btn children (e.g. .hero__ctas) -> a Buttons block carrying the class.
    const kidsEls = [...el.children];
    if (kidsEls.length && kidsEls.every((c) => c.tagName.toLowerCase() === 'a' && c.classList.contains('btn')) && !id &&
        ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      return buttons(kidsEls, cls || null, page);
    }
    const blockKids = hasBlockChild(el);
    // Text that cannot stand alone as a block: bare text nodes and purely inline tags.
    // (<span>, <a> and <img> children can: eo/text, a paragraph wrap, an Image block.)
    const INLINE_ONLY = new Set(['strong', 'em', 'b', 'i', 'time', 'br', 'small', 'code', 'sup', 'sub', 'abbr', 'mark']);
    const inlineText = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) ||
      [...el.children].some((c) => INLINE_ONLY.has(c.tagName.toLowerCase()));
    if (blockKids && inlineText) return raw(el, page, `<${tag}.${cls}> mixes text and blocks`);
    if (!blockKids) {
      // Leaf with inline content: the eo/text block keeps the tag and the attributes.
      const ariaHidden = el.getAttribute('aria-hidden') === 'true';
      const t = TEXT_TAGS.has(tag) || tag === 'span' ? tag : 'div';
      const attrs = { tagName: t === 'div' ? undefined : t, className: cls || undefined, anchor: id || undefined, ariaHidden: ariaHidden || undefined };
      const open = `<${t}${cls ? ` class="${cls}"` : ''}${id ? ` id="${id}"` : ''}${ariaHidden ? ' aria-hidden="true"' : ''}>`;
      return `<!-- wp:eo/text${attrJSON(attrs)} -->\n${open}${inlineHTML(el)}</${t}>\n<!-- /wp:eo/text -->`;
    }
    // Container: core/group with the source tag.
    const t = GROUP_TAG_ATTR.has(tag) ? tag : 'div';
    if (t !== tag) report.warnings.push(`${page.url}: <${tag}> rendered as <div> group`);
    for (const a of el.attributes) {
      if (!['class', 'id'].includes(a.name)) report.warnings.push(`${page.url}: attribute ${a.name}="${a.value}" on <${tag}.${cls}> not carried (core/group keeps class and id only)`);
    }
    const attrs = { tagName: t === 'div' ? undefined : t, className: cls || undefined, anchor: id || undefined, layout: { type: 'default' } };
    const classes = ['wp-block-group', cls].filter(Boolean).join(' ');
    return `<!-- wp:group${attrJSON(attrs)} -->\n<${t} class="${classes}"${id ? ` id="${id}"` : ''}>${convertChildren(el, page)}</${t}>\n<!-- /wp:group -->`;
  }

  if (tag === 'hr') return '<!-- wp:separator -->\n<hr class="wp-block-separator has-alpha-channel-opacity"/>\n<!-- /wp:separator -->';
  if (tag === 'br') return '';
  return raw(el, page, `unhandled <${tag}>`);
}

/* ---------------------------------------------------------------- run */
const outPages = join(root, 'plugins/eo-site/content/pages');
mkdirSync(outPages, { recursive: true });
const written = {};
const registry = [];

const navLabel = {};
for (const item of siteData.nav) { navLabel[item.href] = navLabel[item.href] || item.label; for (const c of item.children || []) navLabel[c.href] = c.label; }

for (const page of pages) {
  const html = readFileSync(join(HANDOFF, page.content_file), 'utf8');
  const { document } = parseHTML(`<!doctype html><html><body><div id="eo-root">${html}</div></body></html>`);
  const rootEl = document.getElementById('eo-root');
  normalizeTree(rootEl, page, document);
  const markup = convertChildren(rootEl, page) + '\n';
  const file = page.url === '/' ? 'home' : page.url.slice(1).replace(/\//g, '--');
  written[`plugins/eo-site/content/pages/${file}.html`] = markup;

  const share = page.share_card.replace('/assets/og/', '');
  registry.push({
    path: page.wp_path,
    slug: page.slug,
    parent: page.parent_url ? page.parent_url.replace(/\/?$/, '/') : null,
    file: `${file}.html`,
    page_id: page.page_id,
    nav_label: page.nav_label || navLabel[page.url] || null,
    h1: page.h1,
    title: page.seo_title,
    description: page.seo_description,
    share_card: share,
    noindex: !!page.noindex,
    sitemap_priority: page.sitemap_priority,
    sitemap_changefreq: page.sitemap_changefreq,
    json_ld: page.json_ld,
    template: page.help_bar ? 'page-legal-guide' : '',
    help_bar: !!page.help_bar,
    front_page: page.url === '/',
    source_text_sha256: page.text_sha256,
  });
}

// Utilities stylesheet.
const util = ['/* Generated by tools/html-to-blocks.mjs from the source pages\' style="" attributes. Do not edit. */'];
for (const [cls, css] of [...utilities.entries()].sort()) util.push(`.${cls} { ${css} }`);
written['themes/equality-ohio/assets/css/eo-utilities.css'] = util.join('\n') + '\n';

// Registry (ordered as the page map).
written['plugins/eo-site/data/pages.json'] = JSON.stringify({ generated_from: 'eo-wordpress-handoff content/pages.json (source ee60763)', today: TODAY, pages: registry }, null, 2) + '\n';

// Report.
const md = [];
md.push('# Conversion Report', '', `Generated by \`tools/html-to-blocks.mjs\` (today = ${TODAY}). ${registry.length} pages.`, '');
md.push('## Raw HTML blocks (core/html)', '', 'Each one and why no core block fit.', '', '| Page | Element | Reason | Size |', '|---|---|---|---|');
for (const r of report.raw) md.push(`| ${r.page} | \`<${r.tag}${r.cls ? ' class="' + r.cls + '"' : ''}>\` | ${r.why} | ${r.chars} chars |`);
md.push('', `Total: ${report.raw.length}.`, '');
md.push('## Dropped expired blocks', '', '| Page | Element | Expired | Text |', '|---|---|---|---|');
for (const d of report.dropped) md.push(`| ${d.page} | \`<${d.tag} class="${d.cls}">\` | ${d.expires} | ${d.text} |`);
md.push('', '## Staging notes marked `.eo-staging-note`', '', '| Page | Element | Text |', '|---|---|---|');
for (const s of report.staging) md.push(`| ${s.page} | ${s.tag} | ${s.text.replace(/\|/g, '\\|')} |`);
md.push('', '## Text changes', '');
for (const t of report.textChanges) md.push(`- ${t.page}: ${t.what}`);
md.push('', '## Images', '', '| Page | src | alt | size |', '|---|---|---|---|');
for (const i of report.images) md.push(`| ${i.page} | ${i.src} | ${i.alt} | ${i.w}×${i.h} |`);
md.push('', '## Warnings', '');
for (const w of [...new Set(report.warnings)]) md.push(`- ${w}`);
written['docs/conversion-report.md'] = md.join('\n') + '\n';

let stale = 0;
for (const [rel, content] of Object.entries(written)) {
  const abs = join(root, rel);
  const cur = existsSync(abs) ? readFileSync(abs, 'utf8') : null;
  if (cur !== content) {
    stale++;
    if (!CHECK) { mkdirSync(dirname(abs), { recursive: true }); writeFileSync(abs, content); }
  }
}
// Orphans: page files that no longer belong.
for (const f of readdirSync(outPages)) if (!written[`plugins/eo-site/content/pages/${f}`]) { stale++; console.error(`orphan: ${f}`); }

if (CHECK) {
  if (stale) { console.error(`${stale} generated file(s) are stale: run npm run pages:build`); process.exit(1); }
  console.log('generated pages are current');
} else {
  console.log(`${registry.length} pages, ${report.raw.length} raw HTML blocks, ${report.dropped.length} expired blocks dropped, ${report.staging.length} staging notes, ${utilities.size} utility classes, ${stale} file(s) written`);
}
