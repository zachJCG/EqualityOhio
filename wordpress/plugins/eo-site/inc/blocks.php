<?php
/**
 * eo/text: a leaf text block that keeps its HTML tag. The source pages use
 * <span class="eyebrow">, <div class="stat__num">, <div class="form-note">,
 * <blockquote class="quote-block"> and the like: inline-content elements whose
 * tag the stylesheet depends on. Core offers only Paragraph (<p>) and Heading
 * for that, so this block saves <tagName class id aria-hidden>rich text</tagName>
 * and nothing else. Lives in the plugin so a theme switch does not break pages
 * (an unregistered static block still prints its saved HTML).
 *
 * @package eo-site
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	function () {
		wp_register_script(
			'eo-text-block',
			EO_SITE_URL . 'assets/eo-text.js',
			array( 'wp-blocks', 'wp-element', 'wp-block-editor', 'wp-components', 'wp-i18n' ),
			EO_SITE_VERSION,
			true
		);
		register_block_type(
			'eo/text',
			array(
				'api_version'   => 3,
				'title'         => 'Text (keeps its tag)',
				'category'      => 'text',
				'description'   => 'A label, number, date or note whose HTML tag matters to the design (span, div, blockquote).',
				'attributes'    => array(
					'tagName'    => array( 'type' => 'string', 'default' => 'div' ),
					// The selector list names every allowed tag; the first match is the block's root.
					'content'    => array( 'type' => 'rich-text', 'source' => 'rich-text', 'selector' => 'div,span,blockquote,small,cite,address,figcaption,dt,dd' ),
					'ariaHidden' => array( 'type' => 'boolean', 'default' => false ),
				),
				'supports'      => array(
					'className'       => false,
					'customClassName' => true,
					'anchor'          => true,
					'html'            => true,
				),
				'editor_script' => 'eo-text-block',
			)
		);
	}
);
