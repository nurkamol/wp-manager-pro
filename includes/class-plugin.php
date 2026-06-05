<?php
namespace WP_Manager_Pro;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_Manager_Pro\API\Controllers\Agency_Controller;

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
        require_once WP_MANAGER_PRO_PATH . 'includes/class-self-updater.php';
        require_once WP_MANAGER_PRO_PATH . 'includes/api/class-routes.php';

        // Load controllers.
        $controllers = [
            'class-dashboard-controller',
            'class-plugins-controller',
            'class-themes-controller',
            'class-files-controller',
            'class-elfinder-controller',
            'class-database-controller',
            'class-system-controller',
            'class-users-controller',
            'class-maintenance-controller',
            'class-notes-controller',
            'class-debug-controller',
            'class-images-controller',
            'class-reset-controller',
            'class-security-controller',
            'class-audit-controller',
            'class-snippets-controller',
            'class-redirects-controller',
            'class-email-controller',
            'class-backup-controller',
            'class-settings-controller',
            'class-performance-controller',
            'class-cron-controller',
            'class-media-controller',
            'class-content-controller',
            'class-dev-tools-controller',
            'class-update-manager-controller',
            'class-security-scanner-controller',
            'class-agency-controller',
            'class-developer-controller',
            'class-notifications-controller',
            'class-search-controller',
            'class-cpt-controller',
            'class-field-groups-controller',
        ];

        foreach ( $controllers as $controller ) {
            require_once WP_MANAGER_PRO_PATH . 'includes/api/controllers/' . $controller . '.php';
        }
    }

    private function init_hooks() {
        add_action( 'init', [ $this, 'load_textdomain' ] );
        add_action( 'init', [ $this, 'handle_login_as' ] );
        add_action( 'init', [ $this, 'handle_switch_back' ] );
        add_action( 'wp_ajax_wmp_elfinder_host', [ API\Controllers\Elfinder_Controller::class, 'host' ] );
        add_action( 'admin_menu', [ Admin::class, 'register_menu' ] );
        add_action( 'admin_enqueue_scripts', [ Admin::class, 'enqueue_assets' ] );
        add_filter( 'plugin_action_links_' . WP_MANAGER_PRO_BASENAME, [ Admin::class, 'add_plugin_links' ] );
        add_filter( 'plugin_row_meta', [ Admin::class, 'add_plugin_meta' ], 10, 2 );
        add_action( 'rest_api_init', [ API\Routes::class, 'register_routes' ] );

        // Admin bar shortcut button + global keyboard listener.
        add_action( 'admin_bar_menu', [ $this, 'add_admin_bar_node' ], 999 );
        add_action( 'admin_bar_menu', [ $this, 'add_switch_back_bar_item' ], 998 );
        add_action( 'admin_enqueue_scripts', [ $this, 'enqueue_global_shortcut' ] );

        // Self-updater — GitHub Releases integration.
        Self_Updater::init();

        // Admin URL protection (conditional on settings).
        add_action( 'login_init', [ API\Controllers\Security_Controller::class, 'protect_login' ] );
        add_action( 'init', [ API\Controllers\Security_Controller::class, 'handle_custom_login_url' ] );
        add_filter( 'logout_redirect', [ API\Controllers\Security_Controller::class, 'handle_logout_redirect' ], 10, 3 );

        // Security v2.0.0 — login limiter and IP blocklist.
        add_action( 'wp_login_failed', [ API\Controllers\Security_Controller::class, 'record_failed_login' ] );
        add_filter( 'authenticate', [ API\Controllers\Security_Controller::class, 'check_lockout' ], 30, 3 );
        add_action( 'init', [ API\Controllers\Security_Controller::class, 'check_ip_blocklist' ] );

        // Security v2.0.0 — hardening hooks (applied conditionally based on saved options).
        if ( get_option( 'wmp_disable_xmlrpc', false ) ) {
            add_filter( 'xmlrpc_enabled', '__return_false' );
        }
        if ( get_option( 'wmp_hide_wp_version', false ) ) {
            add_filter( 'the_generator', '__return_empty_string' );
            add_filter( 'script_loader_src', [ $this, 'strip_wp_version_from_src' ], 10, 1 );
            add_filter( 'style_loader_src',  [ $this, 'strip_wp_version_from_src' ], 10, 1 );
        }

        // SVG / AVIF support (conditional on settings).
        add_filter( 'upload_mimes', [ API\Controllers\Images_Controller::class, 'maybe_allow_avif' ] );
        add_filter( 'upload_mimes', [ API\Controllers\Images_Controller::class, 'maybe_allow_svg' ] );
        add_filter( 'wp_handle_upload_prefilter', [ API\Controllers\Images_Controller::class, 'sanitize_svg' ] );

        // WebP / AVIF conversion on upload (fires after the file is saved to disk).
        add_filter( 'wp_handle_upload', [ API\Controllers\Images_Controller::class, 'convert_on_upload' ] );

        // Delete sidecar WebP/AVIF files when the original attachment is deleted.
        add_action( 'delete_attachment', [ API\Controllers\Images_Controller::class, 'delete_sidecar_files' ] );

        // Transparently serve WebP sidecar when browser supports it (PHP fallback).
        add_filter( 'wp_get_attachment_url', [ API\Controllers\Images_Controller::class, 'maybe_serve_webp' ], 10, 2 );

        // Audit log — WordPress event tracking.
        add_action( 'activated_plugin',       [ API\Controllers\Audit_Controller::class, 'on_plugin_activated' ] );
        add_action( 'deactivated_plugin',     [ API\Controllers\Audit_Controller::class, 'on_plugin_deactivated' ] );
        add_action( 'deleted_plugin',         [ API\Controllers\Audit_Controller::class, 'on_plugin_deleted' ], 10, 2 );
        add_action( 'switch_theme',           [ API\Controllers\Audit_Controller::class, 'on_theme_switched' ] );
        add_action( 'wp_login',               [ API\Controllers\Audit_Controller::class, 'on_user_login' ] );
        add_action( 'wp_logout',              [ API\Controllers\Audit_Controller::class, 'on_user_logout' ] );
        add_action( 'wp_login_failed',        [ API\Controllers\Audit_Controller::class, 'on_login_failed' ] );
        add_action( 'user_register',          [ API\Controllers\Audit_Controller::class, 'on_user_registered' ] );
        add_action( 'transition_post_status', [ API\Controllers\Audit_Controller::class, 'on_post_published' ], 10, 3 );

        // Code Snippets — execution hooks.
        add_action( 'init',      [ API\Controllers\Snippets_Controller::class, 'run_php_snippets' ] );
        add_action( 'wp_head',   [ API\Controllers\Snippets_Controller::class, 'output_css_snippets' ] );
        add_action( 'wp_footer', [ API\Controllers\Snippets_Controller::class, 'output_js_snippets' ] );

        // Maintenance mode — template_redirect fires only for frontend, never for REST API.
        add_action( 'template_redirect', [ API\Controllers\Maintenance_Controller::class, 'handle_maintenance' ] );

        // Agency — mail interceptor
        add_filter( 'wp_mail', [ Agency_Controller::class, 'intercept_mail' ], 1 );

        // Agency — white-label login page
        // login_head fires AFTER wp_print_styles('login'), guaranteeing our CSS
        // loads after the core login stylesheet — so overrides always win.
        add_action( 'login_head', [ Agency_Controller::class, 'apply_login_styles' ] );
        add_filter( 'login_headerurl',       [ Agency_Controller::class, 'login_header_url'   ] );
        add_filter( 'login_headertext',      [ Agency_Controller::class, 'login_header_text'  ] );
        add_action( 'login_footer',          [ Agency_Controller::class, 'apply_login_footer' ] );
        add_action( 'login_form',            [ Agency_Controller::class, 'apply_login_form_fields' ] );
        add_action( 'login_header',          [ Agency_Controller::class, 'inject_brand_panel' ], 5 );

        // Agency — admin customiser (priority 999 to run after all menus are registered)
        add_action( 'admin_menu',        [ Agency_Controller::class, 'apply_admin_customiser'  ], 999 );
        add_action( 'wp_dashboard_setup',[ Agency_Controller::class, 'apply_widget_customiser' ], 999 );

        // Agency — coming soon
        add_action( 'template_redirect', [ Agency_Controller::class, 'apply_coming_soon' ] );

        // Maintenance toggle + Redis node in WP admin bar (frontend + backend).
        add_action( 'admin_bar_menu',        [ Admin::class, 'add_maintenance_bar_item' ], 100 );
        add_action( 'admin_bar_menu',        [ Admin::class, 'add_redis_bar_item' ], 101 );
        add_action( 'wp_enqueue_scripts',    [ Admin::class, 'enqueue_admin_bar_assets' ] );
        add_action( 'admin_enqueue_scripts', [ Admin::class, 'enqueue_admin_bar_assets' ] );

        // Redirects — template_redirect hook.
        add_action( 'template_redirect', [ API\Controllers\Redirects_Controller::class, 'handle_redirects' ] );

        // Email — SMTP configuration + logging.
        add_action( 'phpmailer_init', [ API\Controllers\Email_Controller::class, 'configure_smtp' ] );
        add_action( 'wp_mail',        [ API\Controllers\Email_Controller::class, 'log_sent_email' ] );
        add_action( 'wp_mail_failed', [ API\Controllers\Email_Controller::class, 'log_failed_email' ] );

        // Scheduled Backups — cron action + custom monthly recurrence.
        add_action( 'wmp_run_scheduled_backup', [ API\Controllers\Backup_Controller::class, 'run_scheduled_backup' ] );
        add_action( 'wmp_run_scheduled_update', [ API\Controllers\Update_Manager_Controller::class, 'run_scheduled_update' ] );
        add_filter( 'cron_schedules', [ $this, 'add_monthly_schedule' ] );

        // Cron Manager — inject custom schedules created via the UI (v2.1.0).
        add_filter( 'cron_schedules', [ API\Controllers\Cron_Controller::class, 'inject_custom_schedules' ] );

        // Custom Post Types — register saved CPTs & taxonomies at init.
        add_action( 'init', [ API\Controllers\CPT_Controller::class, 'register_all' ], 5 );

        // Field Groups — meta boxes + save_post hook.
        add_action( 'add_meta_boxes', [ API\Controllers\Field_Groups_Controller::class, 'register_meta_boxes' ] );
        add_action( 'save_post',      [ API\Controllers\Field_Groups_Controller::class, 'save_meta' ], 10, 1 );
    }

    /**
     * Remove the WordPress version from script/style src URLs (hardening).
     */
    public function strip_wp_version_from_src( string $src ): string {
        if ( strpos( $src, 'ver=' . get_bloginfo( 'version' ) ) !== false ) {
            $src = remove_query_arg( 'ver', $src );
        }
        return $src;
    }

    /**
     * Register a monthly WP-Cron recurrence if not already defined.
     */
    public function add_monthly_schedule( array $schedules ): array {
        if ( ! isset( $schedules['monthly'] ) ) {
            $schedules['monthly'] = [
                'interval' => MONTH_IN_SECONDS,
                'display'  => __( 'Once Monthly', 'wp-manager-pro' ),
            ];
        }
        return $schedules;
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

        $admin_id = isset( $transient['admin_id'] ) ? absint( $transient['admin_id'] ) : get_current_user_id();

        delete_transient( 'wmp_login_as_' . $user_id );

        // Set up a secure, cookie-bound switch-back token so the original admin
        // can return to their own account. Binding the token to a browser cookie
        // (rather than to persistent user meta) means the impersonated user
        // cannot later escalate back to the admin account from a normal login.
        $back_token = wp_generate_password( 43, false );
        set_transient( 'wmp_switch_back_' . $user_id, [
            'token'    => wp_hash( $back_token ),
            'admin_id' => $admin_id,
        ], DAY_IN_SECONDS );

        $this->set_switch_back_cookie( $back_token, time() + DAY_IN_SECONDS );

        wp_set_current_user( $user_id );
        wp_set_auth_cookie( $user_id, true );

        wp_safe_redirect( admin_url() );
        exit;
    }

    /**
     * Handle the "Switch back" request that returns an impersonating admin to
     * their original account. The request is authenticated by a nonce tied to
     * the current (impersonated) user plus a token bound to the browser cookie
     * set when the switch began.
     */
    public function handle_switch_back() {
        if ( empty( $_GET['wmp_switch_back'] ) ) {
            return;
        }

        $current_id = get_current_user_id();
        if ( ! $current_id ) {
            return;
        }

        $nonce = isset( $_GET['_wpnonce'] ) ? sanitize_text_field( wp_unslash( $_GET['_wpnonce'] ) ) : '';
        if ( ! wp_verify_nonce( $nonce, 'wmp_switch_back_' . $current_id ) ) {
            wp_die( esc_html__( 'Invalid switch-back request.', 'wp-manager-pro' ), 'WP Manager Pro', [ 'response' => 403 ] );
        }

        $transient = get_transient( 'wmp_switch_back_' . $current_id );
        $cookie    = isset( $_COOKIE['wmp_switch_back'] ) ? sanitize_text_field( wp_unslash( $_COOKIE['wmp_switch_back'] ) ) : '';

        if ( ! $transient || ! $cookie || ! hash_equals( $transient['token'], wp_hash( $cookie ) ) ) {
            wp_die( esc_html__( 'Switch-back session is invalid or has expired.', 'wp-manager-pro' ), 'WP Manager Pro', [ 'response' => 403 ] );
        }

        $admin_id = absint( $transient['admin_id'] );
        $admin    = get_user_by( 'id', $admin_id );

        // The account we return to must still exist and be an administrator.
        if ( ! $admin || ! user_can( $admin, 'manage_options' ) ) {
            wp_die( esc_html__( 'Original account is no longer available.', 'wp-manager-pro' ), 'WP Manager Pro', [ 'response' => 403 ] );
        }

        delete_transient( 'wmp_switch_back_' . $current_id );
        $this->set_switch_back_cookie( '', time() - DAY_IN_SECONDS );

        wp_set_current_user( $admin_id );
        wp_set_auth_cookie( $admin_id, true );

        wp_safe_redirect( admin_url( 'admin.php?page=wp-manager-pro' ) );
        exit;
    }

    /**
     * Set (or clear) the cookie that binds a switch-back token to the browser
     * that initiated the user switch.
     */
    private function set_switch_back_cookie( $value, $expires ) {
        $path   = defined( 'COOKIEPATH' ) && COOKIEPATH ? COOKIEPATH : '/';
        $domain = defined( 'COOKIE_DOMAIN' ) ? COOKIE_DOMAIN : '';

        setcookie( 'wmp_switch_back', $value, [
            'expires'  => $expires,
            'path'     => $path,
            'domain'   => $domain,
            'secure'   => is_ssl(),
            'httponly' => true,
            'samesite' => 'Lax',
        ] );
    }

    /**
     * Add a "Switch back to {admin}" link to the admin bar while an admin is
     * impersonating another user. Shown to the impersonated user regardless of
     * their capabilities, since they may not have `manage_options`.
     */
    public function add_switch_back_bar_item( \WP_Admin_Bar $bar ) {
        $current_id = get_current_user_id();
        if ( ! $current_id || empty( $_COOKIE['wmp_switch_back'] ) ) {
            return;
        }

        $transient = get_transient( 'wmp_switch_back_' . $current_id );
        if ( ! $transient ) {
            return;
        }

        $admin = get_user_by( 'id', absint( $transient['admin_id'] ) );
        if ( ! $admin ) {
            return;
        }

        $url = wp_nonce_url(
            add_query_arg( 'wmp_switch_back', '1', admin_url() ),
            'wmp_switch_back_' . $current_id
        );

        $bar->add_node( [
            'id'    => 'wmp-switch-back',
            'title' => '<span class="ab-icon dashicons dashicons-undo" style="font-size:16px;line-height:32px;vertical-align:middle;"></span><span style="vertical-align:middle;">'
                . sprintf( esc_html__( 'Switch back to %s', 'wp-manager-pro' ), esc_html( $admin->display_name ) )
                . '</span>',
            'href'  => esc_url( $url ),
            'meta'  => [ 'title' => esc_attr__( 'Return to your administrator account', 'wp-manager-pro' ) ],
        ] );
    }

    /**
     * Add "WP Manager" button to the WP admin bar on every admin page.
     */
    public function add_admin_bar_node( \WP_Admin_Bar $bar ) {
        if ( ! current_user_can( 'manage_options' ) ) return;

        $plugin_url = admin_url( 'admin.php?page=wp-manager-pro' );
        $branding   = get_option( 'wmp_branding', [] );
        $label      = ! empty( $branding['menu_label'] ) ? $branding['menu_label'] : 'WP Manager';

        $bar->add_node( [
            'id'    => 'wmp-launch',
            'title' => '<span class="ab-icon dashicons dashicons-search" style="font-size:16px;line-height:32px;vertical-align:middle;"></span><span style="vertical-align:middle;">WPMGR</span>',
            'href'  => '#',
            'meta'  => [ 'title' => 'Open Command Palette (Ctrl+Shift+P)', 'class' => 'wmp-launcher' ],
        ] );
    }

    /**
     * Enqueue the standalone command-palette overlay on every WP admin page.
     * The palette opens as an in-page overlay (not a navigation) when the
     * configured keyboard shortcut or the admin-bar button is triggered.
     */
    public function enqueue_global_shortcut() {
        if ( ! current_user_can( 'manage_options' ) ) return;

        $plugin_url = admin_url( 'admin.php?page=wp-manager-pro' );
        $shortcut   = get_option( 'wmp_palette_shortcut', 'shift+p' );

        wp_enqueue_script(
            'wmp-global-palette',
            WP_MANAGER_PRO_URL . 'assets/global-palette.js',
            [],
            WP_MANAGER_PRO_VERSION,
            true
        );

        wp_add_inline_script(
            'wmp-global-palette',
            'window._wmpGlobal = ' . wp_json_encode( [
                'pluginUrl' => $plugin_url,
                'shortcut'  => $shortcut,
            ] ) . ';',
            'before'
        );
    }
}
