<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Redirects_Controller {

    private static $valid_types = [ 301, 302, 307 ];

    // ── REST Handlers ─────────────────────────────────────────────────────────

    public static function get_redirects( WP_REST_Request $request ) {
        global $wpdb;
        $table     = $wpdb->prefix . 'wmp_redirects';
        $search    = sanitize_text_field( $request->get_param( 'search' ) ?: '' );
        $per_page  = min( 200, max( 10, absint( $request->get_param( 'per_page' ) ) ?: 50 ) );
        $page      = max( 1, absint( $request->get_param( 'page' ) ) ?: 1 );
        $offset    = ( $page - 1 ) * $per_page;

        if ( $search ) {
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $total     = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $table WHERE source LIKE %s OR target LIKE %s", "%{$search}%", "%{$search}%" ) );
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $redirects = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $table WHERE source LIKE %s OR target LIKE %s ORDER BY id DESC LIMIT %d OFFSET %d", "%{$search}%", "%{$search}%", $per_page, $offset ) );
        } else {
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $total     = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table" );
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $redirects = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $table ORDER BY id DESC LIMIT %d OFFSET %d", $per_page, $offset ) );
        }

        return new WP_REST_Response( [
            'redirects'   => $redirects,
            'total'       => $total,
            'page'        => $page,
            'per_page'    => $per_page,
            'total_pages' => (int) ceil( $total / $per_page ),
        ], 200 );
    }

    public static function create_redirect( WP_REST_Request $request ) {
        global $wpdb;
        $table  = $wpdb->prefix . 'wmp_redirects';

        $source = '/' . ltrim( sanitize_text_field( $request->get_param( 'source' ) ?: '' ), '/' );
        $target = sanitize_text_field( $request->get_param( 'target' ) ?: '' );
        $type   = (int) ( $request->get_param( 'type' ) ?: 301 );

        if ( ! $source || ! $target ) {
            return new WP_Error( 'missing_param', 'Source and target are required.', [ 'status' => 400 ] );
        }
        if ( ! in_array( $type, self::$valid_types, true ) ) {
            return new WP_Error( 'invalid_type', 'Type must be 301, 302, or 307.', [ 'status' => 400 ] );
        }
        // Check duplicate source.
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        if ( $wpdb->get_var( $wpdb->prepare( "SELECT id FROM $table WHERE source = %s", $source ) ) ) {
            return new WP_Error( 'duplicate_source', 'A redirect from this source already exists.', [ 'status' => 409 ] );
        }

        $wpdb->insert( $table, [
            'source'     => $source,
            'target'     => $target,
            'type'       => $type,
            'hits'       => 0,
            'created_at' => current_time( 'mysql' ),
            'updated_at' => current_time( 'mysql' ),
        ], [ '%s', '%s', '%d', '%d', '%s', '%s' ] );

        $id       = $wpdb->insert_id;
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $redirect = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );

        return new WP_REST_Response( [ 'success' => true, 'redirect' => $redirect ], 201 );
    }

    public static function update_redirect( WP_REST_Request $request ) {
        global $wpdb;
        $table  = $wpdb->prefix . 'wmp_redirects';

        $id     = absint( $request->get_param( 'id' ) );
        $source = '/' . ltrim( sanitize_text_field( $request->get_param( 'source' ) ?: '' ), '/' );
        $target = sanitize_text_field( $request->get_param( 'target' ) ?: '' );
        $type   = (int) ( $request->get_param( 'type' ) ?: 301 );

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $existing = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );
        if ( ! $existing ) {
            return new WP_Error( 'not_found', 'Redirect not found.', [ 'status' => 404 ] );
        }
        if ( ! in_array( $type, self::$valid_types, true ) ) {
            return new WP_Error( 'invalid_type', 'Type must be 301, 302, or 307.', [ 'status' => 400 ] );
        }

        $wpdb->update( $table, [
            'source'     => $source ?: $existing->source,
            'target'     => $target ?: $existing->target,
            'type'       => $type,
            'updated_at' => current_time( 'mysql' ),
        ], [ 'id' => $id ], [ '%s', '%s', '%d', '%s' ], [ '%d' ] );

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $redirect = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );

        return new WP_REST_Response( [ 'success' => true, 'redirect' => $redirect ], 200 );
    }

    public static function delete_redirect( WP_REST_Request $request ) {
        global $wpdb;
        $table = $wpdb->prefix . 'wmp_redirects';
        $id    = absint( $request->get_param( 'id' ) );

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        if ( ! $wpdb->get_row( $wpdb->prepare( "SELECT id FROM $table WHERE id = %d", $id ) ) ) {
            return new WP_Error( 'not_found', 'Redirect not found.', [ 'status' => 404 ] );
        }
        $wpdb->delete( $table, [ 'id' => $id ], [ '%d' ] );

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    public static function export_csv( WP_REST_Request $request ) {
        global $wpdb;
        $table     = $wpdb->prefix . 'wmp_redirects';
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $redirects = $wpdb->get_results( "SELECT * FROM $table ORDER BY id ASC", ARRAY_A );

        $csv  = "ID,Source,Target,Type,Hits,Created At\n";
        foreach ( $redirects as $row ) {
            $csv .= implode( ',', array_map( function( $v ) {
                return '"' . str_replace( '"', '""', (string) $v ) . '"';
            }, $row ) ) . "\n";
        }

        $key          = wp_generate_password( 12, false );
        set_transient( 'wmp_redirects_export_' . $key, $csv, 120 );
        $nonce        = wp_create_nonce( 'wp_rest' );
        $download_url = rest_url( 'wp-manager-pro/v1/redirects/download' ) . '?key=' . $key . '&_wpnonce=' . $nonce;

        return new WP_REST_Response( [ 'success' => true, 'download_url' => $download_url ], 200 );
    }

    public static function download_csv( WP_REST_Request $request ) {
        $key = sanitize_text_field( $request->get_param( 'key' ) );
        $csv = get_transient( 'wmp_redirects_export_' . $key );

        if ( ! $csv ) {
            return new WP_Error( 'not_found', 'Export has expired.', [ 'status' => 404 ] );
        }
        delete_transient( 'wmp_redirects_export_' . $key );

        @ob_end_clean();
        header( 'Content-Type: text/csv; charset=utf-8' );
        header( 'Content-Disposition: attachment; filename="redirects-' . date( 'Y-m-d' ) . '.csv"' );
        header( 'Content-Length: ' . strlen( $csv ) );
        echo $csv; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        exit;
    }

    public static function import_csv( WP_REST_Request $request ) {
        global $wpdb;
        $table = $wpdb->prefix . 'wmp_redirects';
        $files = $request->get_file_params();

        if ( empty( $files['file'] ) || $files['file']['error'] !== UPLOAD_ERR_OK ) {
            return new WP_Error( 'missing_file', 'No valid CSV file uploaded.', [ 'status' => 400 ] );
        }

        $content = file_get_contents( $files['file']['tmp_name'] );
        $lines   = array_filter( array_map( 'trim', explode( "\n", $content ) ) );
        $count   = 0;

        foreach ( $lines as $i => $line ) {
            if ( $i === 0 && stripos( $line, 'source' ) !== false ) {
                continue; // Skip header row.
            }
            // Parse CSV line (handles quoted fields).
            $fields = str_getcsv( $line );
            if ( count( $fields ) < 2 ) {
                continue;
            }
            $source = '/' . ltrim( sanitize_text_field( $fields[0] ), '/' );
            $target = sanitize_text_field( $fields[1] );
            $type   = isset( $fields[2] ) ? (int) $fields[2] : 301;

            if ( ! $source || ! $target ) {
                continue;
            }
            if ( ! in_array( $type, self::$valid_types, true ) ) {
                $type = 301;
            }
            // Skip duplicates.
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            if ( $wpdb->get_var( $wpdb->prepare( "SELECT id FROM $table WHERE source = %s", $source ) ) ) {
                continue;
            }
            $wpdb->insert( $table, [
                'source'     => $source,
                'target'     => $target,
                'type'       => $type,
                'hits'       => 0,
                'created_at' => current_time( 'mysql' ),
                'updated_at' => current_time( 'mysql' ),
            ], [ '%s', '%s', '%d', '%d', '%s', '%s' ] );
            $count++;
        }

        return new WP_REST_Response( [ 'success' => true, 'imported' => $count ], 200 );
    }

    // ── Redirect Handler (template_redirect hook) ─────────────────────────────

    public static function handle_redirects() {
        if ( is_admin() || wp_doing_ajax() || wp_doing_cron() ) {
            return;
        }

        $request_uri = isset( $_SERVER['REQUEST_URI'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '/';
        // Strip query string for matching.
        $path = strtok( $request_uri, '?' );

        global $wpdb;
        $table    = $wpdb->prefix . 'wmp_redirects';
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $redirect = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE source = %s", $path ) );

        if ( ! $redirect ) {
            return;
        }

        // Increment hit counter (non-blocking).
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $wpdb->query( $wpdb->prepare( "UPDATE $table SET hits = hits + 1 WHERE id = %d", $redirect->id ) );

        $target = $redirect->target;
        // If target is relative, make it absolute.
        if ( ! preg_match( '/^https?:\/\//i', $target ) ) {
            $target = home_url( ltrim( $target, '/' ) );
        }

        wp_redirect( $target, (int) $redirect->type );
        exit;
    }
}
