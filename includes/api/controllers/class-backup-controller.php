<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Backup_Controller {

    private static function backup_dir() {
        $dir = WP_CONTENT_DIR . '/wmp-backups/';
        if ( ! file_exists( $dir ) ) {
            wp_mkdir_p( $dir );
            // Protect directory from direct web access.
            file_put_contents( $dir . '.htaccess', 'deny from all' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
            file_put_contents( $dir . 'index.php', '<?php // Silence is golden.' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
        }
        return $dir;
    }

    // ── REST Handlers ─────────────────────────────────────────────────────────

    public static function list_backups( WP_REST_Request $request ) {
        $dir     = self::backup_dir();
        $files   = glob( $dir . '*.sql' ) ?: [];
        $backups = [];

        foreach ( $files as $file ) {
            $backups[] = [
                'name'         => basename( $file ),
                'size'         => filesize( $file ),
                'size_human'   => size_format( filesize( $file ) ),
                'created_at'   => date( 'Y-m-d H:i:s', filemtime( $file ) ),
            ];
        }

        // Sort newest first.
        usort( $backups, fn( $a, $b ) => strcmp( $b['created_at'], $a['created_at'] ) );

        return new WP_REST_Response( [ 'backups' => $backups ], 200 );
    }

    public static function create_backup( WP_REST_Request $request ) {
        global $wpdb;

        $tables_param = $request->get_param( 'tables' ); // null = all tables
        $filename     = 'backup-' . date( 'Y-m-d-His' ) . '.sql';
        $dir          = self::backup_dir();
        $filepath     = $dir . $filename;

        // Decide which tables to dump.
        if ( $tables_param && is_array( $tables_param ) ) {
            $tables = array_map( 'sanitize_text_field', $tables_param );
        } else {
            // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
            $tables = $wpdb->get_col( 'SHOW TABLES' );
        }

        $sql = self::generate_dump( $tables );

        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_file_put_contents
        if ( file_put_contents( $filepath, $sql ) === false ) {
            return new WP_Error( 'write_failed', 'Could not write backup file.', [ 'status' => 500 ] );
        }

        Audit_Controller::log( 'backup.created', 'backup', $filename );

        return new WP_REST_Response( [
            'success'    => true,
            'name'       => $filename,
            'size'       => filesize( $filepath ),
            'size_human' => size_format( filesize( $filepath ) ),
            'created_at' => date( 'Y-m-d H:i:s', filemtime( $filepath ) ),
        ], 200 );
    }

    public static function download_backup( WP_REST_Request $request ) {
        $name = sanitize_file_name( $request->get_param( 'name' ) ?: '' );
        if ( ! $name ) {
            return new WP_Error( 'missing_param', 'Backup name is required.', [ 'status' => 400 ] );
        }

        // Validate: must end with .sql and contain no path traversal.
        if ( ! preg_match( '/^backup-[\d-]+\.sql$/', $name ) ) {
            return new WP_Error( 'invalid_name', 'Invalid backup filename.', [ 'status' => 400 ] );
        }

        $dir      = self::backup_dir();
        $filepath = $dir . $name;

        if ( ! file_exists( $filepath ) ) {
            return new WP_Error( 'not_found', 'Backup file not found.', [ 'status' => 404 ] );
        }

        // Store in transient for secure download.
        $key      = wp_generate_password( 12, false );
        $nonce    = wp_create_nonce( 'wp_rest' );
        set_transient( 'wmp_backup_dl_' . $key, $filepath, 120 );
        $download_url = rest_url( 'wp-manager-pro/v1/backup/serve' ) . '?key=' . $key . '&_wpnonce=' . $nonce;

        return new WP_REST_Response( [ 'success' => true, 'download_url' => $download_url ], 200 );
    }

    public static function serve_backup( WP_REST_Request $request ) {
        $key      = sanitize_text_field( $request->get_param( 'key' ) );
        $filepath = get_transient( 'wmp_backup_dl_' . $key );

        if ( ! $filepath || ! file_exists( $filepath ) ) {
            return new WP_Error( 'not_found', 'Download link expired or not found.', [ 'status' => 404 ] );
        }

        delete_transient( 'wmp_backup_dl_' . $key );

        @ob_end_clean();
        header( 'Content-Type: application/sql' );
        header( 'Content-Disposition: attachment; filename="' . basename( $filepath ) . '"' );
        header( 'Content-Length: ' . filesize( $filepath ) );
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile
        readfile( $filepath );
        exit;
    }

    public static function delete_backup( WP_REST_Request $request ) {
        $name = sanitize_file_name( $request->get_param( 'name' ) ?: '' );
        if ( ! $name || ! preg_match( '/^backup-[\d-]+\.sql$/', $name ) ) {
            return new WP_Error( 'invalid_name', 'Invalid backup filename.', [ 'status' => 400 ] );
        }

        $dir      = self::backup_dir();
        $filepath = $dir . $name;

        if ( ! file_exists( $filepath ) ) {
            return new WP_Error( 'not_found', 'Backup file not found.', [ 'status' => 404 ] );
        }

        // phpcs:ignore WordPress.WP.AlternativeFunctions.unlink_unlink
        unlink( $filepath );
        Audit_Controller::log( 'backup.deleted', 'backup', $name );

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    // ── SQL Dump Generator ────────────────────────────────────────────────────

    private static function generate_dump( array $tables ): string {
        global $wpdb;

        $output  = "-- WP Manager Pro Backup\n";
        $output .= '-- Generated: ' . gmdate( 'Y-m-d H:i:s' ) . " UTC\n";
        $output .= '-- WordPress Version: ' . get_bloginfo( 'version' ) . "\n";
        $output .= '-- Database: ' . DB_NAME . "\n\n";
        $output .= "SET FOREIGN_KEY_CHECKS=0;\n\n";

        foreach ( $tables as $table ) {
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $create = $wpdb->get_row( "SHOW CREATE TABLE `$table`", ARRAY_N );
            if ( ! $create ) {
                continue;
            }

            $output .= "-- Table: `$table`\n";
            $output .= "DROP TABLE IF EXISTS `$table`;\n";
            $output .= $create[1] . ";\n\n";

            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $rows = $wpdb->get_results( "SELECT * FROM `$table`", ARRAY_A );
            if ( empty( $rows ) ) {
                continue;
            }

            // Chunk inserts for performance.
            $chunks = array_chunk( $rows, 100 );
            foreach ( $chunks as $chunk ) {
                $cols    = '`' . implode( '`, `', array_keys( $chunk[0] ) ) . '`';
                $values  = [];
                foreach ( $chunk as $row ) {
                    $escaped = array_map( function( $val ) use ( $wpdb ) {
                        if ( $val === null ) {
                            return 'NULL';
                        }
                        return "'" . $wpdb->_escape( $val ) . "'";
                    }, $row );
                    $values[] = '(' . implode( ', ', $escaped ) . ')';
                }
                $output .= "INSERT INTO `$table` ($cols) VALUES\n" . implode( ",\n", $values ) . ";\n";
            }
            $output .= "\n";
        }

        $output .= "SET FOREIGN_KEY_CHECKS=1;\n";
        return $output;
    }
}
