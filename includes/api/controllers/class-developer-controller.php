<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Developer Utilities Controller — v2.9.0
 *
 * Endpoints:
 *  GET    /developer/hooks          — Hook Explorer
 *  GET    /developer/rest-routes    — REST route list
 *  POST   /developer/rest-request   — REST API proxy tester
 *  POST   /developer/generate       — Dummy data generator
 *  GET    /developer/dummy-stats    — Dummy data counts
 *  DELETE /developer/dummy          — Delete dummy data
 *  GET    /developer/rewrite-test   — Rewrite rules tester
 *  GET    /developer/cache-keys     — Object cache browser (list)
 *  GET    /developer/cache-value    — Object cache browser (value)
 *  DELETE /developer/cache-key      — Delete cache key
 *  GET    /developer/prefix-info    — DB prefix info
 *  POST   /developer/change-prefix  — DB prefix changer
 */
class Developer_Controller {

    // ── Fake data pools ───────────────────────────────────────────────────────

    private static array $first_names = [
        'Alice', 'Bob', 'Carol', 'David', 'Eva', 'Frank', 'Grace', 'Henry',
        'Isla', 'Jack', 'Karen', 'Leo', 'Mia', 'Noah', 'Olivia', 'Paul',
        'Quinn', 'Rosa', 'Sam', 'Tina',
    ];

    private static array $last_names = [
        'Adams', 'Baker', 'Clark', 'Davis', 'Evans', 'Fisher', 'Green', 'Hall',
        'Ingram', 'Jones', 'King', 'Lane', 'Moore', 'Nash', 'Owen', 'Park',
        'Quinn', 'Reed', 'Scott', 'Turner',
    ];

    private static array $lorem_sentences = [
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
        'Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.',
        'Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.',
        'Duis aute irure dolor in reprehenderit in voluptate velit esse cillum.',
        'Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia.',
        'Curabitur pretium tincidunt lacus nulla non eros ullamcorper luctus.',
        'Fusce lobortis lorem at ipsum semper sagittis. Vivamus eget mauris.',
        'Pellentesque habitant morbi tristique senectus et netus et malesuada.',
        'Nam consequat gravida ligula, vitae tincidunt lorem ornare vel.',
        'Proin faucibus nunc et risus posuere, at volutpat lacus pretium.',
    ];

    private static array $title_patterns = [
        'The Ultimate Guide to %s',
        'Everything You Need to Know About %s',
        'How to Master %s in 30 Days',
        'Top 10 Tips for %s',
        '%s: A Beginner\'s Overview',
        'Understanding %s for Professionals',
        'Why %s Matters in %d',
        'Getting Started with %s',
    ];

    private static array $topics = [
        'WordPress', 'Web Development', 'SEO', 'Performance Optimization',
        'Security', 'Content Strategy', 'E-Commerce', 'Digital Marketing',
    ];

    // ── Hook Explorer ─────────────────────────────────────────────────────────

    public static function get_hooks( \WP_REST_Request $request ): \WP_REST_Response {
        $search      = sanitize_text_field( (string) $request->get_param( 'search' ) );
        $file_filter = sanitize_text_field( (string) $request->get_param( 'file' ) );

        $results = [];

        foreach ( $GLOBALS['wp_filter'] as $hook => $wp_hook ) {
            // Search filter on hook name.
            if ( $search && stripos( $hook, $search ) === false ) {
                // Still check callbacks below — might match file/name.
                $hook_matches_search = false;
            } else {
                $hook_matches_search = true;
            }

            foreach ( $wp_hook->callbacks as $priority => $callbacks ) {
                foreach ( $callbacks as $cb_data ) {
                    $cb      = $cb_data['function'];
                    $args    = $cb_data['accepted_args'];
                    $info    = self::resolve_callback( $cb );

                    // Apply filters.
                    if ( ! $hook_matches_search ) {
                        if ( $search && stripos( $info['name'], $search ) === false && stripos( $info['file'], $search ) === false ) {
                            continue;
                        }
                    }
                    if ( $file_filter && stripos( $info['file'], $file_filter ) === false ) {
                        continue;
                    }

                    $results[] = [
                        'hook'     => $hook,
                        'priority' => (int) $priority,
                        'callback' => $info['name'],
                        'file'     => $info['file'],
                        'line'     => $info['line'],
                        'args'     => (int) $args,
                    ];

                    if ( count( $results ) >= 2000 ) {
                        break 3;
                    }
                }
            }
        }

        return new \WP_REST_Response( [
            'hooks' => $results,
            'total' => count( $results ),
        ], 200 );
    }

