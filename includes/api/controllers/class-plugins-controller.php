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
        if ( ! function_exists( 'request_filesystem_credentials' ) ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        if ( ! function_exists( 'get_filesystem_method' ) ) {
            require_once ABSPATH . 'wp-admin/includes/misc.php';
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

    public static function upload_plugin( WP_REST_Request $request ) {
        self::load_plugin_functions();

        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/misc.php';

        $files = $request->get_file_params();

        if ( empty( $files['file'] ) ) {
            return new WP_Error( 'missing_file', 'No file was uploaded.', [ 'status' => 400 ] );
        }

        $file = $files['file'];

        if ( $file['error'] !== UPLOAD_ERR_OK ) {
            return new WP_Error( 'upload_error', 'File upload error code: ' . $file['error'], [ 'status' => 400 ] );
        }

        // Validate it is a zip file.
        $ext = strtolower( pathinfo( $file['name'], PATHINFO_EXTENSION ) );
        if ( $ext !== 'zip' ) {
            return new WP_Error( 'invalid_file_type', 'Only .zip files are allowed.', [ 'status' => 400 ] );
        }

        $overwrite = (bool) $request->get_param( 'overwrite' );

        $upgrader = new \Plugin_Upgrader( new \WP_Ajax_Upgrader_Skin() );
        $result   = $upgrader->install( $file['tmp_name'], [ 'overwrite_package' => $overwrite ] );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'install_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        if ( ! $result ) {
            return new WP_Error( 'install_failed', 'Plugin installation from upload failed.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [
            'success' => true,
            'message' => 'Plugin uploaded and installed successfully.',
        ], 200 );
    }

    public static function export_plugin( WP_REST_Request $request ) {
        self::load_plugin_functions();

        $plugin_file = sanitize_text_field( $request->get_param( 'plugin' ) );

        if ( ! $plugin_file ) {
            return new WP_Error( 'missing_param', 'Plugin file is required.', [ 'status' => 400 ] );
        }

        // Validate plugin exists.
        $all_plugins = get_plugins();
        if ( ! array_key_exists( $plugin_file, $all_plugins ) ) {
            return new WP_Error( 'plugin_not_found', 'Plugin not found.', [ 'status' => 404 ] );
        }

        if ( ! class_exists( 'ZipArchive' ) ) {
            return new WP_Error( 'zip_not_available', 'ZipArchive class is not available on this server.', [ 'status' => 500 ] );
        }

        $plugin_dir_name = dirname( $plugin_file );
        $is_single_file  = ( $plugin_dir_name === '.' );

        // Set up export directory.
        $upload_dir = wp_upload_dir();
        $export_dir = $upload_dir['basedir'] . '/wmp-exports/';
        wp_mkdir_p( $export_dir );

        $key          = wp_generate_password( 16, false );
        $plugin_slug  = $is_single_file ? basename( $plugin_file, '.php' ) : $plugin_dir_name;
        $version      = $all_plugins[ $plugin_file ]['Version'] ?? '';
        $name_base    = $plugin_slug . ( $version ? '-' . $version : '' );
        $zip_filename = $export_dir . $name_base . '-' . $key . '.zip';

        $zip = new \ZipArchive();
        if ( $zip->open( $zip_filename, \ZipArchive::CREATE | \ZipArchive::OVERWRITE ) !== true ) {
            return new WP_Error( 'zip_failed', 'Failed to create ZIP archive.', [ 'status' => 500 ] );
        }

        if ( $is_single_file ) {
            // Single-file plugin — just zip the one file.
            $source_file = WP_PLUGIN_DIR . '/' . $plugin_file;
            if ( file_exists( $source_file ) ) {
                $zip->addFile( $source_file, basename( $plugin_file ) );
            }
        } else {
            // Zip the entire plugin directory.
            $plugin_base_dir = WP_PLUGIN_DIR . '/' . $plugin_dir_name;
            self::add_folder_to_zip( $zip, WP_PLUGIN_DIR, $plugin_base_dir );
        }

        $zip->close();

        if ( ! file_exists( $zip_filename ) ) {
            return new WP_Error( 'zip_failed', 'ZIP archive was not created.', [ 'status' => 500 ] );
        }

        // Store transient for download.
        set_transient( 'wmp_export_' . $key, $zip_filename, 300 );

        $nonce        = wp_create_nonce( 'wp_rest' );
        $download_url = rest_url( 'wp-manager-pro/v1/plugins/download' ) . '?key=' . $key . '&_wpnonce=' . $nonce;

        return new WP_REST_Response( [
            'success'      => true,
            'download_url' => $download_url,
            'filename'     => $plugin_slug . '.zip',
        ], 200 );
    }

    public static function download_export( WP_REST_Request $request ) {
        $key = sanitize_text_field( $request->get_param( 'key' ) );

        if ( ! $key ) {
            return new WP_Error( 'missing_key', 'Download key is required.', [ 'status' => 400 ] );
        }

        $zip_file = get_transient( 'wmp_export_' . $key );

        if ( ! $zip_file || ! file_exists( $zip_file ) ) {
            return new WP_Error( 'not_found', 'Export file not found or has expired.', [ 'status' => 404 ] );
        }

        delete_transient( 'wmp_export_' . $key );

        // Strip the random key from the filename for the download name.
        $basename     = basename( $zip_file );
        $clean_name   = preg_replace( '/-[a-zA-Z0-9]{16}(\.zip)$/', '$1', $basename );
        $file_size    = filesize( $zip_file );

        @ob_end_clean();

        header( 'Content-Type: application/zip' );
        header( 'Content-Disposition: attachment; filename="' . $clean_name . '"' );
        header( 'Content-Length: ' . $file_size );
        header( 'Cache-Control: no-cache, must-revalidate' );
        header( 'Pragma: public' );

        readfile( $zip_file );
        @unlink( $zip_file );
        exit;
    }

    public static function update_plugin( WP_REST_Request $request ) {
        self::load_plugin_functions();

        $plugin_file = sanitize_text_field( $request->get_param( 'plugin' ) );

        if ( ! $plugin_file ) {
            return new WP_Error( 'missing_param', 'Plugin file is required.', [ 'status' => 400 ] );
        }

        $update_plugins = get_site_transient( 'update_plugins' );

        if ( ! isset( $update_plugins->response[ $plugin_file ] ) ) {
            return new WP_Error( 'no_update', 'No update available for this plugin.', [ 'status' => 400 ] );
        }

        $upgrader = new \Plugin_Upgrader( new \WP_Ajax_Upgrader_Skin() );
        $result   = $upgrader->upgrade( $plugin_file );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'update_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        if ( ! $result ) {
            return new WP_Error( 'update_failed', 'Plugin update failed.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => 'Plugin updated successfully.' ], 200 );
    }

    public static function install_plugin_version( WP_REST_Request $request ) {
        self::load_plugin_functions();

        $slug    = sanitize_text_field( $request->get_param( 'slug' ) );
        $version = sanitize_text_field( $request->get_param( 'version' ) );

        if ( ! $slug || ! $version ) {
            return new WP_Error( 'missing_param', 'Slug and version are required.', [ 'status' => 400 ] );
        }

        if ( ! preg_match( '/^[a-z0-9-]+$/', $slug ) || ! preg_match( '/^[a-zA-Z0-9.\-]+$/', $version ) ) {
            return new WP_Error( 'invalid_param', 'Invalid slug or version format.', [ 'status' => 400 ] );
        }

        $download_url = 'https://downloads.wordpress.org/plugin/' . $slug . '.' . $version . '.zip';

        $upgrader = new \Plugin_Upgrader( new \WP_Ajax_Upgrader_Skin() );
        $result   = $upgrader->install( $download_url, [ 'overwrite_package' => true ] );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'install_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        if ( ! $result ) {
            return new WP_Error( 'install_failed', "Version {$version} installation failed.", [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => "Plugin v{$version} installed successfully." ], 200 );
    }

    private static function add_folder_to_zip( \ZipArchive $zip, string $base_path, string $folder ) {
        $base_path = rtrim( $base_path, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR;
        $folder    = rtrim( $folder, DIRECTORY_SEPARATOR );

        if ( ! is_dir( $folder ) ) {
            return;
        }

        $items = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator( $folder, \RecursiveDirectoryIterator::SKIP_DOTS ),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ( $items as $item ) {
            $item_path    = $item->getRealPath();
            $relative_path = substr( $item_path, strlen( $base_path ) );

            // Normalize to forward slashes for zip compatibility.
            $relative_path = str_replace( DIRECTORY_SEPARATOR, '/', $relative_path );

            if ( $item->isDir() ) {
                $zip->addEmptyDir( $relative_path . '/' );
            } else {
                $zip->addFile( $item_path, $relative_path );
            }
        }
    }
}
