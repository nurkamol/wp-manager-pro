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

    // ── Object Cache ─────────────────────────────────────────────────────────

    /** Path to our bundled drop-in inside the plugin. */
    private static function bundled_dropin_path(): string {
        return WP_MANAGER_PRO_PATH . 'includes/object-cache.php';
    }

    /** Returns true if the installed drop-in was installed by WP Manager Pro. */
    private static function drop_in_is_ours( string $path ): bool {
        if ( ! file_exists( $path ) ) return false;
        $head = @file_get_contents( $path, false, null, 0, 512 ); // phpcs:ignore
        return $head !== false && strpos( $head, '@wmp-dropin true' ) !== false;
    }

    /**
     * Attempts a direct Redis connection and returns [connected, info, error].
     * Always uses WP_REDIS_* constants.
     */
    private static function try_redis_connect(): array {
        if ( ! class_exists( 'Redis' ) ) {
            return [ false, null, 'PhpRedis extension not loaded.' ];
        }

        $scheme  = defined( 'WP_REDIS_SCHEME' )      ? WP_REDIS_SCHEME             : 'tcp';
        $host    = defined( 'WP_REDIS_HOST' )         ? WP_REDIS_HOST               : '127.0.0.1';
        $port    = defined( 'WP_REDIS_PORT' )         ? (int) WP_REDIS_PORT         : 6379;
        $db      = defined( 'WP_REDIS_DATABASE' )     ? (int) WP_REDIS_DATABASE     : 0;
        $timeout = defined( 'WP_REDIS_TIMEOUT' )      ? (float) WP_REDIS_TIMEOUT    : 1.0;

        try {
            $r = new \Redis();
            if ( in_array( $scheme, [ 'unix', 'socket' ], true ) ) {
                $r->connect( $host );
            } else {
                $r->connect( $host, $port, $timeout );
            }

            if ( defined( 'WP_REDIS_PASSWORD' ) && WP_REDIS_PASSWORD !== '' ) {
                if ( defined( 'WP_REDIS_USERNAME' ) && WP_REDIS_USERNAME !== '' ) {
                    $r->auth( [ WP_REDIS_USERNAME, WP_REDIS_PASSWORD ] );
                } else {
                    $r->auth( WP_REDIS_PASSWORD );
                }
            }

            if ( $db > 0 ) $r->select( $db );

            $info     = $r->info();
            $keyspace = $r->info( 'keyspace' );
            $r->close();

            return [ true, [ 'info' => $info, 'keyspace' => $keyspace, 'db' => $db ], '' ];

        } catch ( \Exception $e ) {
            return [ false, null, $e->getMessage() ];
        }
    }

    /**
     * GET /wp-manager-pro/v1/performance/object-cache
     */
    public static function get_object_cache( WP_REST_Request $request ) {
        $drop_in_path     = WP_CONTENT_DIR . '/object-cache.php';
        $drop_in_disabled = WP_CONTENT_DIR . '/object-cache.php.disabled';
        $drop_in_exists   = file_exists( $drop_in_path );
        $drop_in_is_ours  = self::drop_in_is_ours( $drop_in_path );
        $disabled_exists  = file_exists( $drop_in_disabled );
        $content_writable = wp_is_writable( WP_CONTENT_DIR );
        $drop_in_writable = $drop_in_exists ? wp_is_writable( $drop_in_path ) : $content_writable;
        $bundled_exists   = file_exists( self::bundled_dropin_path() );

        // ── Redis config ──────────────────────────────────────────────────────
        $scheme   = defined( 'WP_REDIS_SCHEME' )      ? WP_REDIS_SCHEME             : 'tcp';
        $host     = defined( 'WP_REDIS_HOST' )         ? WP_REDIS_HOST               : '127.0.0.1';
        $port     = defined( 'WP_REDIS_PORT' )         ? (int) WP_REDIS_PORT         : 6379;
        $db       = defined( 'WP_REDIS_DATABASE' )     ? (int) WP_REDIS_DATABASE     : 0;
        $timeout  = defined( 'WP_REDIS_TIMEOUT' )      ? (float) WP_REDIS_TIMEOUT    : 1.0;
        $read_to  = defined( 'WP_REDIS_READ_TIMEOUT' ) ? (float) WP_REDIS_READ_TIMEOUT : 1.0;
        $prefix   = '';
        if ( defined( 'WP_REDIS_PREFIX' ) && WP_REDIS_PREFIX !== '' ) {
            $prefix = WP_REDIS_PREFIX;
        } elseif ( defined( 'WP_CACHE_KEY_SALT' ) && WP_CACHE_KEY_SALT !== '' ) {
            $prefix = WP_CACHE_KEY_SALT;
        }

        // ── Try connecting to Redis directly (always, for reachability check) ─
        list( $redis_reachable, $redis_data, $redis_error ) = self::try_redis_connect();

        // ── Build stats from Redis INFO ────────────────────────────────────────
        $stats = [];
        if ( $redis_reachable && $redis_data ) {
            $info     = $redis_data['info'];
            $keyspace = $redis_data['keyspace'];
            $dbkey    = 'db' . $redis_data['db'];

            $keys_in_db = 0;
            if ( ! empty( $keyspace[ $dbkey ] ) ) {
                preg_match( '/keys=(\d+)/', $keyspace[ $dbkey ], $m );
                $keys_in_db = isset( $m[1] ) ? (int) $m[1] : 0;
            }

            $hits   = (int) ( $info['keyspace_hits']   ?? 0 );
            $misses = (int) ( $info['keyspace_misses'] ?? 0 );
            $total  = $hits + $misses;

            $stats = [
                'hits'              => $hits,
                'misses'            => $misses,
                'hit_ratio'         => $total > 0 ? round( ( $hits / $total ) * 100, 1 ) : null,
                'keys_count'        => $keys_in_db,
                'memory_used'       => $info['used_memory_human']      ?? null,
                'memory_peak'       => $info['used_memory_peak_human'] ?? null,
                'uptime_seconds'    => (int) ( $info['uptime_in_seconds'] ?? 0 ),
                'connected_clients' => (int) ( $info['connected_clients'] ?? 0 ),
                'evicted_keys'      => (int) ( $info['evicted_keys']   ?? 0 ),
                'expired_keys'      => (int) ( $info['expired_keys']   ?? 0 ),
                'ops_per_sec'       => (int) ( $info['instantaneous_ops_per_sec'] ?? 0 ),
                'redis_version'     => $info['redis_version']    ?? null,
                'maxmemory_policy'  => $info['maxmemory_policy'] ?? null,
                'php_redis_version' => phpversion( 'redis' ) ?: null,
            ];
        }

        // ── WP runtime object cache stats ─────────────────────────────────────
        global $wp_object_cache;
        $wp_stats = [];
        if ( is_object( $wp_object_cache ) ) {
            $wp_stats['cache_hits']   = property_exists( $wp_object_cache, 'cache_hits' )   ? (int) $wp_object_cache->cache_hits   : null;
            $wp_stats['cache_misses'] = property_exists( $wp_object_cache, 'cache_misses' ) ? (int) $wp_object_cache->cache_misses : null;
            if ( isset( $wp_object_cache->cache ) && is_array( $wp_object_cache->cache ) ) {
                $wp_stats['groups'] = array_keys( $wp_object_cache->cache );
            }
            // Extra info if our own drop-in is running
            if ( method_exists( $wp_object_cache, 'get_ignored_groups' ) ) {
                $wp_stats['global_groups']  = $wp_object_cache->get_global_groups();
                $wp_stats['ignored_groups'] = $wp_object_cache->get_ignored_groups();
            }
        }

        // ── Determine overall status ──────────────────────────────────────────
        if ( $drop_in_exists && wp_using_ext_object_cache() ) {
            $status = $redis_reachable ? 'connected' : 'error';
        } elseif ( $drop_in_exists && ! wp_using_ext_object_cache() ) {
            // Drop-in present but not loaded (edge case on this request)
            $status = $redis_reachable ? 'not_enabled' : 'error';
        } elseif ( ! class_exists( 'Redis' ) ) {
            $status = 'extension_missing';
        } else {
            $status = 'not_enabled';
        }

        // ── Diagnostics text dump ─────────────────────────────────────────────
        $diag_lines = [
            'Status: '        . ( $drop_in_exists && wp_using_ext_object_cache() ? ( $redis_reachable ? 'Connected' : 'Error' ) : 'Not enabled' ),
            'Drop-in: '       . ( $drop_in_exists ? ( $drop_in_is_ours ? 'WP Manager Pro v1.0.0' : 'Third-party' ) : 'Not installed' ),
            'Redis: '         . ( $redis_reachable ? 'Reachable' : 'Unreachable' ),
            'Filesystem: '    . ( $content_writable ? 'Writable' : 'Not writable' ),
            'PhpRedis: '      . ( class_exists( 'Redis' ) ? ( phpversion( 'redis' ) ?: 'loaded' ) : 'Not loaded' ),
            'PHP Version: '   . PHP_VERSION,
            'Redis Version: ' . ( $stats['redis_version'] ?? 'unknown' ),
            'Host: '          . $host,
            'Port: '          . $port,
            'Database: '      . $db,
            'Timeout: '       . $timeout,
            'Read Timeout: '  . $read_to,
            'Scheme: '        . $scheme,
            'Key Prefix: '    . ( $prefix !== '' ? '"' . $prefix . '"' : '(none)' ),
            'Multisite: '     . ( is_multisite() ? 'Yes' : 'No' ),
        ];
        if ( $redis_error ) {
            $diag_lines[] = 'Error: ' . $redis_error;
        }
        if ( $redis_reachable && isset( $info['maxmemory_policy'] ) ) {
            $diag_lines[] = 'Max Memory Policy: ' . $info['maxmemory_policy'];
        }
        if ( isset( $wp_stats['global_groups'] ) ) {
            $diag_lines[] = 'Global Groups: ' . implode( ', ', $wp_stats['global_groups'] );
        }
        if ( isset( $wp_stats['ignored_groups'] ) ) {
            $diag_lines[] = 'Ignored Groups: ' . implode( ', ', $wp_stats['ignored_groups'] );
        }

        $connection = [
            'scheme'        => $scheme,
            'host'          => $host,
            'port'          => $port,
            'database'      => $db,
            'timeout'       => $timeout,
            'read_timeout'  => $read_to,
            'key_prefix'    => $prefix,
            'php_redis'     => class_exists( 'Redis' ) ? ( phpversion( 'redis' ) ?: 'loaded' ) : null,
        ];

        return new WP_REST_Response( [
            'enabled'          => wp_using_ext_object_cache(),
            'redis_reachable'  => $redis_reachable,
            'redis_error'      => $redis_error,
            'drop_in_exists'   => $drop_in_exists,
            'drop_in_is_ours'  => $drop_in_is_ours,
            'drop_in_writable' => $drop_in_writable,
            'disabled_exists'  => $disabled_exists,
            'content_writable' => $content_writable,
            'bundled_available'=> $bundled_exists,
            'status'           => $status,
            'connection'       => $connection,
            'stats'            => $stats,
            'wp_stats'         => $wp_stats,
            'diagnostics_text' => implode( "\n", $diag_lines ),
        ], 200 );
    }

    /**
     * POST /wp-manager-pro/v1/performance/object-cache/flush
     */
    public static function flush_object_cache( WP_REST_Request $request ) {
        $ok = wp_cache_flush();
        return new WP_REST_Response( [
            'success' => $ok,
            'message' => $ok
                ? 'Object cache flushed successfully.'
                : 'wp_cache_flush() returned false — the cache driver may not support flush, or no external cache is active.',
        ], 200 );
    }

    /**
     * POST /wp-manager-pro/v1/performance/object-cache/drop-in
     *
     * Body: { action: 'install' | 'enable' | 'disable' }
     *
     * install  – copies bundled object-cache.php into wp-content/ (fails if a
     *            non-WMP drop-in already exists unless force:true is passed)
     * disable  – renames object-cache.php to object-cache.php.disabled
     * enable   – renames object-cache.php.disabled back to object-cache.php
     */
    public static function manage_drop_in( WP_REST_Request $request ) {
        $action           = sanitize_key( (string) ( $request->get_param( 'action' ) ?? '' ) );
        $force            = (bool) ( $request->get_param( 'force' ) ?? false );
        $drop_in_path     = WP_CONTENT_DIR . '/object-cache.php';
        $drop_in_disabled = WP_CONTENT_DIR . '/object-cache.php.disabled';
        $bundled          = self::bundled_dropin_path();

        // ── install ──────────────────────────────────────────────────────────
        if ( $action === 'install' ) {
            if ( ! file_exists( $bundled ) ) {
                return new WP_Error( 'bundled_missing', 'Bundled drop-in not found inside the plugin.', [ 'status' => 500 ] );
            }
            if ( ! wp_is_writable( WP_CONTENT_DIR ) ) {
                return new WP_Error( 'not_writable', 'wp-content directory is not writable.', [ 'status' => 403 ] );
            }
            if ( file_exists( $drop_in_path ) && ! self::drop_in_is_ours( $drop_in_path ) && ! $force ) {
                return new WP_Error(
                    'conflict',
                    'Another plugin\'s object-cache.php is already installed. Pass force:true to overwrite it.',
                    [ 'status' => 409 ]
                );
            }
            $ok = @copy( $bundled, $drop_in_path ); // phpcs:ignore WordPress.PHP.NoSilencedErrors
            return new WP_REST_Response( [
                'success' => $ok,
                'message' => $ok
                    ? 'Object cache drop-in installed. Redis caching is now active.'
                    : 'Could not copy the drop-in file.',
            ], $ok ? 200 : 500 );
        }

        // ── disable ──────────────────────────────────────────────────────────
        if ( $action === 'disable' ) {
            if ( ! file_exists( $drop_in_path ) ) {
                return new WP_Error( 'not_found', 'object-cache.php does not exist.', [ 'status' => 404 ] );
            }
            if ( ! wp_is_writable( $drop_in_path ) ) {
                return new WP_Error( 'not_writable', 'object-cache.php is not writable.', [ 'status' => 403 ] );
            }
            $ok = rename( $drop_in_path, $drop_in_disabled );
            return new WP_REST_Response( [
                'success' => $ok,
                'message' => $ok ? 'Drop-in disabled. Object cache will be inactive on next request.' : 'Could not rename the file.',
            ], $ok ? 200 : 500 );
        }

        // ── enable ───────────────────────────────────────────────────────────
        if ( $action === 'enable' ) {
            if ( ! file_exists( $drop_in_disabled ) ) {
                return new WP_Error( 'not_found', 'No disabled drop-in found (object-cache.php.disabled).', [ 'status' => 404 ] );
            }
            if ( ! wp_is_writable( WP_CONTENT_DIR ) ) {
                return new WP_Error( 'not_writable', 'wp-content directory is not writable.', [ 'status' => 403 ] );
            }
            $ok = rename( $drop_in_disabled, $drop_in_path );
            return new WP_REST_Response( [
                'success' => $ok,
                'message' => $ok ? 'Drop-in re-enabled. Object cache will be active on next request.' : 'Could not rename the file.',
            ], $ok ? 200 : 500 );
        }

        return new WP_Error( 'invalid_action', 'action must be install, enable, or disable.', [ 'status' => 400 ] );
    }

    /**
     * Formats bytes to a human-readable string.
     */
    private static function format_bytes( int $bytes ): string {
        if ( $bytes < 1024 )        return $bytes . ' B';
        if ( $bytes < 1048576 )     return round( $bytes / 1024, 1 ) . ' KB';
        if ( $bytes < 1073741824 )  return round( $bytes / 1048576, 2 ) . ' MB';
        return round( $bytes / 1073741824, 2 ) . ' GB';
    }

    // ─────────────────────────────────────────────────────────────────────────

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
