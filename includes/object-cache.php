<?php
/**
 * WP Manager Pro — Redis Object Cache Drop-in
 *
 * A standalone Redis object cache drop-in that requires no other plugin.
 * Install via WP Manager Pro → Performance → Object Cache → Enable Object Cache.
 *
 * Requires: PHP Redis extension (PhpRedis)
 * Supports: WP_REDIS_HOST, WP_REDIS_PORT, WP_REDIS_PASSWORD, WP_REDIS_USERNAME,
 *           WP_REDIS_DATABASE, WP_REDIS_SCHEME, WP_REDIS_TIMEOUT,
 *           WP_REDIS_READ_TIMEOUT, WP_REDIS_PREFIX, WP_CACHE_KEY_SALT
 *
 * @package    WP_Manager_Pro
 * @version    1.0.0
 * @wmp-dropin true
 */

defined( 'ABSPATH' ) || exit;

// ── Global wp_cache_* functions ────────────────────────────────────────────────

function wp_cache_init() {
    global $wp_object_cache;
    $wp_object_cache = new WP_Object_Cache();
}

function wp_cache_add( $key, $data, $group = 'default', $expire = 0 ) {
    global $wp_object_cache;
    return $wp_object_cache->add( $key, $data, $group, (int) $expire );
}

function wp_cache_add_multiple( array $items, $group = 'default', $expire = 0 ) {
    global $wp_object_cache;
    $out = [];
    foreach ( $items as $key => $value ) {
        $out[ $key ] = $wp_object_cache->add( $key, $value, $group, (int) $expire );
    }
    return $out;
}

function wp_cache_replace( $key, $data, $group = 'default', $expire = 0 ) {
    global $wp_object_cache;
    return $wp_object_cache->replace( $key, $data, $group, (int) $expire );
}

function wp_cache_set( $key, $data, $group = 'default', $expire = 0 ) {
    global $wp_object_cache;
    return $wp_object_cache->set( $key, $data, $group, (int) $expire );
}

function wp_cache_set_multiple( array $items, $group = 'default', $expire = 0 ) {
    global $wp_object_cache;
    $out = [];
    foreach ( $items as $key => $value ) {
        $out[ $key ] = $wp_object_cache->set( $key, $value, $group, (int) $expire );
    }
    return $out;
}

function wp_cache_get( $key, $group = 'default', $force = false, &$found = null ) {
    global $wp_object_cache;
    return $wp_object_cache->get( $key, $group, $force, $found );
}

function wp_cache_get_multiple( $keys, $group = 'default', $force = false ) {
    global $wp_object_cache;
    $out = [];
    foreach ( (array) $keys as $key ) {
        $out[ $key ] = $wp_object_cache->get( $key, $group, $force );
    }
    return $out;
}

function wp_cache_delete( $key, $group = 'default' ) {
    global $wp_object_cache;
    return $wp_object_cache->delete( $key, $group );
}

function wp_cache_delete_multiple( array $keys, $group = 'default' ) {
    global $wp_object_cache;
    $out = [];
    foreach ( $keys as $key ) {
        $out[ $key ] = $wp_object_cache->delete( $key, $group );
    }
    return $out;
}

function wp_cache_incr( $key, $offset = 1, $group = 'default' ) {
    global $wp_object_cache;
    return $wp_object_cache->incr( $key, $offset, $group );
}

function wp_cache_decr( $key, $offset = 1, $group = 'default' ) {
    global $wp_object_cache;
    return $wp_object_cache->decr( $key, $offset, $group );
}

function wp_cache_flush() {
    global $wp_object_cache;
    return $wp_object_cache->flush();
}

function wp_cache_flush_runtime() {
    global $wp_object_cache;
    $wp_object_cache->flush_runtime();
    return true;
}

function wp_cache_flush_group( $group ) {
    global $wp_object_cache;
    return $wp_object_cache->flush_group( $group );
}

function wp_cache_close() {
    global $wp_object_cache;
    return $wp_object_cache->close();
}

function wp_cache_add_global_groups( $groups ) {
    global $wp_object_cache;
    $wp_object_cache->add_global_groups( $groups );
}

