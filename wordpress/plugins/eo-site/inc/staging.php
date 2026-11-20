<?php
/**
 * One staging flag. While on: preview ribbon, footer credit, og:site_name
 * suffix, noindex everywhere, robots.txt Disallow, preview 404 wording.
 * Off is the launch state. Stored in the option eo_site_staging ('1'/'0').
 *
 * @package eo-site
 */

defined( 'ABSPATH' ) || exit;

function eo_site_is_staging(): bool {
	$v = get_option( 'eo_site_staging', '1' );
	return '0' !== (string) $v && 'off' !== $v && false !== $v;
}

function eo_site_set_staging( bool $on ): void {
	update_option( 'eo_site_staging', $on ? '1' : '0' );
	// Search engine visibility follows the flag: WordPress disables its sitemap
	// and prints noindex while blog_public is 0 (WordPress.com Coming Soon does
	// the same job on its own while the site is unlaunched).
	update_option( 'blog_public', $on ? 0 : 1 );
}

add_action(
	'admin_init',
	function () {
		register_setting(
			'eo_site',
			'eo_site_staging',
			array(
				'type'              => 'string',
				'default'           => '1',
				'sanitize_callback' => fn( $v ) => ( '0' === (string) $v || '' === (string) $v ) ? '0' : '1',
			)
		);
		register_setting(
			'eo_site',
			'eo_site_redirect_families',
			array(
				'type'              => 'array',
				'default'           => eo_site_redirect_family_names(),
				'sanitize_callback' => fn( $v ) => array_values( array_intersect( (array) $v, eo_site_redirect_family_names() ) ),
			)
		);
	}
);
