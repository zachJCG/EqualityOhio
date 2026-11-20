<?php
/**
 * Ways to run the importer without WP-CLI or the admin screen:
 *
 *  1. On activation: when no imported page exists yet, the import runs once
 *     (WordPress.com installs and activates the plugin through its API, where
 *     there is no shell). A page carrying _eo_page_path means it already ran.
 *  2. A WordPress Ability (Abilities API, WordPress 6.9+): eo-site/import, so
 *     an agent connected through WordPress.com or Jetpack can run or dry-run
 *     it. Administrators only.
 *  3. REST: POST /wp-json/eo-site/v1/import (administrators, cookie or
 *     application-password auth) with {"dry_run": true|false}.
 *
 * @package eo-site
 */

defined( 'ABSPATH' ) || exit;

function eo_site_import_has_run(): bool {
	$found = get_posts( array( 'post_type' => 'page', 'post_status' => 'any', 'meta_key' => '_eo_page_path', 'posts_per_page' => 1, 'fields' => 'ids' ) );
	return ! empty( $found );
}

/** Activation: import once, and remember the result for the Tools screen. */
register_activation_hook(
	dirname( __DIR__ ) . '/eo-site.php',
	function () {
		if ( eo_site_import_has_run() ) {
			return;
		}
		if ( ! wp_get_theme()->exists() || 'equality-ohio' !== get_template() ) {
			// The theme supplies the templates and the asset URLs; import still works, but note it.
			update_option( 'eo_site_import_note', 'Imported with theme ' . get_template() . ' active; activate Equality Ohio and rerun the import to resolve asset URLs.' );
		}
		$log = eo_site_import();
		update_option( 'eo_site_last_import', array( 'when' => time(), 'how' => 'activation', 'log' => $log ) );
	}
);

/** Ability category (its own action, per the Abilities API). */
add_action(
	'wp_abilities_api_categories_init',
	function () {
		if ( function_exists( 'wp_register_ability_category' ) ) {
			wp_register_ability_category( 'eo-site', array( 'label' => 'Equality Ohio site', 'description' => 'Import and staging tools for the Equality Ohio site.' ) );
		}
	}
);

/** Abilities: eo-site/import and eo-site/staging. */
add_action(
	'wp_abilities_api_init',
	function () {
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}
		wp_register_ability(
			'eo-site/import',
			array(
				'label'               => 'Import the Equality Ohio pages',
				'description'         => 'Creates or updates the 29 pages, uploads the mirrored PDFs, builds the menus and sets the front page, timezone and permalinks from the plugin files. Safe to run again.',
				'category'            => 'eo-site',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array(
						'dry_run' => array( 'type' => 'boolean', 'description' => 'Report what would change without writing.', 'default' => false ),
					),
				),
				'output_schema'       => array(
					'type'       => 'object',
					'properties' => array( 'log' => array( 'type' => 'array', 'items' => array( 'type' => 'string' ) ) ),
				),
				'execute_callback'    => function ( $input ) {
					$dry = ! empty( $input['dry_run'] );
					$log = eo_site_import( array( 'dry_run' => $dry ) );
					if ( ! $dry ) {
						update_option( 'eo_site_last_import', array( 'when' => time(), 'how' => 'ability', 'log' => $log ) );
					}
					return array( 'log' => $log );
				},
				'permission_callback' => fn() => current_user_can( 'manage_options' ),
				'meta'                => array(
					'annotations' => array( 'readonly' => false, 'destructive' => false, 'idempotent' => true ),
					'show_in_rest' => true,
				),
			)
		);
		wp_register_ability(
			'eo-site/staging',
			array(
				'label'               => 'Equality Ohio staging flag',
				'description'         => 'Read or set the one launch switch: on = preview ribbon, noindex, no sitemap; off = launch state.',
				'category'            => 'eo-site',
				'input_schema'        => array(
					'type'       => 'object',
					'properties' => array( 'set' => array( 'type' => 'string', 'enum' => array( 'on', 'off' ), 'description' => 'Omit to read.' ) ),
				),
				'output_schema'       => array( 'type' => 'object', 'properties' => array( 'staging' => array( 'type' => 'boolean' ) ) ),
				'execute_callback'    => function ( $input ) {
					if ( ! empty( $input['set'] ) ) {
						eo_site_set_staging( 'on' === $input['set'] );
					}
					return array( 'staging' => eo_site_is_staging() );
				},
				'permission_callback' => fn() => current_user_can( 'manage_options' ),
				'meta'                => array(
					'annotations' => array( 'readonly' => false, 'destructive' => false, 'idempotent' => true ),
					'show_in_rest' => true,
				),
			)
		);
	}
);

