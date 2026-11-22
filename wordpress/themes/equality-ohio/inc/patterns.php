<?php
/**
 * Block patterns: one category, patterns from the patterns/ directory
 * (WordPress registers every PHP file there automatically from its header).
 *
 * @package equality-ohio
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	function () {
		register_block_pattern_category( 'equality-ohio', array( 'label' => __( 'Equality Ohio', 'equality-ohio' ) ) );
		register_block_pattern_category( 'equality-ohio-pages', array( 'label' => __( 'Equality Ohio: page layouts', 'equality-ohio' ) ) );
	},
	9
);
