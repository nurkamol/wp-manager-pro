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
    }

    public static function admin_permission() {
        return current_user_can( 'manage_options' );
    }
}
