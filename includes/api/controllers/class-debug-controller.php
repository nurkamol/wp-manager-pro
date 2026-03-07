<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Debug_Controller {

    private static function get_wp_config_path() {
        $config = ABSPATH . 'wp-config.php';
        if ( ! file_exists( $config ) ) {
            $config = dirname( ABSPATH ) . '/wp-config.php';
        }
        return $config;
    }

    public static function get_debug_info( WP_REST_Request $request ) {
        $log_file = self::get_log_file_path();

        return new WP_REST_Response( [
            'wp_debug'         => defined( 'WP_DEBUG' ) && WP_DEBUG,
            'wp_debug_log'     => defined( 'WP_DEBUG_LOG' ) && WP_DEBUG_LOG,
            'wp_debug_display' => defined( 'WP_DEBUG_DISPLAY' ) && WP_DEBUG_DISPLAY,
            'savequeries'      => defined( 'SAVEQUERIES' ) && SAVEQUERIES,
            'script_debug'     => defined( 'SCRIPT_DEBUG' ) && SCRIPT_DEBUG,
            'log_file'         => $log_file,
            'log_exists'       => file_exists( $log_file ),
            'log_size'         => file_exists( $log_file ) ? filesize( $log_file ) : 0,
            'config_writable'  => is_writable( self::get_wp_config_path() ),
        ], 200 );
    }

    public static function toggle_debug( WP_REST_Request $request ) {
        $wp_debug         = (bool) $request->get_param( 'wp_debug' );
        $wp_debug_log     = (bool) $request->get_param( 'wp_debug_log' );
        $wp_debug_display = (bool) $request->get_param( 'wp_debug_display' );
        $savequeries      = (bool) $request->get_param( 'savequeries' );
        $script_debug     = (bool) $request->get_param( 'script_debug' );

        $config_file = self::get_wp_config_path();

        if ( ! file_exists( $config_file ) ) {
            return new WP_Error( 'config_not_found', 'wp-config.php not found.', [ 'status' => 404 ] );
        }

        if ( ! is_writable( $config_file ) ) {
            return new WP_Error( 'config_not_writable', 'wp-config.php is not writable. Please check file permissions.', [ 'status' => 403 ] );
        }

        $content = file_get_contents( $config_file );

        $replacements = [
            'WP_DEBUG'         => $wp_debug ? 'true' : 'false',
            'WP_DEBUG_LOG'     => $wp_debug_log ? 'true' : 'false',
            'WP_DEBUG_DISPLAY' => $wp_debug_display ? 'true' : 'false',
            'SAVEQUERIES'      => $savequeries ? 'true' : 'false',
            'SCRIPT_DEBUG'     => $script_debug ? 'true' : 'false',
        ];

        foreach ( $replacements as $constant => $value ) {
            // Try to replace existing define.
            $pattern     = "/define\s*\(\s*['\"]" . preg_quote( $constant, '/' ) . "['\"],\s*(true|false|1|0)\s*\)/i";
            $replacement = "define( '{$constant}', {$value} )";

            if ( preg_match( $pattern, $content ) ) {
                $content = preg_replace( $pattern, $replacement, $content );
            } else {
                // Insert before "That's all, stop editing!" or before require.
                $insert_before = "/* That's all, stop editing!";
                if ( strpos( $content, $insert_before ) !== false ) {
                    $content = str_replace(
                        $insert_before,
                        "define( '{$constant}', {$value} );\n\n" . $insert_before,
                        $content
                    );
                }
            }
        }

        $result = file_put_contents( $config_file, $content );

        if ( $result === false ) {
            return new WP_Error( 'write_failed', 'Failed to update wp-config.php.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [
            'success'          => true,
            'message'          => 'Debug settings updated successfully.',
            'wp_debug'         => $wp_debug,
            'wp_debug_log'     => $wp_debug_log,
            'wp_debug_display' => $wp_debug_display,
            'savequeries'      => $savequeries,
            'script_debug'     => $script_debug,
        ], 200 );
    }

    public static function get_error_log( WP_REST_Request $request ) {
        $log_file = self::get_log_file_path();
        $lines    = absint( $request->get_param( 'lines' ) ) ?: 200;
        $level    = sanitize_text_field( $request->get_param( 'level' ) );

        if ( ! file_exists( $log_file ) ) {
            return new WP_REST_Response( [
                'exists'  => false,
                'content' => '',
                'size'    => 0,
                'level'   => $level,
            ], 200 );
        }

        $file_size = filesize( $log_file );

        // Read last N lines.
        $content = self::tail_file( $log_file, $lines );

        // Apply level filtering if a level is specified.
        if ( ! empty( $level ) ) {
            $level_map = [
                'error'      => [ 'PHP Fatal error', 'PHP Parse error', 'PHP Error' ],
                'warning'    => [ 'PHP Warning' ],
                'notice'     => [ 'PHP Notice' ],
                'deprecated' => [ 'PHP Deprecated' ],
            ];

            $patterns = isset( $level_map[ $level ] ) ? $level_map[ $level ] : [];

            if ( ! empty( $patterns ) ) {
                $all_lines      = explode( "\n", $content );
                $filtered_lines = [];

                foreach ( $all_lines as $line ) {
                    foreach ( $patterns as $pattern ) {
                        if ( stripos( $line, $pattern ) !== false ) {
                            $filtered_lines[] = $line;
                            break;
                        }
                    }
                }

                $content = implode( "\n", $filtered_lines );
            }
        }

        return new WP_REST_Response( [
            'exists'  => true,
            'content' => $content,
            'size'    => $file_size,
            'path'    => $log_file,
            'lines'   => $lines,
            'level'   => $level,
        ], 200 );
    }

    public static function clear_error_log( WP_REST_Request $request ) {
        $log_file = self::get_log_file_path();

        if ( ! file_exists( $log_file ) ) {
            return new WP_REST_Response( [ 'success' => true, 'message' => 'Log file does not exist.' ], 200 );
        }

        if ( ! is_writable( $log_file ) ) {
            return new WP_Error( 'not_writable', 'Log file is not writable.', [ 'status' => 403 ] );
        }

        file_put_contents( $log_file, '' );

        return new WP_REST_Response( [ 'success' => true, 'message' => 'Error log cleared.' ], 200 );
    }

    private static function get_log_file_path() {
        // Default log locations.
        $paths = [
            WP_CONTENT_DIR . '/debug.log',
            ABSPATH . 'wp-content/debug.log',
            ini_get( 'error_log' ),
        ];

        foreach ( $paths as $path ) {
            if ( $path && file_exists( $path ) ) {
                return $path;
            }
        }

        return WP_CONTENT_DIR . '/debug.log';
    }

    private static function tail_file( $file, $lines = 200 ) {
        $fp = @fopen( $file, 'r' );
        if ( ! $fp ) return '';

        $buffer     = '';
        $line_count = 0;

        fseek( $fp, 0, SEEK_END );
        $pos = ftell( $fp );

        while ( $pos > 0 && $line_count < $lines ) {
            $read   = min( 4096, $pos );
            $pos   -= $read;
            fseek( $fp, $pos );
            $chunk  = fread( $fp, $read );
            $buffer = $chunk . $buffer;
            $line_count = substr_count( $buffer, "\n" );
        }

        fclose( $fp );

        $all_lines = explode( "\n", $buffer );
        $output    = array_slice( $all_lines, -$lines );

        return implode( "\n", $output );
    }
}
