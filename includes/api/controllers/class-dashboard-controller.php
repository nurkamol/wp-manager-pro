<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;

class Dashboard_Controller {

    public static function get_stats( WP_REST_Request $request ) {
        global $wpdb;

        // WordPress info.
        $wp_version = get_bloginfo( 'version' );
        $site_url   = get_site_url();
        $site_name  = get_bloginfo( 'name' );

        // Count posts & pages.
        $post_count = wp_count_posts( 'post' );
        $page_count = wp_count_posts( 'page' );

        // Count plugins.
        if ( ! function_exists( 'get_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        $all_plugins    = get_plugins();
        $active_plugins = get_option( 'active_plugins', [] );

        // Count themes.
        $all_themes    = wp_get_themes();
        $active_theme  = wp_get_theme();

        // Count users.
        $user_count = count_users();

        // Database size.
        $db_size = $wpdb->get_var(
            "SELECT SUM(data_length + index_length) / 1024 / 1024
             FROM information_schema.tables
             WHERE table_schema = '{$wpdb->dbname}'"
        );

        // Recent activity (recent posts).
        $recent_posts = get_posts( [
            'numberposts' => 5,
            'post_status' => 'publish',
            'orderby'     => 'date',
            'order'       => 'DESC',
        ] );

        $recent = array_map( function( $post ) {
            return [
                'id'    => $post->ID,
                'title' => $post->post_title,
                'date'  => $post->post_date,
                'url'   => get_permalink( $post->ID ),
            ];
        }, $recent_posts );

        // PHP info.
        $php_version    = PHP_VERSION;
        $memory_limit   = ini_get( 'memory_limit' );
        $upload_max     = ini_get( 'upload_max_filesize' );
        $max_exec_time  = ini_get( 'max_execution_time' );

        // Check WordPress health issues.
        $is_debug       = defined( 'WP_DEBUG' ) && WP_DEBUG;
        $is_maintenance = file_exists( ABSPATH . '.maintenance' );

        // Updates available.
        $plugin_updates = 0;
        $update_plugins = get_site_transient( 'update_plugins' );
        if ( $update_plugins && isset( $update_plugins->response ) ) {
            $plugin_updates = count( $update_plugins->response );
        }

        $theme_updates = 0;
        $update_themes = get_site_transient( 'update_themes' );
        if ( $update_themes && isset( $update_themes->response ) ) {
            $theme_updates = count( $update_themes->response );
        }

        // Core update.
        $core_update = false;
        if ( ! function_exists( 'get_core_updates' ) ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }
        $core_updates = get_core_updates();
        if ( ! empty( $core_updates ) && 'upgrade' === $core_updates[0]->response ) {
            $core_update = $core_updates[0]->version;
        }

        // Disk usage.
        $upload_dir  = wp_upload_dir();
        $uploads_size = self::get_dir_size( $upload_dir['basedir'] );

        return new WP_REST_Response( [
            'site' => [
                'name'    => $site_name,
                'url'     => $site_url,
                'wp'      => $wp_version,
                'php'     => $php_version,
                'debug'   => $is_debug,
                'maintenance' => $is_maintenance,
            ],
            'counts' => [
                'posts'          => (int) ( $post_count->publish ?? 0 ),
                'pages'          => (int) ( $page_count->publish ?? 0 ),
                'plugins'        => count( $all_plugins ),
                'active_plugins' => count( $active_plugins ),
                'themes'         => count( $all_themes ),
                'users'          => $user_count['total_users'],
            ],
            'updates' => [
                'plugins' => $plugin_updates,
                'themes'  => $theme_updates,
                'core'    => $core_update,
            ],
            'system' => [
                'memory_limit'  => $memory_limit,
                'upload_max'    => $upload_max,
                'max_exec_time' => $max_exec_time,
                'db_size'       => round( (float) $db_size, 2 ),
                'uploads_size'  => self::format_bytes( $uploads_size ),
            ],
            'active_theme'  => $active_theme->get( 'Name' ),
            'recent_posts'  => $recent,
        ], 200 );
    }

    private static function get_dir_size( $path ) {
        $size = 0;
        if ( ! is_dir( $path ) ) return $size;
        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator( $path, \FilesystemIterator::SKIP_DOTS )
        );
        foreach ( $iterator as $file ) {
            if ( $file->isFile() ) {
                $size += $file->getSize();
            }
        }
        return $size;
    }

    private static function format_bytes( $bytes ) {
        if ( $bytes >= 1073741824 ) {
            return number_format( $bytes / 1073741824, 2 ) . ' GB';
        } elseif ( $bytes >= 1048576 ) {
            return number_format( $bytes / 1048576, 2 ) . ' MB';
        } elseif ( $bytes >= 1024 ) {
            return number_format( $bytes / 1024, 2 ) . ' KB';
        }
        return $bytes . ' B';
    }
}
