<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Themes_Controller {

    private static function load_theme_functions() {
        if ( ! function_exists( 'themes_api' ) ) {
            require_once ABSPATH . 'wp-admin/includes/theme.php';
            require_once ABSPATH . 'wp-admin/includes/theme-install.php';
        }
        if ( ! class_exists( 'Theme_Upgrader' ) ) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        }
        if ( ! function_exists( 'request_filesystem_credentials' ) ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
    }

    public static function get_themes( WP_REST_Request $request ) {
        $all_themes   = wp_get_themes();
        $active_theme = get_stylesheet();

        $update_themes = get_site_transient( 'update_themes' );
        $updates = isset( $update_themes->response ) ? array_keys( $update_themes->response ) : [];

        $themes = [];
        foreach ( $all_themes as $slug => $theme ) {
            $screenshot = $theme->get_screenshot( 'relative' );
            $themes[] = [
                'slug'        => $slug,
                'name'        => $theme->get( 'Name' ),
                'version'     => $theme->get( 'Version' ),
                'description' => $theme->get( 'Description' ),
                'author'      => $theme->get( 'Author' ),
                'author_uri'  => $theme->get( 'AuthorURI' ),
                'theme_uri'   => $theme->get( 'ThemeURI' ),
                'screenshot'  => $screenshot ? get_theme_root_uri() . '/' . $slug . '/' . $screenshot : '',
                'active'      => $slug === $active_theme,
                'is_child'    => (bool) $theme->parent(),
                'parent'      => $theme->parent() ? $theme->parent()->get( 'Name' ) : null,
                'has_update'  => in_array( $slug, $updates ),
            ];
        }

        // Sort: active first, then alphabetically.
        usort( $themes, function( $a, $b ) {
            if ( $a['active'] ) return -1;
            if ( $b['active'] ) return 1;
            return strcmp( $a['name'], $b['name'] );
        } );

        return new WP_REST_Response( [ 'themes' => $themes, 'total' => count( $themes ) ], 200 );
    }

    public static function activate_theme( WP_REST_Request $request ) {
        $slug = sanitize_text_field( $request->get_param( 'slug' ) );

        if ( ! $slug ) {
            return new WP_Error( 'missing_param', 'Theme slug is required.', [ 'status' => 400 ] );
        }

        if ( ! wp_get_theme( $slug )->exists() ) {
            return new WP_Error( 'theme_not_found', 'Theme not found.', [ 'status' => 404 ] );
        }

        switch_theme( $slug );

        return new WP_REST_Response( [ 'success' => true, 'message' => 'Theme activated successfully.' ], 200 );
    }

    public static function delete_theme( WP_REST_Request $request ) {
        $slug = sanitize_text_field( $request->get_param( 'slug' ) );

        if ( ! $slug ) {
            return new WP_Error( 'missing_param', 'Theme slug is required.', [ 'status' => 400 ] );
        }

        // Cannot delete active theme.
        if ( $slug === get_stylesheet() ) {
            return new WP_Error( 'cannot_delete', 'Cannot delete the active theme.', [ 'status' => 403 ] );
        }

        if ( ! function_exists( 'delete_theme' ) ) {
            require_once ABSPATH . 'wp-admin/includes/theme.php';
        }

        $result = delete_theme( $slug );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'delete_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => 'Theme deleted successfully.' ], 200 );
    }

    public static function install_theme( WP_REST_Request $request ) {
        self::load_theme_functions();

        $slug = sanitize_text_field( $request->get_param( 'slug' ) );

        if ( ! $slug ) {
            return new WP_Error( 'missing_param', 'Theme slug is required.', [ 'status' => 400 ] );
        }

        $api = themes_api( 'theme_information', [
            'slug'   => $slug,
            'fields' => [ 'sections' => false ],
        ] );

        if ( is_wp_error( $api ) ) {
            return new WP_Error( 'theme_not_found', $api->get_error_message(), [ 'status' => 404 ] );
        }

        $upgrader = new \Theme_Upgrader( new \WP_Ajax_Upgrader_Skin() );
        $result   = $upgrader->install( $api->download_link );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'install_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => 'Theme installed successfully.' ], 200 );
    }

    public static function search_themes( WP_REST_Request $request ) {
        self::load_theme_functions();

        $search = sanitize_text_field( $request->get_param( 'q' ) );
        $page   = absint( $request->get_param( 'page' ) ) ?: 1;

        $api = themes_api( 'query_themes', [
            'search'   => $search,
            'per_page' => 12,
            'page'     => $page,
            'fields'   => [
                'screenshot_url' => true,
                'rating'         => true,
                'num_ratings'    => true,
                'downloaded'     => true,
                'last_updated'   => true,
            ],
        ] );

        if ( is_wp_error( $api ) ) {
            return new WP_Error( 'search_failed', $api->get_error_message(), [ 'status' => 500 ] );
        }

        $results = [];
        foreach ( $api->themes as $theme ) {
            $results[] = [
                'slug'           => $theme->slug,
                'name'           => $theme->name,
                'version'        => $theme->version,
                'description'    => $theme->description ?? '',
                'author'         => is_array( $theme->author ) ? ( $theme->author['user_nicename'] ?? '' ) : $theme->author,
                'screenshot_url' => $theme->screenshot_url ?? '',
                'rating'         => $theme->rating ?? 0,
                'num_ratings'    => $theme->num_ratings ?? 0,
                'downloaded'     => $theme->downloaded ?? 0,
            ];
        }

        return new WP_REST_Response( [
            'themes' => $results,
            'total'  => $api->info['results'] ?? 0,
        ], 200 );
    }

    public static function upload_theme( WP_REST_Request $request ) {
        self::load_theme_functions();

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

        $upgrader = new \Theme_Upgrader( new \WP_Ajax_Upgrader_Skin() );
        $result   = $upgrader->install( $file['tmp_name'], [ 'overwrite_package' => $overwrite ] );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'install_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        if ( ! $result ) {
            return new WP_Error( 'install_failed', 'Theme installation from upload failed.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [
            'success' => true,
            'message' => 'Theme uploaded and installed successfully.',
        ], 200 );
    }

    public static function export_theme( WP_REST_Request $request ) {
        $slug = sanitize_text_field( $request->get_param( 'slug' ) );

        if ( ! $slug ) {
            return new WP_Error( 'missing_param', 'Theme slug is required.', [ 'status' => 400 ] );
        }

        // Validate theme exists.
        if ( ! wp_get_theme( $slug )->exists() ) {
            return new WP_Error( 'theme_not_found', 'Theme not found.', [ 'status' => 404 ] );
        }

        if ( ! class_exists( 'ZipArchive' ) ) {
            return new WP_Error( 'zip_not_available', 'ZipArchive class is not available on this server.', [ 'status' => 500 ] );
        }

        $theme_dir = get_theme_root() . '/' . $slug;

        if ( ! is_dir( $theme_dir ) ) {
            return new WP_Error( 'theme_dir_not_found', 'Theme directory not found.', [ 'status' => 404 ] );
        }

        // Set up export directory.
        $upload_dir = wp_upload_dir();
        $export_dir = $upload_dir['basedir'] . '/wmp-exports/';
        wp_mkdir_p( $export_dir );

        $key          = wp_generate_password( 16, false );
        $version      = wp_get_theme( $slug )->get( 'Version' );
        $name_base    = $slug . ( $version ? '-' . $version : '' );
        $zip_filename = $export_dir . $name_base . '-' . $key . '.zip';

        $zip = new \ZipArchive();
        if ( $zip->open( $zip_filename, \ZipArchive::CREATE | \ZipArchive::OVERWRITE ) !== true ) {
            return new WP_Error( 'zip_failed', 'Failed to create ZIP archive.', [ 'status' => 500 ] );
        }

        self::add_folder_to_zip( $zip, get_theme_root(), $theme_dir );
        $zip->close();

        if ( ! file_exists( $zip_filename ) ) {
            return new WP_Error( 'zip_failed', 'ZIP archive was not created.', [ 'status' => 500 ] );
        }

        // Store transient for download.
        set_transient( 'wmp_export_' . $key, $zip_filename, 300 );

        $nonce        = wp_create_nonce( 'wp_rest' );
        $download_url = rest_url( 'wp-manager-pro/v1/themes/download' ) . '?key=' . $key . '&_wpnonce=' . $nonce;

        return new WP_REST_Response( [
            'success'      => true,
            'download_url' => $download_url,
            'filename'     => $slug . '.zip',
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
        $basename   = basename( $zip_file );
        $clean_name = preg_replace( '/-[a-zA-Z0-9]{16}(\.zip)$/', '$1', $basename );
        $file_size  = filesize( $zip_file );

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

    public static function update_theme( WP_REST_Request $request ) {
        self::load_theme_functions();

        $slug = sanitize_text_field( $request->get_param( 'slug' ) );

        if ( ! $slug ) {
            return new WP_Error( 'missing_param', 'Theme slug is required.', [ 'status' => 400 ] );
        }

        $update_themes = get_site_transient( 'update_themes' );

        if ( ! isset( $update_themes->response[ $slug ] ) ) {
            return new WP_Error( 'no_update', 'No update available for this theme.', [ 'status' => 400 ] );
        }

        $upgrader = new \Theme_Upgrader( new \WP_Ajax_Upgrader_Skin() );
        $result   = $upgrader->upgrade( $slug );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'update_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        if ( ! $result ) {
            return new WP_Error( 'update_failed', 'Theme update failed.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => 'Theme updated successfully.' ], 200 );
    }

    public static function install_theme_version( WP_REST_Request $request ) {
        self::load_theme_functions();

        $slug    = sanitize_text_field( $request->get_param( 'slug' ) );
        $version = sanitize_text_field( $request->get_param( 'version' ) );

        if ( ! $slug || ! $version ) {
            return new WP_Error( 'missing_param', 'Slug and version are required.', [ 'status' => 400 ] );
        }

        if ( ! preg_match( '/^[a-z0-9-]+$/', $slug ) || ! preg_match( '/^[a-zA-Z0-9.\-]+$/', $version ) ) {
            return new WP_Error( 'invalid_param', 'Invalid slug or version format.', [ 'status' => 400 ] );
        }

        $download_url = 'https://downloads.wordpress.org/theme/' . $slug . '.' . $version . '.zip';

        $upgrader = new \Theme_Upgrader( new \WP_Ajax_Upgrader_Skin() );
        $result   = $upgrader->install( $download_url, [ 'overwrite_package' => true ] );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'install_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        if ( ! $result ) {
            return new WP_Error( 'install_failed', "Version {$version} installation failed.", [ 'status' => 500 ] );
        }

        // Remove stale update entry so the badge disappears after a downgrade.
        $update_themes = get_site_transient( 'update_themes' );
        if ( $update_themes && isset( $update_themes->response[ $slug ] ) ) {
            unset( $update_themes->response[ $slug ] );
            set_site_transient( 'update_themes', $update_themes );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => "Theme v{$version} installed successfully." ], 200 );
    }

    public static function check_updates( WP_REST_Request $request ) {
        self::load_theme_functions();

        // Force WordPress to re-fetch update data from WordPress.org.
        delete_site_transient( 'update_themes' );
        wp_update_themes();

        return self::get_themes( $request );
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
            $item_path     = $item->getRealPath();
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