function wp_cache_add_non_persistent_groups( $groups ) {
    global $wp_object_cache;
    $wp_object_cache->add_non_persistent_groups( $groups );
}

function wp_cache_switch_to_blog( $blog_id ) {
    global $wp_object_cache;
    $wp_object_cache->switch_to_blog( $blog_id );
}

function wp_cache_supports( $feature ) {
    return in_array( $feature, [
        'add_multiple', 'set_multiple', 'get_multiple', 'delete_multiple',
        'flush_runtime', 'flush_group',
    ], true );
}

// ── WP_Object_Cache ────────────────────────────────────────────────────────────

class WP_Object_Cache {

    /** @var \Redis|null */
    private $redis = null;

    /** @var bool */
    private $connected = false;

    /** @var string Connection error message */
    private $connect_error = '';

    /** @var string Prefix applied to all keys */
    private $prefix = '';

    /** @var int|string Blog prefix for multisite */
    private $blog_prefix = '';

    /** @var array Runtime (in-memory) cache */
    public $cache = [];

    /** @var string[] Groups stored globally across all blogs */
    private $global_groups = [
        'blog-details', 'blog-id-cache', 'blog-lookup', 'global-posts',
        'networks', 'rss', 'sites', 'site-details', 'site-lookup',
        'site-options', 'site-transient', 'users', 'useremail',
        'userlogins', 'usermeta', 'user_meta', 'userslugs',
        'blog_meta', 'image_editor', 'network-queries', 'site-queries',
        'theme_files', 'translation_files', 'user-queries',
    ];

    /** @var string[] Groups never persisted to Redis */
    private $ignored_groups = [ 'counts', 'plugins', 'theme_json', 'themes' ];

    /** @var int */
    public $cache_hits = 0;

    /** @var int */
    public $cache_misses = 0;

    /** @var string */
    public $dropin_version = '1.0.0';

    public function __construct() {
        global $blog_id;

        // Resolve key prefix: WP_REDIS_PREFIX → WP_CACHE_KEY_SALT → empty
        $prefix = '';
        if ( defined( 'WP_REDIS_PREFIX' ) && WP_REDIS_PREFIX !== '' ) {
            $prefix = WP_REDIS_PREFIX;
        } elseif ( defined( 'WP_CACHE_KEY_SALT' ) && WP_CACHE_KEY_SALT !== '' ) {
            $prefix = WP_CACHE_KEY_SALT;
        }
        $this->prefix      = $prefix;
        $this->blog_prefix = is_multisite() ? (int) $blog_id : '';

        $this->connect();
    }

    // ── Connection ─────────────────────────────────────────────────────────────

    private function connect() {
        if ( ! class_exists( 'Redis' ) ) {
            $this->connect_error = 'PhpRedis extension is not loaded.';
            return;
        }

        $scheme   = defined( 'WP_REDIS_SCHEME' )       ? WP_REDIS_SCHEME             : 'tcp';
        $host     = defined( 'WP_REDIS_HOST' )          ? WP_REDIS_HOST               : '127.0.0.1';
        $port     = defined( 'WP_REDIS_PORT' )          ? (int) WP_REDIS_PORT         : 6379;
        $db       = defined( 'WP_REDIS_DATABASE' )      ? (int) WP_REDIS_DATABASE     : 0;
        $timeout  = defined( 'WP_REDIS_TIMEOUT' )       ? (float) WP_REDIS_TIMEOUT    : 1.0;
        $read_to  = defined( 'WP_REDIS_READ_TIMEOUT' )  ? (float) WP_REDIS_READ_TIMEOUT : 1.0;

        try {
            $this->redis = new Redis();

            if ( in_array( $scheme, [ 'unix', 'socket' ], true ) ) {
                $this->redis->connect( $host );
            } else {
                $this->redis->connect( $host, $port, $timeout, null, 0, $read_to );
            }

            if ( defined( 'WP_REDIS_PASSWORD' ) && WP_REDIS_PASSWORD !== '' ) {
                if ( defined( 'WP_REDIS_USERNAME' ) && WP_REDIS_USERNAME !== '' ) {
                    $this->redis->auth( [ WP_REDIS_USERNAME, WP_REDIS_PASSWORD ] );
                } else {
                    $this->redis->auth( WP_REDIS_PASSWORD );
                }
            }

            if ( $db > 0 ) {
                $this->redis->select( $db );
            }

            // Use PHP native serialization so all types are stored correctly.
            $this->redis->setOption( Redis::OPT_SERIALIZER, Redis::SERIALIZER_PHP );

            $this->connected = true;

        } catch ( Exception $e ) {
            $this->redis         = null;
            $this->connected     = false;
            $this->connect_error = $e->getMessage();
        }
    }

