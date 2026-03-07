<?php
/**
 * Plugin Name:       WP Manager Pro
 * Plugin URI:        https://github.com/nurkamol/wp-manager-pro
 * Description:       A comprehensive agency-ready WordPress management suite with plugin/theme management, file manager, database tools, system info, maintenance mode, user management, and more.
 * Version:           1.0.0
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
define( 'WP_MANAGER_PRO_VERSION', '1.0.0' );
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

// Activation hook.
register_activation_hook( __FILE__, function() {
    // Create notes table.
    global $wpdb;
    $charset_collate = $wpdb->get_charset_collate();
    $table_name = $wpdb->prefix . 'wmp_notes';

    $sql = "CREATE TABLE IF NOT EXISTS $table_name (
        id bigint(20) NOT NULL AUTO_INCREMENT,
        title varchar(255) NOT NULL DEFAULT '',
        content longtext NOT NULL,
        color varchar(50) NOT NULL DEFAULT 'default',
        created_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY  (id)
    ) $charset_collate;";

    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql );

    update_option( 'wp_manager_pro_version', WP_MANAGER_PRO_VERSION );
} );

// Deactivation hook.
register_deactivation_hook( __FILE__, function() {
    // Remove maintenance mode if active.
    $maintenance_file = ABSPATH . '.maintenance';
    if ( file_exists( $maintenance_file ) ) {
        @unlink( $maintenance_file );
    }
} );