/** REST: POST /wp-json/eo-site/v1/import */
add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'eo-site/v1',
			'/import',
			array(
				'methods'             => 'POST',
				'permission_callback' => fn() => current_user_can( 'manage_options' ),
				'args'                => array( 'dry_run' => array( 'type' => 'boolean', 'default' => false ) ),
				'callback'            => function ( WP_REST_Request $r ) {
					$log = eo_site_import( array( 'dry_run' => (bool) $r->get_param( 'dry_run' ) ) );
					return rest_ensure_response( array( 'log' => $log ) );
				},
			)
		);
		register_rest_route(
			'eo-site/v1',
			'/status',
			array(
				'methods'             => 'GET',
				'permission_callback' => fn() => current_user_can( 'manage_options' ),
				'callback'            => function () {
					return rest_ensure_response(
						array(
							'staging'     => eo_site_is_staging(),
							'imported'    => eo_site_import_has_run(),
							'last_import' => get_option( 'eo_site_last_import', null ),
							'theme'       => get_template(),
							'docs'        => get_option( 'eo_site_docs', array() ),
						)
					);
				},
			)
		);
	}
);

/**
 * Verification: compares every stored page with its file (placeholders
 * resolved for this install) and reports the site's wiring. Read-only.
 */
function eo_site_verify(): array {
	$pages = array();
	$ok    = 0;
	foreach ( eo_site_registry() as $path => $rec ) {
		$post     = eo_site_find_page( $path );
		$file     = EO_SITE_DIR . 'content/pages/' . $rec['file'];
		$expected = file_exists( $file ) ? trim( eo_site_resolve_content( file_get_contents( $file ) ) ) : '';
		$stored   = $post ? trim( (string) $post->post_content ) : '';
		$same     = $post && $stored === $expected;
		$ok      += $same ? 1 : 0;
		$pages[]  = array(
			'path'     => $path,
			'id'       => $post ? $post->ID : 0,
			'status'   => $post ? $post->post_status : 'missing',
			'template' => $post ? (string) get_post_meta( $post->ID, '_wp_page_template', true ) : '',
			'parent'   => $post ? (int) $post->post_parent : 0,
			'same'     => $same,
			'sha256'   => hash( 'sha256', $stored ),
			'expected' => hash( 'sha256', $expected ),
		);
	}
	$menus = array();
	foreach ( get_nav_menu_locations() as $loc => $id ) {
		$items         = $id ? wp_get_nav_menu_items( (int) $id ) : array();
		$menus[ $loc ] = array( 'menu' => (int) $id, 'items' => is_array( $items ) ? count( $items ) : 0 );
	}
	$front = (int) get_option( 'page_on_front' );
	return array(
		'theme'           => get_template(),
		'staging'         => eo_site_is_staging(),
		'blog_public'     => (int) get_option( 'blog_public' ),
		'show_on_front'   => get_option( 'show_on_front' ),
		'page_on_front'   => $front,
		'front_path'      => $front ? get_post_meta( $front, '_eo_page_path', true ) : '',
		'timezone_string' => get_option( 'timezone_string' ),
		'permalinks'      => get_option( 'permalink_structure' ),
		'site_icon'       => (int) get_option( 'site_icon' ),
		'docs'            => get_option( 'eo_site_docs', array() ),
		'menus'           => $menus,
		'pages_total'     => count( $pages ),
		'pages_same'      => $ok,
		'pages'           => $pages,
		'last_import'     => get_option( 'eo_site_last_import', null ),
	);
}

add_action(
	'wp_abilities_api_init',
	function () {
		if ( ! function_exists( 'wp_register_ability' ) ) {
			return;
		}
		wp_register_ability(
			'eo-site/verify',
			array(
				'label'               => 'Verify the Equality Ohio import',
				'description'         => 'Compares each stored page with the plugin file it came from and reports theme, front page, menus, settings and PDFs. Changes nothing.',
				'category'            => 'eo-site',
				'input_schema'        => array( 'type' => 'object', 'properties' => array( 'pages' => array( 'type' => 'boolean', 'description' => 'Include the per-page list.', 'default' => true ) ) ),
				'output_schema'       => array( 'type' => 'object' ),
				'execute_callback'    => function ( $input ) {
					$out = eo_site_verify();
					if ( isset( $input['pages'] ) && ! $input['pages'] ) {
						$out['pages'] = array_values( array_filter( $out['pages'], fn( $p ) => ! $p['same'] ) );
					}
					return $out;
				},
				'permission_callback' => fn() => current_user_can( 'manage_options' ),
				'meta'                => array(
					'annotations'  => array( 'readonly' => true, 'destructive' => false, 'idempotent' => true ),
					'show_in_rest' => true,
				),
			)
		);
	},
	11
);

add_action(
	'rest_api_init',
	function () {
		register_rest_route(
			'eo-site/v1',
			'/verify',
			array(
				'methods'             => 'GET',
				'permission_callback' => fn() => current_user_can( 'manage_options' ),
				'callback'            => fn() => rest_ensure_response( eo_site_verify() ),
			)
		);
	}
);
