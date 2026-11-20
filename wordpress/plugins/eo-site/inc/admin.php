<?php
/**
 * Tools → Equality Ohio: run the importer, flip the staging flag, choose
 * redirect families.
 *
 * @package eo-site
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'admin_menu',
	function () {
		add_management_page( 'Equality Ohio import', 'Equality Ohio', 'manage_options', 'eo-site', 'eo_site_admin_page' );
	}
);

function eo_site_admin_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$log = array();
	if ( isset( $_POST['eo_site_action'] ) && check_admin_referer( 'eo_site_tools' ) ) {
		$action = sanitize_key( wp_unslash( $_POST['eo_site_action'] ) );
		if ( 'import' === $action ) {
			$log = eo_site_import();
		} elseif ( 'dry-run' === $action ) {
			$log = eo_site_import( array( 'dry_run' => true ) );
		} elseif ( 'staging-on' === $action ) {
			eo_site_set_staging( true );
			$log[] = 'Staging flag: on';
		} elseif ( 'staging-off' === $action ) {
			eo_site_set_staging( false );
			$log[] = 'Staging flag: off (launch state)';
		} elseif ( 'families' === $action ) {
			$fam = array_map( 'sanitize_key', (array) ( $_POST['families'] ?? array() ) );
			update_option( 'eo_site_redirect_families', array_values( array_intersect( $fam, eo_site_redirect_family_names() ) ) );
			$log[] = 'Redirect families saved.';
		}
	}
	$enabled = (array) get_option( 'eo_site_redirect_families', eo_site_redirect_family_names() );
	?>
	<div class="wrap">
		<h1>Equality Ohio: site tools</h1>
		<p>Staging flag is <strong><?php echo eo_site_is_staging() ? 'ON (preview ribbon, noindex)' : 'OFF (launch state)'; ?></strong>.</p>
		<?php $last = get_option( 'eo_site_last_import' ); if ( is_array( $last ) && ! empty( $last['when'] ) ) : ?>
			<p>Last automatic import: <?php echo esc_html( wp_date( 'Y-m-d H:i', (int) $last['when'] ) ); ?> (<?php echo esc_html( $last['how'] ); ?>), <?php echo count( (array) ( $last['log'] ?? array() ) ); ?> log lines.</p>
		<?php endif; ?>
		<?php if ( $log ) : ?>
			<pre style="background:#fff;border:1px solid #ccd0d4;padding:1em;max-height:24em;overflow:auto"><?php echo esc_html( implode( "\n", $log ) ); ?></pre>
		<?php endif; ?>
		<form method="post">
			<?php wp_nonce_field( 'eo_site_tools' ); ?>
			<h2>Import the 29 pages, menus, PDFs and settings</h2>
			<p>Creates or updates pages by path (safe to run again).</p>
			<p>
				<button class="button button-primary" name="eo_site_action" value="import">Run import</button>
				<button class="button" name="eo_site_action" value="dry-run">Dry run</button>
			</p>
			<h2>Staging flag</h2>
			<p>
				<button class="button" name="eo_site_action" value="staging-on">Staging on</button>
				<button class="button" name="eo_site_action" value="staging-off">Staging off (launch)</button>
			</p>
			<h2>Redirect families</h2>
			<p>On a fresh install every family applies. On EO's existing WordPress, leave out <code>legacy-post</code>, <code>post-taxonomy</code> and <code>events-calendar</code>: those posts and archives still exist there.</p>
			<?php foreach ( eo_site_redirect_family_names() as $f ) : ?>
				<label style="display:block"><input type="checkbox" name="families[]" value="<?php echo esc_attr( $f ); ?>" <?php checked( in_array( $f, $enabled, true ) ); ?>> <?php echo esc_html( $f ); ?></label>
			<?php endforeach; ?>
			<p><button class="button" name="eo_site_action" value="families">Save families</button></p>
		</form>
	</div>
	<?php
}
