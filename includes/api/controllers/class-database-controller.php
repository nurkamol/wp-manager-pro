<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Database_Controller {

    public static function get_tables( WP_REST_Request $request ) {
        global $wpdb;

        // Use SHOW TABLE STATUS for broad compatibility (works on Local, shared hosts, etc.)
        $raw = $wpdb->get_results( 'SHOW TABLE STATUS', ARRAY_A );

        $tables     = [];
        $total_size = 0;

        if ( $raw ) {
            foreach ( $raw as $row ) {
                $size_mb = round( ( ( (float) $row['Data_length'] ) + ( (float) $row['Index_length'] ) ) / 1024 / 1024, 2 );
                $total_size += $size_mb;
                $tables[] = [
                    'name'       => $row['Name'],
                    'rows'       => $row['Rows'],
                    'size_mb'    => (string) $size_mb,
                    'data_free'  => $row['Data_free'],
                    'engine'     => $row['Engine'],
                    'collation'  => $row['Collation'],
                    'created_at' => $row['Create_time'],
                    'is_wp'      => strpos( $row['Name'], $wpdb->prefix ) === 0,
                ];
            }
            // Sort alphabetically by name.
            usort( $tables, fn( $a, $b ) => strcmp( $a['name'], $b['name'] ) );
        }

        return new WP_REST_Response( [
            'tables'     => $tables,
            'total'      => count( $tables ),
            'total_size' => round( $total_size, 2 ),
            'prefix'     => $wpdb->prefix,
        ], 200 );
    }

    public static function get_table_data( WP_REST_Request $request ) {
        global $wpdb;

        $table  = sanitize_text_field( $request->get_param( 'table' ) );
        $page   = absint( $request->get_param( 'page' ) ) ?: 1;
        $limit  = min( absint( $request->get_param( 'limit' ) ) ?: 50, 200 );
        $offset = ( $page - 1 ) * $limit;

        if ( ! $table ) {
            return new WP_Error( 'missing_param', 'Table name is required.', [ 'status' => 400 ] );
        }

        // Validate table exists in this DB.
        $exists = $wpdb->get_var(
            $wpdb->prepare(
                "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s",
                $wpdb->dbname,
                $table
            )
        );

        if ( ! $exists ) {
            return new WP_Error( 'table_not_found', 'Table not found.', [ 'status' => 404 ] );
        }

        $total = $wpdb->get_var( "SELECT COUNT(*) FROM `{$table}`" );

        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $rows = $wpdb->get_results(
            $wpdb->prepare( "SELECT * FROM `{$table}` LIMIT %d OFFSET %d", $limit, $offset ),
            ARRAY_A
        );

        // Get columns.
        $columns = [];
        if ( ! empty( $rows ) ) {
            $columns = array_keys( $rows[0] );
        } else {
            $col_results = $wpdb->get_results( "DESCRIBE `{$table}`", ARRAY_A );
            $columns = array_column( $col_results, 'Field' );
        }

        return new WP_REST_Response( [
            'table'   => $table,
            'columns' => $columns,
            'rows'    => $rows,
            'total'   => (int) $total,
            'page'    => $page,
            'limit'   => $limit,
            'pages'   => ceil( $total / $limit ),
        ], 200 );
    }

    public static function search_replace( WP_REST_Request $request ) {
        global $wpdb;

        $search      = $request->get_param( 'search' );
        $replace     = $request->get_param( 'replace' );
        $tables      = $request->get_param( 'tables' );
        $dry_run     = (bool) $request->get_param( 'dry_run' );
        $case_insensitive = (bool) $request->get_param( 'case_insensitive' );

        if ( empty( $search ) ) {
            return new WP_Error( 'missing_search', 'Search string is required.', [ 'status' => 400 ] );
        }

        if ( ! is_array( $tables ) || empty( $tables ) ) {
            // Default to all WP tables.
            $all_tables = $wpdb->get_col( "SHOW TABLES" );
            $tables = array_filter( $all_tables, fn( $t ) => strpos( $t, $wpdb->prefix ) === 0 );
        }

        $results  = [];
        $total_replaced = 0;

        foreach ( $tables as $table ) {
            // Validate table.
            $exists = $wpdb->get_var(
                $wpdb->prepare(
                    "SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = %s AND TABLE_NAME = %s",
                    $wpdb->dbname,
                    $table
                )
            );
            if ( ! $exists ) continue;

            $table_result = self::do_search_replace( $table, $search, $replace, $dry_run, $case_insensitive );
            if ( $table_result['count'] > 0 ) {
                $results[] = $table_result;
                $total_replaced += $table_result['count'];
            }
        }

        return new WP_REST_Response( [
            'success'   => true,
            'dry_run'   => $dry_run,
            'total'     => $total_replaced,
            'results'   => $results,
            'message'   => $dry_run
                ? "Dry run: Found {$total_replaced} replacements across " . count( $results ) . " tables."
                : "Replaced {$total_replaced} occurrences across " . count( $results ) . " tables.",
        ], 200 );
    }

    private static function do_search_replace( $table, $search, $replace, $dry_run, $case_insensitive ) {
        global $wpdb;

        $count      = 0;
        $col_info   = $wpdb->get_results( "DESCRIBE `{$table}`", ARRAY_A );
        $primary    = '';

        foreach ( $col_info as $col ) {
            if ( $col['Key'] === 'PRI' ) {
                $primary = $col['Field'];
                break;
            }
        }

        if ( ! $primary ) {
            return [ 'table' => $table, 'count' => 0 ];
        }

        $rows = $wpdb->get_results( "SELECT * FROM `{$table}`", ARRAY_A );

        foreach ( $rows as $row ) {
            $updates = [];
            foreach ( $row as $col => $value ) {
                if ( $col === $primary ) continue;
                if ( ! is_string( $value ) ) continue;

                $new_value = self::recursive_replace( $search, $replace, $value, $case_insensitive );

                if ( $new_value !== $value ) {
                    $updates[ $col ] = $new_value;
                    $count++;
                }
            }

            if ( ! $dry_run && ! empty( $updates ) ) {
                $wpdb->update( $table, $updates, [ $primary => $row[ $primary ] ] );
            }
        }

        return [ 'table' => $table, 'count' => $count ];
    }

    private static function recursive_replace( $search, $replace, $value, $case_insensitive ) {
        // Handle serialized data.
        if ( is_serialized( $value ) ) {
            $unserialized = @unserialize( $value );
            if ( $unserialized !== false ) {
                $replaced = self::recursive_replace_value( $search, $replace, $unserialized, $case_insensitive );
                $reserialized = serialize( $replaced );
                // Fix serialized string lengths.
                return self::fix_serialized_strings( $reserialized );
            }
        }

        if ( $case_insensitive ) {
            return str_ireplace( $search, $replace, $value );
        }
        return str_replace( $search, $replace, $value );
    }

    private static function recursive_replace_value( $search, $replace, $value, $case_insensitive ) {
        if ( is_array( $value ) ) {
            return array_map( fn( $v ) => self::recursive_replace_value( $search, $replace, $v, $case_insensitive ), $value );
        }
        if ( is_object( $value ) ) {
            foreach ( $value as $k => $v ) {
                $value->$k = self::recursive_replace_value( $search, $replace, $v, $case_insensitive );
            }
            return $value;
        }
        if ( is_string( $value ) ) {
            return $case_insensitive ? str_ireplace( $search, $replace, $value ) : str_replace( $search, $replace, $value );
        }
        return $value;
    }

    private static function fix_serialized_strings( $string ) {
        return preg_replace_callback(
            '/s:(\d+):"(.*?)";/s',
            function( $matches ) {
                $len = strlen( $matches[2] );
                return "s:{$len}:\"{$matches[2]}\";";
            },
            $string
        );
    }

    public static function optimize_tables( WP_REST_Request $request ) {
        global $wpdb;

        $tables = $request->get_param( 'tables' );

        if ( ! is_array( $tables ) || empty( $tables ) ) {
            $tables = $wpdb->get_col( "SHOW TABLES LIKE '{$wpdb->prefix}%'" );
        }

        $results = [];
        foreach ( $tables as $table ) {
            $result = $wpdb->query( "OPTIMIZE TABLE `{$table}`" );
            $results[] = [ 'table' => $table, 'optimized' => $result !== false ];
        }

        return new WP_REST_Response( [
            'success' => true,
            'results' => $results,
            'message' => 'Tables optimized successfully.',
        ], 200 );
    }

    public static function run_query( WP_REST_Request $request ) {
        global $wpdb;

        $sql = trim( $request->get_param( 'sql' ) );

        if ( ! $sql ) {
            return new WP_Error( 'missing_sql', 'SQL query is required.', [ 'status' => 400 ] );
        }

        // Basic safety: only allow SELECT, SHOW, DESCRIBE, EXPLAIN.
        $allowed_ops = [ 'SELECT', 'SHOW', 'DESCRIBE', 'DESC', 'EXPLAIN' ];
        $first_word  = strtoupper( strtok( $sql, " \t\n\r" ) );

        if ( ! in_array( $first_word, $allowed_ops ) ) {
            return new WP_Error( 'unsafe_query', 'Only SELECT, SHOW, DESCRIBE, and EXPLAIN queries are allowed.', [ 'status' => 403 ] );
        }

        $results = $wpdb->get_results( $sql, ARRAY_A );

        if ( $wpdb->last_error ) {
            return new WP_Error( 'query_error', $wpdb->last_error, [ 'status' => 500 ] );
        }

        $columns = ! empty( $results ) ? array_keys( $results[0] ) : [];

        return new WP_REST_Response( [
            'columns' => $columns,
            'rows'    => $results,
            'count'   => count( $results ),
        ], 200 );
    }
}
