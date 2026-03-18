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

        // Remember active state — Plugin_Upgrader::upgrade() deactivates but does not re-activate.
        $was_active = is_plugin_active( $plugin_file );

        $upgrader = new \Plugin_Upgrader( new \WP_Ajax_Upgrader_Skin() );
        $result   = $upgrader->upgrade( $plugin_file );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'update_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        if ( ! $result ) {
            return new WP_Error( 'update_failed', 'Plugin update failed.', [ 'status' => 500 ] );
        }

        // Re-activate if it was active before the upgrade.
        if ( $was_active && ! is_plugin_active( $plugin_file ) ) {
            activate_plugin( $plugin_file );
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

        // Snapshot active state before install (install() doesn't re-activate).
        $all_plugins    = get_plugins();
        $active_plugins = get_option( 'active_plugins', [] );
        $plugin_file    = null;

        foreach ( $all_plugins as $file => $data ) {
            $file_slug = dirname( $file );
            if ( '.' === $file_slug ) {
                $file_slug = basename( $file, '.php' );
            }
            if ( $file_slug === $slug ) {
                $plugin_file = $file;
                break;
            }
        }

        $was_active = $plugin_file && in_array( $plugin_file, $active_plugins );

        $download_url = 'https://downloads.wordpress.org/plugin/' . $slug . '.' . $version . '.zip';

        $upgrader = new \Plugin_Upgrader( new \WP_Ajax_Upgrader_Skin() );
        $result   = $upgrader->install( $download_url, [ 'overwrite_package' => true ] );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'install_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        if ( ! $result ) {
            return new WP_Error( 'install_failed', "Version {$version} installation failed.", [ 'status' => 500 ] );
        }

        // Re-activate if it was active before the install.
        if ( $was_active && $plugin_file ) {
            activate_plugin( $plugin_file );
        }

        // Remove stale update entry for this plugin so the badge disappears.
        $update_plugins = get_site_transient( 'update_plugins' );
        if ( $update_plugins && $plugin_file && isset( $update_plugins->response[ $plugin_file ] ) ) {
            unset( $update_plugins->response[ $plugin_file ] );
            set_site_transient( 'update_plugins', $update_plugins );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => "Plugin v{$version} installed successfully." ], 200 );
    }

    public static function bulk_activate( WP_REST_Request $request ) {
        self::load_plugin_functions();

        $plugins = (array) $request->get_param( 'plugins' );
        if ( empty( $plugins ) ) {
            return new WP_Error( 'missing_param', 'Plugins array is required.', [ 'status' => 400 ] );
        }

        $plugins = array_map( 'sanitize_text_field', $plugins );
        $result  = activate_plugins( $plugins );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'activation_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => count( $plugins ) . ' plugin(s) activated.' ], 200 );
    }

    public static function bulk_deactivate( WP_REST_Request $request ) {
        self::load_plugin_functions();

        $plugins = (array) $request->get_param( 'plugins' );
        if ( empty( $plugins ) ) {
            return new WP_Error( 'missing_param', 'Plugins array is required.', [ 'status' => 400 ] );
        }

        $plugins = array_map( 'sanitize_text_field', $plugins );
        $plugins = array_values( array_filter( $plugins, fn( $p ) => WP_MANAGER_PRO_BASENAME !== $p ) );

        deactivate_plugins( $plugins );

        return new WP_REST_Response( [ 'success' => true, 'message' => count( $plugins ) . ' plugin(s) deactivated.' ], 200 );
    }

    public static function bulk_delete( WP_REST_Request $request ) {
        self::load_plugin_functions();

        $plugins = (array) $request->get_param( 'plugins' );
        if ( empty( $plugins ) ) {
            return new WP_Error( 'missing_param', 'Plugins array is required.', [ 'status' => 400 ] );
        }

        $plugins = array_map( 'sanitize_text_field', $plugins );
        $plugins = array_values( array_filter( $plugins, fn( $p ) => WP_MANAGER_PRO_BASENAME !== $p ) );

        deactivate_plugins( $plugins );

        if ( ! function_exists( 'delete_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $result = delete_plugins( $plugins );

        if ( is_wp_error( $result ) ) {
            return new WP_Error( 'delete_failed', $result->get_error_message(), [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => count( $plugins ) . ' plugin(s) deleted.' ], 200 );
    }

    public static function bulk_update( WP_REST_Request $request ) {
        self::load_plugin_functions();

        $plugins = (array) $request->get_param( 'plugins' );
        if ( empty( $plugins ) ) {
            return new WP_Error( 'missing_param', 'Plugins array is required.', [ 'status' => 400 ] );
        }

        $plugins        = array_map( 'sanitize_text_field', $plugins );
        $update_plugins = get_site_transient( 'update_plugins' );
        $updated        = 0;
        $failed         = 0;

        foreach ( $plugins as $plugin_file ) {
            if ( ! isset( $update_plugins->response[ $plugin_file ] ) ) {
                continue;
            }

            $was_active = is_plugin_active( $plugin_file );
            $upgrader   = new \Plugin_Upgrader( new \WP_Ajax_Upgrader_Skin() );
            $result     = $upgrader->upgrade( $plugin_file );

            if ( is_wp_error( $result ) || ! $result ) {
                $failed++;
            } else {
                if ( $was_active && ! is_plugin_active( $plugin_file ) ) {
                    activate_plugin( $plugin_file );
                }
                $updated++;
            }
        }

        $message = "{$updated} plugin(s) updated" . ( $failed > 0 ? ", {$failed} failed" : '' ) . '.';

        return new WP_REST_Response( [
            'success' => $updated > 0,
            'updated' => $updated,
            'failed'  => $failed,
            'message' => $message,
        ], 200 );
    }

    public static function check_updates( WP_REST_Request $request ) {
        self::load_plugin_functions();

        // Force WordPress to re-fetch update data from WordPress.org.
        delete_site_transient( 'update_plugins' );
        wp_update_plugins();

        return self::get_plugins( $request );
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

    // ── Plugin Health Check ────────────────────────────────────────────────────

    /**
     * GET /plugins/health
     * Returns health data for all installed plugins.
     * Results are cached in a 24-hour transient.
     */
    public static function get_health( WP_REST_Request $request ): WP_REST_Response {
        self::load_plugin_functions();

        $bust  = (bool) $request->get_param( 'bust' );
        $cache_key = 'wmp_plugin_health_v1';

        if ( ! $bust ) {
            $cached = get_transient( $cache_key );
            if ( $cached !== false ) {
                return new WP_REST_Response( $cached, 200 );
            }
        }

        $all_plugins    = get_plugins();
        $active_plugins = get_option( 'active_plugins', [] );
        $wp_version     = get_bloginfo( 'version' );
        $api_key        = get_option( 'wmp_wpscan_api_key', '' );

        $results = [];

        foreach ( $all_plugins as $plugin_file => $plugin_data ) {
            $slug    = explode( '/', $plugin_file )[0];
            $active  = in_array( $plugin_file, $active_plugins, true );
            $issues  = [];
            $status  = 'healthy'; // healthy | warning | critical | unknown

            // ── 1. Fetch WP.org plugin info ──────────────────────────────────
            $wporg = self::fetch_wporg_info( $slug );

            if ( $wporg === null ) {
                // Not on WP.org — premium / custom plugin.
                $issues[] = [
                    'type'    => 'not_on_wporg',
                    'level'   => 'info',
                    'message' => 'Not listed on WordPress.org — may be a premium or custom plugin.',
                ];
                if ( $status === 'healthy' ) $status = 'unknown';
            } else {
                // ── 2. Abandoned check (last updated > 2 years) ──────────────
                if ( ! empty( $wporg['last_updated'] ) ) {
                    $last_updated = strtotime( $wporg['last_updated'] );
                    $two_years_ago = strtotime( '-2 years' );
                    if ( $last_updated && $last_updated < $two_years_ago ) {
                        $years = round( ( time() - $last_updated ) / YEAR_IN_SECONDS, 1 );
                        $issues[] = [
                            'type'    => 'abandoned',
                            'level'   => 'warning',
                            'message' => "Not updated in {$years} years — may be abandoned.",
                        ];
                        if ( $status === 'healthy' ) $status = 'warning';
                    }
                }

                // ── 3. Compatibility check ───────────────────────────────────
                if ( ! empty( $wporg['tested'] ) ) {
                    if ( version_compare( $wporg['tested'], $wp_version, '<' ) ) {
                        $issues[] = [
                            'type'    => 'compatibility',
                            'level'   => 'warning',
                            'message' => "Only tested up to WP {$wporg['tested']} (current: {$wp_version}).",
                        ];
                        if ( $status === 'healthy' ) $status = 'warning';
                    }
                }

                // ── 4. Low rating check ──────────────────────────────────────
                if ( ! empty( $wporg['rating'] ) && ! empty( $wporg['num_ratings'] ) ) {
                    $rating     = (float) $wporg['rating'] / 20; // WP.org uses 0–100 scale
                    $num_ratings = (int) $wporg['num_ratings'];
                    if ( $rating < 3.0 && $num_ratings >= 10 ) {
                        $issues[] = [
                            'type'    => 'low_rating',
                            'level'   => 'warning',
                            'message' => sprintf( 'Low rating: %.1f★ from %s ratings.', $rating, number_format( $num_ratings ) ),
                        ];
                        if ( $status === 'healthy' ) $status = 'warning';
                    }
                }
            }

            // ── 5. WPScan vulnerability check ───────────────────────────────
            if ( $api_key ) {
                $vulns = self::fetch_wpscan_for_health( $slug, $plugin_data['Version'], $api_key );
                if ( ! empty( $vulns ) ) {
                    foreach ( $vulns as $v ) {
                        $issues[] = [
                            'type'    => 'vulnerability',
                            'level'   => 'critical',
                            'message' => $v['title'],
                            'cvss'    => $v['cvss'] ?? null,
                            'cve'     => $v['cve']  ?? null,
                        ];
                    }
                    $status = 'critical';
                }
            }

            $results[] = [
                'file'          => $plugin_file,
                'slug'          => $slug,
                'name'          => $plugin_data['Name'],
                'version'       => $plugin_data['Version'],
                'active'        => $active,
                'status'        => $status,
                'issues'        => $issues,
                'wporg'         => $wporg ? [
                    'rating'       => isset( $wporg['rating'] ) ? round( (float) $wporg['rating'] / 20, 1 ) : null,
                    'num_ratings'  => $wporg['num_ratings'] ?? null,
                    'active_installs' => $wporg['active_installs'] ?? null,
                    'last_updated' => $wporg['last_updated'] ?? null,
                    'tested'       => $wporg['tested'] ?? null,
                ] : null,
            ];
        }

        // Sort: critical first, then warning, unknown, healthy.
        $order = [ 'critical' => 0, 'warning' => 1, 'unknown' => 2, 'healthy' => 3 ];
        usort( $results, fn( $a, $b ) => ( $order[ $a['status'] ] ?? 9 ) - ( $order[ $b['status'] ] ?? 9 ) );

        $summary = [
            'total'    => count( $results ),
            'critical' => count( array_filter( $results, fn( $r ) => $r['status'] === 'critical' ) ),
            'warning'  => count( array_filter( $results, fn( $r ) => $r['status'] === 'warning' ) ),
            'unknown'  => count( array_filter( $results, fn( $r ) => $r['status'] === 'unknown' ) ),
            'healthy'  => count( array_filter( $results, fn( $r ) => $r['status'] === 'healthy' ) ),
            'cached_at' => current_time( 'c' ),
        ];

        $response = [ 'summary' => $summary, 'plugins' => $results ];
        set_transient( $cache_key, $response, DAY_IN_SECONDS );

        return new WP_REST_Response( $response, 200 );
    }

    /**
     * Fetch basic plugin info from the WordPress.org API.
     * Returns null if the plugin is not on WP.org.
     */
    private static function fetch_wporg_info( string $slug ): ?array {
        $url = "https://api.wordpress.org/plugins/info/1.0/{$slug}.json";
        $response = wp_remote_get( $url, [ 'timeout' => 8, 'sslverify' => true ] );

        if ( is_wp_error( $response ) ) return null;
        $body = wp_remote_retrieve_body( $response );
        $data = json_decode( $body, true );

        if ( empty( $data ) || isset( $data['error'] ) ) return null;

        return [
            'rating'          => $data['rating']          ?? null,
            'num_ratings'     => $data['num_ratings']     ?? null,
            'active_installs' => $data['active_installs'] ?? null,
            'last_updated'    => $data['last_updated']    ?? null,
            'tested'          => $data['tested']          ?? null,
        ];
    }

    /**
     * Fetch vulnerabilities from WPScan for a single plugin.
     */
    private static function fetch_wpscan_for_health( string $slug, string $version, string $api_key ): array {
        $url      = "https://wpscan.com/api/v3/plugins/{$slug}";
        $response = wp_remote_get( $url, [
            'timeout' => 8,
            'headers' => [ 'Authorization' => 'Token token=' . $api_key ],
        ] );

        if ( is_wp_error( $response ) || wp_remote_retrieve_response_code( $response ) !== 200 ) {
            return [];
        }

        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        $item = $body[ $slug ] ?? null;
        if ( ! $item ) return [];

        $vulns = [];
        foreach ( $item['vulnerabilities'] ?? [] as $v ) {
            $fixed_in = $v['fixed_in'] ?? null;
            if ( $fixed_in && version_compare( $version, $fixed_in, '>=' ) ) continue;

            $cvss = null;
            if ( ! empty( $v['cvss'] ) ) {
                $cvss = is_array( $v['cvss'] ) ? ( $v['cvss']['score'] ?? null ) : $v['cvss'];
            }
            $cve = null;
            if ( ! empty( $v['references']['cve'] ) ) {
                $cve = 'CVE-' . $v['references']['cve'][0];
            }
            $vulns[] = [
                'title' => $v['title'] ?? 'Unknown vulnerability',
                'cvss'  => $cvss,
                'cve'   => $cve,
            ];
        }

        return $vulns;
    }
}
