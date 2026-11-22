<?php
/**
 * The site chrome: skip link, preview ribbon, header with the primary nav,
 * footer with four link columns, the Legal Clinic help bar and the 404 body.
 *
 * Ported from lib/chrome.mjs in the Next.js build. The markup and ARIA are
 * kept exactly (the behaviors script and the accessibility checks were
 * written against them); only the data source changed: links come from the
 * WordPress menus assigned to the theme's locations, falling back to the
 * built-in navigation data when a location is empty.
 *
 * @package equality-ohio
 */

defined( 'ABSPATH' ) || exit;

const EO_NEW_TAB_NOTE = '<span class="sr-only new-tab-note"> (opens in a new tab)</span>';

/**
 * A menu location as a tree of [label, url, classes, children].
 * Falls back to the default navigation data when nothing is assigned.
 */
function eo_menu_tree( string $location, array $fallback = array() ): array {
	$locations = get_nav_menu_locations();
	if ( empty( $locations[ $location ] ) ) {
		return eo_default_tree( $fallback );
	}
	$items = wp_get_nav_menu_items( (int) $locations[ $location ] );
	if ( empty( $items ) ) {
		return eo_default_tree( $fallback );
	}
	_wp_menu_item_classes_by_context( $items );
	$by_parent = array();
	foreach ( $items as $item ) {
		$by_parent[ (int) $item->menu_item_parent ][] = $item;
	}
	$build = function ( int $parent ) use ( &$build, $by_parent ): array {
		$out = array();
		foreach ( $by_parent[ $parent ] ?? array() as $item ) {
			$classes = (array) $item->classes;
			// Same rule as lib/chrome.mjs: the item for this page is "page"; a
			// section whose child is this page is "true". Pages outside the menu
			// mark nothing (WordPress's page-ancestor classes are not used).
			$current = in_array( 'current-menu-item', $classes, true ) ? 'page'
				: ( array_intersect( array( 'current-menu-ancestor', 'current-menu-parent' ), $classes ) ? 'true' : '' );
			$out[] = array(
				'label'    => $item->title,
				'url'      => $item->url,
				'classes'  => array_values( array_filter( $classes, fn( $c ) => $c && 0 !== strpos( $c, 'menu-item' ) && 0 !== strpos( $c, 'current' ) ) ),
				'current'  => $current,
				'children' => $build( (int) $item->ID ),
			);
		}
		return $out;
	};
	return $build( 0 );
}

function eo_default_tree( array $items ): array {
	$out = array();
	foreach ( $items as $item ) {
		$url      = eo_internal_url( $item['href'] );
		$children = eo_default_tree( $item['children'] ?? array() );
		$current  = eo_is_current_url( $url ) ? 'page'
			: ( array_filter( $children, fn( $c ) => 'page' === $c['current'] ) ? 'true' : '' );
		$out[] = array(
			'label'    => $item['label'],
			'url'      => $url,
			'classes'  => $item['classes'] ?? array(),
			'current'  => $current,
			'children' => $children,
		);
	}
	return $out;
}

/** Whether a link points at the page being served (path only, no fragment). */
function eo_is_current_url( string $url ): bool {
	if ( ! preg_match( '#^(/|https?://)#', $url ) || false !== strpos( $url, '#' ) ) {
		return false;
	}
	$path    = untrailingslashit( (string) wp_parse_url( $url, PHP_URL_PATH ) );
	$request = untrailingslashit( (string) wp_parse_url( $_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH ) );
	return $path === $request;
}

/** The default primary nav: the five sections plus the Donate button. */
function eo_default_primary(): array {
	$nav   = eo_theme_data()['nav'] ?? array();
	$nav[] = array( 'label' => 'Donate', 'href' => '/give', 'classes' => array( 'nav-cta' ) );
	return $nav;
}

