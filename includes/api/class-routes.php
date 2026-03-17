<?php
namespace WP_Manager_Pro\API;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_Manager_Pro\API\Controllers\Dashboard_Controller;
use WP_Manager_Pro\API\Controllers\Plugins_Controller;
use WP_Manager_Pro\API\Controllers\Themes_Controller;
use WP_Manager_Pro\API\Controllers\Files_Controller;
use WP_Manager_Pro\API\Controllers\Database_Controller;
use WP_Manager_Pro\API\Controllers\System_Controller;
use WP_Manager_Pro\API\Controllers\Users_Controller;
use WP_Manager_Pro\API\Controllers\Maintenance_Controller;
use WP_Manager_Pro\API\Controllers\Notes_Controller;
use WP_Manager_Pro\API\Controllers\Debug_Controller;
use WP_Manager_Pro\API\Controllers\Images_Controller;
use WP_Manager_Pro\API\Controllers\Reset_Controller;
use WP_Manager_Pro\API\Controllers\Audit_Controller;
use WP_Manager_Pro\API\Controllers\Snippets_Controller;
use WP_Manager_Pro\API\Controllers\Redirects_Controller;
use WP_Manager_Pro\API\Controllers\Email_Controller;
use WP_Manager_Pro\API\Controllers\Backup_Controller;
use WP_Manager_Pro\API\Controllers\Settings_Controller;
use WP_Manager_Pro\API\Controllers\Performance_Controller;
use WP_Manager_Pro\API\Controllers\Security_Controller;
use WP_Manager_Pro\API\Controllers\Cron_Controller;
use WP_Manager_Pro\API\Controllers\Media_Controller;
use WP_Manager_Pro\API\Controllers\Content_Controller;
use WP_Manager_Pro\API\Controllers\Dev_Tools_Controller;
use WP_Manager_Pro\API\Controllers\Update_Manager_Controller;
use WP_Manager_Pro\API\Controllers\Security_Scanner_Controller;
use WP_Manager_Pro\API\Controllers\Agency_Controller;
use WP_Manager_Pro\API\Controllers\Developer_Controller;

class Routes {

    const NAMESPACE = 'wp-manager-pro/v1';

