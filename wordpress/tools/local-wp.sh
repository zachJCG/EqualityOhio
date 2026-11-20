#!/bin/sh
# A local WordPress for this build: core + the SQLite integration plugin
# (no MySQL), WP-CLI, the theme and plugin linked in, the pages imported.
#
#   sh tools/local-wp.sh [target-dir]      default: .local-wp (git-ignored)
#   then: php -S localhost:8080 -t .local-wp/wordpress .local-wp/router.php
#   admin: admin / admin  (local only)
#
# Needs PHP 8.0+ with sqlite3/pdo_sqlite, curl, unzip. Safe to rerun.
set -e
ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR=${1:-$ROOT/.local-wp}
URL=${EO_LOCAL_URL:-http://localhost:8080}
mkdir -p "$DIR" && cd "$DIR"
[ -f wordpress.zip ] || curl -sSL -o wordpress.zip https://wordpress.org/latest.zip
[ -d wordpress ] || unzip -q wordpress.zip
[ -f wp-cli.phar ] || curl -sSL -o wp-cli.phar https://github.com/wp-cli/wp-cli/releases/download/v2.11.0/wp-cli-2.11.0.phar
[ -f sqlite.zip ] || curl -sSL -o sqlite.zip https://downloads.wordpress.org/plugin/sqlite-database-integration.latest-stable.zip
[ -d wordpress/wp-content/plugins/sqlite-database-integration ] || unzip -q sqlite.zip -d wordpress/wp-content/plugins/
cd wordpress
if [ ! -f wp-content/db.php ]; then
  cp wp-content/plugins/sqlite-database-integration/db.copy wp-content/db.php
  sed -i "s#{SQLITE_IMPLEMENTATION_FOLDER_PATH}#$(pwd)/wp-content/plugins/sqlite-database-integration#; s#{SQLITE_PLUGIN}#sqlite-database-integration/load.php#" wp-content/db.php
fi
if [ ! -f wp-config.php ]; then
  cat > wp-config.php <<'CFG'
<?php
define( 'DB_NAME', 'wordpress' ); define( 'DB_USER', 'wordpress' ); define( 'DB_PASSWORD', 'wordpress' ); define( 'DB_HOST', 'localhost' );
define( 'DB_CHARSET', 'utf8mb4' ); define( 'DB_COLLATE', '' );
define( 'AUTH_KEY', 'local-only-1' ); define( 'SECURE_AUTH_KEY', 'local-only-2' ); define( 'LOGGED_IN_KEY', 'local-only-3' ); define( 'NONCE_KEY', 'local-only-4' );
define( 'AUTH_SALT', 'local-only-5' ); define( 'SECURE_AUTH_SALT', 'local-only-6' ); define( 'LOGGED_IN_SALT', 'local-only-7' ); define( 'NONCE_SALT', 'local-only-8' );
$table_prefix = 'wp_';
define( 'WP_DEBUG', true ); define( 'WP_DEBUG_LOG', true ); define( 'WP_DEBUG_DISPLAY', false ); define( 'DISABLE_WP_CRON', true ); define( 'WP_ENVIRONMENT_TYPE', 'local' );
if ( ! defined( 'ABSPATH' ) ) { define( 'ABSPATH', __DIR__ . '/' ); }
require_once ABSPATH . 'wp-settings.php';
CFG
fi
WP="php ../wp-cli.phar --allow-root"
$WP core is-installed 2>/dev/null || $WP core install --url="$URL" --title="Equality Ohio" --admin_user=admin --admin_password=admin --admin_email=admin@example.com --skip-email
ln -sfn "$ROOT/themes/equality-ohio" wp-content/themes/equality-ohio
ln -sfn "$ROOT/plugins/eo-site" wp-content/plugins/eo-site
$WP theme activate equality-ohio
$WP plugin activate eo-site
$WP eo import
cat > ../router.php <<'RT'
<?php
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$file = __DIR__ . '/wordpress' . $path;
if ($path !== '/' && is_file($file)) { return false; }
if (is_dir($file) && is_file(rtrim($file, '/') . '/index.php') && $path !== '/') { $_SERVER['SCRIPT_NAME'] = rtrim($path, '/') . '/index.php'; require rtrim($file, '/') . '/index.php'; return true; }
$_SERVER['SCRIPT_NAME'] = '/index.php';
require __DIR__ . '/wordpress/index.php';
RT
echo "Ready. Run: php -S ${URL#http://} -t $DIR/wordpress $DIR/router.php"