    private static function resolve_callback( mixed $cb ): array {
        $unknown = [ 'name' => '{unknown}', 'file' => '', 'line' => 0 ];

        try {
            if ( $cb instanceof \Closure ) {
                $ref  = new \ReflectionFunction( $cb );
                $file = $ref->getFileName();
                return [
                    'name' => '{closure}',
                    'file' => $file ? str_replace( ABSPATH, '', $file ) : '',
                    'line' => $ref->getStartLine() ?: 0,
                ];
            }

            if ( is_array( $cb ) && count( $cb ) === 2 ) {
                [ $obj, $method ] = $cb;
                $class = is_object( $obj ) ? get_class( $obj ) : (string) $obj;
                try {
                    $ref  = new \ReflectionMethod( $class, (string) $method );
                    $file = $ref->getFileName();
                    return [
                        'name' => $class . '::' . $method,
                        'file' => $file ? str_replace( ABSPATH, '', $file ) : '',
                        'line' => $ref->getStartLine() ?: 0,
                    ];
                } catch ( \ReflectionException ) {
                    return [ 'name' => $class . '::' . $method, 'file' => '', 'line' => 0 ];
                }
            }

            if ( is_string( $cb ) ) {
                if ( str_contains( $cb, '::' ) ) {
                    [ $class, $method ] = explode( '::', $cb, 2 );
                    try {
                        $ref  = new \ReflectionMethod( $class, $method );
                        $file = $ref->getFileName();
                        return [
                            'name' => $cb,
                            'file' => $file ? str_replace( ABSPATH, '', $file ) : '',
                            'line' => $ref->getStartLine() ?: 0,
                        ];
                    } catch ( \ReflectionException ) {
                        return [ 'name' => $cb, 'file' => '', 'line' => 0 ];
                    }
                }
                try {
                    $ref  = new \ReflectionFunction( $cb );
                    $file = $ref->getFileName();
                    return [
                        'name' => $cb,
                        'file' => $file ? str_replace( ABSPATH, '', $file ) : '',
                        'line' => $ref->getStartLine() ?: 0,
                    ];
                } catch ( \ReflectionException ) {
                    return [ 'name' => $cb, 'file' => '', 'line' => 0 ];
                }
            }
        } catch ( \Throwable ) {
            // Silently ignore any reflection errors.
        }

        return $unknown;
    }

    // ── REST API Tester ───────────────────────────────────────────────────────

    public static function get_rest_routes( \WP_REST_Request $request ): \WP_REST_Response {
        $server = rest_get_server();
        $raw    = $server->get_routes();

        $routes = [];
        foreach ( $raw as $path => $endpoints ) {
            $methods = [];
            foreach ( $endpoints as $endpoint ) {
                if ( isset( $endpoint['methods'] ) ) {
                    foreach ( array_keys( $endpoint['methods'] ) as $m ) {
                        $methods[] = $m;
                    }
                }
            }
            $methods = array_unique( $methods );

            // Derive namespace from first two path segments.
            $parts     = array_values( array_filter( explode( '/', ltrim( $path, '/' ) ) ) );
            $namespace = count( $parts ) >= 2 ? $parts[0] . '/' . $parts[1] : ( $parts[0] ?? '' );

            $routes[] = [
                'path'      => $path,
                'methods'   => array_values( $methods ),
                'namespace' => $namespace,
            ];
        }

        return new \WP_REST_Response( [
            'routes' => $routes,
            'total'  => count( $routes ),
        ], 200 );
    }