/** Default footer columns, from lib/chrome.mjs FOOTER_COLUMNS. */
function eo_default_footer_columns(): array {
	$clinic_tel = eo_org( 'clinicPhone' )['tel'] ?? '+18555428529';
	return array(
		'footer-legal-clinic' => array(
			'heading' => 'Legal Clinic',
			'items'   => array(
				array( 'label' => 'About the Clinic', 'href' => '/legal-clinic' ),
				array( 'label' => 'Start an Intake', 'href' => '/legal-clinic/intake' ),
				array( 'label' => 'Family Law Guide', 'href' => '/legal-clinic/ohio-lgbtq-family-law-guide' ),
				array( 'label' => 'Trans Know Your Rights', 'href' => '/legal-clinic/trans-know-your-rights' ),
				array( 'label' => 'Legal Network', 'href' => '/legal-clinic/legal-network' ),
				array( 'label' => '855-LGBT-LAW', 'href' => 'tel:' . $clinic_tel ),
			),
		),
		'footer-our-work'     => array(
			'heading' => 'Our Work',
			'items'   => array(
				array( 'label' => 'What We Do', 'href' => '/our-work' ),
				array( 'label' => 'Local Progress', 'href' => '/our-work/local' ),
				array( 'label' => 'Municipal Equality Map', 'href' => '/our-work/local/municipal-map' ),
				array( 'label' => 'Business Engagement', 'href' => '/our-work/business' ),
				array( 'label' => 'Legacy of Equality', 'href' => '/our-work/legacy-of-equality' ),
				array( 'label' => 'Voters Guide', 'href' => '/votersguide' ),
			),
		),
		'footer-get-involved' => array(
			'heading' => 'Get Involved',
			'items'   => array(
				array( 'label' => 'Ways to Give', 'href' => '/give' ),
				array( 'label' => 'Defenders of Equality', 'href' => '/give#defenders' ),
				array( 'label' => 'Obergefell–Arthur Society', 'href' => '/jim-obergefell-john-arthur-society' ),
				array( 'label' => 'Volunteer', 'href' => '/get-involved/volunteer' ),
				array( 'label' => 'Events', 'href' => '/get-involved/events' ),
				array( 'label' => 'Newsletter', 'href' => '/newsletter' ),
			),
		),
		'footer-about'        => array(
			'heading' => 'About',
			'items'   => array(
				array( 'label' => 'Mission & Values', 'href' => '/about' ),
				array( 'label' => 'Our History', 'href' => '/about/history' ),
				array( 'label' => 'Board of Directors', 'href' => '/about/leadership' ),
				array( 'label' => 'Staff & Interns', 'href' => '/about/staff-interns' ),
				array( 'label' => 'Jobs & Internships', 'href' => '/about/jobs-internships' ),
				array( 'label' => 'News & Policy', 'href' => '/news' ),
				array( 'label' => 'Contact', 'href' => '/contact' ),
			),
		),
	);
}

function eo_logo_img( string $extra_class = '' ): string {
	$class = 'brand-lockup__img' . ( $extra_class ? ' ' . $extra_class : '' );
	$src   = get_theme_file_uri( 'assets/logo/equality-ohio-logo.png' );
	$w     = 400;
	$h     = 174;
	if ( has_custom_logo() ) {
		$img = wp_get_attachment_image_src( (int) get_theme_mod( 'custom_logo' ), 'full' );
		if ( $img ) {
			list( $src, $w, $h ) = $img;
		}
	}
	return sprintf(
		'<img class="%s" src="%s" alt="%s" width="%d" height="%d" />',
		esc_attr( $class ),
		esc_url( $src ),
		esc_attr( get_bloginfo( 'name' ) ?: 'Equality Ohio' ),
		$w,
		$h
	);
}

function eo_caret_svg(): string {
	return '<svg width="10" height="7" viewBox="0 0 10 7" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M1 1.5 L5 5.5 L9 1.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>';
}

function eo_link( array $item, string $class = '', bool $mark_current = false ): string {
	$external = preg_match( '#^https?://#', $item['url'] ) && 0 !== strpos( $item['url'], home_url() );
	$attrs    = ' href="' . esc_url( $item['url'] ) . '"';
	if ( $class ) {
		$attrs .= ' class="' . esc_attr( $class ) . '"';
	}
	if ( $mark_current && ! empty( $item['current'] ) ) {
		$attrs .= ' aria-current="' . esc_attr( $item['current'] ) . '"';
	}
	if ( $external ) {
		$attrs .= ' rel="noopener" target="_blank"';
	}
	return '<a' . $attrs . '>' . esc_html( $item['label'] ) . ( $external ? EO_NEW_TAB_NOTE : '' ) . '</a>';
}

