"""Inventory the Next.js app's static pages for the WordPress handoff.

Usage: python3 -I analyze.py <repo> <config.json> <outdir> <today YYYY-MM-DD>

Writes:
  <outdir>/content/main/<slug-path>.html   each page's <main> inner HTML, nothing generated
  <outdir>/content/pages.json              one record per page (WordPress-ready metadata)
  <outdir>/inventory.json                  cross-page inventory (forms, links, staging copy, expiry...)
"""
import hashlib
import json
import os
import re
import sys
from collections import Counter, OrderedDict
from html.parser import HTMLParser

repo, config_path, outdir, today = sys.argv[1:5]
cfg = json.load(open(config_path, encoding='utf-8'))
PUBLIC = os.path.join(repo, 'public')

GENERATED = re.compile(r'<!-- (seo|chrome:header|chrome:footer):start -->.*?<!-- \1:end -->', re.S)
COMMENT = re.compile(r'<!--.*?-->', re.S)
STAGING_COPY = [re.compile(p, re.I) for p in [
    r'design preview', r'\b(?:this|the) preview\b', r'\bin the real build\b', r'\bproduction build\b',
    r'\bpending (?:embed|asset)\b', r'\bmockup\b', r'\bcontent migration\b', r'\bvisual-only mock\b',
    r'\bpending\s*(?:—|&mdash;|:)',
]]
SELF = re.compile(r'^https?://(?:www\.)?equalityohio\.org(?=[/?#]|$)', re.I)
WORDPRESS = re.compile(r'/wp-content/|wpengine\.com', re.I)
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'}