    public static function proxy_rest_request( \WP_REST_Request $request ): \WP_REST_Response {
        $method  = strtoupper( sanitize_text_field( (string) $request->get_param( 'method' ) ) );
        $path    = sanitize_text_field( (string) $request->get_param( 'path' ) );
        $body    = $request->get_param( 'body' ) ?? [];
        $headers = $request->get_param( 'headers' ) ?? [];

        if ( ! $path ) {
            return new \WP_REST_Response( [ 'error' => 'path is required' ], 400 );
        }

        $allowed_methods = [ 'GET', 'POST', 'PUT', 'PATCH', 'DELETE' ];
        if ( ! in_array( $method, $allowed_methods, true ) ) {
            $method = 'GET';
        }

        $internal_request = new \WP_REST_Request( $method, $path );

        if ( is_array( $body ) ) {
            foreach ( $body as $key => $val ) {
                $internal_request->set_param( sanitize_key( $key ), $val );
            }
        }

        if ( is_array( $headers ) ) {
            foreach ( $headers as $key => $val ) {
                $internal_request->add_header( sanitize_text_field( $key ), sanitize_text_field( $val ) );
            }
        }

        $start    = microtime( true );
        $response = rest_do_request( $internal_request );
        $duration = round( ( microtime( true ) - $start ) * 1000, 2 );

        $server = rest_get_server();
        $data   = $server->response_to_data( $response, false );

        return new \WP_REST_Response( [
            'status'      => $response->get_status(),
            'headers'     => $response->get_headers(),
            'body'        => $data,
            'duration_ms' => $duration,
        ], 200 );
    }

    // ── Dummy Data Generator ──────────────────────────────────────────────────

    public static function generate_dummy( \WP_REST_Request $request ): \WP_REST_Response {
        $type  = sanitize_text_field( (string) $request->get_param( 'type' ) );
        $count = min( 50, max( 1, (int) $request->get_param( 'count' ) ) );

        $generated = [];
        $errors    = [];

        for ( $i = 0; $i < $count; $i++ ) {
            try {
                $id = match ( $type ) {
                    'post'    => self::generate_post( 'post' ),
                    'page'    => self::generate_post( 'page' ),
                    'user'    => self::generate_user(),
                    'product' => self::generate_product(),
                    default   => self::generate_post( 'post' ),
                };

                if ( is_wp_error( $id ) ) {
                    $errors[] = $id->get_error_message();
                } else {
                    $generated[] = $id;
                }
            } catch ( \Throwable $e ) {
                $errors[] = $e->getMessage();
            }
        }

        return new \WP_REST_Response( [
            'generated' => $generated,
            'count'     => count( $generated ),
            'errors'    => $errors,
        ], 200 );
    }

    private static function generate_post( string $type ): int|\WP_Error {
        $topic   = self::$topics[ array_rand( self::$topics ) ];
        $pattern = self::$title_patterns[ array_rand( self::$title_patterns ) ];

        if ( str_contains( $pattern, '%d' ) ) {
            $title = sprintf( str_replace( '%d', (string) wp_date( 'Y' ), $pattern ), $topic );
        } else {
            $title = sprintf( $pattern, $topic );
        }

        $sentences = (array) array_rand( array_flip( self::$lorem_sentences ), min( 5, count( self::$lorem_sentences ) ) );
        $content   = implode( "\n\n", $sentences );

        $id = wp_insert_post( [
            'post_title'   => $title,
            'post_content' => $content,
            'post_status'  => 'publish',
            'post_type'    => $type,
        ], true );

        if ( ! is_wp_error( $id ) ) {
            add_post_meta( $id, '_wmp_dummy_data', '1' );
        }

        return $id;
    }