/** The header block: skip link, ribbon, equality bar, sticky header and nav. */
function eo_render_header(): string {
	$tree = eo_menu_tree( 'primary', eo_default_primary() );
	$out  = '<a class="skip-link" href="#main">Skip to main content</a>' . "\n";
	if ( eo_theme_is_staging() ) {
		$out .= '<aside class="preview-ribbon" aria-label="Preview notice">Design preview — <strong>staging only</strong>, forms and donations are not live · Prepared by Joseph Carter Group</aside>' . "\n";
	}
	$out .= '<div class="equality-bar" aria-hidden="true"></div>' . "\n";
	$out .= '<header class="site-header"><div class="nav-inner">';
	$out .= '<a class="brand-lockup" href="' . esc_url( home_url( '/' ) ) . '" aria-label="Equality Ohio home">' . eo_logo_img() . '</a>';
	$out .= '<a class="nav-toggle" href="#footer-nav" aria-label="Menu">'
		. '<svg class="icon-menu" width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="22" height="2.5" rx="1.25" fill="currentColor"/><rect y="6.75" width="22" height="2.5" rx="1.25" fill="currentColor"/><rect y="13.5" width="22" height="2.5" rx="1.25" fill="currentColor"/></svg>'
		. '<svg class="icon-close" width="22" height="16" viewBox="0 0 22 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path d="M5 2 L17 14 M17 2 L5 14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></a>';
	$out .= '<nav class="site-nav" id="site-nav" aria-label="Primary"><ul>';
	foreach ( $tree as $item ) {
		$classes = $item['classes'];
		if ( ! empty( $item['children'] ) ) {
			$id   = 'sub-' . sanitize_title( $item['label'] );
			$out .= '<li class="has-sub' . ( $classes ? ' ' . esc_attr( implode( ' ', $classes ) ) : '' ) . '">';
			$out .= '<div class="nav-item-row">' . eo_link( $item, '', true )
				. '<button class="sub-toggle" type="button" aria-expanded="false" aria-controls="' . esc_attr( $id ) . '" aria-label="' . esc_attr( $item['label'] ) . ' submenu">' . eo_caret_svg() . '</button></div>';
			$out .= '<ul class="sub-menu" id="' . esc_attr( $id ) . '">';
			foreach ( $item['children'] as $child ) {
				$out .= '<li>' . eo_link( $child, '', true ) . '</li>';
			}
			$out .= '</ul></li>';
		} else {
			$out .= '<li' . ( $classes ? ' class="' . esc_attr( implode( ' ', $classes ) ) . '"' : '' ) . '>' . eo_link( $item, '', true ) . '</li>';
		}
	}
	$out .= '</ul></nav></div></header>' . "\n";
	return $out;
}

