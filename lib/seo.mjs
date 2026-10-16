/* =============================================================================
 * lib/seo.mjs: how every page presents itself to browsers, crawlers and share
 * cards. One entry per URL.
 *
 * Ported from the Ohio Pride platform (lib/seo.mjs + scripts/build-seo.mjs),
 * adapted for a staging-first site: everything that must flip at launch reads
 * LAUNCHED from lib/site.mjs instead of being typed into 29 pages.
 *
 * Consumers:
 *   scripts/build-pages.mjs  writes the <!-- seo:start --> ... <!-- seo:end -->
 *                            block into every public/**\/*.html, and --check
 *                            fails on drift or a registry problem
 *   app/sitemap.js           /sitemap.xml (indexable pages only, with
 *                            lib/static-pages.mjs)
 *   app/robots.js            /robots.txt
 *   pages/_document.js       icons, manifest, preloads and stylesheets for the
 *   pages/404.js             branded 404, plus NOT_FOUND for its metadata
 *
 * Adding a page: create public/<path>.html from the skeleton in
 * docs/authoring-conventions.md, add an entry to PAGES, run
 * `npm run pages:build`. `npm run check:pages` fails if you forget.
 *
 * Copy rule: titles are today's titles verbatim. Descriptions are EO's own
 * wording; where a description ran past 160 characters it was shortened by
 * trimming that wording, never by adding a claim.
 * ========================================================================== */

import { LAUNCHED, ORG, SITE_NAME, SITE_URL, THEME_COLOR } from './site.mjs';

export { LAUNCHED, SITE_NAME, SITE_URL, THEME_COLOR };

/* While staging, share cards say so: a preview link pasted into a chat must
 * not read as the live site. */
export const OG_SITE_NAME = LAUNCHED ? SITE_NAME : `${SITE_NAME} — Design Preview`;

export const absolute = (path) => new URL(path, SITE_URL).href;

/**
 * Whether this build may be indexed at all: only a launched build deployed to
 * Vercel production. Preview deployments stay out of search after launch too.
 * Read at build time (next.config.mjs headers, app/robots.js).
 */
export function indexingAllowed() {
  return LAUNCHED && process.env.VERCEL_ENV === 'production';
}

/* ---------------------------------------------------------------------------
 * Share cards: one 1200x630 card per section (scripts/art/generate-assets.mjs
 * writes them). /votersguide uses the scorecard banner it already shows.
 * ------------------------------------------------------------------------- */
/* Alt text matches the text drawn on each card; scripts/art/og-cards.json
 * (written by the generator) is the source, and `npm run check:pages` fails
 * when this table and that file disagree. */
const card = (key, alt) => ({ path: `/assets/og/${key}.png`, width: 1200, height: 630, alt });

export const OG_IMAGES = {
  default: card('default',
    'Equality Ohio. Ohio’s Statewide LGBTQ+ Advocacy & Legal Aid Organization. An Ohio where justice, dignity, and self-determination belong to everyone. Lived and legal equality for LGBTQ+ Ohioans.'),
  'legal-clinic': card('legal-clinic',
    'Equality Ohio. Free Legal Help for LGBTQ+ Ohioans. The Equality Ohio Legal Clinic. Our services are always free.'),
  'our-work': card('our-work',
    'Equality Ohio. Our Work. Advocating equality for all Ohioans. Equality Ohio defends the rights of LGBTQ Ohioans.'),
  'get-involved': card('get-involved',
    'Equality Ohio. Get Involved. Join us. If you support LGBTQ equality, you’re a part of the Equality Ohio family.'),
  about: card('about',
    'Equality Ohio. About Us. Who we are. Ohio’s statewide LGBTQ+ advocacy and legal aid organization.'),
  give: card('give',
    'Equality Ohio. Give. Fuel the fight for equality. Every dollar supports free legal services, policy advocacy, and organizing across Ohio.'),
  news: card('news',
    'Equality Ohio. News & Policy. Stay informed. Statements, policy alerts, and the stories behind the work.'),
};

export const SCORECARD_BANNER = {
  path: '/assets/img/candidate-scorecard-2026-banner.png',
  width: 1250,
  height: 625,
  alt: '2026 Candidate Scorecard. See how candidates measure up on the issues that matter for LGBTQ+ Ohioans and their families. Equality Ohio.',
};

/* ---------------------------------------------------------------------------
 * Files every page head links (also used by pages/_document.js for the 404).
 * ------------------------------------------------------------------------- */
export const ICONS = {
  ico: '/favicon.ico',
  svg: '/favicon.svg',
  appleTouch: '/apple-touch-icon.png',
  manifest: '/manifest.webmanifest',
};

