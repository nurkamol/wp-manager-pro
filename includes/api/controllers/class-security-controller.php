<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Security_Controller {

    /**
     * GET /security — return current status.
     */
    public static function get_status( WP_REST_Request $request ) {
        $slug = get_option( 'wmp_admin_slug', '' );
        return new WP_REST_Response( [
            'enabled'    => ! empty( $slug ),
            'slug'       => $slug,
            'custom_url' => ! empty( $slug ) ? home_url( '/' . trim( $slug, '/' ) . '/' ) : '',
            'login_url'  => wp_login_url(),
        ], 200 );
    }

    /**
     * POST /security/admin-url — enable / update the hidden login slug.
     */
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

        update_option( 'wmp_admin_slug', $slug );

        return new WP_REST_Response( [
            'success'    => true,
            'slug'       => $slug,
            'custom_url' => home_url( '/' . $slug . '/' ),
        ], 200 );
    }

    /**
     * DELETE /security/admin-url — disable protection.
     */
    public static function disable_protection( WP_REST_Request $request ) {
        delete_option( 'wmp_admin_slug' );
        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    // ── Runtime protection hooks ───────────────────────────────────────────

    /**
     * Called from login_init action (fires when wp-login.php is loaded).
     * Blocks GET requests to wp-login.php that don't carry the secret key.
     */
    public static function protect_login() {
        $slug = get_option( 'wmp_admin_slug', '' );
        if ( empty( $slug ) ) return;

        // Only block GET requests (POST = form submission, let it through).
        if ( isset( $_SERVER['REQUEST_METHOD'] ) && 'GET' !== strtoupper( $_SERVER['REQUEST_METHOD'] ) ) return;

        // Allow specific actions that must remain publicly accessible.
        $action  = isset( $_GET['action'] ) ? sanitize_text_field( wp_unslash( $_GET['action'] ) ) : '';
        $bypass  = [ 'lostpassword', 'retrievepassword', 'resetpass', 'rp', 'confirm_admin_email', 'register' ];
        if ( in_array( $action, $bypass, true ) ) return;

        // Allow if the secret key is present in query string.
        if ( array_key_exists( $slug, $_GET ) ) return;

        // Block — redirect to homepage.
        wp_safe_redirect( home_url( '/' ) );
        exit;
    }

    /**
     * Called from init action.
     * Maps the custom slug URL → wp-login.php with the secret key appended.
     */
    public static function handle_custom_login_url() {
        $slug = get_option( 'wmp_admin_slug', '' );
        if ( empty( $slug ) ) return;

        $path = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( wp_unslash( $_SERVER['REQUEST_URI'] ), PHP_URL_PATH ) : '';
        $path = trim( $path, '/' );

        if ( $path === trim( $slug, '/' ) ) {
            wp_safe_redirect( wp_login_url() . '?' . rawurlencode( $slug ) );
            exit;
        }
    }
}
