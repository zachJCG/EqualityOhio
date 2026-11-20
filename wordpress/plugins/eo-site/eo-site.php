<?php
/**
 * Plugin Name: Equality Ohio Site
 * Plugin URI: https://github.com/zachJCG/EqualityOhio
 * Description: Behavior that must survive a theme change for equalityohio.org: the legacy redirect map, page titles, descriptions, share cards and structured data, the staging flag, safe response headers, the eo/text block, and the importer that creates the 29 pages, menus and settings from files.
 * Version: 0.1.0
 * Requires at least: 6.6
 * Requires PHP: 8.0
 * Author: Joseph Carter Group
 * License: GPL-2.0-or-later
 * Text Domain: eo-site
 *
 * @package eo-site
 */

defined( 'ABSPATH' ) || exit;

define( 'EO_SITE_VERSION', '0.1.0' );
define( 'EO_SITE_DIR', plugin_dir_path( __FILE__ ) );
define( 'EO_SITE_URL', plugin_dir_url( __FILE__ ) );

require_once EO_SITE_DIR . 'inc/registry.php';
require_once EO_SITE_DIR . 'inc/staging.php';
require_once EO_SITE_DIR . 'inc/blocks.php';
require_once EO_SITE_DIR . 'inc/seo.php';
require_once EO_SITE_DIR . 'inc/redirects.php';
require_once EO_SITE_DIR . 'inc/headers.php';
require_once EO_SITE_DIR . 'inc/importer.php';
require_once EO_SITE_DIR . 'inc/admin.php';
if ( defined( 'WP_CLI' ) && WP_CLI ) {
	require_once EO_SITE_DIR . 'inc/cli.php';
}