class Doc(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.h1 = []
        self.headings = []
        self.ids = []
        self.links = []
        self.images = []
        self.forms = []
        self.classes = Counter()
        self.expires = []
        self.inline_styles = 0
        self.scripts = []
        self.iframes = []
        self._heading = None
        self._form = None
        self._label_for = None
        self._label_text = []
        self._labels = {}
        self._link = None
        self._legend = None

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag not in VOID:
            self.stack.append(tag)
        if 'id' in a:
            self.ids.append(a['id'])
        for c in (a.get('class') or '').split():
            self.classes[c] += 1
        if 'style' in a:
            self.inline_styles += 1
        if 'data-expires' in a:
            self.expires.append({'tag': tag, 'date': a['data-expires'], 'id': a.get('id'), 'class': a.get('class')})
        if re.fullmatch(r'h[1-6]', tag):
            self._heading = {'level': int(tag[1]), 'text': [], 'id': a.get('id'), 'class': a.get('class')}
        if tag == 'a':
            self._link = {'href': a.get('href', ''), 'text': [], 'target': a.get('target'), 'rel': a.get('rel'), 'class': a.get('class')}
        if tag == 'img':
            self.images.append({k: a.get(k) for k in ('src', 'alt', 'width', 'height', 'loading', 'srcset', 'sizes')})
        if tag == 'source' and a.get('srcset'):
            self.images.append({'source_srcset': a.get('srcset'), 'type': a.get('type')})
        if tag == 'script':
            self.scripts.append({'src': a.get('src'), 'type': a.get('type')})
        if tag == 'iframe':
            self.iframes.append(a.get('src'))
        if tag == 'form':
            self._form = {'mock': a.get('data-mock') == 'true', 'aria_label': a.get('aria-label'), 'action': a.get('action'),
                          'id': a.get('id'), 'class': a.get('class'), 'fields': [], 'fieldsets': [], 'submit': None}
        if self._form is not None:
            if tag == 'label':
                self._label_for = a.get('for')
                self._label_text = []
            if tag == 'legend':
                self._legend = []
            if tag in ('input', 'select', 'textarea'):
                self._form['fields'].append({
                    'tag': tag, 'type': a.get('type') or ('text' if tag == 'input' else tag), 'id': a.get('id'), 'name': a.get('name'),
                    'required': 'required' in a, 'autocomplete': a.get('autocomplete'), 'value': a.get('value'),
                    'describedby': a.get('aria-describedby'),
                })
            if tag == 'button':
                self._button = []

    def handle_endtag(self, tag):
        if tag in self.stack:
            while self.stack and self.stack.pop() != tag:
                pass
        if re.fullmatch(r'h[1-6]', tag) and self._heading:
            h = self._heading
            h['text'] = ' '.join(''.join(h['text']).split())
            self.headings.append(h)
            if h['level'] == 1:
                self.h1.append(h['text'])
            self._heading = None
        if tag == 'a' and self._link:
            self._link['text'] = ' '.join(''.join(self._link['text']).split())
            self.links.append(self._link)
            self._link = None
        if self._form is not None:
            if tag == 'label' and self._label_for is not None:
                self._labels[self._label_for] = ' '.join(''.join(self._label_text).split())
                self._label_for = None
            if tag == 'legend' and self._legend is not None:
                self._form['fieldsets'].append(' '.join(''.join(self._legend).split()))
                self._legend = None
            if tag == 'button' and getattr(self, '_button', None) is not None:
                self._form['submit'] = ' '.join(''.join(self._button).split())
                self._button = None
            if tag == 'form':
                for f in self._form['fields']:
                    f['label'] = self._labels.get(f['id'])
                self.forms.append(self._form)
                self._form = None
                self._labels = {}

    def handle_data(self, data):
        if self._heading is not None:
            self._heading['text'].append(data)
        if self._link is not None:
            self._link['text'].append(data)
        if self._form is not None:
            if self._label_for is not None:
                self._label_text.append(data)
            if self._legend is not None:
                self._legend.append(data)
            if getattr(self, '_button', None) is not None:
                self._button.append(data)


def text_of(html):
    import html as _html
    return ' '.join(_html.unescape(re.sub(r'<[^>]+>', ' ', html)).split())


BLOCK_TAGS = r'(?:section|div|article|aside|p|h[1-6]|li|ul|ol|dl|dt|dd|form|fieldset|legend|label|button|select|option|textarea|table|tr|td|th|blockquote|figure|figcaption|picture|br|hr|details|summary|nav|header|footer|time)'


def visible_text(html):
    """Visible text of a fragment, one block-level run per line, entities decoded."""
    import html as _html
    t = COMMENT.sub('', html)
    t = re.sub(r'<(script|style)\b.*?</\1>', '', t, flags=re.S)
    t = re.sub(r'</?' + BLOCK_TAGS + r'\b[^>]*>', '\n', t, flags=re.I)
    t = re.sub(r'<[^>]+>', '', t)
    t = _html.unescape(t)
    lines = [' '.join(l.split()) for l in t.split('\n')]
    return '\n'.join(l for l in lines if l) + '\n'


seo = {p['url']: p for p in cfg['pages']}
nav_by_page = {}
for item in cfg['nav']:
    nav_by_page.setdefault(item['page'], item['label'])
    for c in item.get('children', []):
        nav_by_page[c['page']] = c['label']

pages = []
inv = {'forms': [], 'staging_copy': [], 'self_links': [], 'expired': [], 'events': [], 'external_hosts': Counter(),
       'external_links': [], 'mailto': Counter(), 'tel': Counter(), 'classes': Counter(), 'page_styles': [],
       'anchors_used': {}, 'images': Counter(), 'docs_links': Counter(), 'iframes': [], 'scripts': Counter()}

files = []
for root, _, names in os.walk(PUBLIC):
    for n in names:
        if n.endswith('.html'):
            files.append(os.path.join(root, n))
files.sort()

for abs_path in files:
    rel = os.path.relpath(abs_path, PUBLIC).replace(os.sep, '/')
    if rel == 'index.html':
        url = '/'
    elif rel.endswith('/index.html'):
        url = '/' + rel[:-len('/index.html')]
    else:
        url = '/' + rel[:-len('.html')]
    raw = open(abs_path, encoding='utf-8').read()
    body_m = re.search(r'<body\b[^>]*data-page="([^"]+)"', raw)
    page_id = body_m.group(1) if body_m else None
    m = re.search(r'<main id="main">(.*)</main>', raw, re.S)
    main = m.group(1) if m else ''
    main_clean = main.strip('\n') + '\n'
    # page-scoped <style> blocks outside generated regions (in <head> or <body>)
    ungenerated = GENERATED.sub('', raw)
    styles = re.findall(r'<style\b[^>]*>(.*?)</style>', ungenerated, re.S)

    doc = Doc()
    doc.feed(COMMENT.sub('', main))

    # staging-only copy: line by line, comments blanked, generated regions skipped
    blanked = GENERATED.sub(lambda mm: re.sub(r'[^\n]', ' ', mm.group(0)), raw)
    blanked = COMMENT.sub(lambda mm: re.sub(r'[^\n]', ' ', mm.group(0)), blanked)
    staging = []
    for i, line in enumerate(blanked.split('\n'), 1):
        if any(r.search(line) for r in STAGING_COPY):
            staging.append({'line': i, 'text': text_of(line)[:260]})

    events = re.findall(r'<!-- EVENT: (.*?) -->', main)
    election = re.findall(r'<!-- ELECTION: (.*?) -->', main, re.S)

    internal, external, self_links = [], [], []
    for l in doc.links:
        href = l['href']
        if href.startswith('tel:'):
            inv['tel'][href] += 1
        elif href.startswith('mailto:'):
            inv['mailto'][href] += 1
        elif href.startswith('#'):
            internal.append(url + href if url != '/' else '/' + href)
        elif href.startswith('/'):
            internal.append(href)
            if href.startswith('/assets/docs/'):
                inv['docs_links'][href] += 1
        elif re.match(r'https?://', href):
            host = re.sub(r'^https?://([^/]+).*$', r'\1', href)
            if SELF.search(href) or WORDPRESS.search(href):
                self_links.append({'href': href, 'text': l['text']})
            else:
                external.append({'href': href, 'text': l['text']})
                inv['external_hosts'][host] += 1
    for img in doc.images:
        if img.get('src'):
            inv['images'][img['src']] += 1

    is_home = url == '/'
    segs = [s for s in url.split('/') if s]
    parent = '/' + '/'.join(segs[:-1]) if len(segs) > 1 else None
    out_rel = ('home' if is_home else '/'.join(segs)) + '.html'
    s = seo.get(url, {})
    expired = [e for e in doc.expires if e['date'] < today]

    rec = OrderedDict([
        ('url', url),
        ('wp_path', '/' if is_home else url + '/'),
        ('slug', 'home' if is_home else segs[-1]),
        ('parent_url', parent),
        ('depth', len(segs)),
        ('source_file', 'public/' + rel),
        ('content_file', 'content/main/' + out_rel),
        ('page_id', page_id),
        ('nav_label', nav_by_page.get(page_id)),
        ('h1', doc.h1[0] if doc.h1 else None),
        ('seo_title', s.get('title')),
        ('seo_description', s.get('description')),
        ('share_card', (s.get('image') or {}).get('path') or (cfg['ogImages'].get(s.get('section') or 'default') or {}).get('path')),
        ('noindex', bool(s.get('noindex'))),
        ('sitemap_priority', s.get('priority')),
        ('sitemap_changefreq', s.get('changefreq')),
        ('json_ld', [g['@type'] for g in cfg['jsonLd'].get(url, [])]),
        ('help_bar', page_id in cfg['helpBarPages']),
        ('staging_only', url == '/gate'),
        ('headings', [{'level': h['level'], 'text': h['text'], 'id': h['id']} for h in doc.headings]),
        ('anchor_ids', doc.ids),
        ('forms', [{'mock': f['mock'], 'aria_label': f['aria_label'], 'submit': f['submit'], 'fieldsets': f['fieldsets'],
                    'fields': [{'label': x.get('label'), 'type': x['type'], 'id': x['id'], 'name': x['name'], 'required': x['required'], 'autocomplete': x['autocomplete']} for x in f['fields']]}
                   for f in doc.forms]),
        ('internal_links', sorted(set(internal))),
        ('external_links', external),
        ('self_links_to_wordpress', self_links),
        ('images', [i for i in doc.images if i.get('src')]),
        ('data_expires', doc.expires),
        ('expired_as_of_' + today, expired),
        ('event_blocks', events),
        ('election_blocks', len(election)),
        ('staging_copy_lines', staging),
        ('page_style_blocks', len(styles)),
        ('inline_style_attrs', doc.inline_styles),
        ('iframes', doc.iframes),
        ('bytes_main', len(main_clean.encode('utf-8'))),
    ])
    pages.append(rec)

    dest = os.path.join(outdir, 'content', 'main', out_rel)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    open(dest, 'w', encoding='utf-8').write(main_clean)
    vt = visible_text(main)
    tdest = os.path.join(outdir, 'content', 'text', out_rel[:-5] + '.txt')
    os.makedirs(os.path.dirname(tdest), exist_ok=True)
    open(tdest, 'w', encoding='utf-8').write(vt)
    rec['text_file'] = 'content/text/' + out_rel[:-5] + '.txt'
    rec['text_words'] = len(vt.split())
    rec['text_sha256'] = hashlib.sha256(vt.encode('utf-8')).hexdigest()

    for f in rec['forms']:
        inv['forms'].append({'url': url, **f})
    for sc in staging:
        inv['staging_copy'].append({'url': url, **sc})
    for sl in self_links:
        inv['self_links'].append({'url': url, **sl})
    for e in expired:
        inv['expired'].append({'url': url, **e})
    for ev in events:
        inv['events'].append({'url': url, 'event': ev})
    for l in external:
        inv['external_links'].append({'url': url, **l})
    if url != '/gate':
        inv['classes'].update(doc.classes)
    if styles:
        inv['page_styles'].append({'url': url, 'blocks': len(styles), 'bytes': sum(len(x) for x in styles), 'css': [x.strip() for x in styles]})
    for i in doc.iframes:
        inv['iframes'].append({'url': url, 'src': i})
    for sc in doc.scripts:
        inv['scripts'][str(sc)] += 1

# the generated chrome, as served, for building the template parts
def region(path, name):
    raw = open(os.path.join(PUBLIC, path), encoding='utf-8').read()
    m = re.search(r'<!-- ' + name + r':start -->\n?(.*?)\s*<!-- ' + name + r':end -->', raw, re.S)
    return m.group(1) + '\n'


cdir = os.path.join(outdir, 'content', 'chrome')
os.makedirs(cdir, exist_ok=True)
open(os.path.join(cdir, 'header.html'), 'w', encoding='utf-8').write(region('index.html', 'chrome:header'))
open(os.path.join(cdir, 'footer.html'), 'w', encoding='utf-8').write(region('index.html', 'chrome:footer'))
open(os.path.join(cdir, 'footer-with-help-bar.html'), 'w', encoding='utf-8').write(region('legal-clinic.html', 'chrome:footer'))
open(os.path.join(cdir, 'head-home.html'), 'w', encoding='utf-8').write(region('index.html', 'seo'))
open(os.path.join(cdir, 'head-interior.html'), 'w', encoding='utf-8').write(region('about/history.html', 'seo'))
json.dump({'nav': cfg['nav'], 'help_bar_pages': cfg['helpBarPages'], 'org': cfg['site']['ORG'], 'site': {k: v for k, v in cfg['site'].items() if k != 'ORG'},
           'not_found': cfg['notFound'], 'share_cards': cfg['ogImages']},
          open(os.path.join(cdir, 'site-data.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)

# every internal link (path#anchor) must resolve to a page and, when present, an id on it
by_url = {p['url']: p for p in pages}
broken = []
for p in pages:
    for href in p['internal_links']:
        path, _, frag = href.partition('#')
        path = path or '/'
        if path.startswith('/assets/') or path in ('/favicon.ico',):
            continue
        target = by_url.get(path.rstrip('/') or '/')
        if not target:
            broken.append({'from': p['url'], 'href': href, 'why': 'no such page'})
        elif frag and frag not in target['anchor_ids'] and frag not in ('main', 'footer-nav'):
            broken.append({'from': p['url'], 'href': href, 'why': 'no such id'})
inv['broken_internal_links'] = broken

for k in ('external_hosts', 'mailto', 'tel', 'classes', 'images', 'docs_links', 'scripts'):
    inv[k] = OrderedDict(sorted(inv[k].items(), key=lambda kv: (-kv[1], kv[0])))

json.dump(pages, open(os.path.join(outdir, 'content', 'pages.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)
json.dump(inv, open(os.path.join(outdir, 'inventory.json'), 'w', encoding='utf-8'), indent=2, ensure_ascii=False)

print('pages', len(pages))
print('h1 problems', [p['url'] for p in pages if not p['h1']])
print('mock forms', sum(1 for f in inv['forms'] if f['mock']), 'on', sorted({f['url'] for f in inv['forms']}))
print('staging copy lines', len(inv['staging_copy']), 'on', len({s['url'] for s in inv['staging_copy']}), 'pages')
print('self links', len(inv['self_links']))
print('expired', [(e['url'], e['date'], e['tag'], e.get('class')) for e in inv['expired']])
print('events', inv['events'])
print('broken internal', broken)
print('external hosts', dict(inv['external_hosts']))
print('page style blocks', [(s['url'], s['bytes']) for s in inv['page_styles']])
print('iframes', inv['iframes'], 'scripts', dict(inv['scripts']))
print('inline style attrs total', sum(p['inline_style_attrs'] for p in pages))
