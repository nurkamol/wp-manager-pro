<?php
/**
 * Plugin Name:       WP Manager Pro
 * Plugin URI:        https://github.com/nurkamol/wp-manager-pro
 * Description:       A comprehensive agency-ready WordPress management suite with plugin/theme management, file manager, database tools, system info, maintenance mode, user management, and more.
 * Version:           1.7.0
 * Requires at least: 5.9
 * Requires PHP:      7.4
 * Author:            Nurkamol Vakhidov
 * Author URI:        https://nurkamol.com
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       wp-manager-pro
 * Domain Path:       /languages
 */

// Exit if accessed directly.
if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

// Define plugin constants.
define( 'WP_MANAGER_PRO_VERSION', '1.7.0' );
define( 'WP_MANAGER_PRO_FILE', __FILE__ );
define( 'WP_MANAGER_PRO_PATH', plugin_dir_path( __FILE__ ) );
define( 'WP_MANAGER_PRO_URL', plugin_dir_url( __FILE__ ) );
define( 'WP_MANAGER_PRO_BASENAME', plugin_basename( __FILE__ ) );

// Load the main plugin class.
require_once WP_MANAGER_PRO_PATH . 'includes/class-plugin.php';

/**
 * Initialize the plugin.
 */
function wp_manager_pro_init() {
    return WP_Manager_Pro\Plugin::get_instance();
}

add_action( 'plugins_loaded', 'wp_manager_pro_init' );

/**
 * Create / upgrade all plugin database tables.
 *
 * Safe to call multiple times — dbDelta() is idempotent.
 * Called on activation AND on any page load where the stored DB version
 * doesn't match the current plugin version (handles file-only updates).
 */
function wp_manager_pro_setup_tables() {
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';

    // Notes table.
    dbDelta( "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}wmp_notes (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        title varchar(255) NOT NULL DEFAULT '',
        content longtext NOT NULL,
        color varchar(50) NOT NULL DEFAULT 'default',
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY  (id)
    ) $charset_collate;" );

    // Audit log table.
    dbDelta( "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}wmp_audit_log (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        user_id bigint(20) NOT NULL DEFAULT 0,
        user_name varchar(100) NOT NULL DEFAULT '',
        action varchar(100) NOT NULL DEFAULT '',
        object_type varchar(50) NOT NULL DEFAULT '',
        object_name varchar(255) NOT NULL DEFAULT '',
        extra longtext,
        ip_address varchar(45) NOT NULL DEFAULT '',
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY  (id),
        KEY action (action),
        KEY created_at (created_at)
    ) $charset_collate;" );

    // Code snippets table.
    dbDelta( "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}wmp_snippets (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        title varchar(255) NOT NULL DEFAULT '',
        description text,
        code longtext NOT NULL,
        type varchar(10) NOT NULL DEFAULT 'php',
        enabled tinyint(1) NOT NULL DEFAULT 0,
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY  (id)
    ) $charset_collate;" );

    // Redirects table.
    dbDelta( "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}wmp_redirects (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        source varchar(500) NOT NULL DEFAULT '',
        target varchar(500) NOT NULL DEFAULT '',
        type smallint(3) NOT NULL DEFAULT 301,
        hits bigint(20) NOT NULL DEFAULT 0,
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY  (id),
        KEY source (source(191))
    ) $charset_collate;" );

    // Email log table.
    dbDelta( "CREATE TABLE IF NOT EXISTS {$wpdb->prefix}wmp_email_log (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        to_email varchar(500) NOT NULL DEFAULT '',
        subject varchar(500) NOT NULL DEFAULT '',
        message longtext,
        headers longtext,
        status varchar(20) NOT NULL DEFAULT 'sent',
        error text,
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY  (id),
        KEY created_at (created_at)
    ) $charset_collate;" );

    update_option( 'wp_manager_pro_db_version', WP_MANAGER_PRO_VERSION );
    update_option( 'wp_manager_pro_version', WP_MANAGER_PRO_VERSION );
}

// Activation hook — always run table setup on (re)activation.
register_activation_hook( __FILE__, 'wp_manager_pro_setup_tables' );

// Auto-upgrade hook — runs on every request when the stored DB version
// is behind the current plugin version (e.g. after a file-only update).
add_action( 'plugins_loaded', function() {
    if ( get_option( 'wp_manager_pro_db_version' ) !== WP_MANAGER_PRO_VERSION ) {
        wp_manager_pro_setup_tables();
    }
}, 5 ); // Priority 5 — runs before wp_manager_pro_init (priority 10).

// Deactivation hook.
register_deactivation_hook( __FILE__, function() {
    // Ensure maintenance mode is disabled when the plugin is deactivated.
    update_option( 'wmp_maintenance_active', false );

    // Clean up any leftover .maintenance file from older plugin versions.
    $maintenance_file = ABSPATH . '.maintenance';
    if ( file_exists( $maintenance_file ) ) {
        @unlink( $maintenance_file ); // phpcs:ignore WordPress.PHP.NoSilencedErrors.Discouraged
    }
} );
