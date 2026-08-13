/* Root layout for App Router routes. The public site is still static HTML
 * under public/ (served via the rewrites in next.config.mjs), which never
 * passes through here — today this wraps only not-found. When the admin
 * console phase lands, split into app/(site)/ and app/(admin)/ route groups
 * per the platform convention instead of growing this file. */
export const metadata = {
  title: 'Equality Ohio — Design Preview',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/css/eo-fonts.css" />
        <link rel="stylesheet" href="/css/eo-site.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
