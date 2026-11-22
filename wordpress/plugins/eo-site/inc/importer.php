<?php
/**
 * The page importer. Creates or updates the 29 pages from
 * content/pages/*.html and data/pages.json, uploads the mirrored PDFs, sets
 * the menus, the front page, timezone and permalinks. Safe to run again: it
 * matches pages by path (so the WordPress.com default "About", ID 1, is
 * updated rather than duplicated), menus by name, and attachments by source
 * file name.
 *
 * Run with `wp eo import` or Tools → Equality Ohio import.
 *
 * @package eo-site
 */

defined( 'ABSPATH' ) || exit;

/**
 * @param array $opts { pages?: bool, menus?: bool, settings?: bool, media?: bool, dry_run?: bool }
 * @return array log lines
 */
function eo_site_import( array $opts = array() ): array {
	$opts = wp_parse_args( $opts, array( 'pages' => true, 'menus' => true, 'settings' => true, 'media' => true, 'dry_run' => false ) );
	$log  = array();
	$say  = function ( string $line ) use ( &$log ) { $log[] = $line; };

	if ( $opts['media'] ) {
		eo_site_import_media( $say, $opts['dry_run'] );
	}
	if ( $opts['pages'] ) {
		eo_site_import_pages( $say, $opts['dry_run'] );
	}
	if ( $opts['settings'] ) {
		eo_site_import_settings( $say, $opts['dry_run'] );
	}
	if ( $opts['menus'] ) {
		eo_site_import_menus( $say, $opts['dry_run'] );
	}
	if ( ! $opts['dry_run'] ) {
		flush_rewrite_rules();
		$say( 'Rewrite rules flushed.' );
	}
	return $log;
}

/** The mirrored PDFs go into the Media Library so EO can replace them. */
function eo_site_import_media( callable $say, bool $dry ): void {
	require_once ABSPATH . 'wp-admin/includes/file.php';
	require_once ABSPATH . 'wp-admin/includes/media.php';
	require_once ABSPATH . 'wp-admin/includes/image.php';
	$docs = get_option( 'eo_site_docs', array() );
	foreach ( glob( EO_SITE_DIR . 'data/docs/*.pdf' ) ?: array() as $file ) {
		$name     = basename( $file );
		$existing = get_posts( array( 'post_type' => 'attachment', 'post_status' => 'inherit', 'meta_key' => '_eo_source_doc', 'meta_value' => $name, 'posts_per_page' => 1, 'fields' => 'ids' ) );
		if ( $existing ) {
			$docs[ $name ] = wp_get_attachment_url( $existing[0] );
			$say( "media: $name already in the library (#{$existing[0]})" );
			continue;
		}
		if ( $dry ) {
			$say( "media: would upload $name" );
			continue;
		}
		$tmp = wp_tempnam( $name );
		copy( $file, $tmp );
		$id = media_handle_sideload( array( 'name' => $name, 'tmp_name' => $tmp, 'type' => 'application/pdf', 'error' => 0, 'size' => filesize( $file ) ), 0, null, array( 'post_title' => preg_replace( '/[-_]+/', ' ', pathinfo( $name, PATHINFO_FILENAME ) ) ) );
		if ( is_wp_error( $id ) ) {
			$say( "media: FAILED $name: " . $id->get_error_message() );
			continue;
		}
		update_post_meta( $id, '_eo_source_doc', $name );
		$docs[ $name ] = wp_get_attachment_url( $id );
		$say( "media: uploaded $name as #$id" );
	}
	// The site icon, from the theme's brand folder, so WordPress prints the icon links.
	if ( ! get_option( 'site_icon' ) ) {
		$icon = get_template_directory() . '/assets/brand/icon-512.png';
		if ( file_exists( $icon ) && ! $dry ) {
			$tmp = wp_tempnam( 'icon-512.png' );
			copy( $icon, $tmp );
			$id = media_handle_sideload( array( 'name' => 'equality-ohio-icon-512.png', 'tmp_name' => $tmp, 'type' => 'image/png', 'error' => 0, 'size' => filesize( $icon ) ), 0, 'Equality Ohio site icon' );
			if ( ! is_wp_error( $id ) ) {
				update_option( 'site_icon', $id );
				$say( "media: site icon set (#$id)" );
			}
		}
	}
	if ( ! $dry ) {
		update_option( 'eo_site_docs', $docs );
	}
}

/** Resolve the content placeholders for this install. */
function eo_site_resolve_content( string $html ): string {
	$html = str_replace( '{{THEME_URI}}', get_template_directory_uri(), $html );
	$docs = get_option( 'eo_site_docs', array() );
	return preg_replace_callback(
		'/\{\{DOC:([^}]+)\}\}/',
		function ( $m ) use ( $docs ) {
			return $docs[ $m[1] ] ?? ( EO_SITE_URL . 'data/docs/' . $m[1] );
		},
		$html
	);
}

