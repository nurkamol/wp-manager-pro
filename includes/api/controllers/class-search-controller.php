<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;

class Search_Controller {

    public static function search( WP_REST_Request $request ) {
        global $wpdb;

        $q       = sanitize_text_field( $request->get_param( 'q' ) );
        $results = [];

        if ( strlen( $q ) < 2 ) {
            return new WP_REST_Response( [ 'results' => [] ], 200 );
        }

        $like = '%' . $wpdb->esc_like( $q ) . '%';

        // ── Plugins ──────────────────────────────────────────────────────────
        if ( ! function_exists( 'get_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        $active  = (array) get_option( 'active_plugins', [] );
        $plugins = get_plugins();
        $count   = 0;
        foreach ( $plugins as $file => $data ) {
            if ( $count >= 5 ) break;
            if ( stripos( $data['Name'], $q ) === false && stripos( $data['Description'], $q ) === false ) continue;
            $is_active = in_array( $file, $active, true );
            $results[] = [
                'type'     => 'plugin',
                'label'    => $data['Name'],
                'subtitle' => 'v' . $data['Version'] . ' · ' . ( $is_active ? 'Active' : 'Inactive' ),
                'route'    => '/plugins',
                'icon'     => 'puzzle',
            ];
            $count++;
        }

        // ── Users ─────────────────────────────────────────────────────────────
        $users = get_users( [
            'search'         => "*{$q}*",
            'search_columns' => [ 'user_login', 'user_email', 'display_name' ],
            'number'         => 5,
        ] );
        foreach ( $users as $user ) {
            $results[] = [
                'type'     => 'user',
                'label'    => $user->display_name ?: $user->user_login,
                'subtitle' => implode( ' · ', array_slice( $user->roles, 0, 2 ) ) . ' · ' . $user->user_email,
                'route'    => '/users',
                'icon'     => 'user',
            ];
        }

        // ── Notes ─────────────────────────────────────────────────────────────
        $notes_table = $wpdb->prefix . 'wmp_notes';
        if ( $wpdb->get_var( "SHOW TABLES LIKE '{$notes_table}'" ) === $notes_table ) {
            $notes = $wpdb->get_results( $wpdb->prepare(
                "SELECT title, content FROM `{$notes_table}` WHERE title LIKE %s OR content LIKE %s ORDER BY updated_at DESC LIMIT 5",
                $like, $like
            ), ARRAY_A );
            foreach ( $notes as $note ) {
                $results[] = [
                    'type'     => 'note',
                    'label'    => $note['title'] ?: '(Untitled note)',
                    'subtitle' => wp_trim_words( $note['content'], 10 ),
                    'route'    => '/notes',
                    'icon'     => 'note',
                ];
            }
        }

        // ── Audit Log ─────────────────────────────────────────────────────────
        $audit_table = $wpdb->prefix . 'wmp_audit_log';
        if ( $wpdb->get_var( "SHOW TABLES LIKE '{$audit_table}'" ) === $audit_table ) {
            $logs = $wpdb->get_results( $wpdb->prepare(
                "SELECT action, object_name, user_login, created_at FROM `{$audit_table}`
                 WHERE action LIKE %s OR object_name LIKE %s OR user_login LIKE %s
                 ORDER BY created_at DESC LIMIT 5",
                $like, $like, $like
            ), ARRAY_A );
            foreach ( $logs as $log ) {
                $results[] = [
                    'type'     => 'audit',
                    'label'    => str_replace( '.', ': ', $log['action'] ) . ( $log['object_name'] ? ' — ' . $log['object_name'] : '' ),
                    'subtitle' => 'by ' . $log['user_login'] . ' · ' . human_time_diff( strtotime( $log['created_at'] ), time() ) . ' ago',
                    'route'    => '/audit-log',
                    'icon'     => 'activity',
                ];
            }
        }

        // ── Options ───────────────────────────────────────────────────────────
        $options = $wpdb->get_results( $wpdb->prepare(
            "SELECT option_name, option_value FROM {$wpdb->options}
             WHERE option_name LIKE %s
               AND option_name NOT LIKE '\_%'
               AND option_name NOT LIKE '%transient%'
             LIMIT 5",
            $like
        ), ARRAY_A );
        foreach ( $options as $opt ) {
            $val = $opt['option_value'];
            if ( strlen( $val ) > 60 ) $val = substr( $val, 0, 57 ) . '…';
            $results[] = [
                'type'     => 'option',
                'label'    => $opt['option_name'],
                'subtitle' => $val,
                'route'    => '/content-tools',
                'icon'     => 'settings',
            ];
        }

        return new WP_REST_Response( [ 'results' => $results ], 200 );
    }
}
