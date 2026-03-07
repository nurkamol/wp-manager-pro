<?php
namespace WP_Manager_Pro;

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Main Plugin Class - Singleton
 */
class Plugin {

    private static $instance = null;

    public static function get_instance() {
        if ( null === self::$instance ) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    private function __construct() {
        $this->load_dependencies();
        $this->init_hooks();
    }

    private function load_dependencies() {
        require_once WP_MANAGER_PRO_PATH . 'includes/class-admin.php';
        require_once WP_MANAGER_PRO_PATH . 'includes/api/class-routes.php';

        // Load controllers.
        $controllers = [
            'class-dashboard-controller',
            'class-plugins-controller',
            'class-themes-controller',
            'class-files-controller',
            'class-database-controller',
            'class-system-controller',
            'class-users-controller',
            'class-maintenance-controller',
            'class-notes-controller',
            'class-debug-controller',
            'class-images-controller',
            'class-reset-controller',
        ];

        foreach ( $controllers as $controller ) {
            require_once WP_MANAGER_PRO_PATH . 'includes/api/controllers/' . $controller . '.php';
        }
    }

    private function init_hooks() {
        add_action( 'init', [ $this, 'load_textdomain' ] );
        add_action( 'init', [ $this, 'handle_login_as' ] );
        add_action( 'admin_menu', [ Admin::class, 'register_menu' ] );
        add_action( 'admin_enqueue_scripts', [ Admin::class, 'enqueue_assets' ] );
        add_action( 'rest_api_init', [ API\Routes::class, 'register_routes' ] );

        // SVG support (conditional on settings).
        add_filter( 'upload_mimes', [ API\Controllers\Images_Controller::class, 'maybe_allow_svg' ] );
        add_filter( 'wp_handle_upload_prefilter', [ API\Controllers\Images_Controller::class, 'sanitize_svg' ] );
    }

    public function load_textdomain() {
        load_plugin_textdomain(
            'wp-manager-pro',
            false,
            dirname( WP_MANAGER_PRO_BASENAME ) . '/languages'
        );
    }

    /**
     * Handle the "Login As User" token redirect.
     */
    public function handle_login_as() {
        if ( empty( $_GET['wmp_login_as'] ) || empty( $_GET['wmp_token'] ) ) {
            return;
        }

        $user_id = absint( $_GET['wmp_login_as'] );
        $token   = sanitize_text_field( wp_unslash( $_GET['wmp_token'] ) );

        if ( ! $user_id || ! $token ) {
            return;
        }

        $transient = get_transient( 'wmp_login_as_' . $user_id );

        if ( ! $transient || ! hash_equals( $transient['token'], $token ) ) {
            wp_die( esc_html__( 'Invalid or expired login token.', 'wp-manager-pro' ), 'WP Manager Pro', [ 'response' => 403 ] );
        }

        // Only an existing admin can use this feature.
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( esc_html__( 'Insufficient permissions.', 'wp-manager-pro' ), 'WP Manager Pro', [ 'response' => 403 ] );
        }

        $user = get_user_by( 'id', $user_id );
        if ( ! $user ) {
            wp_die( esc_html__( 'User not found.', 'wp-manager-pro' ), 'WP Manager Pro', [ 'response' => 404 ] );
        }

        delete_transient( 'wmp_login_as_' . $user_id );

        wp_set_current_user( $user_id );
        wp_set_auth_cookie( $user_id, true );

        wp_safe_redirect( admin_url() );
        exit;
    }
}