function eo_site_find_page( string $path ): ?WP_Post {
	if ( '/' === $path ) {
		$front = (int) get_option( 'page_on_front' );
		if ( $front ) {
			$p = get_post( $front );
			if ( $p && 'page' === $p->post_type ) {
				return $p;
			}
		}
		$p = get_page_by_path( 'home', OBJECT, 'page' );
		return $p ?: null;
	}
	$p = get_page_by_path( trim( $path, '/' ), OBJECT, 'page' );
	return $p ?: null;
}

function eo_site_import_pages( callable $say, bool $dry ): void {
	$ids   = array();
	$order = array();
	// WordPress's stock sample content would otherwise reach the sitemap.
	foreach ( array( array( 'page', 'sample-page' ), array( 'post', 'hello-world' ) ) as $stock ) {
		$p = get_page_by_path( $stock[1], OBJECT, $stock[0] );
		if ( $p && 'trash' !== $p->post_status ) {
			if ( ! $dry ) {
				wp_trash_post( $p->ID );
			}
			$say( "pages: stock {$stock[0]} '{$stock[1]}' (#{$p->ID}) " . ( $dry ? 'would be trashed' : 'trashed' ) );
		}
	}
	foreach ( eo_site_registry() as $path => $rec ) {
		$file = EO_SITE_DIR . 'content/pages/' . $rec['file'];
		if ( ! file_exists( $file ) ) {
			$say( "pages: MISSING $file" );
			continue;
		}
		$content   = eo_site_resolve_content( file_get_contents( $file ) );
		$parent_id = 0;
		if ( ! empty( $rec['parent'] ) ) {
			$parent_id = $ids[ $rec['parent'] ] ?? ( eo_site_find_page( $rec['parent'] )->ID ?? 0 );
		}
		$order[ $parent_id ] = ( $order[ $parent_id ] ?? 0 ) + 1;
		$existing            = eo_site_find_page( $path );
		$data                = array(
			'post_type'      => 'page',
			'post_status'    => 'publish',
			'post_title'     => eo_site_short_title( $rec ),
			'post_name'      => $rec['slug'],
			'post_parent'    => $parent_id,
			'post_content'   => $content,
			'menu_order'     => $order[ $parent_id ],
			'comment_status' => 'closed',
			'ping_status'    => 'closed',
			'meta_input'     => array( '_eo_page_path' => $path, '_eo_source_text_sha256' => $rec['source_text_sha256'] ),
		);
		if ( $existing ) {
			$data['ID'] = $existing->ID;
		}
		if ( $dry ) {
			$say( 'pages: would ' . ( $existing ? "update #{$existing->ID}" : 'create' ) . " $path" );
			$ids[ $path ] = $existing ? $existing->ID : 0;
			continue;
		}
		// kses would strip inert/aria attributes for users without unfiltered_html; the importer runs as the site owner.
		kses_remove_filters();
		$id = wp_insert_post( wp_slash( $data ), true );
		kses_init_filters();
		if ( is_wp_error( $id ) ) {
			$say( "pages: FAILED $path: " . $id->get_error_message() );
			continue;
		}
		$ids[ $path ] = $id;
		if ( ! empty( $rec['template'] ) ) {
			update_post_meta( $id, '_wp_page_template', $rec['template'] );
		} else {
			delete_post_meta( $id, '_wp_page_template' );
		}
		// Read back and compare: what WordPress stored is what we sent.
		$stored = get_post_field( 'post_content', $id, 'raw' );
		$same   = trim( $stored ) === trim( $content );
		$say( 'pages: ' . ( $existing ? 'updated' : 'created' ) . " #$id $path" . ( $same ? '' : ' (CONTENT DIFFERS AFTER SAVE)' ) );
		if ( ! empty( $rec['front_page'] ) ) {
			update_option( 'show_on_front', 'page' );
			update_option( 'page_on_front', $id );
			update_option( 'page_for_posts', 0 );
		}
	}
}

function eo_site_import_settings( callable $say, bool $dry ): void {
	$settings = array(
		'timezone_string'     => 'America/New_York',
		'permalink_structure' => '/%postname%/',
		'blog_public'         => eo_site_is_staging() ? 0 : 1,
		'default_comment_status' => 'closed',
	);
	foreach ( $settings as $k => $v ) {
		if ( $dry ) {
			$say( "settings: would set $k = $v" );
		} else {
			update_option( $k, $v );
			$say( "settings: $k = $v" );
		}
	}
	// Tagline stays empty unless the live site states one.
}

