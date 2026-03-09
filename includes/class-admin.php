<?php
namespace WP_Manager_Pro;

if ( ! defined( 'ABSPATH' ) ) exit;

class Admin {

    public static function add_plugin_links( $links ) {
        $open_link = '<a href="' . admin_url( 'admin.php?page=wp-manager-pro' ) . '">' . __( 'Open', 'wp-manager-pro' ) . '</a>';
        array_unshift( $links, $open_link );
        return $links;
    }

    public static function add_plugin_meta( $plugin_meta, $plugin_file ) {
        if ( WP_MANAGER_PRO_BASENAME !== $plugin_file ) {
            return $plugin_meta;
        }

        $plugin_meta[] = '<a href="https://github.com/nurkamol/wp-manager-pro#faq" target="_blank" rel="noopener">' . __( 'FAQ', 'wp-manager-pro' ) . '</a>';
        $plugin_meta[] = '<a href="https://github.com/nurkamol/wp-manager-pro/blob/main/CHANGELOG.md" target="_blank" rel="noopener">' . __( 'Changelog', 'wp-manager-pro' ) . '</a>';

        return $plugin_meta;
    }

    public static function register_menu() {
        // Custom SVG: 3 stat cards + 3 management bars — clean dashboard icon.
        $icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">'
            . '<rect fill="#a0a5aa" x="1" y="1" width="5" height="5" rx="1"/>'
            . '<rect fill="#a0a5aa" x="7.5" y="1" width="5" height="5" rx="1"/>'
            . '<rect fill="#a0a5aa" x="14" y="1" width="5" height="5" rx="1"/>'
            . '<rect fill="#a0a5aa" x="1" y="9" width="18" height="2" rx="1"/>'
            . '<rect fill="#a0a5aa" x="1" y="13" width="12" height="2" rx="1"/>'
            . '<rect fill="#a0a5aa" x="1" y="17" width="15" height="2" rx="1"/>'
            . '</svg>';

        add_menu_page(
            __( 'WP Manager Pro', 'wp-manager-pro' ),
            __( 'WP Manager', 'wp-manager-pro' ),
            'manage_options',
            'wp-manager-pro',
            [ self::class, 'render_page' ],
            'data:image/svg+xml;base64,' . base64_encode( $icon ),
            2
        );
    }

    public static function enqueue_assets( $hook ) {
        if ( 'toplevel_page_wp-manager-pro' !== $hook ) {
            return;
        }

        $build_dir = WP_MANAGER_PRO_PATH . 'assets/build/';
        $build_url = WP_MANAGER_PRO_URL . 'assets/build/';

        // Enqueue main CSS (Vite outputs as style.css or index.css).
        $css_file = file_exists( $build_dir . 'index.css' ) ? 'index.css' : 'style.css';
        if ( file_exists( $build_dir . $css_file ) ) {
            wp_enqueue_style(
                'wp-manager-pro',
                $build_url . $css_file,
                [],
                WP_MANAGER_PRO_VERSION
            );
        }

        // Enqueue main JS.
        if ( file_exists( $build_dir . 'index.js' ) ) {
            wp_enqueue_script(
                'wp-manager-pro',
                $build_url . 'index.js',
                [],
                WP_MANAGER_PRO_VERSION,
                true
            );

            wp_localize_script( 'wp-manager-pro', 'wpManagerPro', [
                'apiUrl'   => rest_url( 'wp-manager-pro/v1' ),
                'nonce'    => wp_create_nonce( 'wp_rest' ),
                'siteUrl'  => get_site_url(),
                'adminUrl' => admin_url(),
                'version'  => WP_MANAGER_PRO_VERSION,
                'user'     => [
                    'name'   => wp_get_current_user()->display_name,
                    'email'  => wp_get_current_user()->user_email,
                    'avatar' => get_avatar_url( get_current_user_id(), [ 'size' => 40 ] ),
                ],
            ] );
        }

        // Remove conflicting admin styles to give our app full control.
        add_action( 'admin_head', function() {
            echo '<style>
                #wpcontent { padding-left: 0 !important; }
                #wpbody-content { padding-bottom: 0 !important; }
                .wp-manager-pro-page #wpcontent,
                .wp-manager-pro-page #wpbody { padding: 0 !important; }
                #wpfooter { display: none; }
                #wpwrap { background: #f0f2f5; }
            </style>';
        } );
    }

    public static function render_page() {
        echo '<div id="wp-manager-pro-root" class="wp-manager-pro-page"></div>';
    }
}