    private static function generate_user(): int|\WP_Error {
        $first = self::$first_names[ array_rand( self::$first_names ) ];
        $last  = self::$last_names[ array_rand( self::$last_names ) ];
        $login = strtolower( $first . '.' . $last . '.' . wp_rand( 100, 999 ) );

        $id = wp_insert_user( [
            'user_login' => $login,
            'user_email' => $login . '@example-dummy.test',
            'first_name' => $first,
            'last_name'  => $last,
            'user_pass'  => wp_generate_password(),
            'role'       => 'subscriber',
        ] );

        if ( ! is_wp_error( $id ) ) {
            add_user_meta( $id, '_wmp_dummy_data', '1' );
        }

        return $id;
    }

    private static function generate_product(): int|\WP_Error {
        if ( ! class_exists( 'WooCommerce' ) ) {
            return new \WP_Error( 'no_woocommerce', 'WooCommerce is not active' );
        }
        return self::generate_post( 'product' );
    }

    public static function get_dummy_stats( \WP_REST_Request $request ): \WP_REST_Response {
        global $wpdb;

        $posts = (int) $wpdb->get_var(
            "SELECT COUNT(DISTINCT p.ID) FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
             WHERE pm.meta_key = '_wmp_dummy_data' AND pm.meta_value = '1'"
        );

        $users = (int) $wpdb->get_var(
            "SELECT COUNT(DISTINCT u.ID) FROM {$wpdb->users} u
             INNER JOIN {$wpdb->usermeta} um ON u.ID = um.user_id
             WHERE um.meta_key = '_wmp_dummy_data' AND um.meta_value = '1'"
        );

        $woo_active = class_exists( 'WooCommerce' );

        return new \WP_REST_Response( [
            'posts'       => $posts,
            'users'       => $users,
            'total'       => $posts + $users,
            'woo_active'  => $woo_active,
        ], 200 );
    }

    public static function delete_dummy( \WP_REST_Request $request ): \WP_REST_Response {
        global $wpdb;

        $post_ids = $wpdb->get_col(
            "SELECT DISTINCT p.ID FROM {$wpdb->posts} p
             INNER JOIN {$wpdb->postmeta} pm ON p.ID = pm.post_id
             WHERE pm.meta_key = '_wmp_dummy_data' AND pm.meta_value = '1'"
        );

        $deleted_posts = 0;
        foreach ( $post_ids as $id ) {
            if ( wp_delete_post( (int) $id, true ) ) {
                $deleted_posts++;
            }
        }

        $user_ids = $wpdb->get_col(
            "SELECT DISTINCT u.ID FROM {$wpdb->users} u
             INNER JOIN {$wpdb->usermeta} um ON u.ID = um.user_id
             WHERE um.meta_key = '_wmp_dummy_data' AND um.meta_value = '1'"
        );

        $deleted_users = 0;
        foreach ( $user_ids as $id ) {
            if ( wp_delete_user( (int) $id ) ) {
                $deleted_users++;
            }
        }

        return new \WP_REST_Response( [
            'deleted_posts' => $deleted_posts,
            'deleted_users' => $deleted_users,
            'total'         => $deleted_posts + $deleted_users,
        ], 200 );
    }

    // ── Rewrite Rules Tester ──────────────────────────────────────────────────

