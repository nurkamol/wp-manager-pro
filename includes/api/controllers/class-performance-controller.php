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

    /**
     * GET /wp-manager-pro/v1/performance/object-cache
     *
     * Returns full Redis / Memcached / APCu status, connection info, and live stats.
     */
    public static function get_object_cache( WP_REST_Request $request ) {
        $drop_in_path     = WP_CONTENT_DIR . '/object-cache.php';
        $drop_in_disabled = WP_CONTENT_DIR . '/object-cache.php.disabled';
        $drop_in_exists   = file_exists( $drop_in_path );
        $drop_in_writable = $drop_in_exists ? is_writable( $drop_in_path ) : is_writable( WP_CONTENT_DIR );
        $disabled_exists  = file_exists( $drop_in_disabled );

        // Detect cache type from drop-in content or loaded PHP extensions.
        $cache_type = 'none';
        if ( $drop_in_exists ) {
            $contents = @file_get_contents( $drop_in_path ); // phpcs:ignore WordPress.WP.AlternativeFunctions
            if ( $contents !== false ) {
                $lower = strtolower( $contents );
                if ( strpos( $lower, 'redis' ) !== false ) {
                    $cache_type = 'redis';
                } elseif ( strpos( $lower, 'memcach' ) !== false ) {
                    $cache_type = 'memcached';
                } elseif ( strpos( $lower, 'apcu' ) !== false || strpos( $lower, 'apc_' ) !== false ) {
                    $cache_type = 'apcu';
                } else {
                    $cache_type = 'custom';
                }
            }
        } elseif ( wp_using_ext_object_cache() ) {
            if ( class_exists( 'Redis' ) || defined( 'WP_REDIS_HOST' ) ) {
                $cache_type = 'redis';
            } elseif ( class_exists( 'Memcached' ) || class_exists( 'Memcache' ) ) {
                $cache_type = 'memcached';
            } elseif ( function_exists( 'apcu_cache_info' ) ) {
                $cache_type = 'apcu';
            }
        }

        $status      = 'not_configured';
        $connection  = [];
        $stats       = [];
        $diagnostics = [];

        // ── Redis ────────────────────────────────────────────────────────────
        if ( $cache_type === 'redis' ) {
            $scheme   = defined( 'WP_REDIS_SCHEME' )   ? WP_REDIS_SCHEME             : 'tcp';
            $host     = defined( 'WP_REDIS_HOST' )     ? WP_REDIS_HOST               : '127.0.0.1';
            $port     = defined( 'WP_REDIS_PORT' )     ? (int) WP_REDIS_PORT         : 6379;
            $db       = defined( 'WP_REDIS_DATABASE' ) ? (int) WP_REDIS_DATABASE     : 0;
            $timeout  = defined( 'WP_REDIS_TIMEOUT' )  ? (float) WP_REDIS_TIMEOUT    : 1.0;
            $prefix   = defined( 'WP_REDIS_PREFIX' )   ? WP_REDIS_PREFIX
                      : ( defined( 'WP_CACHE_KEY_SALT' ) ? WP_CACHE_KEY_SALT : '' );

            $connection = [
                'scheme'   => $scheme,
                'host'     => $host,
                'port'     => $port,
                'database' => $db,
                'timeout'  => $timeout,
                'prefix'   => $prefix,
            ];

            if ( ! class_exists( 'Redis' ) ) {
                $status = 'extension_missing';
                $diagnostics['error'] = 'The PHP Redis extension is not installed on this server.';
            } else {
                try {
                    $redis = new \Redis();
                    if ( $scheme === 'unix' ) {
                        $redis->connect( $host );
                    } else {
                        $redis->connect( $host, $port, $timeout );
                    }

                    if ( defined( 'WP_REDIS_PASSWORD' ) && WP_REDIS_PASSWORD ) {
                        if ( defined( 'WP_REDIS_USERNAME' ) && WP_REDIS_USERNAME ) {
                            $redis->auth( [ WP_REDIS_USERNAME, WP_REDIS_PASSWORD ] );
                        } else {
                            $redis->auth( WP_REDIS_PASSWORD );
                        }
                    }

                    $redis->select( $db );
                    $info     = $redis->info();
                    $keyspace = $redis->info( 'keyspace' );
                    $dbkey    = "db{$db}";
                    $keys_in_db = 0;
                    if ( ! empty( $keyspace[ $dbkey ] ) ) {
                        preg_match( '/keys=(\d+)/', $keyspace[ $dbkey ], $m );
                        $keys_in_db = isset( $m[1] ) ? (int) $m[1] : 0;
                    }

                    $hits  = (int) ( $info['keyspace_hits']   ?? 0 );
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
                    ];

                    $status = 'connected';
                    $redis->close();

                } catch ( \Exception $e ) {
                    $status = 'error';
                    $diagnostics['error'] = $e->getMessage();
                }
            }
        }

        // ── Memcached ────────────────────────────────────────────────────────
        elseif ( $cache_type === 'memcached' ) {
            $host = '127.0.0.1';
            $port = 11211;
            // Some setups define this via object-cache.php globals.
            if ( defined( 'MEMCACHED_HOST' ) ) { $host = MEMCACHED_HOST; }
            if ( defined( 'MEMCACHED_PORT' ) ) { $port = (int) MEMCACHED_PORT; }

            $connection = [ 'host' => $host, 'port' => $port ];

            if ( ! class_exists( 'Memcached' ) ) {
                $status = 'extension_missing';
                $diagnostics['error'] = 'The PHP Memcached extension is not installed on this server.';
            } else {
                try {
                    $mc = new \Memcached();
                    $mc->addServer( $host, $port );
                    $raw = $mc->getStats();

                    if ( $raw && ! empty( $raw ) ) {
                        $sk = array_key_first( $raw );
                        $s  = $raw[ $sk ];
                        $hits   = (int) ( $s['get_hits']   ?? 0 );
                        $misses = (int) ( $s['get_misses'] ?? 0 );
                        $total  = $hits + $misses;
                        $stats = [
                            'hits'              => $hits,
                            'misses'            => $misses,
                            'hit_ratio'         => $total > 0 ? round( ( $hits / $total ) * 100, 1 ) : null,
                            'keys_count'        => (int) ( $s['curr_items']       ?? 0 ),
                            'memory_used'       => self::format_bytes( (int) ( $s['bytes']        ?? 0 ) ),
                            'memory_peak'       => self::format_bytes( (int) ( $s['limit_maxbytes'] ?? 0 ) ),
                            'uptime_seconds'    => (int) ( $s['uptime']           ?? 0 ),
                            'connected_clients' => (int) ( $s['curr_connections'] ?? 0 ),
                            'evicted_keys'      => (int) ( $s['evictions']        ?? 0 ),
                            'expired_keys'      => (int) ( $s['expired_unfetched'] ?? 0 ),
                            'version'           => $s['version'] ?? null,
                        ];
                        $status = 'connected';
                    } else {
                        $status = 'error';
                        $diagnostics['error'] = 'No stats returned — server may be unreachable.';
                    }
                } catch ( \Exception $e ) {
                    $status = 'error';
                    $diagnostics['error'] = $e->getMessage();
                }
            }
        }

        // ── APCu ─────────────────────────────────────────────────────────────
        elseif ( $cache_type === 'apcu' ) {
            if ( ! function_exists( 'apcu_cache_info' ) ) {
                $status = 'extension_missing';
                $diagnostics['error'] = 'The APCu PHP extension is not installed.';
            } else {
                $info  = apcu_cache_info( true );
                $sinfo = apcu_sma_info( true );
                $hits   = (int) ( $info['nhits']   ?? 0 );
                $misses = (int) ( $info['nmisses'] ?? 0 );
                $total  = $hits + $misses;
                $stats  = [
                    'hits'           => $hits,
                    'misses'         => $misses,
                    'hit_ratio'      => $total > 0 ? round( ( $hits / $total ) * 100, 1 ) : null,
                    'keys_count'     => (int) ( $info['num_entries'] ?? 0 ),
                    'memory_used'    => self::format_bytes( (int) ( $sinfo['seg_size'] ?? 0 ) - (int) ( $sinfo['avail_mem'] ?? 0 ) ),
                    'memory_peak'    => self::format_bytes( (int) ( $sinfo['seg_size'] ?? 0 ) ),
                    'uptime_seconds' => (int) ( $info['start_time'] ?? 0 ) > 0 ? time() - (int) $info['start_time'] : 0,
                    'evicted_keys'   => (int) ( $info['nexpunges'] ?? 0 ),
                    'expired_keys'   => (int) ( $info['nexpired']  ?? 0 ),
                    'version'        => phpversion( 'apcu' ) ?: null,
                ];
                $status = 'connected';
            }
        }

        // WordPress object-cache global stats.
        global $wp_object_cache;
        $wp_stats = [];
        if ( is_object( $wp_object_cache ) ) {
            $wp_stats['cache_hits']   = property_exists( $wp_object_cache, 'cache_hits' )   ? (int) $wp_object_cache->cache_hits   : null;
            $wp_stats['cache_misses'] = property_exists( $wp_object_cache, 'cache_misses' ) ? (int) $wp_object_cache->cache_misses : null;
            if ( isset( $wp_object_cache->cache ) && is_array( $wp_object_cache->cache ) ) {
                $wp_stats['groups'] = array_keys( $wp_object_cache->cache );
            }
        }

        return new WP_REST_Response( [
            'enabled'          => wp_using_ext_object_cache(),
            'drop_in_exists'   => $drop_in_exists,
            'drop_in_writable' => $drop_in_writable,
            'disabled_exists'  => $disabled_exists,
            'content_writable' => is_writable( WP_CONTENT_DIR ),
            'cache_type'       => $cache_type,
            'status'           => $status,
            'connection'       => $connection,
            'stats'            => $stats,
            'wp_stats'         => $wp_stats,
            'diagnostics'      => $diagnostics,
        ], 200 );
    }

    /**
     * POST /wp-manager-pro/v1/performance/object-cache/flush
     *
     * Flushes the entire object cache via wp_cache_flush().
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
     * Enables or disables the object-cache.php drop-in by renaming the file.
     * Body: { action: 'enable' | 'disable' }
     */
    public static function manage_drop_in( WP_REST_Request $request ) {
        $action           = sanitize_key( $request->get_param( 'action' ) ?? '' );
        $drop_in_path     = WP_CONTENT_DIR . '/object-cache.php';
        $drop_in_disabled = WP_CONTENT_DIR . '/object-cache.php.disabled';

        if ( $action === 'disable' ) {
            if ( ! file_exists( $drop_in_path ) ) {
                return new WP_Error( 'not_found', 'object-cache.php does not exist.', [ 'status' => 404 ] );
            }
            if ( ! is_writable( $drop_in_path ) ) {
                return new WP_Error( 'not_writable', 'object-cache.php is not writable.', [ 'status' => 403 ] );
            }
            $ok = rename( $drop_in_path, $drop_in_disabled );
            return new WP_REST_Response( [
                'success' => $ok,
                'message' => $ok ? 'Drop-in disabled. Object cache will be inactive on next request.' : 'Could not rename the file.',
            ], $ok ? 200 : 500 );
        }

        if ( $action === 'enable' ) {
            if ( ! file_exists( $drop_in_disabled ) ) {
                return new WP_Error( 'not_found', 'No disabled drop-in found (object-cache.php.disabled).', [ 'status' => 404 ] );
            }
            if ( ! is_writable( WP_CONTENT_DIR ) ) {
                return new WP_Error( 'not_writable', 'wp-content directory is not writable.', [ 'status' => 403 ] );
            }
            $ok = rename( $drop_in_disabled, $drop_in_path );
            return new WP_REST_Response( [
                'success' => $ok,
                'message' => $ok ? 'Drop-in re-enabled. Object cache will be active on next request.' : 'Could not rename the file.',
            ], $ok ? 200 : 500 );
        }

        return new WP_Error( 'invalid_action', 'action must be "enable" or "disable".', [ 'status' => 400 ] );
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
