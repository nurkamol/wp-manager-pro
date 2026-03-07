<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Reset_Controller
 *
 * Provides site-reset endpoints for WP Manager Pro.
 * Allows bulk deletion of posts, pages, comments, media, and non-admin users.
 * All destructive operations require explicit confirmation via the `confirm` parameter.
 */
class Reset_Controller {

    /**
     * GET /wp-manager-pro/v1/reset/status
     *
     * Returns a count summary of content that would be deleted by execute_reset.
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response
     */
    public static function get_status( WP_REST_Request $request ) {
        // Count posts (post_type = 'post').
        $posts_query = new \WP_Query( [
            'post_type'      => 'post',
            'post_status'    => 'any',
            'posts_per_page' => -1,
            'fields'         => 'ids',
            'no_found_rows'  => false,
        ] );
        $posts_count = $posts_query->found_posts;

        // Count pages.
        $pages_query = new \WP_Query( [
            'post_type'      => 'page',
            'post_status'    => 'any',
            'posts_per_page' => -1,
            'fields'         => 'ids',
            'no_found_rows'  => false,
        ] );
        $pages_count = $pages_query->found_posts;

        // Count comments.
        $comments_count = (int) ( new \WP_Comment_Query( [
            'count'  => true,
            'status' => 'all',
        ] ) )->query( [
            'count'  => true,
            'status' => 'all',
        ] );

        // Count media (attachments).
        $media_query = new \WP_Query( [
            'post_type'      => 'attachment',
            'post_status'    => 'any',
            'posts_per_page' => -1,
            'fields'         => 'ids',
            'no_found_rows'  => false,
        ] );
        $media_count = $media_query->found_posts;

        // Count non-admin users.
        $non_admin_query = new \WP_User_Query( [
            'role__not_in' => [ 'administrator' ],
            'fields'       => 'ids',
            'number'       => -1,
        ] );
        $non_admin_count = (int) $non_admin_query->get_total();

        return new WP_REST_Response( [
            'posts'           => (int) $posts_count,
            'pages'           => (int) $pages_count,
            'comments'        => (int) $comments_count,
            'media'           => (int) $media_count,
            'users_non_admin' => (int) $non_admin_count,
        ], 200 );
    }

    /**
     * POST /wp-manager-pro/v1/reset/execute
     *
     * Executes the reset for the specified content types.
     *
     * @param WP_REST_Request $request
     * @return WP_REST_Response|WP_Error
     */
    public static function execute_reset( WP_REST_Request $request ) {
        global $wpdb;

        $confirm = (bool) $request->get_param( 'confirm' );

        if ( ! $confirm ) {
            return new WP_Error(
                'confirmation_required',
                'You must pass confirm=true to execute a reset. This action is irreversible.',
                [ 'status' => 400 ]
            );
        }

        $types = (array) $request->get_param( 'types' );

        if ( empty( $types ) ) {
            return new WP_Error( 'missing_types', 'At least one type must be specified.', [ 'status' => 400 ] );
        }

        $valid_types = [ 'posts', 'pages', 'comments', 'media', 'users_non_admin' ];
        $results     = [];

        foreach ( $types as $type ) {
            $type = sanitize_key( $type );

            if ( ! in_array( $type, $valid_types, true ) ) {
                continue;
            }

            switch ( $type ) {

                case 'posts':
                    $posts = get_posts( [
                        'post_type'   => 'post',
                        'post_status' => 'any',
                        'numberposts' => -1,
                        'fields'      => 'ids',
                    ] );
                    $count = 0;
                    foreach ( $posts as $post_id ) {
                        if ( wp_delete_post( (int) $post_id, true ) ) {
                            $count++;
                        }
                    }
                    $results['posts'] = $count;
                    break;

                case 'pages':
                    $pages = get_posts( [
                        'post_type'   => 'page',
                        'post_status' => 'any',
                        'numberposts' => -1,
                        'fields'      => 'ids',
                    ] );
                    $count = 0;
                    foreach ( $pages as $page_id ) {
                        if ( wp_delete_post( (int) $page_id, true ) ) {
                            $count++;
                        }
                    }
                    $results['pages'] = $count;
                    break;

                case 'comments':
                    $wpdb->query( "DELETE FROM {$wpdb->comments}" );
                    $wpdb->query( "DELETE FROM {$wpdb->commentmeta}" );
                    $results['comments'] = (int) $wpdb->rows_affected;
                    break;

                case 'media':
                    $attachments = get_posts( [
                        'post_type'   => 'attachment',
                        'post_status' => 'any',
                        'numberposts' => -1,
                        'fields'      => 'ids',
                    ] );
                    $count = 0;
                    foreach ( $attachments as $attachment_id ) {
                        // true = delete from filesystem as well.
                        if ( wp_delete_attachment( (int) $attachment_id, true ) ) {
                            $count++;
                        }
                    }
                    $results['media'] = $count;
                    break;

                case 'users_non_admin':
                    if ( ! function_exists( 'wp_delete_user' ) ) {
                        require_once ABSPATH . 'wp-admin/includes/user.php';
                    }

                    // Find the first administrator to reassign content to.
                    $admin_query = new \WP_User_Query( [
                        'role'   => 'administrator',
                        'number' => 1,
                        'fields' => 'ids',
                    ] );
                    $admin_ids    = $admin_query->get_results();
                    $reassign_to  = ! empty( $admin_ids ) ? (int) $admin_ids[0] : 1;

                    $non_admin_query = new \WP_User_Query( [
                        'role__not_in' => [ 'administrator' ],
                        'fields'       => 'ids',
                        'number'       => -1,
                    ] );
                    $non_admin_ids = $non_admin_query->get_results();

                    $count = 0;
                    foreach ( $non_admin_ids as $uid ) {
                        $uid = (int) $uid;
                        // Skip the current user just in case they somehow lack admin role.
                        if ( $uid === get_current_user_id() ) {
                            continue;
                        }
                        if ( wp_delete_user( $uid, $reassign_to ) ) {
                            $count++;
                        }
                    }
                    $results['users_non_admin'] = $count;
                    break;
            }
        }

        return new WP_REST_Response( [
            'success' => true,
            'results' => $results,
            'message' => 'Reset completed successfully.',
        ], 200 );
    }
}