    public static function test_rewrite( \WP_REST_Request $request ): \WP_REST_Response {
        global $wp_rewrite;

        $rules_only = (bool) $request->get_param( 'rules_only' );
        $all_rules_raw = $wp_rewrite->wp_rewrite_rules();
        $all_rules  = [];

        foreach ( (array) $all_rules_raw as $pattern => $redirect ) {
            $all_rules[] = [ 'pattern' => $pattern, 'redirect' => $redirect ];
        }

        if ( $rules_only ) {
            return new \WP_REST_Response( [
                'all_rules' => $all_rules,
                'total'     => count( $all_rules ),
            ], 200 );
        }

        $url = sanitize_text_field( (string) $request->get_param( 'url' ) );

        // Strip site URL prefix.
        $url = str_replace( trailingslashit( site_url() ), '', $url );
        $url = ltrim( $url, '/' );

        $matched      = false;
        $matched_rule = '';
        $redirect_str = '';
        $query_vars   = [];
        $captures     = [];

        foreach ( (array) $all_rules_raw as $pattern => $redirect ) {
            if ( preg_match( '#^' . $pattern . '#', $url, $m ) ) {
                $matched      = true;
                $matched_rule = $pattern;
                $redirect_str = $redirect;
                $captures     = $m;

                // Substitute $matches[N] in redirect string.
                $resolved = preg_replace_callback(
                    '/\$matches\[(\d+)\]/',
                    static function ( $match ) use ( $m ) {
                        $idx = (int) $match[1];
                        return $m[ $idx ] ?? '';
                    },
                    $redirect
                );

                // Parse resolved query string into key=value pairs.
                parse_str( (string) ltrim( $resolved, '?' ), $qv );
                foreach ( $qv as $k => $v ) {
                    if ( $v !== '' ) {
                        $query_vars[ $k ] = $v;
                    }
                }
                break;
            }
        }

        return new \WP_REST_Response( [
            'url'        => $url,
            'matched'    => $matched,
            'rule'       => $matched_rule,
            'redirect'   => $redirect_str,
            'query_vars' => $query_vars,
            'matches'    => array_values( $captures ),
            'all_rules'  => $all_rules,
        ], 200 );
    }

    // ── Object Cache Browser ──────────────────────────────────────────────────

    public static function get_cache_keys( \WP_REST_Request $request ): \WP_REST_Response {
        global $wp_object_cache;
        $prefix = sanitize_text_field( (string) $request->get_param( 'prefix' ) );

        // Try to find Redis client.
        $redis = self::get_redis_client();

        if ( $redis ) {
            try {
                $pattern = $prefix ? '*' . $prefix . '*' : '*';
                $keys    = [];
                $cursor  = 0;

                do {
                    $result = $redis->scan( $cursor, [ 'match' => $pattern, 'count' => 100 ] );
                    if ( $result === false ) break;
                    [ $cursor, $batch ] = $result;
                    foreach ( $batch as $key ) {
                        $type_int = $redis->type( $key );
                        $keys[]   = [
                            'key'  => $key,
                            'type' => self::redis_type_name( $type_int ),
                            'ttl'  => $redis->ttl( $key ),
                        ];
                        if ( count( $keys ) >= 500 ) {
                            $cursor = 0;
                            break 2;
                        }
                    }
                } while ( $cursor !== 0 );

                return new \WP_REST_Response( [
                    'backend' => 'redis',
                    'keys'    => $keys,
                    'total'   => count( $keys ),
                ], 200 );
            } catch ( \Throwable ) {
                // Fall through to WP cache.
            }
        }

        // WP internal cache.
        if ( isset( $wp_object_cache->cache ) && is_array( $wp_object_cache->cache ) ) {
            $keys = [];
            foreach ( $wp_object_cache->cache as $group => $items ) {
                foreach ( array_keys( $items ) as $key ) {
                    $full = $group . ':' . $key;
                    if ( $prefix && stripos( $full, $prefix ) === false ) continue;
                    $keys[] = [
                        'key'  => $full,
                        'type' => 'string',
                        'ttl'  => -1,
                    ];
                }
            }

            return new \WP_REST_Response( [
                'backend' => 'wp',
                'keys'    => array_slice( $keys, 0, 500 ),
                'total'   => count( $keys ),
            ], 200 );
        }

        return new \WP_REST_Response( [
            'backend' => 'none',
            'keys'    => [],
            'total'   => 0,
        ], 200 );
    }

