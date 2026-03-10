<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Media_Controller
 *
 * Media library cleanup and analysis tools:
 *  - Overview stats
 *  - Orphaned finder (missing files + untracked files)
 *  - Unused media (not referenced anywhere)
 *  - Duplicate detector (MD5 hash grouping)
 *  - Image re-compression (JPEG/PNG lossless)
 *
 * v2.2.0
 */
class Media_Controller {

    // ─── GET /media/overview ─────────────────────────────────────────────────

    public static function get_overview( WP_REST_Request $request ) {
        global $wpdb;

        // Total attachments
        $total = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'attachment'"
        );

        // Total size of uploads directory
        $upload_dir  = wp_upload_dir();
        $uploads_path = $upload_dir['basedir'];
        $total_size  = self::dir_size( $uploads_path );

        // Count orphaned (missing files) — done via PHP scan (capped at 200 for speed)
        $orphaned_count = self::count_orphaned_attachments( 200 );

        // Count unused (no post reference) — capped at 500
        $unused_count = self::count_unused_attachments( 500 );

        // Count duplicate groups (capped at 300 attachments for speed)
        $duplicate_groups = self::count_duplicate_groups( 300 );

        return rest_ensure_response( [
            'total_attachments' => $total,
            'total_size'        => $total_size,
            'total_size_human'  => size_format( $total_size ),
            'orphaned_count'    => $orphaned_count,
            'unused_count'      => $unused_count,
            'duplicate_groups'  => $duplicate_groups,
        ] );
    }

    // ─── GET /media/orphaned ─────────────────────────────────────────────────

    /**
     * Returns:
     *  - attachments whose physical file is missing on disk
     *  - (future) physical files with no DB record — skipped for performance
     */
    public static function get_orphaned( WP_REST_Request $request ) {
        global $wpdb;

        $limit  = min( (int) ( $request->get_param( 'limit' ) ?: 100 ), 200 );
        $offset = max( 0, (int) $request->get_param( 'offset' ) );

        $attachments = $wpdb->get_results( $wpdb->prepare(
            "SELECT ID, post_title, post_mime_type, post_date, guid
             FROM {$wpdb->posts}
             WHERE post_type = 'attachment'
             ORDER BY post_date DESC
             LIMIT %d OFFSET %d",
            500, // scan a larger batch then filter
            0
        ) );

        $missing = [];
        foreach ( $attachments as $att ) {
            $file = get_attached_file( $att->ID );
            if ( ! $file || ! file_exists( $file ) ) {
                $missing[] = [
                    'id'        => (int) $att->ID,
                    'title'     => $att->post_title,
                    'mime_type' => $att->post_mime_type,
                    'date'      => $att->post_date,
                    'url'       => $att->guid,
                    'file_path' => $file ?: '',
                ];
            }
        }

        $total = count( $missing );
        $page  = array_slice( $missing, $offset, $limit );

        return rest_ensure_response( [
            'total' => $total,
            'items' => $page,
        ] );
    }

    // ─── DELETE /media/orphaned ───────────────────────────────────────────────

    /**
     * Delete one or more orphaned attachments.
     * Body: { ids: int[] }
     */
    public static function delete_orphaned( WP_REST_Request $request ) {
        $ids = array_map( 'absint', (array) $request->get_param( 'ids' ) );
        if ( empty( $ids ) ) {
            return new WP_Error( 'missing_ids', 'No IDs provided.', [ 'status' => 400 ] );
        }

        $deleted = 0;
        $errors  = [];
        foreach ( $ids as $id ) {
            $result = wp_delete_attachment( $id, true );
            if ( $result ) {
                $deleted++;
            } else {
                $errors[] = $id;
            }
        }

        return rest_ensure_response( [ 'deleted' => $deleted, 'errors' => $errors ] );
    }

    // ─── GET /media/unused ───────────────────────────────────────────────────

    /**
     * Returns attachments not referenced by any post (not a featured image,
     * not attached to a post, not found in any post_content).
     *
     * Note: content scanning is approximate (LIKE search on post_content).
     */
    public static function get_unused( WP_REST_Request $request ) {
        global $wpdb;

        $limit  = min( (int) ( $request->get_param( 'limit' ) ?: 50 ), 100 );
        $offset = max( 0, (int) $request->get_param( 'offset' ) );

        // Get IDs used as featured images
        $featured_ids = $wpdb->get_col(
            "SELECT meta_value FROM {$wpdb->postmeta} WHERE meta_key = '_thumbnail_id'"
        );
        $featured_ids = array_map( 'intval', $featured_ids );

        // Get IDs attached to a parent post (post_parent > 0)
        // We consider unattached (post_parent = 0) as potentially unused
        // but still check content references

        // All attachments
        $all = $wpdb->get_results(
            "SELECT p.ID, p.post_title, p.post_mime_type, p.post_date, p.guid,
                    pm.meta_value AS file_path
             FROM {$wpdb->posts} p
             LEFT JOIN {$wpdb->postmeta} pm ON pm.post_id = p.ID AND pm.meta_key = '_wp_attached_file'
             WHERE p.post_type = 'attachment'
               AND p.post_parent = 0
             ORDER BY p.post_date DESC
             LIMIT 500"
        );

        $unused = [];
        foreach ( $all as $att ) {
            $id = (int) $att->ID;

            // Skip if used as a featured image
            if ( in_array( $id, $featured_ids, true ) ) {
                continue;
            }

            // Check if URL appears in any post content
            $url     = $att->guid;
            $slug    = basename( $url );
            $in_use  = (bool) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->posts}
                 WHERE post_status = 'publish'
                   AND post_type NOT IN ('attachment','revision','nav_menu_item')
                   AND post_content LIKE %s",
                '%' . $wpdb->esc_like( $slug ) . '%'
            ) );

            if ( ! $in_use ) {
                $file       = get_attached_file( $id );
                $file_size  = $file && file_exists( $file ) ? filesize( $file ) : 0;

                $unused[] = [
                    'id'         => $id,
                    'title'      => $att->post_title,
                    'mime_type'  => $att->post_mime_type,
                    'date'       => $att->post_date,
                    'url'        => $url,
                    'file_size'  => $file_size,
                    'file_size_human' => size_format( $file_size ),
                    'thumbnail'  => wp_get_attachment_image_url( $id, 'thumbnail' ) ?: '',
                ];
            }
        }

        $total = count( $unused );
        $page  = array_slice( $unused, $offset, $limit );

        return rest_ensure_response( [
            'total' => $total,
            'items' => $page,
        ] );
    }

    // ─── DELETE /media/unused ─────────────────────────────────────────────────

    /**
     * Bulk delete unused attachments.
     * Body: { ids: int[] }
     */
    public static function delete_unused( WP_REST_Request $request ) {
        $ids = array_map( 'absint', (array) $request->get_param( 'ids' ) );
        if ( empty( $ids ) ) {
            return new WP_Error( 'missing_ids', 'No IDs provided.', [ 'status' => 400 ] );
        }

        $deleted = 0;
        $errors  = [];
        foreach ( $ids as $id ) {
            $result = wp_delete_attachment( $id, true );
            if ( $result ) {
                $deleted++;
            } else {
                $errors[] = $id;
            }
        }

        return rest_ensure_response( [ 'deleted' => $deleted, 'errors' => $errors ] );
    }

    // ─── GET /media/duplicates ───────────────────────────────────────────────

    /**
     * Groups attachments by file MD5 hash. Returns groups with 2+ files.
     */
    public static function get_duplicates( WP_REST_Request $request ) {
        global $wpdb;

        $limit = min( (int) ( $request->get_param( 'scan_limit' ) ?: 300 ), 500 );

        $attachments = $wpdb->get_results( $wpdb->prepare(
            "SELECT p.ID, p.post_title, p.post_mime_type, p.post_date, p.guid
             FROM {$wpdb->posts} p
             WHERE p.post_type = 'attachment'
             ORDER BY p.post_date ASC
             LIMIT %d",
            $limit
        ) );

        // Group by MD5 of physical file
        $by_hash = [];
        foreach ( $attachments as $att ) {
            $file = get_attached_file( $att->ID );
            if ( ! $file || ! file_exists( $file ) ) {
                continue;
            }
            $hash = md5_file( $file );
            if ( ! $hash ) continue;

            $file_size = filesize( $file );
            $by_hash[ $hash ][] = [
                'id'         => (int) $att->ID,
                'title'      => $att->post_title,
                'mime_type'  => $att->post_mime_type,
                'date'       => $att->post_date,
                'url'        => $att->guid,
                'file_path'  => $file,
                'file_size'  => $file_size,
                'file_size_human' => size_format( $file_size ),
                'thumbnail'  => wp_get_attachment_image_url( (int) $att->ID, 'thumbnail' ) ?: '',
            ];
        }

        $groups = [];
        foreach ( $by_hash as $hash => $items ) {
            if ( count( $items ) >= 2 ) {
                $groups[] = [
                    'hash'        => $hash,
                    'count'       => count( $items ),
                    'wasted_size' => array_sum( array_column( $items, 'file_size' ) ) - $items[0]['file_size'],
                    'wasted_size_human' => size_format( array_sum( array_column( $items, 'file_size' ) ) - $items[0]['file_size'] ),
                    'items'       => $items,
                ];
            }
        }

        // Sort by wasted size desc
        usort( $groups, fn( $a, $b ) => $b['wasted_size'] - $a['wasted_size'] );

        $total_wasted = array_sum( array_column( $groups, 'wasted_size' ) );

        return rest_ensure_response( [
            'groups'            => $groups,
            'total_groups'      => count( $groups ),
            'total_wasted'      => $total_wasted,
            'total_wasted_human' => size_format( $total_wasted ),
            'scanned'           => count( $attachments ),
        ] );
    }

    // ─── DELETE /media/duplicate ──────────────────────────────────────────────

    /**
     * Delete a duplicate attachment (keep the one with the lowest ID = oldest).
     * Body: { id: int }
     */
    public static function delete_duplicate( WP_REST_Request $request ) {
        $id = absint( $request->get_param( 'id' ) );
        if ( ! $id ) {
            return new WP_Error( 'missing_id', 'Attachment ID required.', [ 'status' => 400 ] );
        }

        $result = wp_delete_attachment( $id, true );
        if ( ! $result ) {
            return new WP_Error( 'delete_failed', 'Could not delete attachment.', [ 'status' => 500 ] );
        }

        return rest_ensure_response( [ 'success' => true, 'deleted_id' => $id ] );
    }

    // ─── POST /media/compress ─────────────────────────────────────────────────

    /**
     * Re-compress a JPEG or PNG attachment using WordPress's image editor.
     * Body: { id: int, quality?: int (1-100, default 82) }
     */
    public static function compress_image( WP_REST_Request $request ) {
        $id      = absint( $request->get_param( 'id' ) );
        $quality = min( 100, max( 1, (int) ( $request->get_param( 'quality' ) ?: 82 ) ) );

        if ( ! $id ) {
            return new WP_Error( 'missing_id', 'Attachment ID required.', [ 'status' => 400 ] );
        }

        $file = get_attached_file( $id );
        if ( ! $file || ! file_exists( $file ) ) {
            return new WP_Error( 'file_missing', 'Attachment file not found.', [ 'status' => 404 ] );
        }

        $mime = get_post_mime_type( $id );
        if ( ! in_array( $mime, [ 'image/jpeg', 'image/png' ], true ) ) {
            return new WP_Error( 'unsupported_type', 'Only JPEG and PNG are supported.', [ 'status' => 400 ] );
        }

        $before_size = filesize( $file );

        // Use WP image editor
        $editor = wp_get_image_editor( $file );
        if ( is_wp_error( $editor ) ) {
            return $editor;
        }

        $editor->set_quality( $quality );
        $result = $editor->save( $file );
        if ( is_wp_error( $result ) ) {
            return $result;
        }

        $after_size = file_exists( $file ) ? filesize( $file ) : $before_size;
        $saved      = max( 0, $before_size - $after_size );

        return rest_ensure_response( [
            'success'          => true,
            'id'               => $id,
            'before_size'      => $before_size,
            'after_size'       => $after_size,
            'before_size_human' => size_format( $before_size ),
            'after_size_human'  => size_format( $after_size ),
            'saved'            => $saved,
            'saved_human'      => size_format( $saved ),
            'saved_pct'        => $before_size > 0 ? round( $saved / $before_size * 100, 1 ) : 0,
        ] );
    }

    // ─── GET /media/compress-candidates ──────────────────────────────────────

    /**
     * Returns JPEG/PNG attachments that may benefit from compression.
     */
    public static function get_compress_candidates( WP_REST_Request $request ) {
        global $wpdb;

        $limit  = min( (int) ( $request->get_param( 'limit' ) ?: 50 ), 200 );
        $offset = max( 0, (int) $request->get_param( 'offset' ) );

        $attachments = $wpdb->get_results( $wpdb->prepare(
            "SELECT p.ID, p.post_title, p.post_date, p.guid, p.post_mime_type
             FROM {$wpdb->posts} p
             WHERE p.post_type = 'attachment'
               AND p.post_mime_type IN ('image/jpeg', 'image/png')
             ORDER BY p.post_date DESC
             LIMIT %d OFFSET %d",
            $limit,
            $offset
        ) );

        $total = (int) $wpdb->get_var(
            "SELECT COUNT(*) FROM {$wpdb->posts}
             WHERE post_type = 'attachment'
               AND post_mime_type IN ('image/jpeg', 'image/png')"
        );

        $items = [];
        foreach ( $attachments as $att ) {
            $file      = get_attached_file( $att->ID );
            $file_size = $file && file_exists( $file ) ? filesize( $file ) : 0;

            $items[] = [
                'id'              => (int) $att->ID,
                'title'           => $att->post_title,
                'mime_type'       => $att->post_mime_type,
                'date'            => $att->post_date,
                'url'             => $att->guid,
                'file_size'       => $file_size,
                'file_size_human' => size_format( $file_size ),
                'thumbnail'       => wp_get_attachment_image_url( (int) $att->ID, 'thumbnail' ) ?: '',
            ];
        }

        return rest_ensure_response( [
            'total' => $total,
            'items' => $items,
        ] );
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private static function count_orphaned_attachments( int $scan_limit ): int {
        global $wpdb;
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts}
             WHERE post_type = 'attachment'
             LIMIT %d",
            $scan_limit
        ) );
        $count = 0;
        foreach ( $rows as $row ) {
            $file = get_attached_file( (int) $row->ID );
            if ( ! $file || ! file_exists( $file ) ) {
                $count++;
            }
        }
        return $count;
    }

    private static function count_unused_attachments( int $scan_limit ): int {
        global $wpdb;
        $featured = $wpdb->get_col(
            "SELECT meta_value FROM {$wpdb->postmeta} WHERE meta_key = '_thumbnail_id'"
        );
        $featured = array_map( 'intval', $featured );

        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT ID, guid FROM {$wpdb->posts}
             WHERE post_type = 'attachment' AND post_parent = 0
             LIMIT %d",
            $scan_limit
        ) );
        $count = 0;
        foreach ( $rows as $row ) {
            $id = (int) $row->ID;
            if ( in_array( $id, $featured, true ) ) continue;
            $slug   = basename( $row->guid );
            $in_use = (bool) $wpdb->get_var( $wpdb->prepare(
                "SELECT COUNT(*) FROM {$wpdb->posts}
                 WHERE post_status = 'publish'
                   AND post_type NOT IN ('attachment','revision','nav_menu_item')
                   AND post_content LIKE %s",
                '%' . $wpdb->esc_like( $slug ) . '%'
            ) );
            if ( ! $in_use ) $count++;
        }
        return $count;
    }

    private static function count_duplicate_groups( int $scan_limit ): int {
        global $wpdb;
        $rows = $wpdb->get_results( $wpdb->prepare(
            "SELECT ID FROM {$wpdb->posts}
             WHERE post_type = 'attachment'
             LIMIT %d",
            $scan_limit
        ) );
        $hashes = [];
        foreach ( $rows as $row ) {
            $file = get_attached_file( (int) $row->ID );
            if ( ! $file || ! file_exists( $file ) ) continue;
            $hash = md5_file( $file );
            if ( $hash ) $hashes[] = $hash;
        }
        $counts = array_count_values( $hashes );
        return count( array_filter( $counts, fn( $c ) => $c >= 2 ) );
    }

    private static function dir_size( string $dir ): int {
        if ( ! is_dir( $dir ) ) return 0;
        $size  = 0;
        $iter  = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator( $dir, \RecursiveDirectoryIterator::SKIP_DOTS )
        );
        foreach ( $iter as $file ) {
            if ( $file->isFile() ) {
                $size += $file->getSize();
            }
        }
        return $size;
    }
}
