<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Update_Manager_Controller {

    const HISTORY_OPTION   = 'wmp_update_history';
    const SCHEDULED_OPTION = 'wmp_scheduled_updates';
    const CRON_ACTION      = 'wmp_run_scheduled_update';
    const MAX_HISTORY      = 100;

    // ── Private helpers ──────────────────────────────────────────────────────

    private static function backup_dir(): string {
        $dir = WP_CONTENT_DIR . '/wmp-backups/updates/';
        if ( ! file_exists( $dir ) ) {
            wp_mkdir_p( $dir );
            file_put_contents( $dir . '.htaccess', 'deny from all' );
            file_put_contents( $dir . 'index.php', '<?php // Silence is golden.' );
        }
        return $dir;
    }

    private static function load_upgrade_functions(): void {
        if ( ! function_exists( 'get_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if ( ! class_exists( 'Plugin_Upgrader' ) ) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        }
        if ( ! function_exists( 'request_filesystem_credentials' ) ) {
            require_once ABSPATH . 'wp-admin/includes/file.php';
        }
        if ( ! function_exists( 'get_core_updates' ) ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }
        if ( ! function_exists( 'themes_api' ) ) {
            require_once ABSPATH . 'wp-admin/includes/theme.php';
        }
        if ( ! class_exists( 'WP_Ajax_Upgrader_Skin' ) ) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-ajax-upgrader-skin.php';
        }
    }

    // ── GET /updates/available ────────────────────────────────────────────────

    public static function get_available( WP_REST_Request $request ): WP_REST_Response {
        self::load_upgrade_functions();

        $force = (bool) $request->get_param( 'force' );
        if ( $force ) {
            wp_update_plugins();
            wp_update_themes();
            wp_version_check();
        }

        $items = [];

        // Plugins
        $update_plugins = get_site_transient( 'update_plugins' );
        $all_plugins    = get_plugins();
        if ( ! empty( $update_plugins->response ) ) {
            foreach ( $update_plugins->response as $plugin_file => $data ) {
                $meta = $all_plugins[ $plugin_file ] ?? [];
                $slug = dirname( $plugin_file );
                if ( '.' === $slug ) {
                    $slug = basename( $plugin_file, '.php' );
                }
                $items[] = [
                    'id'          => 'plugin:' . $plugin_file,
                    'type'        => 'plugin',
                    'slug'        => $slug,
                    'file'        => $plugin_file,
                    'name'        => $meta['Name'] ?? $slug,
                    'current'     => $meta['Version'] ?? '',
                    'new_version' => $data->new_version ?? '',
                    'changelog_url' => $data->url ?? '',
                ];
            }
        }

        // Themes
        $update_themes = get_site_transient( 'update_themes' );
        $all_themes    = wp_get_themes();
        if ( ! empty( $update_themes->response ) ) {
            foreach ( $update_themes->response as $theme_slug => $data ) {
                $theme   = $all_themes[ $theme_slug ] ?? null;
                $items[] = [
                    'id'          => 'theme:' . $theme_slug,
                    'type'        => 'theme',
                    'slug'        => $theme_slug,
                    'file'        => $theme_slug,
                    'name'        => $theme ? $theme->get( 'Name' ) : $theme_slug,
                    'current'     => $theme ? $theme->get( 'Version' ) : '',
                    'new_version' => $data['new_version'] ?? '',
                    'changelog_url' => $data['url'] ?? '',
                ];
            }
        }

        // Core
        $core_updates = get_core_updates();
        if ( ! empty( $core_updates ) ) {
            foreach ( $core_updates as $update ) {
                if ( 'upgrade' === $update->response ) {
                    $items[] = [
                        'id'          => 'core:wordpress',
                        'type'        => 'core',
                        'slug'        => 'wordpress',
                        'file'        => 'wordpress',
                        'name'        => 'WordPress Core',
                        'current'     => get_bloginfo( 'version' ),
                        'new_version' => $update->version,
                        'changelog_url' => 'https://wordpress.org/news/category/releases/',
                    ];
                    break;
                }
            }
        }

        return new WP_REST_Response( [ 'updates' => $items, 'total' => count( $items ) ], 200 );
    }

    // ── GET /updates/changelog ────────────────────────────────────────────────

    public static function get_changelog( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $type = sanitize_text_field( $request->get_param( 'type' ) );
        $slug = sanitize_text_field( $request->get_param( 'slug' ) );

        if ( ! $slug || ! in_array( $type, [ 'plugin', 'theme', 'core' ], true ) ) {
            return new WP_Error( 'missing_param', 'type and slug are required.', [ 'status' => 400 ] );
        }

        if ( 'core' === $type ) {
            return new WP_REST_Response( [
                'changelog' => '<p>See <a href="https://wordpress.org/news/category/releases/" target="_blank" rel="noreferrer">WordPress Release Notes</a> for the full changelog.</p>',
            ], 200 );
        }

        $api_url = 'https://api.wordpress.org/' . $type . 's/info/1.2/?' . http_build_query( [
            'action'           => ( 'plugin' === $type ) ? 'plugin_information' : 'theme_information',
            'slug'             => $slug,
            'fields[sections]' => '1',
        ] );

        $response = wp_remote_get( $api_url, [ 'timeout' => 15 ] );

        if ( is_wp_error( $response ) ) {
            return new WP_Error( 'fetch_failed', $response->get_error_message(), [ 'status' => 502 ] );
        }

        $body = wp_remote_retrieve_body( $response );
        $data = json_decode( $body, true );
        $changelog = $data['sections']['changelog'] ?? '<p>No changelog available for this ' . esc_html( $type ) . '.</p>';

        return new WP_REST_Response( [ 'changelog' => $changelog ], 200 );
    }

    // ── POST /updates/run ─────────────────────────────────────────────────────

    public static function run_update( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        self::load_upgrade_functions();

        $type = sanitize_text_field( $request->get_param( 'type' ) );
        $slug = sanitize_text_field( $request->get_param( 'slug' ) );

        if ( ! $type || ! $slug ) {
            return new WP_Error( 'missing_param', 'type and slug are required.', [ 'status' => 400 ] );
        }

        $current_version = '';
        $new_version     = '';
        $name            = $slug;

        if ( 'plugin' === $type ) {
            $all_plugins     = get_plugins();
            $meta            = $all_plugins[ $slug ] ?? [];
            $current_version = $meta['Version'] ?? '';
            $name            = $meta['Name'] ?? $slug;
            $update_plugins  = get_site_transient( 'update_plugins' );
            $new_version     = $update_plugins->response[ $slug ]->new_version ?? '';
        } elseif ( 'theme' === $type ) {
            $theme           = wp_get_theme( $slug );
            $current_version = $theme->get( 'Version' );
            $name            = $theme->get( 'Name' );
            $update_themes   = get_site_transient( 'update_themes' );
            $new_version     = $update_themes->response[ $slug ]['new_version'] ?? '';
        } elseif ( 'core' === $type ) {
            $current_version = get_bloginfo( 'version' );
            $name            = 'WordPress Core';
        }

        // Step 1: Backup
        $backup_file = ( 'core' !== $type ) ? self::create_backup( $type, $slug, $current_version ) : null;

        // Step 2: Upgrade
        $result = null;
        $error  = null;

        try {
            if ( 'plugin' === $type ) {
                $was_active = is_plugin_active( $slug );
                $upgrader   = new \Plugin_Upgrader( new \WP_Ajax_Upgrader_Skin() );
                $result     = $upgrader->upgrade( $slug );
                if ( $was_active && ! is_plugin_active( $slug ) ) {
                    activate_plugin( $slug );
                }
            } elseif ( 'theme' === $type ) {
                $upgrader = new \Theme_Upgrader( new \WP_Ajax_Upgrader_Skin() );
                $result   = $upgrader->upgrade( $slug );
            } elseif ( 'core' === $type ) {
                require_once ABSPATH . 'wp-admin/includes/update.php';
                $core_updates = get_core_updates();
                $update       = reset( $core_updates );
                $upgrader     = new \Core_Upgrader( new \WP_Ajax_Upgrader_Skin() );
                $result       = $upgrader->upgrade( $update );
            }
        } catch ( \Throwable $e ) {
            $error = $e->getMessage();
        }

        // null result means no update was actually performed (e.g. premium/unlicensed plugin).
        // Also check the upgrader skin's own result for captured errors.
        $skin_error = null;
        if ( isset( $upgrader ) && is_a( $upgrader->skin, 'WP_Upgrader_Skin' ) ) {
            $skin_result = $upgrader->skin->result;
            if ( is_wp_error( $skin_result ) ) {
                $skin_error = $skin_result->get_error_message();
            }
        }

        $success = (
            null === $error &&
            null === $skin_error &&
            ! is_wp_error( $result ) &&
            false !== $result &&
            null !== $result        // null = no update performed (e.g. license required)
        );

        if ( null === $error && null !== $skin_error ) {
            $error = $skin_error;
        }
        if ( null === $error && null === $result && ! is_wp_error( $result ) ) {
            $error = 'Update could not be completed. The plugin or theme may require a valid license key, or no update package was available.';
        }

        // Step 3: Resolve new version
        if ( $success && 'plugin' === $type ) {
            wp_clean_plugins_cache( true );
            $refreshed   = get_plugins();
            $new_version = $refreshed[ $slug ]['Version'] ?? $new_version;
        } elseif ( $success && 'theme' === $type ) {
            delete_site_transient( 'update_themes' );
            $new_version = wp_get_theme( $slug )->get( 'Version' );
        } elseif ( $success && 'core' === $type ) {
            $new_version = get_bloginfo( 'version' );
        }

        // Step 4: Log history
        $backup_path = ( $backup_file && ! is_wp_error( $backup_file ) ) ? $backup_file : null;
        self::append_history( [
            'name'         => $name,
            'type'         => $type,
            'slug'         => $slug,
            'from_version' => $current_version,
            'to_version'   => $success ? $new_version : $current_version,
            'status'       => $success ? 'done' : 'failed',
            'error'        => $error ?? ( is_wp_error( $result ) ? $result->get_error_message() : null ),
            'backup_file'  => $backup_path,
            'date'         => current_time( 'mysql' ),
        ] );

        if ( ! $success ) {
            $msg = $error ?? ( is_wp_error( $result ) ? $result->get_error_message() : 'Update failed.' );
            // Classify the error for a better frontend message
            $code = 'update_failed';
            if ( str_contains( (string) $msg, 'license' ) || str_contains( (string) $msg, 'License' ) ) {
                $code = 'license_required';
            } elseif ( null === $result ) {
                $code = 'update_unavailable';
            }
            return new WP_Error( $code, $msg, [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [
            'success'     => true,
            'message'     => "{$name} updated to v{$new_version} successfully.",
            'new_version' => $new_version,
        ], 200 );
    }

    // ── POST /updates/rollback ────────────────────────────────────────────────

    public static function rollback( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $history_id = sanitize_text_field( $request->get_param( 'history_id' ) );

        if ( ! $history_id ) {
            return new WP_Error( 'missing_param', 'history_id is required.', [ 'status' => 400 ] );
        }

        $history = get_option( self::HISTORY_OPTION, [] );
        $entry   = null;
        foreach ( $history as $h ) {
            if ( $h['id'] === $history_id ) { $entry = $h; break; }
        }

        if ( ! $entry ) {
            return new WP_Error( 'not_found', 'History entry not found.', [ 'status' => 404 ] );
        }
        if ( empty( $entry['backup_file'] ) || ! file_exists( $entry['backup_file'] ) ) {
            return new WP_Error( 'no_backup', 'Backup file not found for this entry.', [ 'status' => 404 ] );
        }

        if ( ! class_exists( 'ZipArchive' ) ) {
            return new WP_Error( 'no_zip', 'ZipArchive extension not available.', [ 'status' => 500 ] );
        }

        $zip = new \ZipArchive();
        if ( $zip->open( $entry['backup_file'] ) !== true ) {
            return new WP_Error( 'zip_failed', 'Could not open backup ZIP.', [ 'status' => 500 ] );
        }

        $extract_to = ( 'plugin' === $entry['type'] ) ? WP_PLUGIN_DIR : get_theme_root();
        $zip->extractTo( $extract_to );
        $zip->close();

        // Mark as rolled-back
        foreach ( $history as &$h ) {
            if ( $h['id'] === $history_id ) { $h['status'] = 'rolled-back'; break; }
        }
        update_option( self::HISTORY_OPTION, $history );

        return new WP_REST_Response( [
            'success' => true,
            'message' => "{$entry['name']} rolled back to v{$entry['from_version']}.",
        ], 200 );
    }

    // ── GET /updates/history ──────────────────────────────────────────────────

    public static function get_history( WP_REST_Request $request ): WP_REST_Response {
        $history = get_option( self::HISTORY_OPTION, [] );
        foreach ( $history as &$h ) {
            $h['has_backup'] = ! empty( $h['backup_file'] ) && file_exists( $h['backup_file'] );
            unset( $h['backup_file'] );
        }
        return new WP_REST_Response( [ 'history' => $history, 'total' => count( $history ) ], 200 );
    }

    // ── DELETE /updates/history/clear ─────────────────────────────────────────

    public static function clear_history( WP_REST_Request $request ): WP_REST_Response {
        $history = get_option( self::HISTORY_OPTION, [] );
        foreach ( $history as $h ) {
            if ( ! empty( $h['backup_file'] ) && file_exists( $h['backup_file'] ) ) {
                @unlink( $h['backup_file'] );
            }
        }
        delete_option( self::HISTORY_OPTION );
        return new WP_REST_Response( [ 'success' => true, 'message' => 'Update history cleared.' ], 200 );
    }

    // ── GET /updates/scheduled ────────────────────────────────────────────────

    public static function get_scheduled( WP_REST_Request $request ): WP_REST_Response {
        $jobs = get_option( self::SCHEDULED_OPTION, [] );
        foreach ( $jobs as &$job ) {
            $next              = wp_next_scheduled( self::CRON_ACTION, [ $job['id'] ] );
            $job['next_run']   = $next ?: null;
            $job['next_run_human'] = $next ? human_time_diff( $next ) : 'Not scheduled';
        }
        return new WP_REST_Response( [ 'scheduled' => $jobs ], 200 );
    }

    // ── POST /updates/schedule ────────────────────────────────────────────────

    public static function add_schedule( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $type   = sanitize_text_field( $request->get_param( 'type' ) );
        $slug   = sanitize_text_field( $request->get_param( 'slug' ) );
        $run_at = absint( $request->get_param( 'run_at' ) );

        if ( ! $type || ! $slug || ! $run_at ) {
            return new WP_Error( 'missing_param', 'type, slug, and run_at are required.', [ 'status' => 400 ] );
        }
        if ( $run_at <= time() ) {
            return new WP_Error( 'invalid_time', 'Scheduled time must be in the future.', [ 'status' => 400 ] );
        }

        $job = [
            'id'         => uniqid( 'wmpsc_', true ),
            'type'       => $type,
            'slug'       => $slug,
            'run_at'     => $run_at,
            'created_at' => current_time( 'mysql' ),
            'status'     => 'pending',
        ];

        $jobs   = get_option( self::SCHEDULED_OPTION, [] );
        $jobs[] = $job;
        update_option( self::SCHEDULED_OPTION, $jobs );

        wp_schedule_single_event( $run_at, self::CRON_ACTION, [ $job['id'] ] );

        return new WP_REST_Response( [ 'success' => true, 'job' => $job ], 201 );
    }

    // ── DELETE /updates/schedule/cancel ───────────────────────────────────────

    public static function cancel_schedule( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $job_id = sanitize_text_field( $request->get_param( 'job_id' ) );
        if ( ! $job_id ) {
            return new WP_Error( 'missing_param', 'job_id is required.', [ 'status' => 400 ] );
        }

        $jobs = get_option( self::SCHEDULED_OPTION, [] );
        $jobs = array_values( array_filter( $jobs, fn( $j ) => $j['id'] !== $job_id ) );
        update_option( self::SCHEDULED_OPTION, $jobs );
        wp_clear_scheduled_hook( self::CRON_ACTION, [ $job_id ] );

        return new WP_REST_Response( [ 'success' => true, 'message' => 'Scheduled update cancelled.' ], 200 );
    }

    // ── WP Cron callback ──────────────────────────────────────────────────────

    public static function run_scheduled_update( string $job_id ): void {
        $jobs = get_option( self::SCHEDULED_OPTION, [] );
        $job  = null;
        foreach ( $jobs as $j ) {
            if ( $j['id'] === $job_id ) { $job = $j; break; }
        }
        if ( ! $job ) return;

        $fake = new \WP_REST_Request( 'POST' );
        $fake->set_param( 'type', $job['type'] );
        $fake->set_param( 'slug', $job['slug'] );
        self::run_update( $fake );

        $jobs = array_values( array_filter( $jobs, fn( $j ) => $j['id'] !== $job_id ) );
        update_option( self::SCHEDULED_OPTION, $jobs );
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private static function append_history( array $entry ): string {
        $history      = get_option( self::HISTORY_OPTION, [] );
        $entry['id']  = uniqid( 'wmpuh_', true );
        array_unshift( $history, $entry );
        $history = array_slice( $history, 0, self::MAX_HISTORY );
        update_option( self::HISTORY_OPTION, $history );
        return $entry['id'];
    }

    private static function create_backup( string $type, string $slug, string $version ): string|\WP_Error {
        if ( ! class_exists( 'ZipArchive' ) ) {
            return new \WP_Error( 'no_zip', 'ZipArchive not available.' );
        }

        $dir       = self::backup_dir();
        $timestamp = time();
        $safe_slug = sanitize_file_name( str_replace( '/', '-', $slug ) );
        $filename  = "{$type}-{$safe_slug}-{$version}-{$timestamp}.zip";
        $zip_path  = $dir . $filename;

        $zip = new \ZipArchive();
        if ( $zip->open( $zip_path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE ) !== true ) {
            return new \WP_Error( 'zip_open_failed', 'Could not create backup ZIP.' );
        }

        if ( 'plugin' === $type ) {
            $dir_name   = dirname( $slug );
            $source_dir = ( '.' !== $dir_name ) ? WP_PLUGIN_DIR . '/' . $dir_name : null;
            if ( $source_dir && is_dir( $source_dir ) ) {
                self::add_folder_to_zip( $zip, WP_PLUGIN_DIR, $source_dir );
            } elseif ( file_exists( WP_PLUGIN_DIR . '/' . $slug ) ) {
                $zip->addFile( WP_PLUGIN_DIR . '/' . $slug, basename( $slug ) );
            }
        } elseif ( 'theme' === $type ) {
            $source_dir = get_theme_root() . '/' . $slug;
            if ( is_dir( $source_dir ) ) {
                self::add_folder_to_zip( $zip, get_theme_root(), $source_dir );
            }
        }

        $zip->close();
        return file_exists( $zip_path ) ? $zip_path : new \WP_Error( 'zip_empty', 'Backup ZIP was not created.' );
    }

    private static function add_folder_to_zip( \ZipArchive $zip, string $base, string $folder ): void {
        $base   = rtrim( $base, DIRECTORY_SEPARATOR ) . DIRECTORY_SEPARATOR;
        $folder = rtrim( $folder, DIRECTORY_SEPARATOR );
        if ( ! is_dir( $folder ) ) return;

        $iter = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator( $folder, \RecursiveDirectoryIterator::SKIP_DOTS ),
            \RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ( $iter as $item ) {
            $real = $item->getRealPath();
            $rel  = str_replace( DIRECTORY_SEPARATOR, '/', substr( $real, strlen( $base ) ) );
            $item->isDir() ? $zip->addEmptyDir( $rel . '/' ) : $zip->addFile( $real, $rel );
        }
    }
}
