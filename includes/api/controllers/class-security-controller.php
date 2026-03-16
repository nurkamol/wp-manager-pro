<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Security_Controller
 *
 * Handles all security features for WP Manager Pro:
 *  - Custom admin login URL (v1.3.0)
 *  - Login attempt limiter / brute-force protection (v2.0.0)
 *  - IP Blocklist (v2.0.0)
 *  - Hardening: disable XML-RPC, hide WP version (v2.0.0)
 *  - File Integrity Checker (v2.0.0)
 *  - Two-Factor Authentication — TOTP (v2.0.0)
 */
class Security_Controller {

    // ── Option / meta keys ─────────────────────────────────────────────────────

    const OPT_ADMIN_SLUG        = 'wmp_admin_slug';
    const OPT_LIMITER_ENABLED   = 'wmp_limiter_enabled';
    const OPT_LIMITER_THRESHOLD = 'wmp_limiter_threshold';   // attempts before lockout
    const OPT_LIMITER_WINDOW    = 'wmp_limiter_window';      // seconds to count attempts
    const OPT_LIMITER_DURATION  = 'wmp_limiter_duration';    // lockout duration in seconds
    const OPT_LOCKOUT_LOG       = 'wmp_lockout_log';
    const OPT_IP_BLOCKLIST      = 'wmp_ip_blocklist';
    const OPT_DISABLE_XMLRPC    = 'wmp_disable_xmlrpc';
    const OPT_HIDE_WP_VERSION   = 'wmp_hide_wp_version';
    const META_2FA_SECRET       = 'wmp_2fa_secret';
    const META_2FA_ENABLED      = 'wmp_2fa_enabled';
    const META_2FA_BACKUP       = 'wmp_2fa_backup_codes';

    // ── GET /security ──────────────────────────────────────────────────────────

    public static function get_status( WP_REST_Request $request ) {
        $slug = get_option( self::OPT_ADMIN_SLUG, '' );
        return new WP_REST_Response( [
            'enabled'    => ! empty( $slug ),
            'slug'       => $slug,
            'custom_url' => ! empty( $slug ) ? home_url( '/' . trim( $slug, '/' ) . '/' ) : '',
            'login_url'  => wp_login_url(),
        ], 200 );
    }

    // ── GET /security/overview ─────────────────────────────────────────────────

    public static function get_overview( WP_REST_Request $request ) {
        $slug     = get_option( self::OPT_ADMIN_SLUG, '' );
        $log      = get_option( self::OPT_LOCKOUT_LOG, [] );
        $blocklist = get_option( self::OPT_IP_BLOCKLIST, [] );

        $user_id     = get_current_user_id();
        $tfa_enabled = (bool) get_user_meta( $user_id, self::META_2FA_ENABLED, true );

        return new WP_REST_Response( [
            // Admin URL
            'admin_url_enabled'    => ! empty( $slug ),
            'admin_url_slug'       => $slug,
            'custom_url'           => ! empty( $slug ) ? home_url( '/' . trim( $slug, '/' ) . '/' ) : '',
            'login_url'            => wp_login_url(),
            // Login limiter
            'limiter_enabled'      => (bool) get_option( self::OPT_LIMITER_ENABLED, false ),
            'limiter_threshold'    => (int)  get_option( self::OPT_LIMITER_THRESHOLD, 5 ),
            'limiter_window'       => (int)  get_option( self::OPT_LIMITER_WINDOW, 300 ),
            'limiter_duration'     => (int)  get_option( self::OPT_LIMITER_DURATION, 900 ),
            'lockout_count'        => count( $log ),
            // IP Blocklist
            'ip_blocklist_count'   => count( $blocklist ),
            // Hardening
            'xmlrpc_disabled'      => (bool) get_option( self::OPT_DISABLE_XMLRPC, false ),
            'hide_wp_version'      => (bool) get_option( self::OPT_HIDE_WP_VERSION, false ),
            // 2FA
            'tfa_enabled'          => $tfa_enabled,
            // WP version (needed for integrity check)
            'wp_version'           => get_bloginfo( 'version' ),
            'wp_locale'            => get_locale(),
        ], 200 );
    }

