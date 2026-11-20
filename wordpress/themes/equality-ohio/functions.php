<?php
/**
 * Equality Ohio block theme.
 *
 * Presentation only. Behavior that must survive a theme change (redirects,
 * SEO data, the staging flag's setting, the page importer) is in the
 * companion plugin, plugins/eo-site. The theme reads one option from it,
 * eo_site_staging, and falls back to "staging" when the plugin is absent.
 *
 * @package equality-ohio
 */

defined( 'ABSPATH' ) || exit;

define( 'EO_THEME_VERSION', wp_get_theme()->get( 'Version' ) ?: '0.1.0' );

require_once get_theme_file_path( 'inc/site-data.php' );
require_once get_theme_file_path( 'inc/chrome.php' );
require_once get_theme_file_path( 'inc/blocks.php' );
require_once get_theme_file_path( 'inc/patterns.php' );

/**
 * Whether the site is in its staging state (preview ribbon, footer credit,
 * og:site_name suffix, noindex). The plugin owns the setting; this is the
 * theme's one read of it.
 */
function eo_theme_is_staging(): bool {
	if ( function_exists( 'eo_site_is_staging' ) ) {
		return eo_site_is_staging();
	}
	return '0' !== (string) get_option( 'eo_site_staging', '1' );
}

add_action(
	'after_setup_theme',
	function () {
		add_theme_support( 'title-tag' );
		add_theme_support( 'html5', array( 'script', 'style', 'navigation-widgets', 'search-form' ) );
		add_theme_support( 'editor-styles' );
		add_editor_style(
			array(
				'assets/css/eo-brand-tokens.css',
				'assets/css/eo-site.css',
				'assets/css/eo-wp.css',
				'assets/css/eo-utilities.css',
				'assets/css/eo-editor.css',
			)
		);
		remove_theme_support( 'core-block-patterns' );

		register_nav_menus(
			array(
				'primary'             => __( 'Primary (header)', 'equality-ohio' ),
				'footer-legal-clinic' => __( 'Footer column 1: Legal Clinic', 'equality-ohio' ),
				'footer-our-work'     => __( 'Footer column 2: Our Work', 'equality-ohio' ),
				'footer-get-involved' => __( 'Footer column 3: Get Involved', 'equality-ohio' ),
				'footer-about'        => __( 'Footer column 4: About', 'equality-ohio' ),
			)
		);
	}
);

/**
 * Front-end styles and the behaviors script. Fonts come from theme.json
 * fontFace entries (WordPress prints the @font-face rules); the two
 * above-the-fold faces are preloaded here, as the source did.
 */
add_action(
	'wp_enqueue_scripts',
	function () {
		$dir = get_template_directory_uri();
		wp_enqueue_style( 'eo-brand-tokens', $dir . '/assets/css/eo-brand-tokens.css', array(), EO_THEME_VERSION );
		wp_enqueue_style( 'eo-site', $dir . '/assets/css/eo-site.css', array( 'eo-brand-tokens' ), EO_THEME_VERSION );
		wp_enqueue_style( 'eo-wp', $dir . '/assets/css/eo-wp.css', array( 'eo-site' ), EO_THEME_VERSION );
		wp_enqueue_style( 'eo-utilities', $dir . '/assets/css/eo-utilities.css', array( 'eo-wp' ), EO_THEME_VERSION );
		wp_enqueue_script( 'eo-site', $dir . '/assets/js/eo-site.js', array(), EO_THEME_VERSION, array( 'strategy' => 'defer', 'in_footer' => false ) );

	},
	9
);

/**
 * Block themes inject their own skip link into the template HTML (WordPress
 * 7.0+, _block_template_add_skip_link), gated on these two actions still
 * being hooked. The header renders the site's one skip link, so unhook them
 * early: the template HTML is built before wp_enqueue_scripts fires.
 */
add_action(
	'init',
	function () {
		remove_action( 'wp_enqueue_scripts', 'wp_enqueue_block_template_skip_link' );
		remove_action( 'wp_footer', 'the_block_template_skip_link' );
	}
);

add_action(
	'wp_head',
	function () {
		$dir = get_template_directory_uri();
		echo '<link rel="preload" href="' . esc_url( $dir . '/assets/fonts/open-sans-latin-400-normal.woff2' ) . '" as="font" type="font/woff2" crossorigin />' . "\n";
		echo '<link rel="preload" href="' . esc_url( $dir . '/assets/fonts/montserrat-latin-800-normal.woff2' ) . '" as="font" type="font/woff2" crossorigin />' . "\n";
	},
	2
);

/** Icons and theme color: the plugin prints the full share/SEO head; these are the theme's own. */
add_action(
	'wp_head',
	function () {
		if ( has_site_icon() ) {
			return; // WordPress prints the site icon links.
		}
		$dir = get_template_directory_uri() . '/assets/brand';
		echo '<link rel="icon" href="' . esc_url( $dir . '/favicon.ico' ) . '" sizes="32x32" />' . "\n";
		echo '<link rel="icon" href="' . esc_url( $dir . '/favicon.svg' ) . '" type="image/svg+xml" />' . "\n";
		echo '<link rel="apple-touch-icon" href="' . esc_url( $dir . '/apple-touch-icon.png' ) . '" />' . "\n";
	},
	3
);

/** Body classes the stylesheet keys on, plus a page id for debugging parity. */
add_filter(
	'body_class',
	function ( array $classes ): array {
		$classes[] = eo_theme_is_staging() ? 'eo-staging' : 'eo-launched';
		if ( is_page() ) {
			$classes[] = 'eo-page-' . sanitize_html_class( get_post_field( 'post_name' ) );
		}
		return $classes;
	}
);

/** The emoji script and its inline styles are not needed and add inline code. */
add_action(
	'init',
	function () {
		remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
		remove_action( 'wp_print_styles', 'print_emoji_styles' );
		remove_action( 'wp_head', 'wp_generator' );
		remove_action( 'wp_head', 'rsd_link' );
		remove_action( 'wp_head', 'wlwmanifest_link' );
	}
);

/**
 * The H1 is part of the page content (the hero), never the post title.
 * Templates do not print the title, and the document title still uses it.
 */
add_filter( 'the_title', fn( $title ) => $title );

/** Button styles: the source's .btn variants, as block styles staff can pick. */
add_action(
	'init',
	function () {
		foreach ( array(
			'eo-primary' => __( 'Purple (primary)', 'equality-ohio' ),
			'eo-outline' => __( 'Outline', 'equality-ohio' ),
			'eo-gold'    => __( 'Gold', 'equality-ohio' ),
			'eo-on-dark' => __( 'On dark (white)', 'equality-ohio' ),
		) as $name => $label ) {
			register_block_style( 'core/button', array( 'name' => $name, 'label' => $label ) );
		}
		register_block_style( 'core/group', array( 'name' => 'eo-section-soft', 'label' => __( 'Soft section', 'equality-ohio' ) ) );
	}
);

/** Text domain. */
add_action( 'init', fn() => load_theme_textdomain( 'equality-ohio', get_template_directory() . '/languages' ) );
