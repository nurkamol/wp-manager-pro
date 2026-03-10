<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Performance_Controller
 *
 * Handles database cleanup, transient management, and cache status
 * for WP Manager Pro v1.9.0.
 */
class Performance_Controller {

    /**
     * GET /wp-manager-pro/v1/performance/overview
     *
     * Returns counts for each cleanable item type + object cache status.
     */
    public static function get_overview( WP_REST_Request $request ) {
        global $wpdb;

        // Post revisions.
        $revisions = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'revision'"
        );

        // Auto-drafts.
        $auto_drafts = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_status = 'auto-draft'"
        );

        // Trashed posts (all post types).
        $trash = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_status = 'trash'"
        );

        // Spam comments.
        $spam_comments = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->comments} WHERE comment_approved = 'spam'"
        );

        // Unapproved / pending comments.
        $pending_comments = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->comments} WHERE comment_approved = '0'"
        );

        // Orphaned postmeta (rows whose post no longer exists).
        $orphaned_postmeta = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->postmeta} pm
             LEFT JOIN {$wpdb->posts} p ON p.ID = pm.post_id
             WHERE p.ID IS NULL"
        );

        // Orphaned commentmeta.
        $orphaned_commentmeta = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->commentmeta} cm
             LEFT JOIN {$wpdb->comments} c ON c.comment_ID = cm.comment_id
             WHERE c.comment_ID IS NULL"
        );

        // All transients count (non-timeout rows).
        $all_transients = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->options}
             WHERE option_name LIKE '_transient_%'
               AND option_name NOT LIKE '_transient_timeout_%'"
        );

        // Expired transients count.
        $now = time();
        $expired_transients = (int) $wpdb->get_var( $wpdb->prepare(
            "SELECT COUNT(*) FROM {$wpdb->options}
             WHERE option_name LIKE '_transient_timeout_%'
               AND option_value < %d",
            $now
        ) );

        // Estimated revision size (KB).
        $revision_size_kb = (int) $wpdb->get_var(
            "SELECT COALESCE(SUM(LENGTH(post_content) + LENGTH(post_title) + LENGTH(post_excerpt)), 0) / 1024
             FROM {$wpdb->posts} WHERE post_type = 'revision'"
        );

        // Object cache detection.
        $object_cache_enabled = wp_using_ext_object_cache();
        $object_cache_type    = 'None';
        if ( $object_cache_enabled ) {
            if ( class_exists( 'Redis' ) || defined( 'WP_REDIS_VERSION' ) || defined( 'WP_REDIS_OBJECT_CACHE' ) ) {
                $object_cache_type = 'Redis';
            } elseif ( class_exists( 'Memcache' ) || class_exists( 'Memcached' ) ) {
                $object_cache_type = 'Memcached';
            } else {
                $object_cache_type = 'External';
            }
        }

        return new WP_REST_Response( [
            'revisions'            => $revisions,
            'revision_size_kb'     => $revision_size_kb,
            'auto_drafts'          => $auto_drafts,
            'trash'                => $trash,
            'spam_comments'        => $spam_comments,
            'pending_comments'     => $pending_comments,
            'orphaned_postmeta'    => $orphaned_postmeta,
            'orphaned_commentmeta' => $orphaned_commentmeta,
            'all_transients'       => $all_transients,
            'expired_transients'   => $expired_transients,
            'object_cache_enabled' => $object_cache_enabled,
            'object_cache_type'    => $object_cache_type,
        ], 200 );
    }

    /**
     * GET /wp-manager-pro/v1/performance/transients
     *
     * Lists transients with optional search and pagination.
     */
    public static function get_transients( WP_REST_Request $request ) {
        global $wpdb;

        $search = sanitize_text_field( $request->get_param( 'search' ) ?? '' );
        $page   = max( 1, (int) ( $request->get_param( 'page' ) ?? 1 ) );
        $limit  = max( 1, min( 200, (int) ( $request->get_param( 'limit' ) ?? 50 ) ) );
        $offset = ( $page - 1 ) * $limit;
        $now    = time();

        if ( $search ) {
            $like  = '%_transient_' . $wpdb->esc_like( $search ) . '%';
            $total = (int) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->options}
                 WHERE option_name LIKE %s
                   AND option_name NOT LIKE '_transient_timeout_%'",
                $like
            ) );
            $rows = $wpdb->get_results( $wpdb->prepare(
                "SELECT o.option_name,
                        LENGTH(o.option_value) AS size_bytes,
                        t.option_value         AS expires_at
                 FROM {$wpdb->options} o
                 LEFT JOIN {$wpdb->options} t
                   ON t.option_name = CONCAT('_transient_timeout_', SUBSTRING(o.option_name, 12))
                 WHERE o.option_name LIKE %s
                   AND o.option_name NOT LIKE '_transient_timeout_%'
                 ORDER BY o.option_name ASC
                 LIMIT %d OFFSET %d",
                $like, $limit, $offset
            ) );
        } else {
            $total = (int) $wpdb->get_var(
                "SELECT COUNT(*) FROM {$wpdb->options}
                 WHERE option_name LIKE '_transient_%'
                   AND option_name NOT LIKE '_transient_timeout_%'"
            );
            $rows = $wpdb->get_results( $wpdb->prepare(
                "SELECT o.option_name,
                        LENGTH(o.option_value) AS size_bytes,
                        t.option_value         AS expires_at
                 FROM {$wpdb->options} o
                 LEFT JOIN {$wpdb->options} t
                   ON t.option_name = CONCAT('_transient_timeout_', SUBSTRING(o.option_name, 12))
                 WHERE o.option_name LIKE '_transient_%'
                   AND o.option_name NOT LIKE '_transient_timeout_%'
                 ORDER BY o.option_name ASC
                 LIMIT %d OFFSET %d",
                $limit, $offset
            ) );
        }

        $items = [];
        foreach ( $rows as $row ) {
            $name    = preg_replace( '/^_transient_/', '', $row->option_name );
            $expires = $row->expires_at ? (int) $row->expires_at : null;
            $items[] = [
                'name'       => $name,
                'size_bytes' => (int) $row->size_bytes,
                'expires_at' => $expires,
                'expired'    => $expires !== null && $expires < $now,
            ];
        }

        return new WP_REST_Response( [
            'items' => $items,
            'total' => $total,
            'page'  => $page,
            'limit' => $limit,
        ], 200 );
    }

    /**
     * DELETE /wp-manager-pro/v1/performance/transients
     *
     * Deletes a single transient by name (passed as ?name=).
     */
    public static function delete_transient_item( WP_REST_Request $request ) {
        $name = sanitize_text_field( $request->get_param( 'name' ) ?? '' );

        if ( ! $name ) {
            return new WP_Error( 'missing_name', 'Transient name is required.', [ 'status' => 400 ] );
        }

        delete_transient( $name );
        delete_site_transient( $name );

        return new WP_REST_Response( [ 'success' => true, 'deleted' => $name ], 200 );
    }

    /**
     * POST /wp-manager-pro/v1/performance/transients/purge-expired
     *
     * Deletes all expired transients (regular + site).
     */
    public static function purge_expired_transients( WP_REST_Request $request ) {
        global $wpdb;

        $now   = time();
        $count = 0;

        $expired = $wpdb->get_col( $wpdb->prepare(
            "SELECT REPLACE(option_name, '_transient_timeout_', '')
             FROM {$wpdb->options}
             WHERE option_name LIKE '_transient_timeout_%'
               AND option_value < %d",
            $now
        ) );
        foreach ( $expired as $name ) {
            delete_transient( $name );
            $count++;
        }

        $expired_site = $wpdb->get_col( $wpdb->prepare(
            "SELECT REPLACE(option_name, '_site_transient_timeout_', '')
             FROM {$wpdb->options}
             WHERE option_name LIKE '_site_transient_timeout_%'
               AND option_value < %d",
            $now
        ) );
        foreach ( $expired_site as $name ) {
            delete_site_transient( $name );
            $count++;
        }

        return new WP_REST_Response( [
            'success' => true,
            'deleted' => $count,
            'message' => "$count expired transient(s) deleted.",
        ], 200 );
    }

    /**
     * POST /wp-manager-pro/v1/performance/cleanup
     *
     * Runs selected cleanup operations.
     * Body: { types: string[] }
     */
    public static function run_cleanup( WP_REST_Request $request ) {
        global $wpdb;

        $types = (array) $request->get_param( 'types' );

        if ( empty( $types ) ) {
            return new WP_Error( 'missing_types', 'At least one cleanup type must be specified.', [ 'status' => 400 ] );
        }

        $valid_types = [
            'revisions', 'auto_drafts', 'trash',
            'spam_comments', 'pending_comments',
            'orphaned_postmeta', 'orphaned_commentmeta',
            'expired_transients',
        ];

        $results = [];

        foreach ( $types as $type ) {
            $type = sanitize_key( $type );

            if ( ! in_array( $type, $valid_types, true ) ) {
                continue;
            }

            switch ( $type ) {

                case 'revisions':
                    $ids   = $wpdb->get_col( "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'revision'" );
                    $count = 0;
                    foreach ( $ids as $id ) {
                        wp_delete_post_revision( (int) $id );
                        $count++;
                    }
                    $results['revisions'] = $count;
                    break;

                case 'auto_drafts':
                    $ids   = $wpdb->get_col( "SELECT ID FROM {$wpdb->posts} WHERE post_status = 'auto-draft'" );
                    $count = 0;
                    foreach ( $ids as $id ) {
                        wp_delete_post( (int) $id, true );
                        $count++;
                    }
                    $results['auto_drafts'] = $count;
                    break;

                case 'trash':
                    $ids   = $wpdb->get_col( "SELECT ID FROM {$wpdb->posts} WHERE post_status = 'trash'" );
                    $count = 0;
                    foreach ( $ids as $id ) {
                        wp_delete_post( (int) $id, true );
                        $count++;
                    }
                    $results['trash'] = $count;
                    break;

                case 'spam_comments':
                    $ids   = $wpdb->get_col( "SELECT comment_ID FROM {$wpdb->comments} WHERE comment_approved = 'spam'" );
                    $count = 0;
                    foreach ( $ids as $id ) {
                        wp_delete_comment( (int) $id, true );
                        $count++;
                    }
                    $results['spam_comments'] = $count;
                    break;

                case 'pending_comments':
                    $ids   = $wpdb->get_col( "SELECT comment_ID FROM {$wpdb->comments} WHERE comment_approved = '0'" );
                    $count = 0;
                    foreach ( $ids as $id ) {
                        wp_delete_comment( (int) $id, true );
                        $count++;
                    }
                    $results['pending_comments'] = $count;
                    break;

                case 'orphaned_postmeta':
                    $deleted = $wpdb->query(
                        "DELETE pm FROM {$wpdb->postmeta} pm
                         LEFT JOIN {$wpdb->posts} p ON p.ID = pm.post_id
                         WHERE p.ID IS NULL"
                    );
                    $results['orphaned_postmeta'] = (int) $deleted;
                    break;

                case 'orphaned_commentmeta':
                    $deleted = $wpdb->query(
                        "DELETE cm FROM {$wpdb->commentmeta} cm
                         LEFT JOIN {$wpdb->comments} c ON c.comment_ID = cm.comment_id
                         WHERE c.comment_ID IS NULL"
                    );
                    $results['orphaned_commentmeta'] = (int) $deleted;
                    break;

                case 'expired_transients':
                    $now          = time();
                    $expired      = $wpdb->get_col( $wpdb->prepare(
                        "SELECT REPLACE(option_name, '_transient_timeout_', '')
                         FROM {$wpdb->options}
                         WHERE option_name LIKE '_transient_timeout_%'
                           AND option_value < %d",
                        $now
                    ) );
                    $count = 0;
                    foreach ( $expired as $name ) {
                        delete_transient( $name );
                        $count++;
                    }
                    $expired_site = $wpdb->get_col( $wpdb->prepare(
                        "SELECT REPLACE(option_name, '_site_transient_timeout_', '')
                         FROM {$wpdb->options}
                         WHERE option_name LIKE '_site_transient_timeout_%'
                           AND option_value < %d",
                        $now
                    ) );
                    foreach ( $expired_site as $name ) {
                        delete_site_transient( $name );
                        $count++;
                    }
                    $results['expired_transients'] = $count;
                    break;
            }
        }

        return new WP_REST_Response( [
            'success' => true,
            'results' => $results,
        ], 200 );
    }
}