    // ── Key building ───────────────────────────────────────────────────────────

    private function build_key( $key, $group ) {
        $group = $group ?: 'default';
        $key   = (string) $key;

        // Strip characters Redis treats as special in key names
        $key = preg_replace( '/[\x00-\x1F\x7F]/', '_', $key );

        $blog_prefix = in_array( $group, $this->global_groups, true ) ? '' : (string) $this->blog_prefix;

        if ( $this->prefix !== '' ) {
            return $this->prefix . ':' . $blog_prefix . ':' . $group . ':' . $key;
        }
        return $blog_prefix . ':' . $group . ':' . $key;
    }

    private function is_ignored( $group ) {
        return in_array( $group ?: 'default', $this->ignored_groups, true );
    }

    // ── Cache API ──────────────────────────────────────────────────────────────

    public function add( $key, $data, $group = 'default', $expire = 0 ) {
        if ( false !== $this->get( $key, $group ) ) {
            return false;
        }
        return $this->set( $key, $data, $group, $expire );
    }

    public function replace( $key, $data, $group = 'default', $expire = 0 ) {
        if ( false === $this->get( $key, $group ) ) {
            return false;
        }
        return $this->set( $key, $data, $group, $expire );
    }

    public function set( $key, $data, $group = 'default', $expire = 0 ) {
        $group = $group ?: 'default';
        $rkey  = $this->build_key( $key, $group );

        $this->cache[ $rkey ] = is_object( $data ) ? clone $data : $data;

        if ( $this->is_ignored( $group ) || ! $this->connected ) {
            return true;
        }

        try {
            if ( $expire > 0 ) {
                $this->redis->setEx( $rkey, $expire, $data );
            } else {
                $this->redis->set( $rkey, $data );
            }
            return true;
        } catch ( Exception $e ) {
            return false;
        }
    }

    public function get( $key, $group = 'default', $force = false, &$found = null ) {
        $group = $group ?: 'default';
        $rkey  = $this->build_key( $key, $group );

        if ( ! $force && array_key_exists( $rkey, $this->cache ) ) {
            $found = true;
            $this->cache_hits++;
            $v = $this->cache[ $rkey ];
            return is_object( $v ) ? clone $v : $v;
        }

        if ( $this->is_ignored( $group ) || ! $this->connected ) {
            $found = false;
            $this->cache_misses++;
            return false;
        }

        try {
            $value = $this->redis->get( $rkey );

            if ( $value === false ) {
                $found = false;
                $this->cache_misses++;
                return false;
            }

            $found                = true;
            $this->cache_hits++;
            $this->cache[ $rkey ] = $value;
            return is_object( $value ) ? clone $value : $value;

        } catch ( Exception $e ) {
            $found = false;
            $this->cache_misses++;
            return false;
        }
    }

    public function delete( $key, $group = 'default' ) {
        $group = $group ?: 'default';
        $rkey  = $this->build_key( $key, $group );

        unset( $this->cache[ $rkey ] );

        if ( $this->is_ignored( $group ) || ! $this->connected ) {
            return true;
        }

        try {
            return (bool) $this->redis->del( $rkey );
        } catch ( Exception $e ) {
            return false;
        }
    }

    public function incr( $key, $offset = 1, $group = 'default' ) {
        $group  = $group ?: 'default';
        $rkey   = $this->build_key( $key, $group );
        $offset = max( 1, (int) $offset );

        if ( $this->is_ignored( $group ) || ! $this->connected ) {
            $val = (int) ( $this->cache[ $rkey ] ?? 0 ) + $offset;
            $this->cache[ $rkey ] = $val;
            return $val;
        }

        try {
            // Ensure key exists as integer
            if ( ! $this->redis->exists( $rkey ) ) {
                $this->redis->set( $rkey, 0 );
                $this->redis->setOption( Redis::OPT_SERIALIZER, Redis::SERIALIZER_NONE );
            }
            $val = $this->redis->incrBy( $rkey, $offset );
            $this->cache[ $rkey ] = $val;
            return $val;
        } catch ( Exception $e ) {
            return false;
        }
    }