    public static function get_cache_value( \WP_REST_Request $request ): \WP_REST_Response {
        global $wp_object_cache;
        $key = sanitize_text_field( (string) $request->get_param( 'key' ) );

        if ( ! $key ) {
            return new \WP_REST_Response( [ 'error' => 'key is required' ], 400 );
        }

        $redis = self::get_redis_client();

        if ( $redis ) {
            try {
                $type_int = $redis->type( $key );
                $type     = self::redis_type_name( $type_int );
                $value    = match ( $type ) {
                    'list'   => $redis->lRange( $key, 0, -1 ),
                    'set'    => $redis->sMembers( $key ),
                    'zset'   => $redis->zRange( $key, 0, -1, true ),
                    'hash'   => $redis->hGetAll( $key ),
                    default  => $redis->get( $key ),
                };
                return new \WP_REST_Response( [
                    'key'   => $key,
                    'type'  => $type,
                    'value' => $value,
                ], 200 );
            } catch ( \Throwable $e ) {
                return new \WP_REST_Response( [ 'error' => $e->getMessage() ], 500 );
            }
        }

        // WP cache: expect "group:key" format.
        if ( str_contains( $key, ':' ) ) {
            [ $group, $item_key ] = explode( ':', $key, 2 );
        } else {
            $group    = 'default';
            $item_key = $key;
        }

        $value = wp_cache_get( $item_key, $group );
        return new \WP_REST_Response( [
            'key'   => $key,
            'type'  => 'string',
            'value' => $value,
        ], 200 );
    }

    public static function delete_cache_key( \WP_REST_Request $request ): \WP_REST_Response {
        $key = sanitize_text_field( (string) $request->get_param( 'key' ) );

        if ( ! $key ) {
            return new \WP_REST_Response( [ 'error' => 'key is required' ], 400 );
        }

        $redis = self::get_redis_client();

        if ( $redis ) {
            try {
                $deleted = $redis->del( $key );
                return new \WP_REST_Response( [ 'success' => $deleted > 0 ], 200 );
            } catch ( \Throwable $e ) {
                return new \WP_REST_Response( [ 'error' => $e->getMessage() ], 500 );
            }
        }

        if ( str_contains( $key, ':' ) ) {
            [ $group, $item_key ] = explode( ':', $key, 2 );
        } else {
            $group    = 'default';
            $item_key = $key;
        }

        $success = wp_cache_delete( $item_key, $group );
        return new \WP_REST_Response( [ 'success' => $success ], 200 );
    }

    private static function get_redis_client(): mixed {
        global $wp_object_cache;

        if ( ! is_object( $wp_object_cache ) ) return null;

        // Try method first.
        if ( method_exists( $wp_object_cache, 'redis_instance' ) ) {
            try {
                $client = $wp_object_cache->redis_instance();
                if ( $client instanceof \Redis ) return $client;
            } catch ( \Throwable ) {}
        }

        // Try common property names.
        foreach ( [ 'redis', 'redis_client', 'client', '_redis' ] as $prop ) {
            if ( isset( $wp_object_cache->$prop ) && $wp_object_cache->$prop instanceof \Redis ) {
                return $wp_object_cache->$prop;
            }
        }

        return null;
    }

    private static function redis_type_name( int $type ): string {
        // Use integer constants to avoid Redis:: class not found if Redis is not installed.
        return match ( $type ) {
            1 => 'string',
            2 => 'set',
            3 => 'list',
            4 => 'zset',
            5 => 'hash',
            default => 'none',
        };
    }

    // ── DB Prefix Changer ─────────────────────────────────────────────────────

