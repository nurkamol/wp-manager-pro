<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Notifications_Controller {

    const OPTION_KEY = 'wmp_notifications';
    const MAX_ITEMS  = 100;

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private static function get_all(): array {
        $raw = get_option( self::OPTION_KEY, [] );
        return is_array( $raw ) ? $raw : [];
    }

    private static function save( array $items ): void {
        // Keep newest first, cap at MAX_ITEMS
        $items = array_values( $items );
        if ( count( $items ) > self::MAX_ITEMS ) {
            $items = array_slice( $items, 0, self::MAX_ITEMS );
        }
        update_option( self::OPTION_KEY, $items, false );
    }

    public static function make_id(): string {
        return sprintf( '%s-%04x', date( 'ymdHis' ), wp_rand( 0, 0xffff ) );
    }

    /**
     * Push a notification from anywhere in the plugin.
     *
     * @param string $type    cron_failed|backup_error|lockout|update_failed|ssl_expiry|vulnerability|info|warning|success
     * @param string $title
     * @param string $message
     * @param string $link    Hash route, e.g. #/cron
     */
    public static function push( string $type, string $title, string $message, string $link = '' ): void {
        $items = self::get_all();

        array_unshift( $items, [
            'id'         => self::make_id(),
            'type'       => sanitize_key( $type ),
            'title'      => sanitize_text_field( $title ),
            'message'    => sanitize_text_field( $message ),
            'link'       => esc_url_raw( $link ),
            'read'       => false,
            'created_at' => gmdate( 'c' ),
        ] );

        self::save( $items );
    }

    // -------------------------------------------------------------------------
    // REST handlers
    // -------------------------------------------------------------------------

    public static function get_notifications( WP_REST_Request $request ) {
        $items    = self::get_all();
        $unread   = count( array_filter( $items, fn( $n ) => ! $n['read'] ) );

        return new WP_REST_Response( [
            'notifications' => $items,
            'total'         => count( $items ),
            'unread'        => $unread,
        ], 200 );
    }

    public static function mark_read( WP_REST_Request $request ) {
        $id    = sanitize_text_field( $request->get_param( 'id' ) );
        $items = self::get_all();

        foreach ( $items as &$n ) {
            if ( $id === 'all' || $n['id'] === $id ) {
                $n['read'] = true;
            }
        }
        unset( $n );

        self::save( $items );

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    public static function dismiss( WP_REST_Request $request ) {
        $id    = sanitize_text_field( $request->get_param( 'id' ) );
        $items = self::get_all();

        if ( $id === 'all' ) {
            $items = [];
        } else {
            $items = array_filter( $items, fn( $n ) => $n['id'] !== $id );
        }

        self::save( $items );

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    // -------------------------------------------------------------------------
    // Auto-collect: scan existing plugin state and push notifications
    // Called on a slow cron or when the dashboard loads.
    // -------------------------------------------------------------------------

    public static function collect() {
        // --- Plugin updates available ---
        $update_plugins = get_site_transient( 'update_plugins' );
        if ( isset( $update_plugins->response ) && count( $update_plugins->response ) > 0 ) {
            $count = count( $update_plugins->response );
            self::push(
                'update_available',
                'Plugin updates available',
                "{$count} plugin(s) have updates ready.",
                '#/updates'
            );
        }

        // --- Core update available ---
        $core = get_site_transient( 'update_core' );
        if ( isset( $core->updates ) ) {
            foreach ( $core->updates as $u ) {
                if ( isset( $u->response ) && $u->response === 'upgrade' ) {
                    self::push(
                        'update_available',
                        'WordPress core update available',
                        "Version {$u->version} is available.",
                        '#/updates'
                    );
                    break;
                }
            }
        }

        // --- SSL expiry check ---
        $home = home_url();
        if ( strpos( $home, 'https://' ) !== false ) {
            $host = wp_parse_url( $home, PHP_URL_HOST );
            if ( $host ) {
                $context = stream_context_create( [ 'ssl' => [ 'capture_peer_cert' => true ] ] );
                $conn     = @stream_socket_client(
                    "ssl://{$host}:443", $errno, $errstr, 5,
                    STREAM_CLIENT_CONNECT, $context
                );
                if ( $conn ) {
                    $params  = stream_context_get_params( $conn );
                    $cert    = openssl_x509_parse( $params['options']['ssl']['peer_certificate'] );
                    fclose( $conn );
                    if ( isset( $cert['validTo_time_t'] ) ) {
                        $days_left = (int) ( ( $cert['validTo_time_t'] - time() ) / DAY_IN_SECONDS );
                        if ( $days_left <= 30 ) {
                            self::push(
                                'ssl_expiry',
                                'SSL certificate expiring soon',
                                "Certificate for {$host} expires in {$days_left} day(s).",
                                '#/system'
                            );
                        }
                    }
                }
            }
        }

        // --- Login lockouts (Security page) ---
        $lockouts = get_option( 'wmp_lockouts', [] );
        if ( is_array( $lockouts ) && count( $lockouts ) > 0 ) {
            $active = array_filter( $lockouts, fn( $l ) => isset( $l['until'] ) && $l['until'] > time() );
            if ( count( $active ) > 0 ) {
                self::push(
                    'lockout',
                    'Active login lockouts',
                    count( $active ) . ' IP(s) are currently locked out.',
                    '#/security'
                );
            }
        }

        // --- Maintenance mode on ---
        if ( get_option( 'wmp_maintenance_enabled', false ) ) {
            self::push(
                'warning',
                'Maintenance mode is ON',
                'Your site is currently in maintenance mode.',
                '#/maintenance'
            );
        }
    }
}
