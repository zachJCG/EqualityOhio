"""Write the generated reference tables for the handoff package.

Usage: python3 -I build_reference.py <outdir with content/ inventory.json redirects/> <package dir> <templates dir>

Writes <package>/reference/*.md and <package>/redirects/README.md. The hand-written parts live in the
templates; the tables and counts come from the data.
"""
import json
import os
import sys
from collections import OrderedDict

out, pkg, tpl = sys.argv[1:4]
ref = os.path.join(pkg, 'reference')
pages = json.load(open(os.path.join(out, 'content', 'pages.json'), encoding='utf-8'))
inv = json.load(open(os.path.join(out, 'inventory.json'), encoding='utf-8'))
red = json.load(open(os.path.join(out, 'redirects', 'summary.json'), encoding='utf-8'))
rules = json.load(open(os.path.join(out, 'redirects', 'redirect-rules.json'), encoding='utf-8'))
os.makedirs(ref, exist_ok=True)
content = sorted((p for p in pages if not p['staging_only']), key=lambda p: (p['url'] != '/', p['url']))
# analyze.py names the expired-block list after the day it ran (expired_as_of_YYYY-MM-DD).
EXPIRED = next(k for k in pages[0] if k.startswith('expired_as_of_'))
AS_OF = EXPIRED[len('expired_as_of_'):]


def cell(text):
    return str(text if text is not None else '').replace('|', '\\|').replace('\n', ' ')


# ---------------------------------------------------------------- page map
L = ['# Page Map: 29 Pages to Create in WordPress', '',
     'Generated from `content/pages.json` (source commit `ee60763`). One row per WordPress Page. '
     'Slugs and parents reproduce the live equalityohio.org paths, so every URL keeps its trailing-slash spelling.', '',
     '| # | WordPress path | Slug | Parent | H1 | Words | On this page |',
     '|---|---|---|---|---|---|---|']
for i, p in enumerate(content, 1):
    notes = []
    if p['url'] == '/':
        notes.append('Static front page')
    if p['forms']:
        notes.append('Form: ' + ', '.join(f['aria_label'] or 'form' for f in p['forms']))
    if p['help_bar']:
        notes.append('Phone help bar')
    if p['noindex']:
        notes.append('Stays noindex after launch')
    n = len(p['staging_copy_lines'])
    if n:
        notes.append('%d staging-only line%s' % (n, '' if n == 1 else 's'))
    exp = p[EXPIRED]
    if exp:
        notes.append('%d expired election block%s (do not port)' % (len(exp), '' if len(exp) == 1 else 's'))
    if p['self_links_to_wordpress']:
        k = len(p['self_links_to_wordpress'])
        notes.append('%d link%s back to equalityohio.org' % (k, '' if k == 1 else 's'))
    if p['images']:
        notes.append('%d image%s' % (len(p['images']), '' if len(p['images']) == 1 else 's'))
    L.append('| %d | `%s` | `%s` | %s | %s | %d | %s |' % (
        i, p['wp_path'], p['slug'], '`%s/`' % p['parent_url'] if p['parent_url'] else '—',
        cell(p['h1']), p['text_words'], cell('; '.join(notes)) or '—'))
L += ['', 'Totals: %d pages, %d words, %d forms, %d staging-only lines, %d expired blocks, %d links back to equalityohio.org.' % (
    len(content), sum(p['text_words'] for p in content), sum(len(p['forms']) for p in content),
    sum(len(p['staging_copy_lines']) for p in content), sum(len(p[EXPIRED]) for p in content),
    sum(len(p['self_links_to_wordpress']) for p in content)), '',
    'Not ported: `/gate` (the Vercel staging gate). The branded 404 becomes `templates/404.html`.', '',
    '## SEO Registry', '',
    'Titles are the live site\'s titles verbatim; descriptions are EO\'s own wording, trimmed to 160 characters. '
    'Every indexable page except the home page also carries a BreadcrumbList; the home page carries NGO and WebSite graphs '
    '(`content/chrome/head-home.html` shows the exact output).', '',
    '| WordPress path | Title | Description | Share card |', '|---|---|---|---|']
for p in content:
    L.append('| `%s` | %s | %s | `%s` |' % (p['wp_path'], cell(p['seo_title']), cell(p['seo_description']), (p['share_card'] or '').split('/')[-1]))
