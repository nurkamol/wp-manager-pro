<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Dev_Tools_Controller {

    // ── Constant groups ───────────────────────────────────────────────────────

    private static $groups = [
        'database' => [ 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST', 'DB_CHARSET', 'DB_COLLATE' ],
        'debug'    => [ 'WP_DEBUG', 'WP_DEBUG_LOG', 'WP_DEBUG_DISPLAY', 'SCRIPT_DEBUG', 'SAVEQUERIES' ],
        'salts'    => [ 'AUTH_KEY', 'SECURE_AUTH_KEY', 'LOGGED_IN_KEY', 'NONCE_KEY', 'AUTH_SALT', 'SECURE_AUTH_SALT', 'LOGGED_IN_SALT', 'NONCE_SALT' ],
        'urls'     => [ 'WP_HOME', 'WP_SITEURL' ],
        'memory'   => [ 'WP_MEMORY_LIMIT', 'WP_MAX_MEMORY_LIMIT', 'WP_CACHE', 'WP_LANG' ],
    ];

    // ── wp-config.php helpers ─────────────────────────────────────────────────

    private static function get_wp_config_path() {
        $config = ABSPATH . 'wp-config.php';
        if ( ! file_exists( $config ) ) {
            $config = dirname( ABSPATH ) . '/wp-config.php';
        }
        return $config;
    }

    private static function resolve_group( string $name ): string {
        foreach ( self::$groups as $group => $constants ) {
            if ( in_array( $name, $constants, true ) ) {
                return $group;
            }
        }
        return 'custom';
    }

    private static function mask_salt( string $value ): string {
        if ( strlen( $value ) <= 8 ) {
            return str_repeat( '•', strlen( $value ) );
        }
        return substr( $value, 0, 4 ) . '••••••••' . substr( $value, -4 );
    }

    private static function cast_value( string $raw ): array {
        $trimmed = trim( $raw, " \t\n\r\0\x0B\"'" );

        if ( strtolower( $trimmed ) === 'true' || $trimmed === '1' ) {
            return [ 'value' => true, 'type' => 'bool' ];
        }
        if ( strtolower( $trimmed ) === 'false' || $trimmed === '0' ) {
            return [ 'value' => false, 'type' => 'bool' ];
        }
        if ( is_numeric( $trimmed ) && strpos( $trimmed, '.' ) === false ) {
            return [ 'value' => (int) $trimmed, 'type' => 'int' ];
        }
        return [ 'value' => $trimmed, 'type' => 'string' ];
    }

    // ── GET /dev-tools/wp-config ──────────────────────────────────────────────

    public static function get_wp_config( WP_REST_Request $request ) {
        $config_file = self::get_wp_config_path();

        if ( ! file_exists( $config_file ) ) {
            return new WP_Error( 'config_not_found', 'wp-config.php not found.', [ 'status' => 404 ] );
        }

        $content  = file_get_contents( $config_file );
        $lines    = explode( "\n", $content );
        $parsed   = [];

        // Regex matches: define( 'CONST', value ) or define("CONST", value)
        $pattern = "/^\s*define\s*\(\s*['\"]([^'\"]+)['\"]\s*,\s*(.*?)\s*\)\s*;/";

        foreach ( $lines as $line_num => $line ) {
            if ( preg_match( $pattern, $line, $m ) ) {
                $name     = $m[1];
                $raw      = trim( $m[2] );
                $casted   = self::cast_value( $raw );
                $group    = self::resolve_group( $name );

                $display_value = $casted['value'];

                // Mask salts.
                if ( $group === 'salts' && is_string( $display_value ) ) {
                    $display_value = self::mask_salt( $display_value );
                }

                $parsed[ $name ] = [
                    'name'  => $name,
                    'value' => $display_value,
                    'type'  => $casted['type'],
                    'raw'   => $raw,
                    'line'  => $line_num + 1,
                    'group' => $group,
                ];
            }
        }

        // Build grouped output.
        $grouped = [];
        foreach ( array_keys( self::$groups ) as $g ) {
            $grouped[ $g ] = [];
        }
        $grouped['custom'] = [];

        foreach ( $parsed as $name => $entry ) {
            $grouped[ $entry['group'] ][] = $entry;
        }

        return new WP_REST_Response( [
            'groups'   => $grouped,
            'writable' => is_writable( $config_file ),
            'path'     => $config_file,
            'size'     => filesize( $config_file ),
        ], 200 );
    }

    // ── POST /dev-tools/wp-config ─────────────────────────────────────────────

    public static function save_wp_config_constant( WP_REST_Request $request ) {
        $name  = sanitize_text_field( $request->get_param( 'name' ) );
        $value = $request->get_param( 'value' );
        $type  = sanitize_text_field( $request->get_param( 'type' ) );

        if ( empty( $name ) ) {
            return new WP_Error( 'invalid_name', 'Constant name is required.', [ 'status' => 400 ] );
        }

        $config_file = self::get_wp_config_path();

        if ( ! file_exists( $config_file ) ) {
            return new WP_Error( 'config_not_found', 'wp-config.php not found.', [ 'status' => 404 ] );
        }

        if ( ! is_writable( $config_file ) ) {
            return new WP_Error( 'config_not_writable', 'wp-config.php is not writable.', [ 'status' => 403 ] );
        }

        $content = file_get_contents( $config_file );

        // Build the new value string.
        if ( $type === 'bool' ) {
            $new_val_str = ( $value === true || $value === 'true' || $value === '1' || $value === 1 ) ? 'true' : 'false';
        } elseif ( $type === 'int' ) {
            $new_val_str = (string) (int) $value;
        } else {
            // Escape any single quotes in the value.
            $escaped     = str_replace( "'", "\\'", (string) $value );
            $new_val_str = "'{$escaped}'";
        }

        $replacement = "define( '{$name}', {$new_val_str} )";

        // Try to replace existing define.
        $pattern = "/define\s*\(\s*['\"]" . preg_quote( $name, '/' ) . "['\"],\s*.*?\s*\)/";

        if ( preg_match( $pattern, $content ) ) {
            $content = preg_replace( $pattern, $replacement, $content );
        } else {
            // Add before "That's all, stop editing!" comment.
            $insert_before = "/* That's all, stop editing!";
            if ( strpos( $content, $insert_before ) !== false ) {
                $content = str_replace(
                    $insert_before,
                    "{$replacement};\n\n" . $insert_before,
                    $content
                );
            } else {
                // Fallback: append at end.
                $content .= "\n{$replacement};\n";
            }
        }

        $result = file_put_contents( $config_file, $content );

        if ( $result === false ) {
            return new WP_Error( 'write_failed', 'Failed to update wp-config.php.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [
            'success' => true,
            'name'    => $name,
            'value'   => $value,
            'type'    => $type,
        ], 200 );
    }

    // ── GET /dev-tools/htaccess ───────────────────────────────────────────────

    public static function get_htaccess( WP_REST_Request $request ) {
        $path    = ABSPATH . '.htaccess';
        $backup  = $request->get_param( 'backup' );

        if ( $backup ) {
            $backup_path = ABSPATH . '.htaccess.wmp-backup';
            if ( ! file_exists( $backup_path ) ) {
                return new WP_Error( 'no_backup', 'No backup file found.', [ 'status' => 404 ] );
            }
            return new WP_REST_Response( [
                'content'  => file_get_contents( $backup_path ),
                'exists'   => true,
                'writable' => is_writable( $backup_path ),
                'size'     => filesize( $backup_path ),
                'path'     => $backup_path,
            ], 200 );
        }

        if ( ! file_exists( $path ) ) {
            return new WP_REST_Response( [
                'content'  => '',
                'exists'   => false,
                'writable' => is_writable( ABSPATH ),
                'size'     => 0,
                'path'     => $path,
            ], 200 );
        }

        return new WP_REST_Response( [
            'content'  => file_get_contents( $path ),
            'exists'   => true,
            'writable' => is_writable( $path ),
            'size'     => filesize( $path ),
            'path'     => $path,
        ], 200 );
    }

    // ── POST /dev-tools/htaccess ──────────────────────────────────────────────

    public static function save_htaccess( WP_REST_Request $request ) {
        $content = $request->get_param( 'content' );

        if ( $content === null ) {
            return new WP_Error( 'missing_content', 'Content is required.', [ 'status' => 400 ] );
        }

        $path        = ABSPATH . '.htaccess';
        $backup_path = ABSPATH . '.htaccess.wmp-backup';

        // Backup current content before saving.
        if ( file_exists( $path ) ) {
            $current = file_get_contents( $path );
            if ( file_put_contents( $backup_path, $current ) === false ) {
                return new WP_Error( 'backup_failed', 'Failed to create backup of .htaccess.', [ 'status' => 500 ] );
            }
        }

        $result = file_put_contents( $path, $content );

        if ( $result === false ) {
            return new WP_Error( 'write_failed', 'Failed to save .htaccess.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [
            'success' => true,
            'message' => '.htaccess saved successfully. Previous version backed up.',
            'size'    => strlen( $content ),
            'path'    => $path,
        ], 200 );
    }

    // ── GET /dev-tools/phpinfo ────────────────────────────────────────────────

    public static function get_phpinfo( WP_REST_Request $request ) {
        ob_start();
        phpinfo();
        $html = ob_get_clean();

        $sections = [];

        // Use DOMDocument to parse phpinfo HTML.
        $doc = new \DOMDocument();
        libxml_use_internal_errors( true );
        @$doc->loadHTML( '<?xml encoding="utf-8" ?>' . $html );
        libxml_clear_errors();

        $xpath = new \DOMXPath( $doc );

        // phpinfo uses <h2> for section titles and <table> for data.
        $h2_nodes = $xpath->query( '//h2' );

        if ( $h2_nodes && $h2_nodes->length > 0 ) {
            foreach ( $h2_nodes as $h2 ) {
                $title  = trim( $h2->textContent );
                $rows   = [];

                // Get the next sibling table(s).
                $sibling = $h2->nextSibling;
                while ( $sibling ) {
                    if ( $sibling->nodeName === 'table' ) {
                        $tr_nodes = $xpath->query( './/tr', $sibling );
                        foreach ( $tr_nodes as $tr ) {
                            $tds = $xpath->query( './/td', $tr );
                            if ( $tds && $tds->length >= 1 ) {
                                $directive    = trim( $tds->item( 0 )->textContent );
                                $local_value  = $tds->length >= 2 ? trim( $tds->item( 1 )->textContent ) : '';
                                $master_value = $tds->length >= 3 ? trim( $tds->item( 2 )->textContent ) : '';

                                if ( ! empty( $directive ) ) {
                                    $rows[] = [
                                        'directive'    => $directive,
                                        'local_value'  => $local_value,
                                        'master_value' => $master_value,
                                    ];
                                }
                            }
                        }
                        break; // Only the first table after each h2.
                    }
                    $sibling = $sibling->nextSibling;
                }

                if ( ! empty( $rows ) || ! empty( $title ) ) {
                    $sections[] = [
                        'title' => $title,
                        'rows'  => $rows,
                    ];
                }
            }
        }

        // Fallback: regex parse if DOMDocument produced no results.
        if ( empty( $sections ) ) {
            $sections = self::parse_phpinfo_regex( $html );
        }

        return new WP_REST_Response( [
            'sections'   => $sections,
            'php_version' => PHP_VERSION,
        ], 200 );
    }

    private static function parse_phpinfo_regex( string $html ): array {
        $sections = [];

        // Extract section titles.
        preg_match_all( '/<h2[^>]*>(.*?)<\/h2>/si', $html, $titles );

        // Extract tables.
        preg_match_all( '/<table[^>]*>(.*?)<\/table>/si', $html, $tables );

        $section_count = count( $titles[1] );

        for ( $i = 0; $i < $section_count; $i++ ) {
            $title = strip_tags( $titles[1][ $i ] );
            $rows  = [];

            if ( isset( $tables[1][ $i ] ) ) {
                preg_match_all( '/<tr[^>]*>(.*?)<\/tr>/si', $tables[1][ $i ], $tr_matches );
                foreach ( $tr_matches[1] as $tr ) {
                    preg_match_all( '/<td[^>]*>(.*?)<\/td>/si', $tr, $td_matches );
                    $tds = array_map( 'strip_tags', $td_matches[1] );
                    if ( count( $tds ) >= 1 && ! empty( trim( $tds[0] ) ) ) {
                        $rows[] = [
                            'directive'    => trim( $tds[0] ),
                            'local_value'  => isset( $tds[1] ) ? trim( $tds[1] ) : '',
                            'master_value' => isset( $tds[2] ) ? trim( $tds[2] ) : '',
                        ];
                    }
                }
            }

            $sections[] = [
                'title' => trim( $title ),
                'rows'  => $rows,
            ];
        }

        return $sections;
    }

    // ── GET /dev-tools/query-monitor ──────────────────────────────────────────

    public static function get_query_monitor( WP_REST_Request $request ) {
        $enabled = defined( 'SAVEQUERIES' ) && SAVEQUERIES;

        if ( ! $enabled ) {
            return new WP_REST_Response( [
                'enabled'      => false,
                'instructions' => 'Enable SAVEQUERIES in wp-config.php to track database queries. Navigate to Debug Tools and toggle SAVEQUERIES on.',
            ], 200 );
        }

        global $wpdb;

        $queries = isset( $wpdb->queries ) ? (array) $wpdb->queries : [];

        // Sort by time descending.
        usort( $queries, function( $a, $b ) {
            return $b[1] <=> $a[1];
        } );

        $total_time  = 0.0;
        $slow        = [];
        $all_trimmed = [];

        foreach ( $queries as $q ) {
            $sql    = isset( $q[0] ) ? $q[0] : '';
            $time   = isset( $q[1] ) ? (float) $q[1] : 0.0;
            $caller = isset( $q[2] ) ? $q[2] : '';

            $total_time += $time;

            $entry = [
                'sql'    => strlen( $sql ) > 200 ? substr( $sql, 0, 200 ) . '…' : $sql,
                'time'   => $time,
                'caller' => $caller,
                'slow'   => $time > 0.05,
            ];

            if ( $time > 0.05 ) {
                $slow[] = $entry;
            }

            $all_trimmed[] = $entry;
        }

        $all_trimmed = array_slice( $all_trimmed, 0, 50 );

        $peak_bytes = memory_get_peak_usage( true );
        $peak_fmt   = self::format_bytes( $peak_bytes );

        return new WP_REST_Response( [
            'enabled'       => true,
            'total_queries' => count( $queries ),
            'total_time'    => round( $total_time, 6 ),
            'slow_queries'  => $slow,
            'all_queries'   => $all_trimmed,
            'memory_peak'   => $peak_fmt,
        ], 200 );
    }

    private static function format_bytes( int $bytes ): string {
        if ( $bytes >= 1073741824 ) {
            return round( $bytes / 1073741824, 2 ) . ' GB';
        }
        if ( $bytes >= 1048576 ) {
            return round( $bytes / 1048576, 2 ) . ' MB';
        }
        if ( $bytes >= 1024 ) {
            return round( $bytes / 1024, 2 ) . ' KB';
        }
        return $bytes . ' B';
    }

    // ── GET /dev-tools/environment ────────────────────────────────────────────

    public static function get_environment( WP_REST_Request $request ) {
        $custom_option = get_option( 'wmp_environment_type', '' );

        // WP_ENVIRONMENT_TYPE constant takes precedence.
        if ( defined( 'WP_ENVIRONMENT_TYPE' ) ) {
            return new WP_REST_Response( [
                'type'   => WP_ENVIRONMENT_TYPE,
                'source' => 'constant',
                'custom' => $custom_option,
            ], 200 );
        }

        $type = ! empty( $custom_option ) ? $custom_option : 'production';

        return new WP_REST_Response( [
            'type'   => $type,
            'source' => 'option',
            'custom' => $custom_option,
        ], 200 );
    }

    // ── POST /dev-tools/environment ───────────────────────────────────────────

    public static function save_environment( WP_REST_Request $request ) {
        $type = sanitize_text_field( $request->get_param( 'type' ) );

        if ( empty( $type ) ) {
            return new WP_Error( 'invalid_type', 'Environment type is required.', [ 'status' => 400 ] );
        }

        update_option( 'wmp_environment_type', $type );

        return new WP_REST_Response( [
            'success' => true,
            'type'    => $type,
            'source'  => defined( 'WP_ENVIRONMENT_TYPE' ) ? 'constant' : 'option',
        ], 200 );
    }
}
