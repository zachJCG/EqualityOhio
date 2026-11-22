# Equality Ohio — WordPress Port

You are rebuilding the Equality Ohio website, which exists as a Next.js app, as a WordPress block theme and 29 pages. **Read `HANDOFF.md` before doing anything.** It has the goal, the current state, the plan and the checks.

## Rules That Always Apply

- **Copy is Equality Ohio's.** Every word comes from `content/`. Do not write, tighten or invent copy, names, dates, figures, eligibility rules or legal guidance.
- **Legal Clinic intake is never stored in WordPress.** No form entries, no logs, no emailed copies. It goes to Lawmatics.
- **equalityohio.org is read-only.** Public reads only. No logins and no writes to EO's site or its host.
- **Do not buy a plan, launch the site, connect a domain, delete the site or change its address.** Those belong to Zach.
- **Accessibility is a release gate.** Zero axe WCAG 2.1 A/AA violations at 390 and 1280 px on every page and state; no sideways scroll at 320 px.
- **No secrets in git.** Treat every repository here as public.
- **Read back what you write to WordPress** and compare it with what you sent.
- **Report with evidence.** Counts and check results, what you could not verify, and where you departed from the brief.

## Where Things Are

- `HANDOFF.md`: the brief.
- `reference/`: page map, component map, forms, launch blockers, WordPress.com site facts.
- `content/`: every page's content, visible text, metadata, and the header and footer as served.
- `redirects/`: the live site's 553 URLs resolved, and the rules.
- `source/nextjs/`: the app at commit `ee60763`. Its own `CLAUDE.md` describes the app, not this job; where the two disagree about what to do, this folder wins.
- `tools/`: scripts and templates that regenerate `content/`, `redirects/`, `inventory/` and `reference/`.

## Regenerating the Data

Only needed if the source changes. From this folder, with Node and Python 3 available:

```
sh tools/build_package.sh source/nextjs . $(date +%F)
```

It rebuilds `content/`, `redirects/`, `inventory/` and `reference/` from the source and the templates in `tools/templates/`. The redirect step must print `problems []`. Edit a template, not a generated file, or the next run overwrites your change.
