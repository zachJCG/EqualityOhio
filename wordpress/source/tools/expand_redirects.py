"""Expand the Next.js redirect rules against the live-sitemap snapshot, in WordPress terms.

Usage: python3 -I expand_redirects.py <repo> <config.json> <pages.json> <outdir>

Writes into <outdir>/redirects/:
  legacy-url-map.csv     all 553 live paths: what each one does on the new site
  redirect-rules.json    the ordered rule list (exact + pattern), WordPress-style targets
  redirect-rules.csv     the same rules as source,target,regex,code
"""
import csv
import json
import os
import re
import sys
from collections import Counter, OrderedDict

repo, config_path, pages_path, outdir = sys.argv[1:5]
cfg = json.load(open(config_path, encoding='utf-8'))
pages = json.load(open(pages_path, encoding='utf-8'))
page_urls = {p['url'] for p in pages if not p['staging_only']}
anchors = {p['url']: set(p['anchor_ids']) for p in pages}

rules = [r for r in cfg['redirects'] if not r['source'].endswith('.html')]


def compile_source(src):
    """Next.js path pattern -> (regex, kind). Only the two shapes this config uses."""
    if ':' not in src:
        return re.compile('^' + re.escape(src) + '$'), 'exact'
    m = re.fullmatch(r'(.*)/:(\w+)(\*?)', src)
    if not m:
        raise SystemExit('unsupported pattern: ' + src)
    base, _, star = m.groups()
    if star:      # zero or more segments
        return re.compile('^' + re.escape(base) + r'(?:/.*)?$'), 'prefix'
    return re.compile('^' + re.escape(base) + r'/[^/]+$'), 'one-segment'


compiled = [(compile_source(r['source']), r) for r in rules]


def wp_target(dest):
    """'/give#daf' -> '/give/#daf'; '/' stays '/'; files keep their path."""
    path, sep, frag = dest.partition('#')
    if path != '/' and not re.search(r'\.[a-z0-9]{2,5}$', path):
        path = path.rstrip('/') + '/'
    return path + (sep + frag if sep else '')


def wp_regex(src):
    """Regex for a WordPress redirect tool: optional trailing slash, anchored."""
    (rx, kind), = [compile_source(src)]
    if kind == 'exact':
        return '^' + re.escape(src).replace('\\-', '-') + '/?$'
    base = re.fullmatch(r'(.*)/:(\w+)(\*?)', src).group(1)
    base = re.escape(base).replace('\\-', '-')
    return '^' + base + ('(?:/.*)?$' if kind == 'prefix' else '/[^/]+/?$')


def resolve(path):
    """First matching rule wins, as in Next.js."""
    for (rx, kind), r in compiled:
        if rx.match(path):
            return r
    return None


live = [l.strip() for l in open(os.path.join(repo, 'docs', 'legacy-sitemap-urls.txt'), encoding='utf-8')
        if l.strip() and not l.startswith('#')]

os.makedirs(os.path.join(outdir, 'redirects'), exist_ok=True)
rows, problems = [], []
by_action, by_dest = Counter(), Counter()
used_rules = Counter()
for lp in live:
    norm = lp.rstrip('/') or '/'
    if norm in page_urls:
        rows.append([lp, 'keeps its path', '', norm if norm == '/' else norm + '/', ''])
        by_action['keeps its path'] += 1
        continue
    r = resolve(norm)
    if not r:
        problems.append(('unresolved', lp))
        rows.append([lp, 'UNRESOLVED', '', '', ''])
        continue
    dest = r['destination']
    dpath, _, frag = dest.partition('#')
    # a redirect must land on a page (or a mirrored file) in one hop, and its anchor must exist
    if dpath.startswith('/assets/'):
        if not os.path.exists(os.path.join(repo, 'public', dpath.lstrip('/'))):
            problems.append(('missing file', lp, dest))
    else:
        if dpath not in page_urls:
            problems.append(('target is not a page', lp, dest))
        elif frag and frag not in anchors[dpath]:
            problems.append(('missing anchor', lp, dest))
        if resolve(dpath):
            problems.append(('chain', lp, dest))
    code = 301 if r['permanent'] else 302
    rows.append([lp, 'redirects', code, wp_target(dest), r['source']])
    by_action['redirects'] += 1
    by_dest[wp_target(dest)] += 1
    used_rules[r['source']] += 1

with open(os.path.join(outdir, 'redirects', 'legacy-url-map.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['live_path', 'on_the_new_site', 'http_code', 'lands_on', 'matched_rule'])
    w.writerows(rows)

# Families tell Claude Code which rules a fresh install needs vs. a theme swap on EO's existing install.
def family(src):
    if src in set(cfg['legacyPostPaths']):
        return 'legacy-post'
    for prefix, fam in [('/wp-content/', 'media'), ('/category', 'post-taxonomy'), ('/tag', 'post-taxonomy'),
                        ('/people', 'people-cpt'), ('/people-category', 'people-cpt'), ('/about/staff-interns/', 'people-cpt'),
                        ('/job-', 'jobs-cpt'), ('/single-jobs', 'jobs-cpt'), ('/worship-database', 'worship-database-cpt'),
                        ('/our-work/faith', 'worship-database-cpt'), ('/municipal-map', 'municipal-map-cpt'),
                        ('/event', 'events-calendar'), ('/our-work/events', 'events-calendar'),
                        ('/board', 'round-1-mockup'), ('/legal-clinic-intake', 'round-1-mockup')]:
        if src.startswith(prefix):
            return fam
    return 'retired-page'


out_rules = []
for i, r in enumerate(rules, 1):
    (rx, kind), = [compile_source(r['source'])]
    out_rules.append(OrderedDict([
        ('order', i),
        ('source', r['source']),
        ('match', kind),
        ('regex', wp_regex(r['source'])),
        ('target', wp_target(r['destination'])),
        ('code', 301 if r['permanent'] else 302),
        ('next_code', 308 if r['permanent'] else 307),
        ('family', family(r['source'])),
        ('live_paths_matched', used_rules.get(r['source'], 0)),
    ]))
json.dump(out_rules, open(os.path.join(outdir, 'redirects', 'redirect-rules.json'), 'w', encoding='utf-8'), indent=2)
with open(os.path.join(outdir, 'redirects', 'redirect-rules.csv'), 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f)
    w.writerow(['source', 'target', 'regex', 'code'])
    for r in out_rules:
        if r['match'] == 'exact':
            w.writerow([r['source'] + '/', r['target'], 0, r['code']])
        else:
            w.writerow([r['regex'], r['target'], 1, r['code']])

fam = Counter(r['family'] for r in out_rules)
unused = [r['source'] for r in out_rules if not r['live_paths_matched']]
print('live paths', len(live), dict(by_action))
print('problems', problems)
print('rules', len(out_rules), 'exact', sum(r['match'] == 'exact' for r in out_rules), 'pattern', sum(r['match'] != 'exact' for r in out_rules))
print('families', dict(fam))
print('302s', [r['source'] for r in out_rules if r['code'] == 302])
print('rules matching no live path (%d):' % len(unused), unused)
print('top destinations', by_dest.most_common(12))
json.dump({'live_paths': len(live), 'actions': by_action, 'destinations': OrderedDict(by_dest.most_common()),
           'rule_families': fam, 'rules_matching_no_live_path': unused, 'problems': problems},
          open(os.path.join(outdir, 'redirects', 'summary.json'), 'w', encoding='utf-8'), indent=2)
