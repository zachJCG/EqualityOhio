<?php
/**
 * Safe response headers. The Next.js build sent a strict Content-Security-Policy
 * (script-src 'self'); that is not carried over, because it would break the
 * block editor and the third-party form embeds EO needs (HANDOFF.md §5).
 *
 * @package eo-site
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'send_headers',
	function () {
		if ( headers_sent() ) {
			return;
		}
		header( 'X-Content-Type-Options: nosniff' );
		header( 'Referrer-Policy: strict-origin-when-cross-origin' );
		header( 'X-Frame-Options: SAMEORIGIN' );
		header( 'Permissions-Policy: camera=(), microphone=(), geolocation=()' );
		if ( eo_site_is_staging() ) {
			header( 'X-Robots-Tag: noindex, nofollow' );
		}
	}
);
