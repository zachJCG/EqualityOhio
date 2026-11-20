<?php
/**
 * The legacy redirect map: 148 rules from the live equalityohio.org sitemaps
 * (data/redirect-rules.json, converted from the Next.js next.config.mjs).
 * First matching rule wins; families can be switched off for an install
 * where the old content still exists (option eo_site_redirect_families).
 *
 * Runs on init, before WordPress's own canonical redirect, so /events reaches
 * /get-involved/events/ in one hop instead of via /events/.
 *
 * @package eo-site
 */

defined( 'ABSPATH' ) || exit;

function eo_site_redirect_rules(): array {
	static $rules = null;
	if ( null === $rules ) {
		$rules = json_decode( file_get_contents( EO_SITE_DIR . 'data/redirect-rules.json' ), true ) ?: array();
	}
	return $rules;
}

function eo_site_redirect_family_names(): array {
	$names = array();
	foreach ( eo_site_redirect_rules() as $r ) {
		$names[ $r['family'] ] = true;
	}
	return array_keys( $names );
}

/** The rule's target as an absolute URL, with media targets resolved to uploads. */
function eo_site_redirect_target( string $target ): string {
	if ( 0 === strpos( $target, '/assets/docs/' ) ) {
		$docs = get_option( 'eo_site_docs', array() );
		$name = substr( $target, strlen( '/assets/docs/' ) );
		if ( ! empty( $docs[ $name ] ) ) {
			return $docs[ $name ];
		}
		return EO_SITE_URL . 'data/docs/' . $name;
	}
	$hash = '';
	if ( false !== strpos( $target, '#' ) ) {
		list( $target, $hash ) = explode( '#', $target, 2 );
		$hash                  = '#' . $hash;
	}
	return home_url( $target ) . $hash;
}

/** Match a path against the rules; returns [target, code] or null. */
function eo_site_match_redirect( string $path ): ?array {
	$enabled = get_option( 'eo_site_redirect_families', eo_site_redirect_family_names() );
	$enabled = is_array( $enabled ) ? $enabled : eo_site_redirect_family_names();
	$path    = rawurldecode( $path );
	foreach ( eo_site_redirect_rules() as $rule ) {
		if ( ! in_array( $rule['family'], $enabled, true ) ) {
			continue;
		}
		if ( ! preg_match( '#' . $rule['regex'] . '#u', $path, $m ) ) {
			continue;
		}
		$target = $rule['target'];
		// Named groups (/:slug patterns are expanded to $1 in the target when present).
		if ( count( $m ) > 1 ) {
			foreach ( array_slice( $m, 1 ) as $i => $v ) {
				$target = str_replace( '$' . ( $i + 1 ), $v, $target );
			}
		}
		return array( eo_site_redirect_target( $target ), (int) $rule['code'] );
	}
	return null;
}

add_action(
	'init',
	function () {
		if ( is_admin() || wp_doing_ajax() || wp_doing_cron() || ( defined( 'WP_CLI' ) && WP_CLI ) ) {
			return;
		}
		if ( empty( $_SERVER['REQUEST_URI'] ) ) {
			return;
		}
		$path = (string) wp_parse_url( $_SERVER['REQUEST_URI'], PHP_URL_PATH );
		$base = (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH );
		if ( '/' !== $base && 0 === strpos( $path, rtrim( $base, '/' ) ) ) {
			$path = substr( $path, strlen( rtrim( $base, '/' ) ) ) ?: '/';
		}
		// Admin, API and login paths are never redirected; a missing upload may be (the media family).
		if ( preg_match( '#^/(wp-admin|wp-json|wp-login\.php|wp-includes|xmlrpc\.php)#', $path ) ) {
			return;
		}
		$hit = eo_site_match_redirect( $path );
		if ( ! $hit ) {
			return;
		}
		wp_redirect( $hit[0], $hit[1], 'Equality Ohio legacy map' );
		exit;
	},
	1
);
