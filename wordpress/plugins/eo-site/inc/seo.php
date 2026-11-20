<?php
/**
 * Titles, descriptions, robots, share cards and structured data from the page
 * registry (data/pages.json). Steps aside for title/description/social/JSON-LD
 * when a known SEO plugin is active; the staging robots rules always apply.
 *
 * @package eo-site
 */

defined( 'ABSPATH' ) || exit;

function eo_site_seo_plugin_active(): bool {
	return defined( 'WPSEO_VERSION' ) || defined( 'RANK_MATH_VERSION' ) || defined( 'SEOPRESS_VERSION' ) || defined( 'AIOSEO_VERSION' ) || class_exists( 'All_in_One_SEO_Pack' );
}

function eo_site_noindex_now(): bool {
	if ( eo_site_is_staging() ) {
		return true;
	}
	if ( is_404() || is_search() ) {
		return true;
	}
	$rec = eo_site_current_record();
	return $rec ? ! empty( $rec['noindex'] ) : false;
}

/** robots meta: staging = noindex, nofollow; launched noindex pages = noindex, follow. */
add_filter(
	'wp_robots',
	function ( array $robots ): array {
		if ( eo_site_is_staging() ) {
			return array( 'noindex' => true, 'nofollow' => true );
		}
		if ( eo_site_noindex_now() ) {
			return array( 'noindex' => true, 'follow' => true );
		}
		return array( 'index' => true, 'follow' => true, 'max-image-preview:large' => true );
	},
	99
);

/** robots.txt: nothing is crawlable while staging. */
add_filter(
	'robots_txt',
	function ( string $output, $public ): string {
		if ( eo_site_is_staging() ) {
			return "User-agent: *\nDisallow: /\n";
		}
		return $output;
	},
	99,
	2
);

/** Document title from the registry (the live site's titles verbatim). */
add_filter(
	'pre_get_document_title',
	function ( $title ) {
		if ( eo_site_seo_plugin_active() ) {
			return $title;
		}
		if ( is_404() ) {
			return 'Page Not Found — Equality Ohio';
		}
		$rec = eo_site_current_record();
		return $rec ? $rec['title'] : $title;
	},
	20
);

/** No canonical while staging (the source printed one only when launched). */
add_action(
	'wp',
	function () {
		if ( eo_site_is_staging() ) {
			remove_action( 'wp_head', 'rel_canonical' );
			remove_action( 'wp_head', 'wp_shortlink_wp_head' );
		}
	}
);

function eo_site_share_card( array $rec ): array {
	$cards = eo_site_data()['share_cards'] ?? array();
	$key   = preg_replace( '/\.png$/', '', $rec['share_card'] );
	$card  = $cards[ $key ] ?? $cards['default'];
	$card  = $card ?: array( 'path' => '/assets/og/default.png', 'width' => 1200, 'height' => 630, 'alt' => 'Equality Ohio' );
	$url   = get_template_directory_uri() . $card['path'];
	if ( ! isset( $cards[ $key ] ) && $key ) {
		// A page-specific card (the scorecard banner) lives under img/.
		$img = get_template_directory() . '/assets/img/' . $rec['share_card'];
		if ( file_exists( $img ) ) {
			$size = @getimagesize( $img );
			return array( 'url' => get_template_directory_uri() . '/assets/img/' . $rec['share_card'], 'width' => $size[0] ?? 1200, 'height' => $size[1] ?? 630, 'alt' => $rec['h1'] );
		}
	}
	return array( 'url' => $url, 'width' => $card['width'], 'height' => $card['height'], 'alt' => $card['alt'] );
}

/** Meta description, Open Graph, Twitter, theme color, JSON-LD. */
add_action(
	'wp_head',
	function () {
		$site_name = 'Equality Ohio' . ( eo_site_is_staging() ? ' — Design Preview' : '' );
		$theme     = eo_site_data()['site']['THEME_COLOR'] ?? '#5A3F99';
		echo '<meta name="theme-color" content="' . esc_attr( $theme ) . '" />' . "\n";
		if ( eo_site_seo_plugin_active() ) {
			return;
		}
		$rec = eo_site_current_record();
		if ( is_404() ) {
			echo '<meta name="description" content="' . esc_attr( eo_site_is_staging() ? "That page isn't part of this preview." : 'That page could not be found.' ) . '" />' . "\n";
			return;
		}
		if ( ! $rec ) {
			return;
		}
		$url  = is_front_page() ? home_url( '/' ) : get_permalink();
		$card = eo_site_share_card( $rec );
		$m    = function ( $k, $v, $prop = true ) {
			echo '<meta ' . ( $prop ? 'property' : 'name' ) . '="' . esc_attr( $k ) . '" content="' . esc_attr( $v ) . '" />' . "\n";
		};
		$m( 'description', $rec['description'], false );
		$m( 'og:type', 'website' );
		$m( 'og:site_name', $site_name );
		$m( 'og:locale', 'en_US' );
		$m( 'og:title', $rec['title'] );
		$m( 'og:description', $rec['description'] );
		$m( 'og:url', $url );
		$m( 'og:image', $card['url'] );
		$m( 'og:image:width', (string) $card['width'] );
		$m( 'og:image:height', (string) $card['height'] );
		$m( 'og:image:alt', $card['alt'] );
		$m( 'twitter:card', 'summary_large_image', false );
		$m( 'twitter:title', $rec['title'], false );
		$m( 'twitter:description', $rec['description'], false );
		$m( 'twitter:image', $card['url'], false );
		$m( 'twitter:image:alt', $card['alt'], false );

		foreach ( eo_site_json_ld( $rec ) as $graph ) {
			echo '<script type="application/ld+json">' . wp_json_encode( $graph, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT ) . '</script>' . "\n";
		}
	},
	4
);

