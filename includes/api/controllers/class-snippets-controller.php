<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Snippets_Controller {

    // ── REST Handlers ─────────────────────────────────────────────────────────

    public static function get_snippets( WP_REST_Request $request ) {
        global $wpdb;
        $table    = $wpdb->prefix . 'wmp_snippets';
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $snippets = $wpdb->get_results( "SELECT * FROM $table ORDER BY id DESC" );
        // $wpdb->get_results() returns all columns as strings. Cast `enabled` to
        // integer so JavaScript receives 0/1 — not "0"/"1". In JS, !!"0" === true
        // (any non-empty string is truthy), which broke the enable/disable toggle.
        foreach ( (array) $snippets as $snippet ) {
            $snippet->enabled = (int) $snippet->enabled;
        }
        return new WP_REST_Response( [ 'snippets' => $snippets ], 200 );
    }

    public static function create_snippet( WP_REST_Request $request ) {
        global $wpdb;

        $title       = sanitize_text_field( $request->get_param( 'title' ) );
        $description = sanitize_textarea_field( $request->get_param( 'description' ) ?: '' );
        $code        = $request->get_param( 'code' );
        $type        = sanitize_text_field( $request->get_param( 'type' ) ?: 'php' );

        if ( ! $title || ! $code ) {
            return new WP_Error( 'missing_param', 'Title and code are required.', [ 'status' => 400 ] );
        }

        if ( ! in_array( $type, [ 'php', 'css', 'js' ], true ) ) {
            return new WP_Error( 'invalid_type', 'Type must be php, css, or js.', [ 'status' => 400 ] );
        }

        $table = $wpdb->prefix . 'wmp_snippets';
        $wpdb->insert( $table, [
            'title'       => $title,
            'description' => $description,
            'code'        => $code,
            'type'        => $type,
            'enabled'     => 0,
            'created_at'  => current_time( 'mysql' ),
            'updated_at'  => current_time( 'mysql' ),
        ], [ '%s', '%s', '%s', '%s', '%d', '%s', '%s' ] );

        $id = $wpdb->insert_id;
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $snippet          = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );
        $snippet->enabled = (int) $snippet->enabled;

        Audit_Controller::log( 'snippet.created', 'snippet', $title );

        return new WP_REST_Response( [ 'success' => true, 'snippet' => $snippet ], 201 );
    }

    public static function update_snippet( WP_REST_Request $request ) {
        global $wpdb;
        $table = $wpdb->prefix . 'wmp_snippets';

        $id          = absint( $request->get_param( 'id' ) );
        $title       = sanitize_text_field( $request->get_param( 'title' ) );
        $description = sanitize_textarea_field( $request->get_param( 'description' ) ?: '' );
        $code        = $request->get_param( 'code' );
        $type        = sanitize_text_field( $request->get_param( 'type' ) ?: 'php' );

        if ( ! $id ) {
            return new WP_Error( 'missing_param', 'ID is required.', [ 'status' => 400 ] );
        }

        if ( ! in_array( $type, [ 'php', 'css', 'js' ], true ) ) {
            return new WP_Error( 'invalid_type', 'Type must be php, css, or js.', [ 'status' => 400 ] );
        }

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $existing = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );
        if ( ! $existing ) {
            return new WP_Error( 'not_found', 'Snippet not found.', [ 'status' => 404 ] );
        }

        $wpdb->update( $table, [
            'title'       => $title ?: $existing->title,
            'description' => $description,
            'code'        => $code ?: $existing->code,
            'type'        => $type,
            'updated_at'  => current_time( 'mysql' ),
        ], [ 'id' => $id ], [ '%s', '%s', '%s', '%s', '%s' ], [ '%d' ] );

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $snippet          = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );
        $snippet->enabled = (int) $snippet->enabled;

        return new WP_REST_Response( [ 'success' => true, 'snippet' => $snippet ], 200 );
    }

    public static function toggle_snippet( WP_REST_Request $request ) {
        global $wpdb;
        $table = $wpdb->prefix . 'wmp_snippets';

        $id      = absint( $request->get_param( 'id' ) );
        $enabled = (bool) $request->get_param( 'enabled' );

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $snippet = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );
        if ( ! $snippet ) {
            return new WP_Error( 'not_found', 'Snippet not found.', [ 'status' => 404 ] );
        }

        $wpdb->update( $table, [
            'enabled'    => $enabled ? 1 : 0,
            'updated_at' => current_time( 'mysql' ),
        ], [ 'id' => $id ], [ '%d', '%s' ], [ '%d' ] );

        $action = $enabled ? 'snippet.enabled' : 'snippet.disabled';
        Audit_Controller::log( $action, 'snippet', $snippet->title );

        return new WP_REST_Response( [ 'success' => true, 'enabled' => $enabled ], 200 );
    }

    public static function delete_snippet( WP_REST_Request $request ) {
        global $wpdb;
        $table = $wpdb->prefix . 'wmp_snippets';
        $id    = absint( $request->get_param( 'id' ) );

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $snippet = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM $table WHERE id = %d", $id ) );
        if ( ! $snippet ) {
            return new WP_Error( 'not_found', 'Snippet not found.', [ 'status' => 404 ] );
        }

        $wpdb->delete( $table, [ 'id' => $id ], [ '%d' ] );
        Audit_Controller::log( 'snippet.deleted', 'snippet', $snippet->title );

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    // ── Snippet Execution (called via WP hooks) ───────────────────────────────

    public static function run_php_snippets() {
        global $wpdb;
        $table    = $wpdb->prefix . 'wmp_snippets';
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $snippets = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $table WHERE type = %s AND enabled = 1", 'php' ) );

        foreach ( (array) $snippets as $snippet ) {
            if ( empty( $snippet->code ) ) {
                continue;
            }
            $code = preg_replace( '/^<\?php\s*/i', '', trim( $snippet->code ) );
            $code = preg_replace( '/\s*\?>$/', '', $code );
            try {
                // phpcs:ignore Squiz.PHP.Eval.Discouraged
                eval( $code ); // Controlled execution of user-saved PHP snippets.
            } catch ( \Throwable $e ) {
                error_log( sprintf(
                    '[WP Manager Pro] Snippet "%s" (#%d) error: %s',
                    $snippet->title, $snippet->id, $e->getMessage()
                ) );
            }
        }
    }

    public static function output_css_snippets() {
        global $wpdb;
        $table    = $wpdb->prefix . 'wmp_snippets';
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $snippets = $wpdb->get_results( $wpdb->prepare( "SELECT code FROM $table WHERE type = %s AND enabled = 1", 'css' ) );
        if ( empty( $snippets ) ) {
            return;
        }
        echo "<style id=\"wmp-snippets-css\">\n";
        foreach ( $snippets as $s ) {
            echo $s->code . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        }
        echo "</style>\n";
    }

    public static function output_js_snippets() {
        global $wpdb;
        $table    = $wpdb->prefix . 'wmp_snippets';
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $snippets = $wpdb->get_results( $wpdb->prepare( "SELECT code FROM $table WHERE type = %s AND enabled = 1", 'js' ) );
        if ( empty( $snippets ) ) {
            return;
        }
        echo "<script id=\"wmp-snippets-js\">\n";
        foreach ( $snippets as $s ) {
            echo $s->code . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        }
        echo "</script>\n";
    }
}