open(os.path.join(ref, 'page-map.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')

# ---------------------------------------------------------------- launch blockers
L = ['# Staging-Only Content, Expired Content and Links Back to WordPress', '',
     'Generated from the source pages on %s with the same patterns the source repo\'s own tests use ' % AS_OF +
     '(`tests/site-rules.test.mjs`, `tests/freshness.test.mjs`). Line numbers refer to the file under `source/nextjs/`.', '',
     '## 1. Expired Blocks: Do Not Port', '']
if inv['expired']:
    L += ['Each carries `data-expires="2026-11-04"` and an `<!-- ELECTION: … -->` comment telling the next editor to delete it after Election Day.', '',
          '| Page | Element | What it is |', '|---|---|---|']
else:
    L += ['None as of %s. The four 2026 election blocks (`data-expires="2026-11-04"`) were deleted from the source after Election Day.' % AS_OF]
what = {('/', 'section'): 'The "Make your plan to vote in 2026!" section with the scorecard banner',
        ('/', 'article'): 'The "Make your plan to vote" card in "The latest"',
        ('/news', 'div'): 'The election alert card at the top of News & Policy',
        ('/votersguide', 'div'): 'The get-out-the-vote block (three cards)'}
for e in inv['expired']:
    L.append('| `%s` | `<%s class="%s">` | %s |' % (e['url'], e['tag'], e.get('class') or '', what.get((e['url'], e['tag']), '')))
L += ['', 'Everything else about the 2026 election (the `/votersguide/` page itself, the scorecard cards and the news items) is still in the source and is EO\'s call. Flag it; do not cut it yourself.', '',
      '## 2. Staging-Only Copy (%d Lines on %d Pages)' % (
          sum(len(p['staging_copy_lines']) for p in content), sum(1 for p in content if p['staging_copy_lines'])), '',
      'True only of a preview. Carry each one into WordPress as a marked staging note (one pattern, one class) so a single search finds them all at launch. The source 404 adds three more (`pages/404.js`, `lib/seo.mjs` `NOT_FOUND`).', '',
      '| Page | Source line | Text |', '|---|---|---|']
for p in content:
    for s in p['staging_copy_lines']:
        L.append('| `%s` | %d | %s |' % (p['url'], s['line'], cell(s['text'])))
L += ['', '## 3. Links Back to equalityohio.org (%d)' % len(inv['self_links']), '',
      'On a fresh install these still point at the live site, which is fine while staging. They become loops or 404s the day this build serves equalityohio.org.', '',
      '| Page | Link text | Target |', '|---|---|---|']
for s in inv['self_links']:
    L.append('| `%s` | %s | %s |' % (s['url'], cell(s['text']), s['href']))
L += ['', '## 4. Forms That Send Nothing (%d)' % sum(1 for f in inv['forms'] if f['mock']), '',
      'See `reference/forms.md` for fields and where each one should go.', '']
for f in inv['forms']:
    L.append('- `%s`: %s (%d fields, button "%s")' % (f['url'], f['aria_label'], len(f['fields']), f['submit']))
open(os.path.join(ref, 'launch-blockers.md'), 'w', encoding='utf-8').write('\n'.join(L) + '\n')

# ---------------------------------------------------------------- forms field tables (appended to hand-written intro)
L = []
for f in inv['forms']:
    L += ['### `%s`: %s' % (f['url'], f['aria_label']), '',
          'Submit button: "%s".%s' % (f['submit'], (' Field groups: ' + '; '.join(f['fieldsets']) + '.') if f['fieldsets'] else ''), '',
          '| Label | Type | Required | Source id |', '|---|---|---|---|']
    for x in f['fields']:
        L.append('| %s | %s | %s | `%s` |' % (cell((x['label'] or '').rstrip('*')), x['type'], 'Yes' if x['required'] else 'No', x['id']))
    L.append('')
forms_tpl = open(os.path.join(tpl, 'forms.md'), encoding='utf-8').read()
assert '<!-- GENERATED:forms-fields -->' in forms_tpl
open(os.path.join(ref, 'forms.md'), 'w', encoding='utf-8').write(forms_tpl.replace('<!-- GENERATED:forms-fields -->', '\n'.join(L).rstrip() ) + '\n' if not forms_tpl.endswith('\n\n') else forms_tpl.replace('<!-- GENERATED:forms-fields -->', '\n'.join(L).rstrip()))

# ---------------------------------------------------------------- redirects README numbers
fam = OrderedDict(sorted(red['rule_families'].items(), key=lambda kv: -kv[1]))
L = ['| Family | Rules | What it covers |', '|---|---|---|']
desc = {
    'legacy-post': 'The 69 posts in the live post sitemap, all sent to `/news/`',
    'people-cpt': 'Staff and board profile pages and the people taxonomy archives',
    'retired-page': 'Old giving, volunteer, newsletter, template and campaign pages',
    'events-calendar': 'The Events Calendar URLs (`/events/`, `/event/<slug>/`, category archives)',
    'jobs-cpt': 'Job openings and the job taxonomy archive',
    'worship-database-cpt': 'The affirming-congregations directory (108 entries), temporary',
    'municipal-map-cpt': 'The per-city municipal map pages (257), temporary',
    'post-taxonomy': 'Post category and tag archives',
    'media': 'Three PDFs that moved from `/wp-content/uploads/` to mirrored copies',
    'round-1-mockup': 'Flat URLs from the first mockup round; safe to drop',
}
for k, v in fam.items():
    L.append('| `%s` | %d | %s |' % (k, v, desc.get(k, '')))
L += ['', 'Where the 528 redirected live paths land:', '', '| Lands on | Live paths |', '|---|---|']
for k, v in red['destinations'].items():
    L.append('| `%s` | %d |' % (k, v))
red_tpl = open(os.path.join(tpl, 'redirects-README.md'), encoding='utf-8').read()
assert '<!-- GENERATED:redirect-tables -->' in red_tpl
open(os.path.join(pkg, 'redirects', 'README.md'), 'w', encoding='utf-8').write(red_tpl.replace('<!-- GENERATED:redirect-tables -->', '\n'.join(L)))

# ---------------------------------------------------------------- component map (counts) and site facts (verbatim)
class Counts(dict):
    def __missing__(self, key):
        raise SystemExit('component-map.md asks for a class the pages do not use: ' + key)


comp_tpl = open(os.path.join(tpl, 'component-map.md'), encoding='utf-8').read()
open(os.path.join(ref, 'component-map.md'), 'w', encoding='utf-8').write(comp_tpl % Counts(inv['classes']))
open(os.path.join(ref, 'wpcom-site.md'), 'w', encoding='utf-8').write(open(os.path.join(tpl, 'wpcom-site.md'), encoding='utf-8').read())
print('ok', len(content), 'pages;', len(rules), 'rules')