/** Menus: Primary (five sections + Donate) and the four footer columns. */
function eo_site_import_menus( callable $say, bool $dry ): void {
	$site = eo_site_data();
	$menus = array(
		'primary' => array( 'name' => 'Primary', 'items' => array_merge( $site['nav'], array( array( 'label' => 'Donate', 'href' => '/give', 'classes' => array( 'nav-cta' ) ) ) ) ),
	);
	$columns = array(
		'footer-legal-clinic' => array( 'Legal Clinic', array( array( 'About the Clinic', '/legal-clinic' ), array( 'Start an Intake', '/legal-clinic/intake' ), array( 'Family Law Guide', '/legal-clinic/ohio-lgbtq-family-law-guide' ), array( 'Trans Know Your Rights', '/legal-clinic/trans-know-your-rights' ), array( 'Legal Network', '/legal-clinic/legal-network' ), array( '855-LGBT-LAW', 'tel:' . ( $site['org']['clinicPhone']['tel'] ?? '+18555428529' ) ) ) ),
		'footer-our-work'     => array( 'Our Work', array( array( 'What We Do', '/our-work' ), array( 'Local Progress', '/our-work/local' ), array( 'Municipal Equality Map', '/our-work/local/municipal-map' ), array( 'Business Engagement', '/our-work/business' ), array( 'Legacy of Equality', '/our-work/legacy-of-equality' ), array( 'Voters Guide', '/votersguide' ) ) ),
		'footer-get-involved' => array( 'Get Involved', array( array( 'Ways to Give', '/give' ), array( 'Defenders of Equality', '/give#defenders' ), array( 'Obergefell–Arthur Society', '/jim-obergefell-john-arthur-society' ), array( 'Volunteer', '/get-involved/volunteer' ), array( 'Events', '/get-involved/events' ), array( 'Newsletter', '/newsletter' ) ) ),
		'footer-about'        => array( 'About', array( array( 'Mission & Values', '/about' ), array( 'Our History', '/about/history' ), array( 'Board of Directors', '/about/leadership' ), array( 'Staff & Interns', '/about/staff-interns' ), array( 'Jobs & Internships', '/about/jobs-internships' ), array( 'News & Policy', '/news' ), array( 'Contact', '/contact' ) ) ),
	);
	foreach ( $columns as $loc => $col ) {
		$menus[ $loc ] = array( 'name' => $col[0], 'items' => array_map( fn( $i ) => array( 'label' => $i[0], 'href' => $i[1] ), $col[1] ) );
	}

	$locations = get_theme_mod( 'nav_menu_locations', array() );
	foreach ( $menus as $location => $menu ) {
		if ( $dry ) {
			$say( "menus: would build '{$menu['name']}' (" . count( $menu['items'] ) . ' items) for ' . $location );
			continue;
		}
		$obj = wp_get_nav_menu_object( $menu['name'] );
		if ( ! $obj ) {
			$menu_id = wp_create_nav_menu( $menu['name'] );
		} else {
			$menu_id = $obj->term_id;
			foreach ( wp_get_nav_menu_items( $menu_id ) ?: array() as $old ) {
				wp_delete_post( $old->ID, true );
			}
		}
		$pos = 1;
		foreach ( $menu['items'] as $item ) {
			$parent = eo_site_add_menu_item( $menu_id, $item, 0, $pos++ );
			foreach ( $item['children'] ?? array() as $child ) {
				eo_site_add_menu_item( $menu_id, $child, $parent, $pos++ );
			}
		}
		$locations[ $location ] = $menu_id;
		$say( "menus: '{$menu['name']}' rebuilt (#$menu_id) → $location" );
	}
	if ( ! $dry ) {
		set_theme_mod( 'nav_menu_locations', $locations );
	}
}

function eo_site_add_menu_item( int $menu_id, array $item, int $parent, int $position ): int {
	$href = $item['href'];
	$args = array(
		'menu-item-title'     => $item['label'],
		'menu-item-status'    => 'publish',
		'menu-item-parent-id' => $parent,
		'menu-item-position'  => $position,
		'menu-item-classes'   => implode( ' ', $item['classes'] ?? array() ),
	);
	$page = null;
	if ( 0 === strpos( $href, '/' ) && false === strpos( $href, '#' ) ) {
		$page = eo_site_find_page( '/' === $href ? '/' : trailingslashit( $href ) );
	}
	if ( $page ) {
		$args['menu-item-type']      = 'post_type';
		$args['menu-item-object']    = 'page';
		$args['menu-item-object-id'] = $page->ID;
	} else {
		$args['menu-item-type'] = 'custom';
		$args['menu-item-url']  = preg_match( '#^(https?:|mailto:|tel:)#', $href ) ? $href : eo_site_plugin_internal_url( $href );
	}
	return (int) wp_update_nav_menu_item( $menu_id, 0, $args );
}

function eo_site_plugin_internal_url( string $href ): string {
	$hash = '';
	if ( false !== strpos( $href, '#' ) ) {
		list( $href, $hash ) = explode( '#', $href, 2 );
		$hash                = '#' . $hash;
	}
	return home_url( trailingslashit( $href ) ) . $hash;
}
