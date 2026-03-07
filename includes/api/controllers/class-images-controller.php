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
            'webp_enabled'     => (bool) get_option( 'wmp_webp_enabled', false ),
            'max_width'        => (int) get_option( 'wmp_max_width', 0 ),
            'max_height'       => (int) get_option( 'wmp_max_height', 0 ),
            'jpeg_quality'     => (int) get_option( 'wmp_jpeg_quality', 82 ),
            'thumbnail_sizes'  => $thumbnail_sizes,
            'gd_support'       => extension_loaded( 'gd' ),
            'imagick_support'  => extension_loaded( 'imagick' ),
            'webp_support'     => function_exists( 'imagewebp' ) || extension_loaded( 'imagick' ),
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

    private static function get_all_image_sizes() {
        global $_wp_additional_image_sizes;

        $default_sizes = [ 'thumbnail', 'medium', 'medium_large', 'large', 'full' ];
        $sizes = [];

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
