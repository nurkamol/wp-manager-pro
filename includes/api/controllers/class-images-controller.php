<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Images_Controller {

    public static function get_settings( WP_REST_Request $request ) {
        $thumbnail_sizes = self::get_all_image_sizes();

        return new WP_REST_Response( [
            'webp_enabled'      => (bool) get_option( 'wmp_webp_enabled', false ),
            'max_width'         => (int) get_option( 'wmp_max_width', 0 ),
            'max_height'        => (int) get_option( 'wmp_max_height', 0 ),
            'jpeg_quality'      => (int) get_option( 'wmp_jpeg_quality', 82 ),
            'thumbnail_sizes'   => $thumbnail_sizes,
            'gd_support'        => extension_loaded( 'gd' ),
            'imagick_support'   => extension_loaded( 'imagick' ),
            'webp_support'      => function_exists( 'imagewebp' ) || extension_loaded( 'imagick' ),
            'svg_enabled'       => (bool) get_option( 'wmp_svg_enabled', false ),
            'svg_allowed_roles' => get_option( 'wmp_svg_allowed_roles', [ 'administrator' ] ),
        ], 200 );
    }

    public static function save_settings( WP_REST_Request $request ) {
        $webp_enabled = (bool) $request->get_param( 'webp_enabled' );
        $max_width    = absint( $request->get_param( 'max_width' ) );
        $max_height   = absint( $request->get_param( 'max_height' ) );
        $jpeg_quality = min( 100, max( 0, absint( $request->get_param( 'jpeg_quality' ) ) ) );

        update_option( 'wmp_webp_enabled', $webp_enabled );
        update_option( 'wmp_max_width', $max_width );
        update_option( 'wmp_max_height', $max_height );
        update_option( 'wmp_jpeg_quality', $jpeg_quality ?: 82 );

        // SVG settings.
        $svg_enabled = (bool) $request->get_param( 'svg_enabled' );
        $svg_roles   = (array) $request->get_param( 'svg_allowed_roles' ) ?: [ 'administrator' ];

        update_option( 'wmp_svg_enabled', $svg_enabled );
        update_option( 'wmp_svg_allowed_roles', array_map( 'sanitize_text_field', $svg_roles ) );

        return new WP_REST_Response( [
            'success' => true,
            'message' => 'Image settings saved successfully.',
        ], 200 );
    }

    public static function regenerate_thumbnails( WP_REST_Request $request ) {
        if ( ! function_exists( 'wp_update_attachment_metadata' ) ) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }

        $attachments = get_posts( [
            'post_type'      => 'attachment',
            'post_mime_type' => 'image',
            'numberposts'    => -1,
            'post_status'    => 'any',
        ] );

        $processed = 0;
        $errors    = 0;

        foreach ( $attachments as $attachment ) {
            $file = get_attached_file( $attachment->ID );
            if ( ! $file || ! file_exists( $file ) ) {
                $errors++;
                continue;
            }

            $metadata = wp_generate_attachment_metadata( $attachment->ID, $file );
            if ( ! is_wp_error( $metadata ) ) {
                wp_update_attachment_metadata( $attachment->ID, $metadata );
                $processed++;
            } else {
                $errors++;
            }
        }

        return new WP_REST_Response( [
            'success'   => true,
            'processed' => $processed,
            'errors'    => $errors,
            'message'   => "Regenerated thumbnails for {$processed} images.",
        ], 200 );
    }

    /**
     * Hook: upload_mimes
     * Conditionally allow SVG uploads based on plugin settings and user role.
     * Called from the plugin bootstrap via add_filter('upload_mimes', ...).
     *
     * @param array $mimes Allowed MIME types.
     * @return array
     */
    public static function maybe_allow_svg( $mimes ) {
        if ( ! get_option( 'wmp_svg_enabled', false ) ) {
            return $mimes;
        }

        $allowed_roles = (array) get_option( 'wmp_svg_allowed_roles', [ 'administrator' ] );
        $user          = wp_get_current_user();

        if ( ! $user || ! $user->exists() ) {
            return $mimes;
        }

        $user_roles = (array) $user->roles;

        foreach ( $user_roles as $role ) {
            if ( in_array( $role, $allowed_roles, true ) ) {
                $mimes['svg'] = 'image/svg+xml';
                break;
            }
        }

        return $mimes;
    }

    /**
     * Hook: wp_handle_upload_prefilter
     * Sanitize SVG files on upload to strip dangerous content.
     * Called from the plugin bootstrap via add_filter('wp_handle_upload_prefilter', ...).
     *
     * @param array $file Upload file array.
     * @return array
     */
    public static function sanitize_svg( $file ) {
        if ( ! isset( $file['type'] ) || $file['type'] !== 'image/svg+xml' ) {
            return $file;
        }

        if ( empty( $file['tmp_name'] ) || ! file_exists( $file['tmp_name'] ) ) {
            return $file;
        }

        $svg_content = file_get_contents( $file['tmp_name'] );

        if ( $svg_content === false ) {
            $file['error'] = 'Could not read the uploaded SVG file.';
            return $file;
        }

        // Strip <script> blocks entirely.
        $svg_content = preg_replace( '/<script[\s\S]*?<\/script>/i', '', $svg_content );

        // Strip on* event attributes (onclick, onload, onmouseover, etc.).
        $svg_content = preg_replace( '/\s+on\w+\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]*)/i', '', $svg_content );

        // Strip xlink:href and href values that use javascript: protocol.
        $svg_content = preg_replace( '/(xlink:href|href)\s*=\s*["\']?\s*javascript:[^"\'>\s]*/i', '$1=""', $svg_content );

        // Strip <use> elements pointing to external resources (data: or http:).
        $svg_content = preg_replace( '/<use[^>]+(href|xlink:href)\s*=\s*["\'][^#][^"\']*["\'][^>]*>/i', '', $svg_content );

        // Strip foreignObject elements.
        $svg_content = preg_replace( '/<foreignObject[\s\S]*?<\/foreignObject>/i', '', $svg_content );

        // Strip base elements.
        $svg_content = preg_replace( '/<base[\s\S]*?>/i', '', $svg_content );

        file_put_contents( $file['tmp_name'], $svg_content );

        return $file;
    }

    private static function get_all_image_sizes() {
        global $_wp_additional_image_sizes;

        $default_sizes = [ 'thumbnail', 'medium', 'medium_large', 'large', 'full' ];
        $sizes         = [];

        foreach ( $default_sizes as $size ) {
            $sizes[ $size ] = [
                'name'   => ucwords( str_replace( '_', ' ', $size ) ),
                'width'  => (int) get_option( "{$size}_size_w", 0 ),
                'height' => (int) get_option( "{$size}_size_h", 0 ),
                'crop'   => (bool) get_option( "{$size}_crop", false ),
            ];
        }

        if ( $_wp_additional_image_sizes ) {
            foreach ( $_wp_additional_image_sizes as $name => $size ) {
                $sizes[ $name ] = [
                    'name'   => ucwords( str_replace( [ '-', '_' ], ' ', $name ) ),
                    'width'  => $size['width'],
                    'height' => $size['height'],
                    'crop'   => $size['crop'],
                ];
            }
        }

        return $sizes;
    }
}