    public static function register_routes() {
        $namespace = self::NAMESPACE;

        // Dashboard.
        register_rest_route( $namespace, '/dashboard', [
            'methods'             => 'GET',
            'callback'            => [ Dashboard_Controller::class, 'get_stats' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Plugins.
        register_rest_route( $namespace, '/plugins', [
            'methods'             => 'GET',
            'callback'            => [ Plugins_Controller::class, 'get_plugins' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/activate', [
            'methods'             => 'POST',
            'callback'            => [ Plugins_Controller::class, 'activate_plugin' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/deactivate', [
            'methods'             => 'POST',
            'callback'            => [ Plugins_Controller::class, 'deactivate_plugin' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/delete', [
            'methods'             => 'DELETE',
            'callback'            => [ Plugins_Controller::class, 'delete_plugin' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/install', [
            'methods'             => 'POST',
            'callback'            => [ Plugins_Controller::class, 'install_plugin' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/search', [
            'methods'             => 'GET',
            'callback'            => [ Plugins_Controller::class, 'search_plugins' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/upload', [
            'methods'             => 'POST',
            'callback'            => [ Plugins_Controller::class, 'upload_plugin' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/update', [
            'methods'             => 'POST',
            'callback'            => [ Plugins_Controller::class, 'update_plugin' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/install-version', [
            'methods'             => 'POST',
            'callback'            => [ Plugins_Controller::class, 'install_plugin_version' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/check-updates', [
            'methods'             => 'POST',
            'callback'            => [ Plugins_Controller::class, 'check_updates' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/bulk-activate', [
            'methods'             => 'POST',
            'callback'            => [ Plugins_Controller::class, 'bulk_activate' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/bulk-deactivate', [
            'methods'             => 'POST',
            'callback'            => [ Plugins_Controller::class, 'bulk_deactivate' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/bulk-delete', [
            'methods'             => 'DELETE',
            'callback'            => [ Plugins_Controller::class, 'bulk_delete' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/bulk-update', [
            'methods'             => 'POST',
            'callback'            => [ Plugins_Controller::class, 'bulk_update' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/export', [
            'methods'             => 'POST',
            'callback'            => [ Plugins_Controller::class, 'export_plugin' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/plugins/download', [
            'methods'             => 'GET',
            'callback'            => [ Plugins_Controller::class, 'download_export' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Themes.
        register_rest_route( $namespace, '/themes', [
            'methods'             => 'GET',
            'callback'            => [ Themes_Controller::class, 'get_themes' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/themes/activate', [
            'methods'             => 'POST',
            'callback'            => [ Themes_Controller::class, 'activate_theme' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/themes/delete', [
            'methods'             => 'DELETE',
            'callback'            => [ Themes_Controller::class, 'delete_theme' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/themes/install', [
            'methods'             => 'POST',
            'callback'            => [ Themes_Controller::class, 'install_theme' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/themes/search', [
            'methods'             => 'GET',
            'callback'            => [ Themes_Controller::class, 'search_themes' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/themes/upload', [
            'methods'             => 'POST',
            'callback'            => [ Themes_Controller::class, 'upload_theme' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/themes/update', [
            'methods'             => 'POST',
            'callback'            => [ Themes_Controller::class, 'update_theme' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/themes/install-version', [
            'methods'             => 'POST',
            'callback'            => [ Themes_Controller::class, 'install_theme_version' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/themes/check-updates', [
            'methods'             => 'POST',
            'callback'            => [ Themes_Controller::class, 'check_updates' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/themes/export', [
            'methods'             => 'POST',
            'callback'            => [ Themes_Controller::class, 'export_theme' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/themes/download', [
            'methods'             => 'GET',
            'callback'            => [ Themes_Controller::class, 'download_export' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Files.
        register_rest_route( $namespace, '/files', [
            'methods'             => 'GET',
            'callback'            => [ Files_Controller::class, 'list_files' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/files/read', [
            'methods'             => 'GET',
            'callback'            => [ Files_Controller::class, 'read_file' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/files/write', [
            'methods'             => 'POST',
            'callback'            => [ Files_Controller::class, 'write_file' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/files/delete', [
            'methods'             => 'DELETE',
            'callback'            => [ Files_Controller::class, 'delete_file' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/files/mkdir', [
            'methods'             => 'POST',
            'callback'            => [ Files_Controller::class, 'create_directory' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/files/upload', [
            'methods'             => 'POST',
            'callback'            => [ Files_Controller::class, 'upload_file' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/files/rename', [
            'methods'             => 'POST',
            'callback'            => [ Files_Controller::class, 'rename_file' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Database.
        register_rest_route( $namespace, '/database/tables', [
            'methods'             => 'GET',
            'callback'            => [ Database_Controller::class, 'get_tables' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/database/table-data', [
            'methods'             => 'GET',
            'callback'            => [ Database_Controller::class, 'get_table_data' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/database/search-replace', [
            'methods'             => 'POST',
            'callback'            => [ Database_Controller::class, 'search_replace' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/database/optimize', [
            'methods'             => 'POST',
            'callback'            => [ Database_Controller::class, 'optimize_tables' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/database/query', [
            'methods'             => 'POST',
            'callback'            => [ Database_Controller::class, 'run_query' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/database/row', [
            'methods'             => 'POST',
            'callback'            => [ Database_Controller::class, 'insert_row' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/database/row', [
            'methods'             => 'PUT',
            'callback'            => [ Database_Controller::class, 'update_row' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/database/row', [
            'methods'             => 'DELETE',
            'callback'            => [ Database_Controller::class, 'delete_row' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/database/export', [
            'methods'             => 'GET',
            'callback'            => [ Database_Controller::class, 'export_table' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // System Info.
        register_rest_route( $namespace, '/system', [
            'methods'             => 'GET',
            'callback'            => [ System_Controller::class, 'get_info' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Maintenance.
        register_rest_route( $namespace, '/maintenance', [
            'methods'             => 'GET',
            'callback'            => [ Maintenance_Controller::class, 'get_status' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/maintenance/toggle', [
            'methods'             => 'POST',
            'callback'            => [ Maintenance_Controller::class, 'toggle' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        register_rest_route( $namespace, '/maintenance/settings', [
            'methods'             => 'POST',
            'callback'            => [ Maintenance_Controller::class, 'save_settings' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Users.
        register_rest_route( $namespace, '/users', [
            'methods'             => 'GET',
            'callback'            => [ Users_Controller::class, 'get_users' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/users/change-role', [
            'methods'             => 'POST',
            'callback'            => [ Users_Controller::class, 'change_role' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/users/login-as', [
            'methods'             => 'POST',
            'callback'            => [ Users_Controller::class, 'login_as_user' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/users/delete', [
            'methods'             => 'DELETE',
            'callback'            => [ Users_Controller::class, 'delete_user' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/users/rename', [
            'methods'             => 'POST',
            'callback'            => [ Users_Controller::class, 'rename_user' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Notes.
        register_rest_route( $namespace, '/notes', [
            'methods'             => 'GET',
            'callback'            => [ Notes_Controller::class, 'get_notes' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/notes', [
            'methods'             => 'POST',
            'callback'            => [ Notes_Controller::class, 'create_note' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/notes/(?P<id>\d+)', [
            'methods'             => 'PUT',
            'callback'            => [ Notes_Controller::class, 'update_note' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/notes/(?P<id>\d+)', [
            'methods'             => 'DELETE',
            'callback'            => [ Notes_Controller::class, 'delete_note' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Debug.
        register_rest_route( $namespace, '/debug', [
            'methods'             => 'GET',
            'callback'            => [ Debug_Controller::class, 'get_debug_info' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/debug/toggle', [
            'methods'             => 'POST',
            'callback'            => [ Debug_Controller::class, 'toggle_debug' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/debug/log', [
            'methods'             => 'GET',
            'callback'            => [ Debug_Controller::class, 'get_error_log' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/debug/log/clear', [
            'methods'             => 'DELETE',
            'callback'            => [ Debug_Controller::class, 'clear_error_log' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Images.
        register_rest_route( $namespace, '/images/settings', [
            'methods'             => 'GET',
            'callback'            => [ Images_Controller::class, 'get_settings' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/images/settings', [
            'methods'             => 'POST',
            'callback'            => [ Images_Controller::class, 'save_settings' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/images/regenerate', [
            'methods'             => 'POST',
            'callback'            => [ Images_Controller::class, 'regenerate_thumbnails' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/images/convert', [
            'methods'             => 'POST',
            'callback'            => [ Images_Controller::class, 'batch_convert' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/images/convert-stats', [
            'methods'             => 'GET',
            'callback'            => [ Images_Controller::class, 'get_convert_stats' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/images/convert', [
            'methods'             => 'DELETE',
            'callback'            => [ Images_Controller::class, 'delete_all_converted' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Reset Tools.
        register_rest_route( $namespace, '/reset/status', [
            'methods'             => 'GET',
            'callback'            => [ Reset_Controller::class, 'get_status' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Security.
        register_rest_route( $namespace, '/security', [
            'methods'             => 'GET',
            'callback'            => [ Security_Controller::class, 'get_status' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/overview', [
            'methods'             => 'GET',
            'callback'            => [ Security_Controller::class, 'get_overview' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/admin-url', [
            'methods'             => 'POST',
            'callback'            => [ Security_Controller::class, 'update_slug' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/admin-url', [
            'methods'             => 'DELETE',
            'callback'            => [ Security_Controller::class, 'disable_protection' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/limiter', [
            'methods'             => 'POST',
            'callback'            => [ Security_Controller::class, 'save_limiter_settings' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/lockouts', [
            'methods'             => 'GET',
            'callback'            => [ Security_Controller::class, 'get_lockout_log' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/lockouts', [
            'methods'             => 'DELETE',
            'callback'            => [ Security_Controller::class, 'clear_lockout_log' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/lockouts/unlock', [
            'methods'             => 'POST',
            'callback'            => [ Security_Controller::class, 'unlock_ip' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/ip-blocklist', [
            'methods'             => 'GET',
            'callback'            => [ Security_Controller::class, 'get_ip_blocklist' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/ip-blocklist', [
            'methods'             => 'POST',
            'callback'            => [ Security_Controller::class, 'add_ip_block' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/ip-blocklist', [
            'methods'             => 'DELETE',
            'callback'            => [ Security_Controller::class, 'remove_ip_block' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/hardening', [
            'methods'             => 'POST',
            'callback'            => [ Security_Controller::class, 'save_hardening' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/integrity', [
            'methods'             => 'POST',
            'callback'            => [ Security_Controller::class, 'check_integrity' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/2fa', [
            'methods'             => 'GET',
            'callback'            => [ Security_Controller::class, 'get_2fa_status' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/2fa/setup', [
            'methods'             => 'POST',
            'callback'            => [ Security_Controller::class, 'setup_2fa' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/2fa/verify', [
            'methods'             => 'POST',
            'callback'            => [ Security_Controller::class, 'verify_2fa' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/security/2fa', [
            'methods'             => 'DELETE',
            'callback'            => [ Security_Controller::class, 'disable_2fa' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        register_rest_route( $namespace, '/reset/execute', [
            'methods'             => 'POST',
            'callback'            => [ Reset_Controller::class, 'execute_reset' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Audit Log.
        register_rest_route( $namespace, '/audit', [
            'methods'             => 'GET',
            'callback'            => [ Audit_Controller::class, 'get_logs' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/audit/clear', [
            'methods'             => 'DELETE',
            'callback'            => [ Audit_Controller::class, 'clear_logs' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/audit/export', [
            'methods'             => 'POST',
            'callback'            => [ Audit_Controller::class, 'export_logs' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/audit/download', [
            'methods'             => 'GET',
            'callback'            => [ Audit_Controller::class, 'download_export' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/audit/action-types', [
            'methods'             => 'GET',
            'callback'            => [ Audit_Controller::class, 'get_action_types' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Code Snippets.
        register_rest_route( $namespace, '/snippets', [
            'methods'             => 'GET',
            'callback'            => [ Snippets_Controller::class, 'get_snippets' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/snippets', [
            'methods'             => 'POST',
            'callback'            => [ Snippets_Controller::class, 'create_snippet' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/snippets/(?P<id>\d+)', [
            'methods'             => 'PUT',
            'callback'            => [ Snippets_Controller::class, 'update_snippet' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/snippets/(?P<id>\d+)/toggle', [
            'methods'             => 'POST',
            'callback'            => [ Snippets_Controller::class, 'toggle_snippet' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/snippets/(?P<id>\d+)', [
            'methods'             => 'DELETE',
            'callback'            => [ Snippets_Controller::class, 'delete_snippet' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Redirects.
        register_rest_route( $namespace, '/redirects', [
            'methods'             => 'GET',
            'callback'            => [ Redirects_Controller::class, 'get_redirects' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/redirects', [
            'methods'             => 'POST',
            'callback'            => [ Redirects_Controller::class, 'create_redirect' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/redirects/(?P<id>\d+)', [
            'methods'             => 'PUT',
            'callback'            => [ Redirects_Controller::class, 'update_redirect' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/redirects/(?P<id>\d+)', [
            'methods'             => 'DELETE',
            'callback'            => [ Redirects_Controller::class, 'delete_redirect' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/redirects/export', [
            'methods'             => 'POST',
            'callback'            => [ Redirects_Controller::class, 'export_csv' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/redirects/download', [
            'methods'             => 'GET',
            'callback'            => [ Redirects_Controller::class, 'download_csv' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/redirects/import', [
            'methods'             => 'POST',
            'callback'            => [ Redirects_Controller::class, 'import_csv' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Email / SMTP.
        register_rest_route( $namespace, '/email/settings', [
            'methods'             => 'GET',
            'callback'            => [ Email_Controller::class, 'get_settings' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/email/settings', [
            'methods'             => 'POST',
            'callback'            => [ Email_Controller::class, 'save_settings' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/email/test', [
            'methods'             => 'POST',
            'callback'            => [ Email_Controller::class, 'send_test' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/email/log', [
            'methods'             => 'GET',
            'callback'            => [ Email_Controller::class, 'get_log' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/email/log/clear', [
            'methods'             => 'DELETE',
            'callback'            => [ Email_Controller::class, 'clear_log' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Database Backup.
        register_rest_route( $namespace, '/backup', [
            'methods'             => 'GET',
            'callback'            => [ Backup_Controller::class, 'list_backups' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/backup/create', [
            'methods'             => 'POST',
            'callback'            => [ Backup_Controller::class, 'create_backup' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/backup/download', [
            'methods'             => 'POST',
            'callback'            => [ Backup_Controller::class, 'download_backup' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/backup/serve', [
            'methods'             => 'GET',
            'callback'            => [ Backup_Controller::class, 'serve_backup' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/backup/delete', [
            'methods'             => 'DELETE',
            'callback'            => [ Backup_Controller::class, 'delete_backup' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Backup Schedule.
        register_rest_route( $namespace, '/backup/schedule', [
            'methods'             => 'GET',
            'callback'            => [ Backup_Controller::class, 'get_schedule' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/backup/schedule', [
            'methods'             => 'POST',
            'callback'            => [ Backup_Controller::class, 'save_schedule' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Performance (DB Cleanup + Transients + Cache).
        register_rest_route( $namespace, '/performance/overview', [
            'methods'             => 'GET',
            'callback'            => [ Performance_Controller::class, 'get_overview' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/performance/transients', [
            'methods'             => 'GET',
            'callback'            => [ Performance_Controller::class, 'get_transients' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/performance/transients', [
            'methods'             => 'DELETE',
            'callback'            => [ Performance_Controller::class, 'delete_transient_item' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/performance/transients/purge-expired', [
            'methods'             => 'POST',
            'callback'            => [ Performance_Controller::class, 'purge_expired_transients' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/performance/cleanup', [
            'methods'             => 'POST',
            'callback'            => [ Performance_Controller::class, 'run_cleanup' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/performance/object-cache', [
            'methods'             => 'GET',
            'callback'            => [ Performance_Controller::class, 'get_object_cache' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/performance/object-cache/flush', [
            'methods'             => 'POST',
            'callback'            => [ Performance_Controller::class, 'flush_object_cache' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/performance/object-cache/drop-in', [
            'methods'             => 'POST',
            'callback'            => [ Performance_Controller::class, 'manage_drop_in' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Cron Manager (v2.1.0).
        register_rest_route( $namespace, '/cron/events', [
            'methods'             => 'GET',
            'callback'            => [ Cron_Controller::class, 'get_events' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/cron/run', [
            'methods'             => 'POST',
            'callback'            => [ Cron_Controller::class, 'run_event' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/cron/event', [
            'methods'             => 'DELETE',
            'callback'            => [ Cron_Controller::class, 'delete_event' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/cron/schedules', [
            'methods'             => 'GET',
            'callback'            => [ Cron_Controller::class, 'get_schedules' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/cron/schedules', [
            'methods'             => 'POST',
            'callback'            => [ Cron_Controller::class, 'create_schedule' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/cron/schedules', [
            'methods'             => 'DELETE',
            'callback'            => [ Cron_Controller::class, 'delete_schedule' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/cron/health', [
            'methods'             => 'GET',
            'callback'            => [ Cron_Controller::class, 'get_health' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Media Manager (v2.2.0).
        register_rest_route( $namespace, '/media/overview', [
            'methods'             => 'GET',
            'callback'            => [ Media_Controller::class, 'get_overview' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/media/orphaned', [
            'methods'             => 'GET',
            'callback'            => [ Media_Controller::class, 'get_orphaned' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/media/orphaned', [
            'methods'             => 'DELETE',
            'callback'            => [ Media_Controller::class, 'delete_orphaned' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/media/unused', [
            'methods'             => 'GET',
            'callback'            => [ Media_Controller::class, 'get_unused' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/media/unused', [
            'methods'             => 'DELETE',
            'callback'            => [ Media_Controller::class, 'delete_unused' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/media/duplicates', [
            'methods'             => 'GET',
            'callback'            => [ Media_Controller::class, 'get_duplicates' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/media/duplicate', [
            'methods'             => 'DELETE',
            'callback'            => [ Media_Controller::class, 'delete_duplicate' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/media/compress-candidates', [
            'methods'             => 'GET',
            'callback'            => [ Media_Controller::class, 'get_compress_candidates' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/media/compress', [
            'methods'             => 'POST',
            'callback'            => [ Media_Controller::class, 'compress_image' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Content Tools (v2.3.0).
        register_rest_route( $namespace, '/content/post-types', [
            'methods'             => 'GET',
            'callback'            => [ Content_Controller::class, 'get_post_types' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/content/authors', [
            'methods'             => 'GET',
            'callback'            => [ Content_Controller::class, 'get_authors' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/content/posts', [
            'methods'             => 'GET',
            'callback'            => [ Content_Controller::class, 'get_posts' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/content/posts/bulk-edit', [
            'methods'             => 'POST',
            'callback'            => [ Content_Controller::class, 'bulk_edit_posts' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/content/posts/duplicate', [
            'methods'             => 'POST',
            'callback'            => [ Content_Controller::class, 'duplicate_post' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/content/scheduled', [
            'methods'             => 'GET',
            'callback'            => [ Content_Controller::class, 'get_scheduled' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/content/options', [
            'methods'             => 'GET',
            'callback'            => [ Content_Controller::class, 'get_options' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/content/options/(?P<name>[\w%\-.]+)', [
            'methods'             => 'GET',
            'callback'            => [ Content_Controller::class, 'get_option_value' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/content/options', [
            'methods'             => 'POST',
            'callback'            => [ Content_Controller::class, 'update_option_value' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/content/options', [
            'methods'             => 'DELETE',
            'callback'            => [ Content_Controller::class, 'delete_option_value' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Dev Tools (v2.4.0).
        register_rest_route( $namespace, '/dev-tools/wp-config', [
            'methods'             => 'GET',
            'callback'            => [ Dev_Tools_Controller::class, 'get_wp_config' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/dev-tools/wp-config', [
            'methods'             => 'POST',
            'callback'            => [ Dev_Tools_Controller::class, 'save_wp_config_constant' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/dev-tools/htaccess', [
            'methods'             => 'GET',
            'callback'            => [ Dev_Tools_Controller::class, 'get_htaccess' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/dev-tools/htaccess', [
            'methods'             => 'POST',
            'callback'            => [ Dev_Tools_Controller::class, 'save_htaccess' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/dev-tools/phpinfo', [
            'methods'             => 'GET',
            'callback'            => [ Dev_Tools_Controller::class, 'get_phpinfo' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/dev-tools/query-monitor', [
            'methods'             => 'GET',
            'callback'            => [ Dev_Tools_Controller::class, 'get_query_monitor' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/dev-tools/environment', [
            'methods'             => 'GET',
            'callback'            => [ Dev_Tools_Controller::class, 'get_environment' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/dev-tools/environment', [
            'methods'             => 'POST',
            'callback'            => [ Dev_Tools_Controller::class, 'save_environment' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Settings (Branding / White-label).
        register_rest_route( $namespace, '/settings', [
            'methods'             => 'GET',
            'callback'            => [ Settings_Controller::class, 'get_settings' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/settings', [
            'methods'             => 'POST',
            'callback'            => [ Settings_Controller::class, 'save_settings' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/settings/export', [
            'methods'             => 'GET',
            'callback'            => [ Settings_Controller::class, 'export_settings' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/settings/import', [
            'methods'             => 'POST',
            'callback'            => [ Settings_Controller::class, 'import_settings' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/settings/export-wp-xml', [
            'methods'             => 'POST',
            'callback'            => [ Settings_Controller::class, 'export_wordpress_xml' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // ── Update Manager ────────────────────────────────────────────────────
        register_rest_route( $namespace, '/updates/available', [
            'methods'             => 'GET',
            'callback'            => [ Update_Manager_Controller::class, 'get_available' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/updates/changelog', [
            'methods'             => 'GET',
            'callback'            => [ Update_Manager_Controller::class, 'get_changelog' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/updates/run', [
            'methods'             => 'POST',
            'callback'            => [ Update_Manager_Controller::class, 'run_update' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/updates/rollback', [
            'methods'             => 'POST',
            'callback'            => [ Update_Manager_Controller::class, 'rollback' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/updates/history', [
            'methods'             => 'GET',
            'callback'            => [ Update_Manager_Controller::class, 'get_history' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/updates/history/clear', [
            'methods'             => 'DELETE',
            'callback'            => [ Update_Manager_Controller::class, 'clear_history' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/updates/scheduled', [
            'methods'             => 'GET',
            'callback'            => [ Update_Manager_Controller::class, 'get_scheduled' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/updates/schedule', [
            'methods'             => 'POST',
            'callback'            => [ Update_Manager_Controller::class, 'add_schedule' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/updates/schedule/cancel', [
            'methods'             => 'DELETE',
            'callback'            => [ Update_Manager_Controller::class, 'cancel_schedule' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/updates/check-self', [
            'methods'             => 'POST',
            'callback'            => [ Update_Manager_Controller::class, 'check_self_update' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // ── Security Scanner (v2.7.0) ──────────────────────────────────────────
        register_rest_route( $namespace, '/scanner/malware', [
            'methods'             => 'GET',
            'callback'            => [ Security_Scanner_Controller::class, 'scan_malware' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/scanner/vulns', [
            'methods'             => 'GET',
            'callback'            => [ Security_Scanner_Controller::class, 'get_vulnerabilities' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/scanner/ssl', [
            'methods'             => 'GET',
            'callback'            => [ Security_Scanner_Controller::class, 'get_ssl' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/scanner/core', [
            'methods'             => 'GET',
            'callback'            => [ Security_Scanner_Controller::class, 'get_core_status' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/scanner/api-key', [
            'methods'             => 'GET',
            'callback'            => [ Security_Scanner_Controller::class, 'get_api_key_status' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/scanner/api-key', [
            'methods'             => 'POST',
            'callback'            => [ Security_Scanner_Controller::class, 'save_api_key' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/scanner/file', [
            'methods'             => 'GET',
            'callback'            => [ Security_Scanner_Controller::class, 'get_file_content' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/scanner/file', [
            'methods'             => 'DELETE',
            'callback'            => [ Security_Scanner_Controller::class, 'delete_file' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/scanner/quarantine', [
            'methods'             => 'POST',
            'callback'            => [ Security_Scanner_Controller::class, 'quarantine_file' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/scanner/ignore', [
            'methods'             => 'POST',
            'callback'            => [ Security_Scanner_Controller::class, 'ignore_file' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/scanner/ignored', [
            'methods'             => 'GET',
            'callback'            => [ Security_Scanner_Controller::class, 'get_ignored_files' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/scanner/ignored', [
            'methods'             => 'DELETE',
            'callback'            => [ Security_Scanner_Controller::class, 'remove_ignored_file' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // ── Agency Tools ─────────────────────────────────────────────────────

        // Mail Interceptor
        register_rest_route( $namespace, '/agency/mail-settings', [
            [ 'methods' => 'GET',  'callback' => [ Agency_Controller::class, 'get_mail_settings'  ], 'permission_callback' => [ self::class, 'admin_permission' ] ],
            [ 'methods' => 'POST', 'callback' => [ Agency_Controller::class, 'save_mail_settings' ], 'permission_callback' => [ self::class, 'admin_permission' ] ],
        ] );
        register_rest_route( $namespace, '/agency/mail-log', [
            'methods'             => 'GET',
            'callback'            => [ Agency_Controller::class, 'get_mail_log' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/agency/mail-log/clear', [
            'methods'             => 'DELETE',
            'callback'            => [ Agency_Controller::class, 'clear_mail_log' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/agency/mail-resend', [
            'methods'             => 'POST',
            'callback'            => [ Agency_Controller::class, 'resend_mail' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Login Page
        register_rest_route( $namespace, '/agency/login-page', [
            [ 'methods' => 'GET',  'callback' => [ Agency_Controller::class, 'get_login_settings'  ], 'permission_callback' => [ self::class, 'admin_permission' ] ],
            [ 'methods' => 'POST', 'callback' => [ Agency_Controller::class, 'save_login_settings' ], 'permission_callback' => [ self::class, 'admin_permission' ] ],
        ] );

        // Admin Customiser
        register_rest_route( $namespace, '/agency/admin-customiser', [
            [ 'methods' => 'GET',  'callback' => [ Agency_Controller::class, 'get_admin_customiser'  ], 'permission_callback' => [ self::class, 'admin_permission' ] ],
            [ 'methods' => 'POST', 'callback' => [ Agency_Controller::class, 'save_admin_customiser' ], 'permission_callback' => [ self::class, 'admin_permission' ] ],
        ] );

        // Client Report
        register_rest_route( $namespace, '/agency/report', [
            'methods'             => 'GET',
            'callback'            => [ Agency_Controller::class, 'generate_report' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // Coming Soon
        register_rest_route( $namespace, '/agency/coming-soon', [
            [ 'methods' => 'GET',  'callback' => [ Agency_Controller::class, 'get_coming_soon'  ], 'permission_callback' => [ self::class, 'admin_permission' ] ],
            [ 'methods' => 'POST', 'callback' => [ Agency_Controller::class, 'save_coming_soon' ], 'permission_callback' => [ self::class, 'admin_permission' ] ],
        ] );
        register_rest_route( $namespace, '/agency/coming-soon/emails/clear', [
            'methods'             => 'DELETE',
            'callback'            => [ Agency_Controller::class, 'clear_coming_soon_emails' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );

        // ── Developer Utilities (v2.9.0) ───────────────────────────────────────
        register_rest_route( $namespace, '/developer/hooks', [
            'methods'             => 'GET',
            'callback'            => [ Developer_Controller::class, 'get_hooks' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/developer/rest-routes', [
            'methods'             => 'GET',
            'callback'            => [ Developer_Controller::class, 'get_rest_routes' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/developer/rest-request', [
            'methods'             => 'POST',
            'callback'            => [ Developer_Controller::class, 'proxy_rest_request' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/developer/generate', [
            'methods'             => 'POST',
            'callback'            => [ Developer_Controller::class, 'generate_dummy' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/developer/dummy-stats', [
            'methods'             => 'GET',
            'callback'            => [ Developer_Controller::class, 'get_dummy_stats' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/developer/dummy', [
            'methods'             => 'DELETE',
            'callback'            => [ Developer_Controller::class, 'delete_dummy' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/developer/rewrite-test', [
            'methods'             => 'GET',
            'callback'            => [ Developer_Controller::class, 'test_rewrite' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/developer/cache-keys', [
            'methods'             => 'GET',
            'callback'            => [ Developer_Controller::class, 'get_cache_keys' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/developer/cache-value', [
            'methods'             => 'GET',
            'callback'            => [ Developer_Controller::class, 'get_cache_value' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/developer/cache-key', [
            'methods'             => 'DELETE',
            'callback'            => [ Developer_Controller::class, 'delete_cache_key' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/developer/prefix-info', [
            'methods'             => 'GET',
            'callback'            => [ Developer_Controller::class, 'get_prefix_info' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
        register_rest_route( $namespace, '/developer/change-prefix', [
            'methods'             => 'POST',
            'callback'            => [ Developer_Controller::class, 'change_prefix' ],
            'permission_callback' => [ self::class, 'admin_permission' ],
        ] );
    }

    public static function admin_permission() {
        return current_user_can( 'manage_options' );
    }
}