    public static function get_prefix_info( \WP_REST_Request $request ): \WP_REST_Response {
        global $wpdb;

        $prefix = $wpdb->prefix;
        $raw    = $wpdb->get_results( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $prefix ) . '%' ), ARRAY_N );

        $tables = [];
        foreach ( $raw as $row ) {
            $name  = $row[0];
            $count = (int) $wpdb->get_var( "SELECT COUNT(*) FROM `{$name}`" ); // phpcs:ignore
            $tables[] = [ 'name' => $name, 'rows' => $count ];
        }

        return new \WP_REST_Response( [
            'current_prefix' => $prefix,
            'tables'         => $tables,
            'count'          => count( $tables ),
        ], 200 );
    }

    public static function change_prefix( \WP_REST_Request $request ): \WP_REST_Response {
        global $wpdb;

        $new_prefix = sanitize_text_field( (string) $request->get_param( 'new_prefix' ) );
        $dry_run    = (bool) $request->get_param( 'dry_run' );

        if ( ! $new_prefix ) {
            return new \WP_REST_Response( [ 'error' => 'new_prefix is required' ], 400 );
        }

        if ( ! preg_match( '/^[a-zA-Z0-9_]+$/', $new_prefix ) ) {
            return new \WP_REST_Response( [ 'error' => 'Prefix may only contain letters, numbers, and underscores' ], 400 );
        }

        if ( ! str_ends_with( $new_prefix, '_' ) ) {
            $new_prefix .= '_';
        }

        $old_prefix = $wpdb->prefix;

        if ( $new_prefix === $old_prefix ) {
            return new \WP_REST_Response( [ 'error' => 'New prefix is the same as the current prefix' ], 400 );
        }

        $raw = $wpdb->get_results( $wpdb->prepare( 'SHOW TABLES LIKE %s', $wpdb->esc_like( $old_prefix ) . '%' ), ARRAY_N );

        $tables = [];
        foreach ( $raw as $row ) {
            $tables[] = $row[0];
        }

        if ( $dry_run ) {
            $preview = [];
            foreach ( $tables as $t ) {
                $preview[] = [
                    'old' => $t,
                    'new' => $new_prefix . substr( $t, strlen( $old_prefix ) ),
                ];
            }
            return new \WP_REST_Response( [
                'dry_run'    => true,
                'old_prefix' => $old_prefix,
                'new_prefix' => $new_prefix,
                'preview'    => $preview,
                'count'      => count( $preview ),
            ], 200 );
        }

        $renamed = [];
        $errors  = [];

        foreach ( $tables as $t ) {
            $new_name = $new_prefix . substr( $t, strlen( $old_prefix ) );
            $result   = $wpdb->query( "RENAME TABLE `{$t}` TO `{$new_name}`" ); // phpcs:ignore
            if ( $result !== false ) {
                $renamed[] = [ 'old' => $t, 'new' => $new_name ];
            } else {
                $errors[] = "Failed to rename {$t}";
            }
        }

        // Update options table — option_name for old-prefixed rows (e.g. wp_user_roles).
        $new_options = $new_prefix . 'options';
        if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $new_options ) ) === $new_options ) {
            $wpdb->query(
                $wpdb->prepare(
                    "UPDATE `{$new_options}` SET option_name = REPLACE(option_name, %s, %s) WHERE option_name LIKE %s", // phpcs:ignore
                    $old_prefix,
                    $new_prefix,
                    $wpdb->esc_like( $old_prefix ) . '%'
                )
            );
        }

        // Update usermeta table — meta_key for old-prefixed capability / session rows.
        $new_usermeta = $new_prefix . 'usermeta';
        if ( $wpdb->get_var( $wpdb->prepare( 'SHOW TABLES LIKE %s', $new_usermeta ) ) === $new_usermeta ) {
            $wpdb->query(
                $wpdb->prepare(
                    "UPDATE `{$new_usermeta}` SET meta_key = REPLACE(meta_key, %s, %s) WHERE meta_key LIKE %s", // phpcs:ignore
                    $old_prefix,
                    $new_prefix,
                    $wpdb->esc_like( $old_prefix ) . '%'
                )
            );
        }

        // Update wp-config.php $table_prefix line.
        $config_updated = false;
        $config_path    = ABSPATH . 'wp-config.php';

        if ( is_writable( $config_path ) ) {
            $config  = file_get_contents( $config_path );
            $updated = preg_replace(
                '/(\$table_prefix\s*=\s*)[\'"]' . preg_quote( $old_prefix, '/' ) . '[\'"]\s*;/',
                '${1}\'' . addslashes( $new_prefix ) . '\';',
                (string) $config
            );
            if ( $updated && $updated !== $config ) {
                file_put_contents( $config_path, $updated );
                $config_updated = true;
            }
        }

        return new \WP_REST_Response( [
            'success'        => count( $errors ) === 0,
            'old_prefix'     => $old_prefix,
            'new_prefix'     => $new_prefix,
            'tables_renamed' => count( $renamed ),
            'renamed'        => $renamed,
            'errors'         => $errors,
            'config_updated' => $config_updated,
        ], 200 );
    }
}
