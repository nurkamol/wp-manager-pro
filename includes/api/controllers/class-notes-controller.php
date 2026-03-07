<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Notes_Controller {

    private static function table_name() {
        global $wpdb;
        return $wpdb->prefix . 'wmp_notes';
    }

    public static function get_notes( WP_REST_Request $request ) {
        global $wpdb;
        $table = self::table_name();

        $notes = $wpdb->get_results(
            "SELECT * FROM `{$table}` ORDER BY updated_at DESC",
            ARRAY_A
        );

        return new WP_REST_Response( [ 'notes' => $notes, 'total' => count( $notes ) ], 200 );
    }

    public static function create_note( WP_REST_Request $request ) {
        global $wpdb;

        $title   = sanitize_text_field( $request->get_param( 'title' ) );
        $content = wp_kses_post( $request->get_param( 'content' ) );
        $color   = sanitize_text_field( $request->get_param( 'color' ) ) ?: 'default';

        if ( ! $title ) {
            return new WP_Error( 'missing_param', 'Title is required.', [ 'status' => 400 ] );
        }

        $table = self::table_name();

        $result = $wpdb->insert( $table, [
            'title'   => $title,
            'content' => $content,
            'color'   => $color,
        ] );

        if ( $result === false ) {
            return new WP_Error( 'create_failed', 'Failed to create note.', [ 'status' => 500 ] );
        }

        $note = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM `{$table}` WHERE id = %d", $wpdb->insert_id ), ARRAY_A );

        return new WP_REST_Response( [ 'success' => true, 'note' => $note ], 201 );
    }

    public static function update_note( WP_REST_Request $request ) {
        global $wpdb;

        $id      = absint( $request->get_param( 'id' ) );
        $title   = sanitize_text_field( $request->get_param( 'title' ) );
        $content = wp_kses_post( $request->get_param( 'content' ) );
        $color   = sanitize_text_field( $request->get_param( 'color' ) );

        $table = self::table_name();

        $data = [];
        if ( $title )   $data['title']   = $title;
        if ( $content !== null ) $data['content'] = $content;
        if ( $color )   $data['color']   = $color;

        if ( empty( $data ) ) {
            return new WP_Error( 'missing_params', 'No data to update.', [ 'status' => 400 ] );
        }

        $result = $wpdb->update( $table, $data, [ 'id' => $id ] );

        if ( $result === false ) {
            return new WP_Error( 'update_failed', 'Failed to update note.', [ 'status' => 500 ] );
        }

        $note = $wpdb->get_row( $wpdb->prepare( "SELECT * FROM `{$table}` WHERE id = %d", $id ), ARRAY_A );

        return new WP_REST_Response( [ 'success' => true, 'note' => $note ], 200 );
    }

    public static function delete_note( WP_REST_Request $request ) {
        global $wpdb;

        $id    = absint( $request->get_param( 'id' ) );
        $table = self::table_name();

        $result = $wpdb->delete( $table, [ 'id' => $id ] );

        if ( $result === false ) {
            return new WP_Error( 'delete_failed', 'Failed to delete note.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => 'Note deleted.' ], 200 );
    }
}
