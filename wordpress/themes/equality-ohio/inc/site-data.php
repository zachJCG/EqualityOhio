<?php
/**
 * Organization facts and the default navigation, read from inc/site-data.json
 * (the same data the Next.js build used, lib/site.mjs ORG and lib/chrome.mjs
 * NAV_ITEMS). Menus assigned in WordPress take precedence over the defaults.
 *
 * @package equality-ohio
 */

defined( 'ABSPATH' ) || exit;

function eo_theme_data(): array {
	static $data = null;
	if ( null === $data ) {
		$raw  = file_get_contents( get_theme_file_path( 'inc/site-data.json' ) );
		$data = json_decode( $raw, true ) ?: array();
		$data = apply_filters( 'eo_site_data', $data );
	}
	return $data;
}

function eo_org( string $key ) {
	return eo_theme_data()['org'][ $key ] ?? null;
}

/** Internal paths in the source have no trailing slash; WordPress URLs do. */
function eo_internal_url( string $href ): string {
	if ( '' === $href || '/' === $href ) {
		return home_url( '/' );
	}
	if ( preg_match( '#^(https?:|mailto:|tel:|\#)#', $href ) ) {
		return $href;
	}
	$hash = '';
	if ( false !== strpos( $href, '#' ) ) {
		list( $href, $hash ) = explode( '#', $href, 2 );
		$hash                = '#' . $hash;
	}
	return home_url( trailingslashit( $href ) ) . $hash;
}

/** A mirrored PDF's address: the Media Library copy when the plugin uploaded one, else the plugin's file. */
function eo_doc_url( string $name ): string {
	$docs = get_option( 'eo_site_docs', array() );
	if ( is_array( $docs ) && ! empty( $docs[ $name ] ) ) {
		return $docs[ $name ];
	}
	if ( defined( 'EO_SITE_URL' ) ) {
		return EO_SITE_URL . 'data/docs/' . $name;
	}
	return home_url( '/' . $name );
}