    // ── Admin URL (v1.3.0) ─────────────────────────────────────────────────────

    public static function update_slug( WP_REST_Request $request ) {
        $raw  = $request->get_param( 'slug' );
        $slug = sanitize_title_with_dashes( $raw );
        $slug = trim( $slug, '/' );

        if ( empty( $slug ) ) {
            return new WP_Error( 'invalid_slug', 'Please provide a valid slug.', [ 'status' => 400 ] );
        }
        if ( strlen( $slug ) < 4 ) {
            return new WP_Error( 'slug_too_short', 'Slug must be at least 4 characters.', [ 'status' => 400 ] );
        }

        $reserved = [ 'wp-admin', 'wp-login', 'wp-content', 'wp-includes', 'admin', 'login', 'dashboard' ];
        if ( in_array( $slug, $reserved, true ) ) {
            return new WP_Error( 'reserved_slug', 'This slug is reserved and cannot be used.', [ 'status' => 400 ] );
        }

        update_option( self::OPT_ADMIN_SLUG, $slug );

        return new WP_REST_Response( [
            'success'    => true,
            'slug'       => $slug,
            'custom_url' => home_url( '/' . $slug . '/' ),
        ], 200 );
    }

    public static function disable_protection( WP_REST_Request $request ) {
        delete_option( self::OPT_ADMIN_SLUG );
        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    // ── Login Limiter (v2.0.0) ─────────────────────────────────────────────────

    public static function save_limiter_settings( WP_REST_Request $request ) {
        update_option( self::OPT_LIMITER_ENABLED,   (bool) $request->get_param( 'enabled' ) );
        update_option( self::OPT_LIMITER_THRESHOLD, absint( $request->get_param( 'threshold' ) ) ?: 5 );
        update_option( self::OPT_LIMITER_WINDOW,    absint( $request->get_param( 'window' ) ) ?: 300 );
        update_option( self::OPT_LIMITER_DURATION,  absint( $request->get_param( 'duration' ) ) ?: 900 );

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    public static function get_lockout_log( WP_REST_Request $request ) {
        $log = get_option( self::OPT_LOCKOUT_LOG, [] );
        // Sort newest first.
        usort( $log, fn( $a, $b ) => $b['time'] - $a['time'] );
        return new WP_REST_Response( [ 'items' => $log ], 200 );
    }

    public static function clear_lockout_log( WP_REST_Request $request ) {
        delete_option( self::OPT_LOCKOUT_LOG );
        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    public static function unlock_ip( WP_REST_Request $request ) {
        $ip = sanitize_text_field( $request->get_param( 'ip' ) );
        if ( ! $ip ) {
            return new WP_Error( 'missing_ip', 'IP address required.', [ 'status' => 400 ] );
        }

        delete_transient( 'wmp_lockout_' . md5( $ip ) );

        // Remove from log.
        $log = get_option( self::OPT_LOCKOUT_LOG, [] );
        $log = array_values( array_filter( $log, fn( $e ) => $e['ip'] !== $ip ) );
        update_option( self::OPT_LOCKOUT_LOG, $log );

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    // ── IP Blocklist (v2.0.0) ─────────────────────────────────────────────────

    public static function get_ip_blocklist( WP_REST_Request $request ) {
        $list = get_option( self::OPT_IP_BLOCKLIST, [] );
        return new WP_REST_Response( [ 'items' => array_values( $list ) ], 200 );
    }

    public static function add_ip_block( WP_REST_Request $request ) {
        $ip   = sanitize_text_field( $request->get_param( 'ip' ) );
        $note = sanitize_text_field( $request->get_param( 'note' ) ?? '' );

        if ( ! $ip ) {
            return new WP_Error( 'missing_ip', 'IP address or CIDR range required.', [ 'status' => 400 ] );
        }

        // Basic validation: allow plain IPs and CIDR notation.
        if ( ! filter_var( $ip, FILTER_VALIDATE_IP ) && ! preg_match( '/^[\d.:a-fA-F]+\/\d{1,3}$/', $ip ) ) {
            return new WP_Error( 'invalid_ip', 'Invalid IP address or CIDR range.', [ 'status' => 400 ] );
        }

        $list = get_option( self::OPT_IP_BLOCKLIST, [] );

        // Prevent duplicates.
        foreach ( $list as $entry ) {
            if ( $entry['ip'] === $ip ) {
                return new WP_Error( 'duplicate_ip', 'This IP is already in the blocklist.', [ 'status' => 409 ] );
            }
        }

        $list[] = [
            'ip'      => $ip,
            'note'    => $note,
            'added'   => time(),
        ];

        update_option( self::OPT_IP_BLOCKLIST, $list );

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    public static function remove_ip_block( WP_REST_Request $request ) {
        $ip   = sanitize_text_field( $request->get_param( 'ip' ) );
        $list = get_option( self::OPT_IP_BLOCKLIST, [] );
        $list = array_values( array_filter( $list, fn( $e ) => $e['ip'] !== $ip ) );
        update_option( self::OPT_IP_BLOCKLIST, $list );

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    // ── Hardening (v2.0.0) ────────────────────────────────────────────────────

    public static function save_hardening( WP_REST_Request $request ) {
        $xmlrpc  = $request->get_param( 'disable_xmlrpc' );
        $version = $request->get_param( 'hide_wp_version' );

        if ( $xmlrpc !== null )  update_option( self::OPT_DISABLE_XMLRPC,  (bool) $xmlrpc );
        if ( $version !== null ) update_option( self::OPT_HIDE_WP_VERSION, (bool) $version );

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    // ── File Integrity (v2.0.0) ───────────────────────────────────────────────

    public static function check_integrity( WP_REST_Request $request ) {
        $version = get_bloginfo( 'version' );
        $locale  = get_locale();

        // Fetch official checksums from wordpress.org.
        $api_url  = add_query_arg( [ 'version' => $version, 'locale' => $locale ], 'https://api.wordpress.org/core/checksums/1.0/' );
        $response = wp_remote_get( $api_url, [ 'timeout' => 15 ] );

        if ( is_wp_error( $response ) ) {
            return new WP_Error( 'api_error', 'Could not reach api.wordpress.org: ' . $response->get_error_message(), [ 'status' => 502 ] );
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );

        if ( empty( $body['checksums'] ) ) {
            return new WP_Error( 'no_checksums', 'No checksums returned for WordPress ' . $version . ' (' . $locale . ').', [ 'status' => 502 ] );
        }

        $checksums  = $body['checksums'];
        $abspath    = untrailingslashit( ABSPATH );
        $modified   = [];
        $missing    = [];
        $checked    = 0;

        // Directories that hold core WordPress files only.
        $scan_dirs = [ 'wp-admin', 'wp-includes' ];

        // Scan root files first (wp-*.php and index.php).
        foreach ( $checksums as $rel_path => $expected_hash ) {
            $full_path = $abspath . '/' . $rel_path;

            // Skip wp-content entirely — it's user content.
            if ( strpos( $rel_path, 'wp-content/' ) === 0 ) continue;

            $checked++;

            if ( ! file_exists( $full_path ) ) {
                $missing[] = $rel_path;
                continue;
            }

            $actual_hash = md5_file( $full_path );
            if ( $actual_hash !== $expected_hash ) {
                $modified[] = [
                    'path'     => $rel_path,
                    'expected' => $expected_hash,
                    'actual'   => $actual_hash,
                    'size'     => filesize( $full_path ),
                    'modified' => filemtime( $full_path ),
                ];
            }
        }

        return new WP_REST_Response( [
            'version'  => $version,
            'locale'   => $locale,
            'checked'  => $checked,
            'ok'       => $checked - count( $modified ) - count( $missing ),
            'modified' => $modified,
            'missing'  => $missing,
            'clean'    => empty( $modified ) && empty( $missing ),
        ], 200 );
    }

    // ── Two-Factor Auth — TOTP (v2.0.0) ──────────────────────────────────────

    public static function get_2fa_status( WP_REST_Request $request ) {
        $user_id = get_current_user_id();
        return new WP_REST_Response( [
            'enabled'      => (bool) get_user_meta( $user_id, self::META_2FA_ENABLED, true ),
            'has_secret'   => ! empty( get_user_meta( $user_id, self::META_2FA_SECRET, true ) ),
            'backup_count' => count( (array) get_user_meta( $user_id, self::META_2FA_BACKUP, true ) ),
        ], 200 );
    }

    public static function setup_2fa( WP_REST_Request $request ) {
        $user_id = get_current_user_id();
        $user    = get_userdata( $user_id );

        // Generate a fresh 20-byte (160-bit) secret.
        $secret   = self::generate_totp_secret();
        $label    = rawurlencode( $user->user_email );
        $issuer   = rawurlencode( get_bloginfo( 'name' ) ?: 'WP Manager Pro' );
        $otp_url  = "otpauth://totp/{$issuer}:{$label}?secret={$secret}&issuer={$issuer}&algorithm=SHA1&digits=6&period=30";
        $qr_url   = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&ecc=M&data=' . rawurlencode( $otp_url );

        // Store pending secret (not yet confirmed).
        update_user_meta( $user_id, self::META_2FA_SECRET . '_pending', $secret );

        return new WP_REST_Response( [
            'secret'  => $secret,
            'otp_url' => $otp_url,
            'qr_url'  => $qr_url,
        ], 200 );
    }

    public static function verify_2fa( WP_REST_Request $request ) {
        $user_id = get_current_user_id();
        $code    = sanitize_text_field( $request->get_param( 'code' ) ?? '' );
        $code    = preg_replace( '/\s+/', '', $code );

        $secret = get_user_meta( $user_id, self::META_2FA_SECRET . '_pending', true );

        if ( ! $secret ) {
            // Try the already-enabled secret for re-verification.
            $secret = get_user_meta( $user_id, self::META_2FA_SECRET, true );
        }

        if ( ! $secret ) {
            return new WP_Error( 'no_secret', 'Please generate a QR code first.', [ 'status' => 400 ] );
        }

        if ( ! self::verify_totp( $secret, $code ) ) {
            return new WP_Error( 'invalid_code', 'The verification code is incorrect. Please try again.', [ 'status' => 400 ] );
        }

        // Confirm — promote pending secret to active.
        $backup_codes = self::generate_backup_codes();
        update_user_meta( $user_id, self::META_2FA_SECRET,  $secret );
        update_user_meta( $user_id, self::META_2FA_ENABLED, 1 );
        update_user_meta( $user_id, self::META_2FA_BACKUP,  array_map( 'md5', $backup_codes ) );
        delete_user_meta( $user_id, self::META_2FA_SECRET . '_pending' );

        return new WP_REST_Response( [
            'success'      => true,
            'backup_codes' => $backup_codes, // Plain codes shown once only.
        ], 200 );
    }

    public static function disable_2fa( WP_REST_Request $request ) {
        $user_id = get_current_user_id();
        delete_user_meta( $user_id, self::META_2FA_SECRET );
        delete_user_meta( $user_id, self::META_2FA_ENABLED );
        delete_user_meta( $user_id, self::META_2FA_BACKUP );
        delete_user_meta( $user_id, self::META_2FA_SECRET . '_pending' );

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    // ── Runtime hooks ─────────────────────────────────────────────────────────

    /** Called from login_init — block direct wp-login.php GET access. */
    public static function protect_login() {
        $slug = get_option( self::OPT_ADMIN_SLUG, '' );
        if ( empty( $slug ) ) return;

        if ( isset( $_SERVER['REQUEST_METHOD'] ) && 'GET' !== strtoupper( $_SERVER['REQUEST_METHOD'] ) ) return;

        $action  = isset( $_GET['action'] ) ? sanitize_text_field( wp_unslash( $_GET['action'] ) ) : '';
        $bypass  = [ 'logout', 'lostpassword', 'retrievepassword', 'resetpass', 'rp', 'confirm_admin_email', 'register' ];
        if ( in_array( $action, $bypass, true ) ) return;

        if ( array_key_exists( $slug, $_GET ) ) return;

        wp_safe_redirect( home_url( '/' ) );
        exit;
    }

    /** Called from init — redirect custom slug to wp-login.php. */
    public static function handle_custom_login_url() {
        $slug = get_option( self::OPT_ADMIN_SLUG, '' );
        if ( empty( $slug ) ) return;

        $path = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( wp_unslash( $_SERVER['REQUEST_URI'] ), PHP_URL_PATH ) : '';
        $path = trim( $path, '/' );

        if ( $path === trim( $slug, '/' ) ) {
            wp_safe_redirect( wp_login_url() . '?' . rawurlencode( $slug ) );
            exit;
        }
    }

    /** Called from wp_login_failed — record failed attempt and lock out if over threshold. */
    public static function record_failed_login( $username ) {
        if ( ! get_option( self::OPT_LIMITER_ENABLED, false ) ) return;

        $ip        = self::get_client_ip();
        $threshold = (int) get_option( self::OPT_LIMITER_THRESHOLD, 5 );
        $window    = (int) get_option( self::OPT_LIMITER_WINDOW, 300 );
        $duration  = (int) get_option( self::OPT_LIMITER_DURATION, 900 );
        $key       = 'wmp_attempts_' . md5( $ip );

        $attempts = get_transient( $key );
        if ( ! is_array( $attempts ) ) $attempts = [];

        // Prune old entries outside the window.
        $now      = time();
        $attempts = array_filter( $attempts, fn( $t ) => $t > $now - $window );
        $attempts[] = $now;

        set_transient( $key, $attempts, $window );

        if ( count( $attempts ) >= $threshold ) {
            set_transient( 'wmp_lockout_' . md5( $ip ), 1, $duration );

            // Append to lockout log.
            $log   = get_option( self::OPT_LOCKOUT_LOG, [] );
            $log[] = [
                'ip'       => $ip,
                'username' => $username,
                'time'     => $now,
                'duration' => $duration,
                'attempts' => count( $attempts ),
            ];
            // Keep last 500 entries.
            if ( count( $log ) > 500 ) {
                $log = array_slice( $log, -500 );
            }
            update_option( self::OPT_LOCKOUT_LOG, $log );
        }
    }

    /** Called from authenticate filter — block locked-out IPs. */
    public static function check_lockout( $user, $username, $password ) {
        if ( ! get_option( self::OPT_LIMITER_ENABLED, false ) ) return $user;

        $ip = self::get_client_ip();

        if ( get_transient( 'wmp_lockout_' . md5( $ip ) ) ) {
            $duration = (int) get_option( self::OPT_LIMITER_DURATION, 900 );
            return new \WP_Error(
                'too_many_attempts',
                sprintf( 'Too many failed login attempts. You are locked out for %d minutes.', ceil( $duration / 60 ) )
            );
        }

        return $user;
    }

    /** Called from init — block requests from IPs in the blocklist. */
    public static function check_ip_blocklist() {
        $list = get_option( self::OPT_IP_BLOCKLIST, [] );
        if ( empty( $list ) ) return;

        $client_ip = self::get_client_ip();

        foreach ( $list as $entry ) {
            if ( self::ip_matches( $client_ip, $entry['ip'] ) ) {
                wp_die( 'Access denied.', 'Forbidden', [ 'response' => 403 ] );
            }
        }
    }

    /** Called from logout_redirect filter — redirect to custom login URL after logout. */
    public static function handle_logout_redirect( string $redirect_to, string $requested_redirect_to, $user ): string {
        $slug = get_option( self::OPT_ADMIN_SLUG, '' );
        if ( ! empty( $slug ) ) {
            return home_url( '/' . trim( $slug, '/' ) . '/' );
        }
        return $redirect_to;
    }

    // ── TOTP helpers ──────────────────────────────────────────────────────────

    private static function generate_totp_secret( int $bytes = 20 ): string {
        $random = random_bytes( $bytes );
        return self::base32_encode( $random );
    }

    private static function verify_totp( string $secret, string $code, int $window = 1 ): bool {
        $key = self::base32_decode( $secret );
        $ts  = (int) floor( time() / 30 );

        for ( $i = -$window; $i <= $window; $i++ ) {
            $counter = pack( 'N*', 0, $ts + $i );
            $hash    = hash_hmac( 'sha1', $counter, $key, true );
            $offset  = ord( $hash[19] ) & 0x0F;
            $otp     = (
                ( ( ord( $hash[ $offset ] ) & 0x7F ) << 24 ) |
                ( ( ord( $hash[ $offset + 1 ] ) & 0xFF ) << 16 ) |
                ( ( ord( $hash[ $offset + 2 ] ) & 0xFF ) << 8 ) |
                ( ord( $hash[ $offset + 3 ] ) & 0xFF )
            ) % 1_000_000;

            if ( hash_equals( str_pad( (string) $otp, 6, '0', STR_PAD_LEFT ), $code ) ) {
                return true;
            }
        }

        return false;
    }

    private static function generate_backup_codes( int $count = 8 ): array {
        $codes = [];
        for ( $i = 0; $i < $count; $i++ ) {
            $codes[] = strtoupper( bin2hex( random_bytes( 4 ) ) );
        }
        return $codes;
    }

    private static function base32_encode( string $data ): string {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $output   = '';
        $v        = 0;
        $vbits    = 0;

        foreach ( str_split( $data ) as $c ) {
            $v     = ( $v << 8 ) | ord( $c );
            $vbits += 8;
            while ( $vbits >= 5 ) {
                $vbits -= 5;
                $output .= $alphabet[ ( $v >> $vbits ) & 0x1F ];
            }
        }
        if ( $vbits > 0 ) {
            $output .= $alphabet[ ( $v << ( 5 - $vbits ) ) & 0x1F ];
        }
        // No padding needed for authenticator apps.
        return $output;
    }

    private static function base32_decode( string $data ): string {
        $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
        $data     = strtoupper( $data );
        $output   = '';
        $v        = 0;
        $vbits    = 0;

        for ( $i = 0; $i < strlen( $data ); $i++ ) {
            $p = strpos( $alphabet, $data[ $i ] );
            if ( $p === false ) continue;
            $v     = ( $v << 5 ) | $p;
            $vbits += 5;
            if ( $vbits >= 8 ) {
                $vbits -= 8;
                $output .= chr( ( $v >> $vbits ) & 0xFF );
            }
        }

        return $output;
    }

    // ── IP helpers ────────────────────────────────────────────────────────────

    private static function get_client_ip(): string {
        $headers = [
            'HTTP_CF_CONNECTING_IP',
            'HTTP_X_REAL_IP',
            'HTTP_X_FORWARDED_FOR',
            'REMOTE_ADDR',
        ];
        foreach ( $headers as $h ) {
            if ( ! empty( $_SERVER[ $h ] ) ) {
                $ip = sanitize_text_field( wp_unslash( $_SERVER[ $h ] ) );
                // X-Forwarded-For may contain a comma-separated list.
                $ip = trim( explode( ',', $ip )[0] );
                if ( filter_var( $ip, FILTER_VALIDATE_IP ) ) return $ip;
            }
        }
        return '0.0.0.0';
    }

    private static function ip_matches( string $ip, string $range ): bool {
        if ( strpos( $range, '/' ) !== false ) {
            [ $subnet, $bits ] = explode( '/', $range );
            $bits     = (int) $bits;
            $ip_long  = ip2long( $ip );
            $net_long = ip2long( $subnet );
            if ( $ip_long === false || $net_long === false ) return false;
            $mask = $bits === 0 ? 0 : ( ~0 << ( 32 - $bits ) );
            return ( $ip_long & $mask ) === ( $net_long & $mask );
        }
        return $ip === $range;
    }
}