/** The footer block. The year is the current year, never a build year. */
function eo_render_footer(): string {
	$org   = eo_theme_data()['org'] ?? array();
	$phone = $org['phone'] ?? array( 'display' => '(614) 224-0400', 'tel' => '+16142240400' );
	$email = $org['email'] ?? 'info@equalityohio.org';

	$out  = '<footer class="site-footer"><div class="equality-bar" aria-hidden="true"></div>';
	$out .= '<div class="footer-main" id="footer-nav"><div class="footer-brand">';
	$out .= '<a class="brand-lockup" href="' . esc_url( home_url( '/' ) ) . '" aria-label="Equality Ohio home">' . eo_logo_img( 'brand-lockup__img--invert' ) . '</a>';
	$out .= '<p class="mt-1">Ohio’s statewide LGBTQ+ advocacy and legal aid organization — working toward an Ohio where justice, dignity, and self-determination belong to everyone.</p>';
	$out .= '<ul class="footer-contact">';
	$out .= '<li><a href="tel:' . esc_attr( $phone['tel'] ) . '">' . esc_html( $phone['display'] ) . '</a></li>';
	$out .= '<li><a href="mailto:' . esc_attr( $email ) . '">' . esc_html( $email ) . '</a></li>';
	$socials = array();
	foreach ( $org['socials'] ?? array() as $s ) {
		$socials[] = '<a href="' . esc_url( $s['url'] ) . '" rel="noopener" target="_blank">' . esc_html( $s['label'] ) . EO_NEW_TAB_NOTE . '</a>';
	}
	if ( $socials ) {
		$out .= '<li class="footer-social">' . implode( ' · ', $socials ) . '</li>';
	}
	$out .= '</ul></div>';

	foreach ( eo_default_footer_columns() as $location => $column ) {
		$heading   = $column['heading'];
		$locations = get_nav_menu_locations();
		if ( ! empty( $locations[ $location ] ) ) {
			$menu = wp_get_nav_menu_object( (int) $locations[ $location ] );
			if ( $menu && ! empty( $menu->name ) ) {
				$heading = $menu->name;
			}
		}
		$items = eo_menu_tree( $location, $column['items'] );
		$id    = 'footer-' . sanitize_title( $heading );
		$out  .= '<nav class="footer-col" aria-labelledby="' . esc_attr( $id ) . '"><h2 class="footer-heading" id="' . esc_attr( $id ) . '">' . esc_html( $heading ) . '</h2><ul>';
		foreach ( $items as $item ) {
			$out .= '<li>' . eo_link( $item ) . '</li>';
		}
		$out .= '</ul></nav>';
	}
	$out .= '</div>';

	$c3   = $org['c3'] ?? array( 'name' => 'Equality Ohio Education Fund', 'ein' => '02-0743268' );
	$c4   = $org['c4'] ?? array( 'name' => 'Equality Ohio', 'ein' => '02-0743270' );
	$out .= '<div class="footer-legal"><div class="footer-legal__inner">';
	$out .= '<span class="footer-badge"><img src="' . esc_url( get_theme_file_uri( 'assets/logo/guidestar-silver-2021.png' ) ) . '" alt="GuideStar Silver Transparency 2021" width="54" height="54" loading="lazy" /><span>'
		. esc_html( $c3['name'] ) . ' is a 501(c)(3) — EIN ' . esc_html( $c3['ein'] ) . ' · ' . esc_html( $c4['name'] ) . ' is a 501(c)(4) — EIN ' . esc_html( $c4['ein'] ) . '</span></span>';
	$out .= '<span>© ' . esc_html( wp_date( 'Y' ) ) . ' Equality Ohio · <a href="' . esc_url( home_url( '/privacy-policy/' ) ) . '">Privacy Policy</a> · <a href="' . esc_url( home_url( '/terms-conditions/' ) ) . '">Terms &amp; Conditions</a>'
		. ( eo_theme_is_staging() ? ' · Design preview by Joseph Carter Group' : '' ) . '</span>';
	$out .= '</div></div></footer>' . "\n";
	return $out;
}

/** The phone help bar: Legal Clinic guide pages only (template page-legal-guide). */
function eo_render_help_bar(): string {
	$tel = eo_org( 'clinicPhone' )['tel'] ?? '+18555428529';
	return '<aside class="help-bar" aria-label="Legal Clinic quick help">'
		. '<a class="help-bar__call" href="tel:' . esc_attr( $tel ) . '">Call 855&#8209;LGBT&#8209;LAW</a>'
		. '<a class="btn btn--on-dark" href="' . esc_url( home_url( '/legal-clinic/intake/' ) ) . '">Start an Intake</a>'
		. '</aside>' . "\n";
}

/** The 404 body. Preview wording while staging, EO-neutral wording after. */
function eo_render_not_found(): string {
	$staging = eo_theme_is_staging();
	$title   = $staging ? 'This page isn&rsquo;t part of the preview yet.' : 'We couldn&rsquo;t find that page.';
	$lede    = $staging
		? 'The full production build covers every page in the sitemap. For now, head somewhere that exists:'
		: 'The address may have changed. Try one of these pages instead:';
	return '<section class="hero hero--interior"><div class="container center not-found">'
		. '<div class="not-found__mark" aria-hidden="true">4=4</div>'
		. '<h1 class="not-found__title">' . $title . '</h1>'
		. '<p class="hero__lede not-found__lede">' . $lede . '</p>'
		. '<div class="hero__ctas">'
		. '<a class="btn btn--primary" href="' . esc_url( home_url( '/' ) ) . '">Home</a>'
		. '<a class="btn btn--outline" href="' . esc_url( home_url( '/legal-clinic/' ) ) . '">Legal Clinic</a>'
		. '<a class="btn btn--gold" href="' . esc_url( home_url( '/give/' ) ) . '">Donate</a>'
		. '</div></div></section>';
}
