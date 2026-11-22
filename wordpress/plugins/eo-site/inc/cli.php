<?php
/**
 * WP-CLI: wp eo import [--dry-run] [--skip-menus] [--skip-media] [--skip-settings]
 *         wp eo staging <on|off|status>
 *         wp eo redirect <path>      show where a legacy path lands
 *
 * @package eo-site
 */

defined( 'ABSPATH' ) || exit;

class EO_Site_CLI {
	/**
	 * Create or update the 29 pages, menus, PDFs and settings from the plugin's files.
	 *
	 * ## OPTIONS
	 * [--dry-run]
	 * [--skip-menus]
	 * [--skip-media]
	 * [--skip-settings]
	 */
	public function import( $args, $assoc ) {
		$log = eo_site_import(
			array(
				'dry_run'  => isset( $assoc['dry-run'] ),
				'menus'    => ! isset( $assoc['skip-menus'] ),
				'media'    => ! isset( $assoc['skip-media'] ),
				'settings' => ! isset( $assoc['skip-settings'] ),
			)
		);
		foreach ( $log as $line ) {
			WP_CLI::log( $line );
		}
		WP_CLI::success( 'Import finished.' );
	}

	/** Staging flag: on | off | status */
	public function staging( $args ) {
		$what = $args[0] ?? 'status';
		if ( 'on' === $what ) {
			eo_site_set_staging( true );
		} elseif ( 'off' === $what ) {
			eo_site_set_staging( false );
		}
		WP_CLI::log( 'staging: ' . ( eo_site_is_staging() ? 'on' : 'off' ) );
	}

	/** Where a legacy path lands. */
	public function redirect( $args ) {
		$hit = eo_site_match_redirect( $args[0] );
		WP_CLI::log( $hit ? "{$hit[1]} → {$hit[0]}" : 'no rule' );
	}
}
WP_CLI::add_command( 'eo', 'EO_Site_CLI' );