/* Icons the web manifest lists (app/manifest.js). */
export const MANIFEST_ICONS = [
  { src: '/assets/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
  { src: '/assets/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
  { src: '/assets/brand/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
];

/* Above-the-fold faces, preloaded so the first paint does not wait for the
 * CSS to be parsed before the font requests start: Open Sans 400 is the body
 * text (body { font-family: var(--eo-font-body) }) and Montserrat 800 is
 * every h1 (h1 { font-weight: 800 }, display family). */
export const FONT_PRELOADS = [
  '/assets/fonts/open-sans-latin-400-normal.woff2',
  '/assets/fonts/montserrat-latin-800-normal.woff2',
];

/* Order matters: the tokens must load before the component layer that reads
 * them. eo-site.css used to @import the tokens, which serialized a third
 * render-blocking request behind it. */
export const STYLESHEETS = ['/css/eo-fonts.css', '/css/eo-brand-tokens.css', '/css/eo-site.css'];

/* ---------------------------------------------------------------------------
 * Static pages under public/.
 *
 *   url          clean URL (lib/static-pages.mjs resolves the file)
 *   title        <title>, og:title, twitter:title (decoded text; escaped on
 *                output)
 *   description  meta description, og:description (<= 160 characters)
 *   section      which share card: a key of OG_IMAGES
 *   image        overrides section with an explicit { path, width, height, alt }
 *   crumb        breadcrumb label (default: the title before " — ")
 *   noindex      robots noindex, kept out of the sitemap, no JSON-LD
 *   jsonLd       extra graphs ('organization', 'website'); every indexable
 *                page below / also gets a BreadcrumbList
 * ------------------------------------------------------------------------- */
export const PAGES = [
  {
    url: '/',
    title: 'Equality Ohio | Lived and Legal Equality for LGBTQ+ Ohioans',
    description:
      "Equality Ohio is Ohio's statewide LGBTQ+ advocacy and legal aid organization — driving policy change and delivering free, accessible legal support.",
    section: 'default',
    crumb: 'Home',
    jsonLd: ['organization', 'website'],
    priority: 1.0,
    changefreq: 'weekly',
  },

  /* -- About ---------------------------------------------------------------- */
  {
    url: '/about',
    title: 'About Us — Equality Ohio',
    description:
      "Founded in 2005, Equality Ohio is Ohio's statewide LGBTQ+ advocacy and legal aid organization.",
    section: 'about',
    priority: 0.8,
    changefreq: 'monthly',
  },
  {
    url: '/about/history',
    title: 'Our History — Equality Ohio',
    description:
      'Founded in 2005 by 65 activists and allies, Equality Ohio has spent two decades advancing lived and legal equality for LGBTQ+ Ohioans.',
    section: 'about',
    priority: 0.5,
    changefreq: 'yearly',
  },
  {
    url: '/about/leadership',
    title: 'Board of Directors — Equality Ohio',
    description:
      'Meet the boards of the Equality Ohio Education Fund (501c3) and Equality Ohio (501c4).',
    section: 'about',
    priority: 0.6,
    changefreq: 'monthly',
  },
  {
    url: '/about/staff-interns',
    title: 'Staff & Interns — Equality Ohio',
    description:
      'Meet the staff of Equality Ohio — the team working for lived and legal equality for LGBTQ+ Ohioans.',
    section: 'about',
    priority: 0.6,
    changefreq: 'monthly',
  },
  {
    url: '/about/jobs-internships',
    title: 'Jobs & Internships — Equality Ohio',
    description:
      'Careers, fellowships, and internships with Equality Ohio — current openings and how to apply.',
    section: 'about',
    priority: 0.6,
    changefreq: 'weekly',
  },
  {
    url: '/contact',
    title: 'Contact — Equality Ohio',
    description:
      'Get in touch with Equality Ohio — general inquiries, the Legal Clinic, giving, and press.',
    section: 'about',
    priority: 0.7,
    changefreq: 'yearly',
  },

  /* -- Legal Clinic --------------------------------------------------------- */
  {
    url: '/legal-clinic',
    title: 'Legal Clinic — Equality Ohio',
    description:
      'The Equality Ohio Legal Clinic offers free legal services for LGBTQ+ Ohioans — consumer law, family law, civil rights, and administrative help.',
    section: 'legal-clinic',
    priority: 0.9,
    changefreq: 'monthly',
  },
  {
    url: '/legal-clinic/intake',
    title: 'Legal Clinic Intake — Equality Ohio',
    description:
      'Start a confidential intake with the Equality Ohio Legal Clinic. Free legal help for LGBTQ+ Ohioans.',
    section: 'legal-clinic',
    priority: 0.8,
    changefreq: 'monthly',
  },
  {
    url: '/legal-clinic/intake/thank-you',
    title: 'Intake Received — Equality Ohio',
    description:
      'Thank you for submitting your intake request to the Equality Ohio Legal Clinic. A member of our intake staff will reach out to you via email.',
    section: 'legal-clinic',
    noindex: true,
  },
  {
    url: '/legal-clinic/ohio-lgbtq-family-law-guide',
    title: 'Ohio LGBTQ+ Family Law Guide — Equality Ohio',
    description:
      'The Ohio LGBTQ Family Law Guide gives LGBTQ+-headed families detailed, accessible explanations of federal and state law — marriage, parentage, and adoption.',
    section: 'legal-clinic',
    priority: 0.7,
    changefreq: 'yearly',
  },
  {
    url: '/legal-clinic/trans-know-your-rights',
    title: 'Trans Know Your Rights — Equality Ohio',
    description:
      "Know your rights as a transgender Ohioan — legal name changes, birth certificates, driver's licenses and state IDs, passports, and remedies for discrimination.",
    section: 'legal-clinic',
    priority: 0.7,
    changefreq: 'monthly',
  },
  {
    url: '/legal-clinic/legal-network',
    title: 'Legal Network — Equality Ohio',
    description:
      'Join the Equality Ohio Attorney Referral Network. Connect with regional attorneys, access CLE opportunities, and champion equal access to the law.',
    section: 'legal-clinic',
    priority: 0.6,
    changefreq: 'yearly',
  },

  /* -- Our Work ------------------------------------------------------------- */
  {
    url: '/our-work',
    title: 'Our Work — Equality Ohio',
    description:
      'Equality Ohio defends the rights of LGBTQ Ohioans — in communities across the state, at the Ohio Statehouse, and at the federal level.',
    section: 'our-work',
    priority: 0.8,
    changefreq: 'monthly',
  },
  {
    url: '/our-work/local',
    title: 'Local Progress — Equality Ohio',
    description:
      'Equality Ohio organizes in communities across the state — passing local nondiscrimination ordinances and banning conversion therapy on minors.',
    section: 'our-work',
    priority: 0.6,
    changefreq: 'monthly',
  },
  {
    url: '/our-work/local/municipal-map',
    title: 'Municipal Equality Map — Equality Ohio',
    description:
      'Use this map to identify what nondiscrimination protections exist for the LGBTQ+ community in various localities across Ohio.',
    section: 'our-work',
    priority: 0.6,
    changefreq: 'monthly',
  },
  {
    url: '/our-work/business',
    title: 'Business Engagement — Equality Ohio',
    description:
      'Ohio Business Competes — a nonpartisan coalition of Ohio corporations, universities and law firms in support of LGBTQ-inclusive nondiscrimination protections.',
    section: 'our-work',
    priority: 0.6,
    changefreq: 'yearly',
  },
  {
    url: '/our-work/legacy-of-equality',
    title: 'Legacy of Equality — Equality Ohio',
    description:
      "Equality Ohio's Legacy of Equality — the 20th anniversary honorees celebrated at Advocates and Allies, and the Legacy of Equality Society of supporters.",
    section: 'our-work',
    priority: 0.5,
    changefreq: 'yearly',
  },
  {
    url: '/votersguide',
    title: 'Voters Guide — Equality Ohio',
    description:
      "Equality Ohio's 2026 Candidate Scorecard examines 30 critical races — statewide, congressional, and Statehouse — helping Ohioans make informed choices.",
    image: SCORECARD_BANNER,
    priority: 0.8,
    changefreq: 'weekly',
  },

  /* -- Get Involved --------------------------------------------------------- */
  {
    url: '/get-involved',
    title: 'Get Involved — Equality Ohio',
    description:
      'Join Equality Ohio — volunteer near you, come to an event, give, share your story, and stay close to the fight for lived and legal equality for LGBTQ+ Ohioans.',
    section: 'get-involved',
    priority: 0.8,
    changefreq: 'monthly',
  },
  {
    url: '/get-involved/volunteer',
    title: 'Volunteer — Equality Ohio',
    description:
      'Volunteer with Equality Ohio — sign up for opportunities in Northeast, Central, and Southwest Ohio, or virtual opportunities from anywhere in the state.',
    section: 'get-involved',
    priority: 0.7,
    changefreq: 'monthly',
  },
  {
    url: '/get-involved/events',
    title: 'Events — Equality Ohio',
    description:
      "If you support LGBTQ equality, you're a part of the Equality Ohio family. Come see us at an event near you to learn more or take action.",
    section: 'get-involved',
    priority: 0.7,
    changefreq: 'weekly',
  },
  {
    url: '/stories',
    title: 'Share Your Story — Equality Ohio',
    description:
      'Stories of Discrimination — this is why we fight. Read stories from LGBTQ+ Ohioans and share your own with Equality Ohio.',
    section: 'get-involved',
    priority: 0.5,
    changefreq: 'monthly',
  },
  {
    url: '/newsletter',
    title: 'Newsletter — Equality Ohio',
    description:
      'Sign up for the latest news from Equality Ohio — join our list and get the latest LGBTQ+ Ohio updates.',
    section: 'get-involved',
    priority: 0.5,
    changefreq: 'yearly',
  },

  /* -- Give ------------------------------------------------------------------ */
  {
    url: '/give',
    title: 'Ways to Give — Equality Ohio',
    description:
      'Support lived and legal equality for LGBTQ+ Ohioans — one-time gifts, Defenders of Equality monthly giving, and the Jim Obergefell & John Arthur Society.',
    section: 'give',
    priority: 0.9,
    changefreq: 'monthly',
  },
  {
    url: '/jim-obergefell-john-arthur-society',
    title: 'Jim Obergefell & John Arthur Society — Equality Ohio',
    description:
      'The Jim Obergefell & John Arthur Society is an Equality Ohio Education Fund donor group delivering strategic, smart giving.',
    section: 'give',
    priority: 0.6,
    changefreq: 'yearly',
  },

  /* -- News ------------------------------------------------------------------ */
  {
    url: '/news',
    title: 'News & Policy — Equality Ohio',
    description: 'News, statements, and policy updates from Equality Ohio.',
    section: 'news',
    priority: 0.8,
    changefreq: 'weekly',
  },

  /* -- Not for the index ------------------------------------------------------ */
  {
    url: '/gate',
    title: 'Preview Access — Equality Ohio',
    description: 'Password-protected design preview.',
    section: 'default',
    noindex: true,
  },
];

/* The branded 404 (pages/404.js). Not a file under public/, so it is not in
 * PAGES; pages/404.js reads its title, description and robots from here. */
export const NOT_FOUND = {
  url: '/404',
  title: 'Page Not Found — Equality Ohio',
  description: "That page isn't part of this preview.",
  section: 'default',
  noindex: true,
};

export function pageFor(url) {
  return PAGES.find((p) => p.url === url) || null;
}

/** The share image for a page: { path, width, height, alt }. */
export function imageFor(page) {
  return page.image || OG_IMAGES[page.section || 'default'] || OG_IMAGES.default;
}

/** <meta name="robots"> content for a page. */
export function robotsContent(page) {
  if (!LAUNCHED) return 'noindex, nofollow';
  // nofollow is deliberately not set on launched noindex pages: they link
  // back into the public site and there is no reason to strand those links.
  return page.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large';
}

/** The page's own breadcrumb label. */
export function crumbName(page) {
  return page.crumb || page.title.split(' — ')[0].split(' | ')[0].trim();
}

/* ---------------------------------------------------------------------------
 * Structured data. Only facts the site already prints (lib/site.mjs ORG).
 * The EINs are on the site but deliberately not modelled here: the c3 and the
 * c4 are two legal entities and how EO wants them represented is EO's call.
 * ------------------------------------------------------------------------- */
const home = () => pageFor('/');

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'NGO',
    // Same @id as the live site's graph, for continuity across the migration.
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    logo: absolute('/assets/logo/equality-ohio-logo.png'),
    image: absolute(OG_IMAGES.default.path),
    description: home().description,
    telephone: ORG.phone.tel,
    email: ORG.email,
    areaServed: { '@type': 'State', name: 'Ohio' },
    sameAs: ORG.socials.map((s) => s.url),
    contactPoint: [
      {
        '@type': 'ContactPoint',
        contactType: 'Legal Clinic',
        telephone: ORG.clinicPhone.tel,
        areaServed: 'US-OH',
      },
    ],
  };
}

export function websiteJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name: SITE_NAME,
    publisher: { '@id': `${SITE_URL}/#organization` },
    inLanguage: 'en-US',
  };
}

/** Home, then each ancestor URL segment that is a page, then the page. */
export function breadcrumbJsonLd(page) {
  const segments = page.url.split('/').filter(Boolean);
  const trail = [home()];
  for (let i = 1; i < segments.length; i++) {
    const ancestor = pageFor('/' + segments.slice(0, i).join('/'));
    if (ancestor) trail.push(ancestor);
  }
  trail.push(page);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: crumbName(p),
      item: absolute(p.url),
    })),
  };
}

/** Every JSON-LD graph a page carries, in document order. */
export function jsonLdFor(page) {
  if (page.noindex) return [];
  const builders = { organization: organizationJsonLd, website: websiteJsonLd };
  const graphs = (page.jsonLd || []).map((kind) => builders[kind](page));
  if (page.url !== '/') graphs.push(breadcrumbJsonLd(page));
  return graphs;
}
