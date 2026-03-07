<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;

class System_Controller {

    public static function get_info( WP_REST_Request $request ) {
        global $wpdb;

        // WordPress info.
        $wp = [
            'version'        => get_bloginfo( 'version' ),
            'site_url'       => get_site_url(),
            'home_url'       => get_home_url(),
            'admin_email'    => get_option( 'admin_email' ),
            'language'       => get_locale(),
            'timezone'       => wp_timezone_string(),
            'charset'        => get_option( 'blog_charset' ),
            'multisite'      => is_multisite(),
            'memory_limit'   => WP_MEMORY_LIMIT,
            'max_memory'     => defined( 'WP_MAX_MEMORY_LIMIT' ) ? WP_MAX_MEMORY_LIMIT : 'N/A',
            'debug'          => defined( 'WP_DEBUG' ) && WP_DEBUG,
            'debug_log'      => defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG,
            'debug_display'  => defined( 'WP_DEBUG_DISPLAY' ) && WP_DEBUG_DISPLAY,
            'table_prefix'   => $wpdb->prefix,
            'uploads_dir'    => wp_upload_dir()['basedir'],
        ];

        // PHP info.
        $php = [
            'version'           => PHP_VERSION,
            'os'                => PHP_OS,
            'sapi'              => PHP_SAPI,
            'memory_limit'      => ini_get( 'memory_limit' ),
            'max_exec_time'     => ini_get( 'max_execution_time' ),
            'upload_max'        => ini_get( 'upload_max_filesize' ),
            'post_max_size'     => ini_get( 'post_max_size' ),
            'max_input_vars'    => ini_get( 'max_input_vars' ),
            'max_input_time'    => ini_get( 'max_input_time' ),
            'display_errors'    => ini_get( 'display_errors' ),
            'short_tags'        => ini_get( 'short_open_tag' ),
            'output_buffering'  => ini_get( 'output_buffering' ),
            'extensions'        => get_loaded_extensions(),
            'disabled_funcs'    => ini_get( 'disable_functions' ),
            'curl'              => function_exists( 'curl_version' ),
            'gd'                => extension_loaded( 'gd' ),
            'imagick'           => extension_loaded( 'imagick' ),
            'mbstring'          => extension_loaded( 'mbstring' ),
            'openssl'           => extension_loaded( 'openssl' ),
            'zip'               => extension_loaded( 'zip' ),
            'intl'              => extension_loaded( 'intl' ),
            'opcache'           => extension_loaded( 'Zend OPcache' ),
        ];

        // Database info.
        $db = [
            'host'      => DB_HOST,
            'name'      => DB_NAME,
            'user'      => DB_USER,
            'charset'   => DB_CHARSET,
            'collate'   => DB_COLLATE,
            'version'   => $wpdb->db_version(),
            'prefix'    => $wpdb->prefix,
            'size'      => self::get_db_size(),
        ];

        // Server info.
        $server = [
            'software'   => isset( $_SERVER['SERVER_SOFTWARE'] ) ? sanitize_text_field( $_SERVER['SERVER_SOFTWARE'] ) : 'Unknown',
            'ip'         => isset( $_SERVER['SERVER_ADDR'] ) ? sanitize_text_field( $_SERVER['SERVER_ADDR'] ) : 'Unknown',
            'port'       => isset( $_SERVER['SERVER_PORT'] ) ? (int) $_SERVER['SERVER_PORT'] : 80,
            'protocol'   => isset( $_SERVER['SERVER_PROTOCOL'] ) ? sanitize_text_field( $_SERVER['SERVER_PROTOCOL'] ) : 'HTTP/1.1',
            'https'      => is_ssl(),
            'disk_free'  => self::format_bytes( disk_free_space( ABSPATH ) ),
            'disk_total' => self::format_bytes( disk_total_space( ABSPATH ) ),
        ];

        // Active plugins.
        if ( ! function_exists( 'get_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        $active_plugin_slugs = get_option( 'active_plugins', [] );
        $all_plugins         = get_plugins();
        $active_plugins_list = [];
        foreach ( $active_plugin_slugs as $slug ) {
            if ( isset( $all_plugins[ $slug ] ) ) {
                $active_plugins_list[] = [
                    'name'    => $all_plugins[ $slug ]['Name'],
                    'version' => $all_plugins[ $slug ]['Version'],
                    'file'    => $slug,
                ];
            }
        }

        // WordPress constants.
        $constants = [
            'ABSPATH'            => ABSPATH,
            'WP_CONTENT_DIR'     => WP_CONTENT_DIR,
            'WP_PLUGIN_DIR'      => WP_PLUGIN_DIR,
            'WP_DEBUG'           => defined( 'WP_DEBUG' ) ? ( WP_DEBUG ? 'true' : 'false' ) : 'not defined',
            'SAVEQUERIES'        => defined( 'SAVEQUERIES' ) ? ( SAVEQUERIES ? 'true' : 'false' ) : 'not defined',
            'WP_DISABLE_FATAL_ERROR_HANDLER' => defined( 'WP_DISABLE_FATAL_ERROR_HANDLER' ) ? ( WP_DISABLE_FATAL_ERROR_HANDLER ? 'true' : 'false' ) : 'not defined',
            'FORCE_SSL_ADMIN'    => defined( 'FORCE_SSL_ADMIN' ) ? ( FORCE_SSL_ADMIN ? 'true' : 'false' ) : 'not defined',
            'DISALLOW_FILE_EDIT' => defined( 'DISALLOW_FILE_EDIT' ) ? ( DISALLOW_FILE_EDIT ? 'true' : 'false' ) : 'not defined',
            'DISALLOW_FILE_MODS' => defined( 'DISALLOW_FILE_MODS' ) ? ( DISALLOW_FILE_MODS ? 'true' : 'false' ) : 'not defined',
        ];

        // Scheduled cron jobs.
        $cron_events = [];
        $crons = _get_cron_array();
        if ( $crons ) {
            foreach ( $crons as $timestamp => $cron ) {
                foreach ( $cron as $hook => $events ) {
                    foreach ( $events as $key => $event ) {
                        $cron_events[] = [
                            'hook'      => $hook,
                            'schedule'  => $event['schedule'] ?? 'once',
                            'next_run'  => human_time_diff( $timestamp ) . ' ago',
                            'timestamp' => $timestamp,
                        ];
                    }
                }
            }
        }

        return new WP_REST_Response( [
            'wordpress'     => $wp,
            'php'           => $php,
            'database'      => $db,
            'server'        => $server,
            'constants'     => $constants,
            'active_plugins' => $active_plugins_list,
            'cron'          => array_slice( $cron_events, 0, 20 ),
        ], 200 );
    }

    private static function get_db_size() {
        global $wpdb;
        $size = $wpdb->get_var(
            "SELECT SUM(data_length + index_length) / 1024 / 1024
             FROM information_schema.tables
             WHERE table_schema = '{$wpdb->dbname}'"
        );
        return round( (float) $size, 2 ) . ' MB';
    }

    private static function format_bytes( $bytes ) {
        if ( $bytes >= 1073741824 ) return number_format( $bytes / 1073741824, 2 ) . ' GB';
        if ( $bytes >= 1048576 ) return number_format( $bytes / 1048576, 2 ) . ' MB';
        if ( $bytes >= 1024 ) return number_format( $bytes / 1024, 2 ) . ' KB';
        return $bytes . ' B';
    }
}
