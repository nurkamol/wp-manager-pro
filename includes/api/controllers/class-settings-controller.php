<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

class Settings_Controller {

    /**
     * GET /settings — return branding settings.
     */
    public static function get_settings( \WP_REST_Request $request ): \WP_REST_Response {
        return new \WP_REST_Response( [
            'plugin_name' => get_option( 'wmp_plugin_name', '' ),
            'menu_label'  => get_option( 'wmp_menu_label', '' ),
            'logo_url'    => get_option( 'wmp_logo_url', '' ),
        ] );
    }

    /**
     * POST /settings — save branding settings.
     */
    public static function save_settings( \WP_REST_Request $request ): \WP_REST_Response {
        $plugin_name = sanitize_text_field( $request->get_param( 'plugin_name' ) ?? '' );
        $menu_label  = sanitize_text_field( $request->get_param( 'menu_label' ) ?? '' );
        $logo_url    = esc_url_raw( $request->get_param( 'logo_url' ) ?? '' );

        update_option( 'wmp_plugin_name', $plugin_name );
        update_option( 'wmp_menu_label',  $menu_label );
        update_option( 'wmp_logo_url',    $logo_url );

        return new \WP_REST_Response( [
            'success'     => true,
            'plugin_name' => $plugin_name,
            'menu_label'  => $menu_label,
            'logo_url'    => $logo_url,
        ] );
    }
}
