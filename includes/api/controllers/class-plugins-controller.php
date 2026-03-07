<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Plugins_Controller {

    private static function load_plugin_functions() {
        if ( ! function_exists( 'get_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if ( ! function_exists( 'plugins_api' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
        }
        if ( ! class_exists( 'Plugin_Upgrader' ) ) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        }
    }

    public static function get_plugins( WP_REST_Request $request ) {
        self::load_plugin_functions();

        $all_plugins    = get_plugins();
        $active_plugins = get_option( 'active_plugins', [] );

        $update_plugins = get_site_transient( 'update_plugins' );
        $updates = isset( $update_plugins->response ) ? array_keys( $update_plugins->response ) : [];

        $plugins = [];
        foreach ( $all_plugins as $plugin_file => $plugin_data ) {
            $plugins[] = [
                'file'         => $plugin_file,
                'name'         => $plugin_data['Name'],
                'version'      => $plugin_data['Version'],
                'description'  => $plugin_data['Description'],
                'author'       => $plugin_data['Author'],
                'author_uri'   => $plugin_data['AuthorURI'],
                'plugin_uri'   => $plugin_data['PluginURI'],
                'text_domain'  => $plugin_data['TextDomain'],
                'active'       => in_array( $plugin_file, $active_plugins ),
                'has_update'   => in_array( $plugin_file, $updates ),
                'network'      => isset( $plugin_data['Network'] ) && $plugin_data['Network'],
            ];
        }

        // Sort by name.
        usort( $plugins, fn( $a, $b ) => strcmp( $a['name'], $b['name'] ) );

        return new WP_REST_Response( [ 'plugins' => $plugins, 'total' => count( $plugins ) ], 200 );
    }

    public static function activate_plugin( WP_REST_Request $request ) {
        self::load_plugin_functions();

        $plugin_file = sanitize_text_field( $request->get_param( 'plugin' ) );

        if ( ! $plugin_file ) {
            return new WP_Error( 'missing_param', 'Plugin file is required.', [ 'status' => 400 ] );
        }

        $result = activate_plugin( $plugin_file );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'activation_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => 'Plugin activated successfully.' ], 200 );
    }

    public static function deactivate_plugin( WP_REST_Request $request ) {
        self::load_plugin_functions();

        $plugin_file = sanitize_text_field( $request->get_param( 'plugin' ) );

        if ( ! $plugin_file ) {
            return new WP_Error( 'missing_param', 'Plugin file is required.', [ 'status' => 400 ] );
        }

        // Prevent deactivating self.
        if ( WP_MANAGER_PRO_BASENAME === $plugin_file ) {
            return new WP_Error( 'cannot_deactivate', 'Cannot deactivate WP Manager Pro.', [ 'status' => 403 ] );
        }

        deactivate_plugins( $plugin_file );

        return new WP_REST_Response( [ 'success' => true, 'message' => 'Plugin deactivated successfully.' ], 200 );
    }

    public static function delete_plugin( WP_REST_Request $request ) {
        self::load_plugin_functions();

        $plugin_file = sanitize_text_field( $request->get_param( 'plugin' ) );

        if ( ! $plugin_file ) {
            return new WP_Error( 'missing_param', 'Plugin file is required.', [ 'status' => 400 ] );
        }

        // Prevent deleting self.
        if ( WP_MANAGER_PRO_BASENAME === $plugin_file ) {
            return new WP_Error( 'cannot_delete', 'Cannot delete WP Manager Pro.', [ 'status' => 403 ] );
        }

        // Deactivate first.
        deactivate_plugins( $plugin_file );

        // Delete the plugin.
        if ( ! function_exists( 'delete_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        $result = delete_plugins( [ $plugin_file ] );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'delete_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => 'Plugin deleted successfully.' ], 200 );
    }

    public static function install_plugin( WP_REST_Request $request ) {
        self::load_plugin_functions();

        $slug = sanitize_text_field( $request->get_param( 'slug' ) );

        if ( ! $slug ) {
            return new WP_Error( 'missing_param', 'Plugin slug is required.', [ 'status' => 400 ] );
        }

        // Get plugin info from WordPress.org.
        $api = plugins_api( 'plugin_information', [
            'slug'   => $slug,
            'fields' => [ 'sections' => false ],
        ] );

        if ( is_wp_error( $api ) ) {
            return new WP_Error( 'plugin_not_found', $api->get_error_message(), [ 'status' => 404 ] );
        }

        $upgrader = new \Plugin_Upgrader( new \WP_Ajax_Upgrader_Skin() );
        $result   = $upgrader->install( $api->download_link );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'install_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        if ( ! $result ) {
            return new WP_Error( 'install_failed', 'Plugin installation failed.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => 'Plugin installed successfully.' ], 200 );
    }

    public static function search_plugins( WP_REST_Request $request ) {
        self::load_plugin_functions();

        $search = sanitize_text_field( $request->get_param( 'q' ) );
        $page   = absint( $request->get_param( 'page' ) ) ?: 1;

        if ( ! $search ) {
            return new WP_Error( 'missing_param', 'Search query is required.', [ 'status' => 400 ] );
        }

        $api = plugins_api( 'query_plugins', [
            'search'   => $search,
            'per_page' => 12,
            'page'     => $page,
            'fields'   => [
                'short_description' => true,
                'icons'             => true,
                'rating'            => true,
                'num_ratings'       => true,
                'downloaded'        => true,
                'last_updated'      => true,
            ],
        ] );

        if ( is_wp_error( $api ) ) {
            return new WP_Error( 'search_failed', $api->get_error_message(), [ 'status' => 500 ] );
        }

        $results = [];
        foreach ( $api->plugins as $plugin ) {
            $results[] = [
                'slug'              => $plugin->slug,
                'name'              => $plugin->name,
                'version'           => $plugin->version,
                'short_description' => $plugin->short_description,
                'author'            => $plugin->author,
                'rating'            => $plugin->rating,
                'num_ratings'       => $plugin->num_ratings,
                'downloaded'        => $plugin->downloaded,
                'last_updated'      => $plugin->last_updated,
                'icon'              => isset( $plugin->icons['1x'] ) ? $plugin->icons['1x'] : ( isset( $plugin->icons['svg'] ) ? $plugin->icons['svg'] : '' ),
            ];
        }

        return new WP_REST_Response( [
            'plugins' => $results,
            'total'   => $api->info['results'] ?? 0,
            'pages'   => $api->info['pages'] ?? 1,
        ], 200 );
    }
}
