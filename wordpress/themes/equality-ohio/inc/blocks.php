<?php
/**
 * Dynamic blocks that render the chrome, so the template parts stay editable
 * in the Site Editor while the markup is produced by PHP from menus and data.
 *
 * @package equality-ohio
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	function () {
		$blocks = array(
			'site-header' => array( 'title' => 'EO Site Header', 'render' => 'eo_render_header' ),
			'site-footer' => array( 'title' => 'EO Site Footer', 'render' => 'eo_render_footer' ),
			'help-bar'    => array( 'title' => 'EO Legal Clinic Help Bar', 'render' => 'eo_render_help_bar' ),
			'not-found'   => array( 'title' => 'EO 404 Body', 'render' => 'eo_render_not_found' ),
		);
		wp_register_script(
			'eo-blocks-editor',
			get_theme_file_uri( 'assets/js/eo-blocks-editor.js' ),
			array( 'wp-blocks', 'wp-element', 'wp-server-side-render', 'wp-block-editor', 'wp-components' ),
			EO_THEME_VERSION,
			true
		);
		foreach ( $blocks as $slug => $def ) {
			register_block_type(
				'eo/' . $slug,
				array(
					'api_version'     => 3,
					'title'           => $def['title'],
					'category'        => 'theme',
					'description'     => 'Rendered by the Equality Ohio theme from site data and menus.',
					'supports'        => array( 'html' => false, 'customClassName' => false, 'inserter' => true, 'multiple' => false ),
					'render_callback' => fn() => call_user_func( $def['render'] ),
					'editor_script'   => 'eo-blocks-editor',
				)
			);
		}
	}
);
