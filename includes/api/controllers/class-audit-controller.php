<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Audit_Controller {

    // ── REST Handlers ─────────────────────────────────────────────────────────

    public static function get_logs( WP_REST_Request $request ) {
        global $wpdb;
        $table = $wpdb->prefix . 'wmp_audit_log';

        $page     = max( 1, absint( $request->get_param( 'page' ) ) ?: 1 );
        $per_page = min( 200, max( 10, absint( $request->get_param( 'per_page' ) ) ?: 50 ) );
        $action   = sanitize_text_field( $request->get_param( 'action_type' ) ?: '' );
        $user_id  = absint( $request->get_param( 'user_id' ) ?: 0 );
        $from     = sanitize_text_field( $request->get_param( 'from' ) ?: '' );
        $to       = sanitize_text_field( $request->get_param( 'to' ) ?: '' );

        $where  = '1=1';
        $params = [];

        if ( $action ) {
            $where   .= ' AND action = %s';
            $params[] = $action;
        }
        if ( $user_id ) {
            $where   .= ' AND user_id = %d';
            $params[] = $user_id;
        }
        if ( $from ) {
            $where   .= ' AND created_at >= %s';
            $params[] = $from . ' 00:00:00';
        }
        if ( $to ) {
            $where   .= ' AND created_at <= %s';
            $params[] = $to . ' 23:59:59';
        }

        $offset = ( $page - 1 ) * $per_page;

        if ( $params ) {
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $total = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $table WHERE $where", ...$params ) );
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $logs  = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $table WHERE $where ORDER BY created_at DESC LIMIT %d OFFSET %d", ...array_merge( $params, [ $per_page, $offset ] ) ) );
        } else {
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $total = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table" );
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $logs  = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $table ORDER BY created_at DESC LIMIT %d OFFSET %d", $per_page, $offset ) );
        }

        return new WP_REST_Response( [
            'logs'        => $logs,
            'total'       => $total,
            'page'        => $page,
            'per_page'    => $per_page,
            'total_pages' => (int) ceil( $total / $per_page ),
        ], 200 );
    }

    public static function clear_logs( WP_REST_Request $request ) {
        global $wpdb;
        $table = $wpdb->prefix . 'wmp_audit_log';
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $wpdb->query( "TRUNCATE TABLE $table" );
        self::log( 'audit.cleared', 'log', 'All audit logs cleared' );
        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    public static function export_logs( WP_REST_Request $request ) {
        global $wpdb;
        $table = $wpdb->prefix . 'wmp_audit_log';
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $logs  = $wpdb->get_results( "SELECT * FROM $table ORDER BY created_at DESC", ARRAY_A );

        $csv  = "ID,User ID,User,Action,Object Type,Object Name,Extra,IP Address,Date\n";
        foreach ( $logs as $row ) {
            $csv .= implode( ',', array_map( function( $v ) {
                return '"' . str_replace( '"', '""', (string) $v ) . '"';
            }, $row ) ) . "\n";
        }

        $key          = wp_generate_password( 12, false );
        set_transient( 'wmp_audit_export_' . $key, $csv, 120 );
        $nonce        = wp_create_nonce( 'wp_rest' );
        $download_url = rest_url( 'wp-manager-pro/v1/audit/download' ) . '?key=' . $key . '&_wpnonce=' . $nonce;

        return new WP_REST_Response( [ 'success' => true, 'download_url' => $download_url ], 200 );
    }

    public static function download_export( WP_REST_Request $request ) {
        $key = sanitize_text_field( $request->get_param( 'key' ) );
        $csv = get_transient( 'wmp_audit_export_' . $key );

        if ( ! $csv ) {
            return new WP_Error( 'not_found', 'Export has expired.', [ 'status' => 404 ] );
        }
        delete_transient( 'wmp_audit_export_' . $key );

        @ob_end_clean();
        header( 'Content-Type: text/csv; charset=utf-8' );
        header( 'Content-Disposition: attachment; filename="audit-log-' . date( 'Y-m-d' ) . '.csv"' );
        header( 'Content-Length: ' . strlen( $csv ) );
        echo $csv; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        exit;
    }

    public static function get_action_types( WP_REST_Request $request ) {
        global $wpdb;
        $table = $wpdb->prefix . 'wmp_audit_log';
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $types = $wpdb->get_col( "SELECT DISTINCT action FROM $table ORDER BY action ASC" );
        return new WP_REST_Response( [ 'types' => $types ], 200 );
    }

    // ── Logger (called from other controllers + WP hooks) ────────────────────

    public static function log( string $action, string $object_type = '', string $object_name = '', array $extra = [] ) {
        global $wpdb;
        $table   = $wpdb->prefix . 'wmp_audit_log';
        $user    = wp_get_current_user();
        $user_id = $user ? $user->ID : 0;
        $uname   = $user ? $user->user_login : 'system';
        $ip      = self::get_ip();

        $wpdb->insert( $table, [
            'user_id'     => $user_id,
            'user_name'   => $uname,
            'action'      => $action,
            'object_type' => $object_type,
            'object_name' => $object_name,
            'extra'       => $extra ? wp_json_encode( $extra ) : null,
            'ip_address'  => $ip,
            'created_at'  => current_time( 'mysql' ),
        ], [ '%d', '%s', '%s', '%s', '%s', '%s', '%s', '%s' ] );
    }

    private static function get_ip(): string {
        foreach ( [ 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR' ] as $key ) {
            if ( ! empty( $_SERVER[ $key ] ) ) {
                $ip = explode( ',', sanitize_text_field( wp_unslash( $_SERVER[ $key ] ) ) );
                return trim( $ip[0] );
            }
        }
        return '';
    }

    // ── WordPress Event Hooks ─────────────────────────────────────────────────

    public static function on_plugin_activated( string $plugin ) {
        $data = get_plugins()[ $plugin ] ?? [];
        self::log( 'plugin.activated', 'plugin', $data['Name'] ?? $plugin );
    }

    public static function on_plugin_deactivated( string $plugin ) {
        $data = get_plugins()[ $plugin ] ?? [];
        self::log( 'plugin.deactivated', 'plugin', $data['Name'] ?? $plugin );
    }

    public static function on_plugin_deleted( string $plugin, bool $deleted ) {
        if ( $deleted ) {
            self::log( 'plugin.deleted', 'plugin', $plugin );
        }
    }

    public static function on_theme_switched( string $new_name ) {
        self::log( 'theme.activated', 'theme', $new_name );
    }

    public static function on_user_login( string $user_login ) {
        self::log( 'user.login', 'user', $user_login );
    }

    public static function on_user_logout( int $user_id ) {
        $user = get_user_by( 'id', $user_id );
        self::log( 'user.logout', 'user', $user ? $user->user_login : "#{$user_id}" );
    }

    public static function on_login_failed( string $username ) {
        self::log( 'user.login_failed', 'user', $username, [ 'ip' => self::get_ip() ] );
    }

    public static function on_user_registered( int $user_id ) {
        $user = get_user_by( 'id', $user_id );
        self::log( 'user.registered', 'user', $user ? $user->user_login : "#{$user_id}" );
    }

    public static function on_post_published( string $new_status, string $old_status, \WP_Post $post ) {
        if ( 'publish' === $new_status && 'publish' !== $old_status && ! wp_is_post_revision( $post ) ) {
            self::log( 'content.published', $post->post_type, $post->post_title );
        }
    }
}