    public function decr( $key, $offset = 1, $group = 'default' ) {
        $group  = $group ?: 'default';
        $rkey   = $this->build_key( $key, $group );
        $offset = max( 1, (int) $offset );

        if ( $this->is_ignored( $group ) || ! $this->connected ) {
            $val = max( 0, (int) ( $this->cache[ $rkey ] ?? 0 ) - $offset );
            $this->cache[ $rkey ] = $val;
            return $val;
        }

        try {
            $val = max( 0, (int) $this->redis->decrBy( $rkey, $offset ) );
            $this->cache[ $rkey ] = $val;
            return $val;
        } catch ( Exception $e ) {
            return false;
        }
    }

    public function flush() {
        $this->flush_runtime();

        if ( ! $this->connected ) {
            return true;
        }

        try {
            if ( $this->prefix !== '' ) {
                $this->scan_delete( $this->prefix . ':*' );
            } else {
                $this->redis->flushDb();
            }
            return true;
        } catch ( Exception $e ) {
            return false;
        }
    }

    public function flush_runtime() {
        $this->cache = [];
    }

    public function flush_group( $group ) {
        $group = $group ?: 'default';

        // Clear from runtime cache
        foreach ( array_keys( $this->cache ) as $k ) {
            if ( false !== strpos( $k, ':' . $group . ':' ) ) {
                unset( $this->cache[ $k ] );
            }
        }

        if ( ! $this->connected ) {
            return true;
        }

        try {
            $pattern = $this->build_key( '*', $group );
            $this->scan_delete( $pattern );
            return true;
        } catch ( Exception $e ) {
            return false;
        }
    }

    private function scan_delete( $pattern ) {
        $cursor = null;
        do {
            $keys = $this->redis->scan( $cursor, $pattern, 1000 );
            if ( is_array( $keys ) && ! empty( $keys ) ) {
                $this->redis->del( $keys );
            }
        } while ( $cursor );
    }

    public function close() {
        if ( $this->connected && $this->redis ) {
            try { $this->redis->close(); } catch ( Exception $e ) {} // phpcs:ignore
        }
        $this->connected = false;
        return true;
    }

    // ── Group management ───────────────────────────────────────────────────────

    public function add_global_groups( $groups ) {
        $this->global_groups = array_unique( array_merge( $this->global_groups, (array) $groups ) );
    }

    public function add_non_persistent_groups( $groups ) {
        $this->ignored_groups = array_unique( array_merge( $this->ignored_groups, (array) $groups ) );
    }

    public function switch_to_blog( $blog_id ) {
        $this->blog_prefix = is_multisite() ? (int) $blog_id : '';
    }

    // ── Stats / diagnostics (used by WP Manager Pro REST API) ─────────────────

    public function is_connected(): bool {
        return $this->connected;
    }

    public function get_connect_error(): string {
        return $this->connect_error;
    }

    public function get_redis_server_info(): ?array {
        if ( ! $this->connected ) return null;
        try {
            return $this->redis->info();
        } catch ( Exception $e ) {
            return null;
        }
    }

    public function get_redis_keyspace(): ?array {
        if ( ! $this->connected ) return null;
        try {
            return $this->redis->info( 'keyspace' );
        } catch ( Exception $e ) {
            return null;
        }
    }

    public function get_key_prefix(): string {
        return $this->prefix;
    }

    public function get_global_groups(): array {
        return $this->global_groups;
    }

    public function get_ignored_groups(): array {
        return $this->ignored_groups;
    }

    public function ping(): bool {
        if ( ! $this->connected ) return false;
        try {
            return $this->redis->ping() === true || $this->redis->ping() === '+PONG';
        } catch ( Exception $e ) {
            return false;
        }
    }
}