function eo_site_json_ld( array $rec ): array {
	if ( ! empty( $rec['noindex'] ) ) {
		return array();
	}
	$org  = eo_site_data()['org'] ?? array();
	$home = home_url( '/' );
	$out  = array();
	foreach ( $rec['json_ld'] ?? array() as $kind ) {
		if ( 'organization' === $kind || 'NGO' === $kind ) {
			$out[] = array(
				'@context'     => 'https://schema.org',
				'@type'        => 'NGO',
				'@id'          => $home . '#organization',
				'name'         => 'Equality Ohio',
				'url'          => $home,
				'logo'         => get_template_directory_uri() . '/assets/logo/equality-ohio-logo.png',
				'image'        => get_template_directory_uri() . '/assets/og/default.png',
				'description'  => $rec['description'],
				'telephone'    => $org['phone']['tel'] ?? '+16142240400',
				'email'        => $org['email'] ?? 'info@equalityohio.org',
				'areaServed'   => array( '@type' => 'State', 'name' => 'Ohio' ),
				'sameAs'       => array_map( fn( $s ) => $s['url'], $org['socials'] ?? array() ),
				'contactPoint' => array(
					array( '@type' => 'ContactPoint', 'contactType' => 'Legal Clinic', 'telephone' => $org['clinicPhone']['tel'] ?? '+18555428529', 'areaServed' => 'US-OH' ),
				),
			);
		} elseif ( 'website' === $kind || 'WebSite' === $kind ) {
			$out[] = array(
				'@context'   => 'https://schema.org',
				'@type'      => 'WebSite',
				'@id'        => $home . '#website',
				'url'        => $home,
				'name'       => 'Equality Ohio',
				'publisher'  => array( '@id' => $home . '#organization' ),
				'inLanguage' => 'en-US',
			);
		}
	}
	if ( '/' !== $rec['path'] ) {
		$items = array( array( '@type' => 'ListItem', 'position' => 1, 'name' => 'Home', 'item' => $home ) );
		$parts = array_filter( explode( '/', trim( $rec['path'], '/' ) ) );
		$acc   = '';
		$pos   = 2;
		foreach ( $parts as $part ) {
			$acc  .= '/' . $part;
			$r     = eo_site_registry()[ $acc . '/' ] ?? null;
			$items[] = array( '@type' => 'ListItem', 'position' => $pos++, 'name' => $r ? eo_site_short_title( $r ) : ucwords( str_replace( '-', ' ', $part ) ), 'item' => home_url( $acc . '/' ) );
		}
		$out[] = array( '@context' => 'https://schema.org', '@type' => 'BreadcrumbList', 'itemListElement' => $items );
	}
	return $out;
}

/** Sitemap: pages only, minus noindex pages; nothing while staging. */
add_filter( 'wp_sitemaps_enabled', fn( $on ) => eo_site_is_staging() ? false : $on );
add_filter( 'wp_sitemaps_add_provider', fn( $provider, $name ) => 'posts' === $name ? $provider : false, 10, 2 );
add_filter( 'wp_sitemaps_post_types', fn( $types ) => array_intersect_key( $types, array( 'page' => 1 ) ) );
add_filter(
	'wp_sitemaps_posts_query_args',
	function ( array $args, string $type ): array {
		if ( 'page' !== $type ) {
			return $args;
		}
		$exclude = array();
		foreach ( eo_site_registry() as $path => $rec ) {
			if ( ! empty( $rec['noindex'] ) ) {
				$p = get_page_by_path( trim( $path, '/' ), OBJECT, 'page' );
				if ( $p ) {
					$exclude[] = $p->ID;
				}
			}
		}
		if ( $exclude ) {
			$args['post__not_in'] = array_merge( $args['post__not_in'] ?? array(), $exclude );
		}
		return $args;
	},
	10,
	2
);
