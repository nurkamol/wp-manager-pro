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

    /**
     * GET /settings/export — export plugin settings as a signed JSON file download.
     */
    public static function export_settings( \WP_REST_Request $request ): void {
        global $wpdb;

        $sections_param = $request->get_param( 'sections' );
        $sections = $sections_param
            ? array_map( 'trim', explode( ',', $sections_param ) )
            : [ 'branding', 'maintenance', 'smtp', 'images', 'snippets', 'redirects', 'notes' ];

        $data = [];

        // Branding
        if ( in_array( 'branding', $sections, true ) ) {
            $data['branding'] = [
                'wmp_plugin_name' => get_option( 'wmp_plugin_name', '' ),
                'wmp_menu_label'  => get_option( 'wmp_menu_label', '' ),
                'wmp_logo_url'    => get_option( 'wmp_logo_url', '' ),
            ];
        }

        // Maintenance — collect all wmp_maintenance_* options
        if ( in_array( 'maintenance', $sections, true ) ) {
            $maintenance = [];
            $rows = $wpdb->get_results(
                "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE 'wmp_maintenance_%'",
                ARRAY_A
            );
            foreach ( $rows as $row ) {
                $maintenance[ $row['option_name'] ] = $row['option_value'];
            }
            $data['maintenance'] = $maintenance;
        }

        // SMTP — collect all wmp_smtp_* options
        if ( in_array( 'smtp', $sections, true ) ) {
            $smtp = [];
            $rows = $wpdb->get_results(
                "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE 'wmp_smtp_%' OR option_name LIKE 'wmp_email_%'",
                ARRAY_A
            );
            foreach ( $rows as $row ) {
                $smtp[ $row['option_name'] ] = $row['option_value'];
            }
            $data['smtp'] = $smtp;
        }

        // Images — collect wmp_image_*, wmp_webp_*, wmp_avif_*, wmp_svg_* options
        if ( in_array( 'images', $sections, true ) ) {
            $images = [];
            $rows = $wpdb->get_results(
                "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE 'wmp_image_%' OR option_name LIKE 'wmp_webp_%' OR option_name LIKE 'wmp_avif_%' OR option_name LIKE 'wmp_svg_%'",
                ARRAY_A
            );
            foreach ( $rows as $row ) {
                $images[ $row['option_name'] ] = $row['option_value'];
            }
            $data['images'] = $images;
        }

        // Snippets — all rows from wmp_snippets table
        if ( in_array( 'snippets', $sections, true ) ) {
            $table = $wpdb->prefix . 'wmp_snippets';
            if ( $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ) === $table ) {
                $data['snippets'] = $wpdb->get_results( "SELECT * FROM {$table}", ARRAY_A ) ?: [];
            } else {
                $data['snippets'] = [];
            }
        }

        // Redirects — all rows from wmp_redirects table (if exists)
        if ( in_array( 'redirects', $sections, true ) ) {
            $table = $wpdb->prefix . 'wmp_redirects';
            if ( $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ) === $table ) {
                $data['redirects'] = $wpdb->get_results( "SELECT * FROM {$table}", ARRAY_A ) ?: [];
            } else {
                $data['redirects'] = [];
            }
        }

        // Notes — all rows from wmp_notes table
        if ( in_array( 'notes', $sections, true ) ) {
            $table = $wpdb->prefix . 'wmp_notes';
            if ( $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ) === $table ) {
                $data['notes'] = $wpdb->get_results( "SELECT * FROM {$table}", ARRAY_A ) ?: [];
            } else {
                $data['notes'] = [];
            }
        }

        // Debug options
        if ( in_array( 'debug', $sections, true ) ) {
            $debug = [];
            $rows = $wpdb->get_results(
                "SELECT option_name, option_value FROM {$wpdb->options} WHERE option_name LIKE 'wmp_debug_%'",
                ARRAY_A
            );
            foreach ( $rows as $row ) {
                $debug[ $row['option_name'] ] = $row['option_value'];
            }
            $data['debug'] = $debug;
        }

        // Metadata
        $data['_meta'] = [
            'exported_at'    => gmdate( 'c' ),
            'site_url'       => get_site_url(),
            'wp_version'     => get_bloginfo( 'version' ),
            'plugin_version' => defined( 'WP_MANAGER_PRO_VERSION' ) ? WP_MANAGER_PRO_VERSION : '',
        ];

        // HMAC signature (exclude _signature key from payload)
        $payload = json_encode( $data );
        $data['_signature'] = hash_hmac( 'sha256', $payload, wp_salt( 'auth' ) );

        $json = json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE );
        $date = gmdate( 'Y-m-d' );

        header( 'Content-Type: application/json; charset=utf-8' );
        header( "Content-Disposition: attachment; filename=\"wmp-settings-{$date}.json\"" );
        header( 'Content-Length: ' . strlen( $json ) );
        header( 'Cache-Control: no-cache, no-store, must-revalidate' );
        header( 'Pragma: no-cache' );
        header( 'Expires: 0' );

        // Disable REST API JSON output — we output directly.
        // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        echo $json;
        exit;
    }

    /**
     * POST /settings/import — import settings from an uploaded JSON bundle.
     */
    public static function import_settings( \WP_REST_Request $request ): \WP_REST_Response {
        global $wpdb;

        $imported = [];
        $skipped  = [];
        $warnings = [];

        // Accept file upload or raw JSON body param
        $json_data = null;

        if ( ! empty( $_FILES['file']['tmp_name'] ) ) {
            $tmp = $_FILES['file']['tmp_name'];
            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
            $raw = file_get_contents( $tmp );
            $json_data = json_decode( $raw, true );
        } elseif ( $request->get_param( 'data' ) ) {
            $raw       = $request->get_param( 'data' );
            $json_data = is_array( $raw ) ? $raw : json_decode( $raw, true );
        }

        if ( ! is_array( $json_data ) ) {
            return new \WP_REST_Response( [ 'message' => 'Invalid or missing JSON data.' ], 400 );
        }

        // Verify HMAC signature
        if ( isset( $json_data['_signature'] ) ) {
            $sig     = $json_data['_signature'];
            $payload = $json_data;
            unset( $payload['_signature'] );
            $expected = hash_hmac( 'sha256', json_encode( $payload ), wp_salt( 'auth' ) );
            if ( ! hash_equals( $expected, $sig ) ) {
                // Warn if from different site but don't block
                $warnings[] = 'HMAC signature mismatch — the export may be from a different site or has been modified.';
            }
        }

        $overwrite_param = $request->get_param( 'overwrite' );
        $overwrite_sections = [];
        if ( $overwrite_param ) {
            if ( is_string( $overwrite_param ) ) {
                $decoded = json_decode( $overwrite_param, true );
                $overwrite_sections = is_array( $decoded ) ? $decoded : explode( ',', $overwrite_param );
            } elseif ( is_array( $overwrite_param ) ) {
                $overwrite_sections = $overwrite_param;
            }
        }

        $all = $overwrite_sections === 'all' || in_array( 'all', $overwrite_sections, true );

        // Branding
        if ( isset( $json_data['branding'] ) && ( $all || in_array( 'branding', $overwrite_sections, true ) ) ) {
            foreach ( $json_data['branding'] as $key => $value ) {
                if ( strpos( $key, 'wmp_' ) === 0 ) {
                    update_option( sanitize_key( $key ), sanitize_text_field( $value ) );
                }
            }
            $imported[] = 'branding';
        } elseif ( isset( $json_data['branding'] ) ) {
            $skipped[] = 'branding';
        }

        // Maintenance
        if ( isset( $json_data['maintenance'] ) && ( $all || in_array( 'maintenance', $overwrite_sections, true ) ) ) {
            foreach ( $json_data['maintenance'] as $key => $value ) {
                if ( strpos( $key, 'wmp_maintenance_' ) === 0 ) {
                    update_option( sanitize_key( $key ), sanitize_text_field( $value ) );
                }
            }
            $imported[] = 'maintenance';
        } elseif ( isset( $json_data['maintenance'] ) ) {
            $skipped[] = 'maintenance';
        }

        // SMTP
        if ( isset( $json_data['smtp'] ) && ( $all || in_array( 'smtp', $overwrite_sections, true ) ) ) {
            foreach ( $json_data['smtp'] as $key => $value ) {
                if ( strpos( $key, 'wmp_smtp_' ) === 0 || strpos( $key, 'wmp_email_' ) === 0 ) {
                    update_option( sanitize_key( $key ), sanitize_text_field( $value ) );
                }
            }
            $imported[] = 'smtp';
        } elseif ( isset( $json_data['smtp'] ) ) {
            $skipped[] = 'smtp';
        }

        // Images
        if ( isset( $json_data['images'] ) && ( $all || in_array( 'images', $overwrite_sections, true ) ) ) {
            foreach ( $json_data['images'] as $key => $value ) {
                if ( preg_match( '/^wmp_(image|webp|avif|svg)_/', $key ) ) {
                    update_option( sanitize_key( $key ), sanitize_text_field( $value ) );
                }
            }
            $imported[] = 'images';
        } elseif ( isset( $json_data['images'] ) ) {
            $skipped[] = 'images';
        }

        // Snippets — re-insert all rows
        if ( isset( $json_data['snippets'] ) && ( $all || in_array( 'snippets', $overwrite_sections, true ) ) ) {
            $table = $wpdb->prefix . 'wmp_snippets';
            if ( $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ) === $table ) {
                foreach ( $json_data['snippets'] as $row ) {
                    $existing = $wpdb->get_var(
                        $wpdb->prepare( "SELECT id FROM {$table} WHERE id = %d", intval( $row['id'] ?? 0 ) )
                    );
                    $insert = [
                        'name'        => sanitize_text_field( $row['name'] ?? '' ),
                        'description' => sanitize_text_field( $row['description'] ?? '' ),
                        'type'        => sanitize_text_field( $row['type'] ?? 'php' ),
                        'code'        => wp_kses_post( $row['code'] ?? '' ),
                        'enabled'     => intval( $row['enabled'] ?? 0 ),
                        'created_at'  => sanitize_text_field( $row['created_at'] ?? current_time( 'mysql' ) ),
                    ];
                    if ( $existing ) {
                        $wpdb->update( $table, $insert, [ 'id' => intval( $row['id'] ) ] );
                    } else {
                        $wpdb->insert( $table, $insert );
                    }
                }
                $imported[] = 'snippets';
            } else {
                $warnings[] = 'Snippets table does not exist — snippets skipped.';
                $skipped[] = 'snippets';
            }
        } elseif ( isset( $json_data['snippets'] ) ) {
            $skipped[] = 'snippets';
        }

        // Redirects
        if ( isset( $json_data['redirects'] ) && ( $all || in_array( 'redirects', $overwrite_sections, true ) ) ) {
            $table = $wpdb->prefix . 'wmp_redirects';
            if ( $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ) === $table ) {
                foreach ( $json_data['redirects'] as $row ) {
                    $existing = $wpdb->get_var(
                        $wpdb->prepare( "SELECT id FROM {$table} WHERE id = %d", intval( $row['id'] ?? 0 ) )
                    );
                    $insert = [
                        'source'      => sanitize_text_field( $row['source'] ?? '' ),
                        'target'      => esc_url_raw( $row['target'] ?? '' ),
                        'code'        => intval( $row['code'] ?? 301 ),
                        'enabled'     => intval( $row['enabled'] ?? 1 ),
                        'hits'        => intval( $row['hits'] ?? 0 ),
                        'created_at'  => sanitize_text_field( $row['created_at'] ?? current_time( 'mysql' ) ),
                    ];
                    if ( $existing ) {
                        $wpdb->update( $table, $insert, [ 'id' => intval( $row['id'] ) ] );
                    } else {
                        $wpdb->insert( $table, $insert );
                    }
                }
                $imported[] = 'redirects';
            } else {
                $warnings[] = 'Redirects table does not exist — redirects skipped.';
                $skipped[] = 'redirects';
            }
        } elseif ( isset( $json_data['redirects'] ) ) {
            $skipped[] = 'redirects';
        }

        // Notes
        if ( isset( $json_data['notes'] ) && ( $all || in_array( 'notes', $overwrite_sections, true ) ) ) {
            $table = $wpdb->prefix . 'wmp_notes';
            if ( $wpdb->get_var( "SHOW TABLES LIKE '{$table}'" ) === $table ) {
                foreach ( $json_data['notes'] as $row ) {
                    $existing = $wpdb->get_var(
                        $wpdb->prepare( "SELECT id FROM {$table} WHERE id = %d", intval( $row['id'] ?? 0 ) )
                    );
                    $insert = [
                        'title'      => sanitize_text_field( $row['title'] ?? '' ),
                        'content'    => wp_kses_post( $row['content'] ?? '' ),
                        'color'      => sanitize_text_field( $row['color'] ?? '' ),
                        'created_at' => sanitize_text_field( $row['created_at'] ?? current_time( 'mysql' ) ),
                        'updated_at' => sanitize_text_field( $row['updated_at'] ?? current_time( 'mysql' ) ),
                    ];
                    if ( $existing ) {
                        $wpdb->update( $table, $insert, [ 'id' => intval( $row['id'] ) ] );
                    } else {
                        $wpdb->insert( $table, $insert );
                    }
                }
                $imported[] = 'notes';
            } else {
                $warnings[] = 'Notes table does not exist — notes skipped.';
                $skipped[] = 'notes';
            }
        } elseif ( isset( $json_data['notes'] ) ) {
            $skipped[] = 'notes';
        }

        return new \WP_REST_Response( [
            'success'  => true,
            'imported' => $imported,
            'skipped'  => $skipped,
            'warnings' => $warnings,
        ] );
    }

    /**
     * POST /settings/export-wp-xml — export WordPress content as standard WXR XML.
     */
    public static function export_wordpress_xml( \WP_REST_Request $request ): void {
        $content = sanitize_text_field( $request->get_param( 'content' ) ?? 'all' );

        if ( ! defined( 'ABSPATH' ) ) {
            wp_die( 'ABSPATH not defined.' );
        }

        require_once ABSPATH . 'wp-admin/includes/export.php';

        $export_args = [ 'content' => $content ];

        ob_start();
        export_wp( $export_args );
        $xml = ob_get_clean();

        $date = gmdate( 'Y-m-d' );

        header( 'Content-Type: text/xml; charset=utf-8' );
        header( "Content-Disposition: attachment; filename=\"wordpress-export-{$date}.xml\"" );
        header( 'Content-Length: ' . strlen( $xml ) );
        header( 'Cache-Control: no-cache, no-store, must-revalidate' );
        header( 'Pragma: no-cache' );
        header( 'Expires: 0' );

        // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        echo $xml;
        exit;
    }
}
