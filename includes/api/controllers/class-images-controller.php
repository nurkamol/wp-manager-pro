<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Images_Controller {

    public static function get_settings( WP_REST_Request $request ) {
        $thumbnail_sizes = self::get_all_image_sizes();

        // Use WordPress's own image editor support checks — the same mechanism
        // used by core and third-party plugins like "Converter for Media".
        // This avoids calling Imagick::queryFormats() directly, which throws an
        // ImagickException on servers where the AVIF codec is absent, corrupting
        // the JSON response and making all four status cards show "Not available".
        $gd_support      = extension_loaded( 'gd' ) && function_exists( 'gd_info' );
        $imagick_support = extension_loaded( 'imagick' ) && class_exists( 'Imagick' );
        $webp_support    = wp_image_editor_supports( [ 'mime_type' => 'image/webp' ] );
        $avif_support    = wp_image_editor_supports( [ 'mime_type' => 'image/avif' ] );

        return new WP_REST_Response( [
            'webp_enabled'          => (bool) get_option( 'wmp_webp_enabled', false ),
            'max_width'             => (int) get_option( 'wmp_max_width', 0 ),
            'max_height'            => (int) get_option( 'wmp_max_height', 0 ),
            'jpeg_quality'          => (int) get_option( 'wmp_jpeg_quality', 82 ),
            'thumbnail_sizes'       => $thumbnail_sizes,
            'gd_support'            => $gd_support,
            'imagick_support'       => $imagick_support,
            'webp_support'          => $webp_support,
            'avif_enabled'          => (bool) get_option( 'wmp_avif_enabled', false ),
            'avif_support'          => $avif_support,
            'svg_enabled'           => (bool) get_option( 'wmp_svg_enabled', false ),
            'svg_allowed_roles'     => get_option( 'wmp_svg_allowed_roles', [ 'administrator' ] ),
            'webp_serve_webp'       => (bool) get_option( 'wmp_webp_serve_webp', false ),
            'webp_delete_originals' => (bool) get_option( 'wmp_webp_delete_originals', false ),
            'webp_delete_sidecars'  => false, // UI-only action flag
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

        // AVIF settings.
        $avif_enabled = (bool) $request->get_param( 'avif_enabled' );
        update_option( 'wmp_avif_enabled', $avif_enabled );

        // SVG settings.
        $svg_enabled = (bool) $request->get_param( 'svg_enabled' );
        $svg_roles   = (array) $request->get_param( 'svg_allowed_roles' ) ?: [ 'administrator' ];

        update_option( 'wmp_svg_enabled', $svg_enabled );
        update_option( 'wmp_svg_allowed_roles', array_map( 'sanitize_text_field', $svg_roles ) );

        // WebP serving & replace options.
        $serve_webp       = (bool) $request->get_param( 'webp_serve_webp' );
        $delete_originals = (bool) $request->get_param( 'webp_delete_originals' );
        update_option( 'wmp_webp_serve_webp', $serve_webp );
        update_option( 'wmp_webp_delete_originals', $delete_originals );

        // Manage .htaccess rules for transparent WebP serving.
        if ( $serve_webp ) {
            self::write_htaccess_webp();
        } else {
            self::remove_htaccess_webp();
        }

        return new WP_REST_Response( [
            'success' => true,
            'message' => 'Image settings saved successfully.',
        ], 200 );
    }

    // ── WebP / AVIF Conversion ─────────────────────────────────────────────────

    /**
     * Hook: wp_handle_upload
     * Called after an image is uploaded. Converts to WebP and/or AVIF if enabled.
     *
     * @param array $upload { file, url, type }
     * @return array Upload array (may be modified if replace_original is on).
     */
    public static function convert_on_upload( array $upload ): array {
        // Only process raster images (skip SVG, WebP, AVIF themselves).
        $type = $upload['type'] ?? '';
        if ( ! $type || strpos( $type, 'image/' ) !== 0 ) {
            return $upload;
        }
        $skip_types = [ 'image/svg+xml', 'image/webp', 'image/avif' ];
        if ( in_array( $type, $skip_types, true ) ) {
            return $upload;
        }

        $file = $upload['file'] ?? '';
        if ( ! $file || ! file_exists( $file ) ) {
            return $upload;
        }

        $delete_original = (bool) get_option( 'wmp_webp_delete_originals', false );

        // Convert to WebP if enabled and supported.
        if ( get_option( 'wmp_webp_enabled', false ) ) {
            $webp_ok = wp_image_editor_supports( [ 'mime_type' => 'image/webp' ] );
            if ( $webp_ok ) {
                $webp_path = self::save_as_format( $file, 'image/webp' );
                // If replace-original is on: swap the upload to point at the .webp file.
                if ( $delete_original && $webp_path && file_exists( $webp_path ) ) {
                    @unlink( $file );
                    $upload['file'] = $webp_path;
                    $upload['url']  = str_replace( wp_basename( $upload['url'] ), wp_basename( $webp_path ), $upload['url'] );
                    $upload['type'] = 'image/webp';
                    return $upload; // Return immediately — original replaced.
                }
            }
        }

        // Convert to AVIF if enabled and supported (sidecar only; AVIF replace-original not supported).
        if ( get_option( 'wmp_avif_enabled', false ) ) {
            $avif_ok = wp_image_editor_supports( [ 'mime_type' => 'image/avif' ] );
            if ( $avif_ok ) {
                self::save_as_format( $file, 'image/avif' );
            }
        }

        return $upload;
    }

    /**
     * Convert a single image file to the given MIME type and save it alongside
     * the original (e.g. photo.jpg → photo.webp).
     *
     * @param string $source Full path to the source image.
     * @param string $mime   Target MIME type ('image/webp' or 'image/avif').
     * @return string|null   Path to the converted file, or null on failure.
     */
    private static function save_as_format( string $source, string $mime ): ?string {
        $ext_map = [
            'image/webp' => 'webp',
            'image/avif' => 'avif',
        ];
        $ext = $ext_map[ $mime ] ?? null;
        if ( ! $ext ) {
            return null;
        }

        $dest = preg_replace( '/\.[^.]+$/', '.' . $ext, $source );
        if ( ! $dest || $dest === $source ) {
            return null;
        }

        $editor = wp_get_image_editor( $source );
        if ( is_wp_error( $editor ) ) {
            return null;
        }

        $result = $editor->save( $dest, $mime );
        if ( is_wp_error( $result ) ) {
            return null;
        }

        return $dest;
    }

    /**
     * REST handler: batch-convert existing media library images to WebP or AVIF.
     * Processes $limit images per call; frontend loops through using next_offset.
     */
    public static function batch_convert( WP_REST_Request $request ) {
        $format          = sanitize_text_field( $request->get_param( 'format' ) ?: 'webp' );
        $offset          = absint( $request->get_param( 'offset' ) ?: 0 );
        $limit           = min( absint( $request->get_param( 'limit' ) ?: 10 ), 50 );
        $delete_original = (bool) $request->get_param( 'delete_original' );

        if ( ! in_array( $format, [ 'webp', 'avif' ], true ) ) {
            return new WP_Error( 'invalid_format', 'Format must be webp or avif.', [ 'status' => 400 ] );
        }

        $mime = 'image/' . $format;

        // Server-side support check.
        if ( ! wp_image_editor_supports( [ 'mime_type' => 'image/' . $format ] ) ) {
            return new WP_Error(
                'not_supported',
                ucfirst( $format ) . ' conversion is not supported on this server.',
                [ 'status' => 500 ]
            );
        }

        if ( ! function_exists( 'wp_update_attachment_metadata' ) ) {
            require_once ABSPATH . 'wp-admin/includes/image.php';
        }

        $ids = get_posts( [
            'post_type'      => 'attachment',
            'post_mime_type' => [ 'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff' ],
            'numberposts'    => $limit,
            'offset'         => $offset,
            'post_status'    => 'any',
            'fields'         => 'ids',
        ] );

        $converted = 0;
        $skipped   = 0;
        $errors    = 0;

        foreach ( $ids as $id ) {
            $file = get_attached_file( $id );
            if ( ! $file || ! file_exists( $file ) ) {
                $errors++;
                continue;
            }

            $dest = preg_replace( '/\.[^.]+$/', '.' . $format, $file );
            if ( ! $dest ) {
                $errors++;
                continue;
            }

            // Skip if converted version already exists.
            if ( file_exists( $dest ) ) {
                $skipped++;
                continue;
            }

            $editor = wp_get_image_editor( $file );
            if ( is_wp_error( $editor ) ) {
                $errors++;
                continue;
            }

            $result = $editor->save( $dest, $mime );
            if ( is_wp_error( $result ) ) {
                $errors++;
                continue;
            }

            $converted++;

            // If replace-original is requested, update the attachment record.
            if ( $delete_original && 'webp' === $format ) {
                // Delete original thumbnails sidecars (other sizes).
                $meta = wp_get_attachment_metadata( $id );
                if ( ! empty( $meta['sizes'] ) ) {
                    $dir = trailingslashit( dirname( $file ) );
                    foreach ( $meta['sizes'] as $size ) {
                        $thumb = $dir . $size['file'];
                        if ( file_exists( $thumb ) ) {
                            @unlink( $thumb );
                        }
                    }
                }
                // Delete original.
                @unlink( $file );
                // Update attachment file pointer & MIME type.
                update_attached_file( $id, $dest );
                wp_update_post( [ 'ID' => $id, 'post_mime_type' => 'image/webp' ] );
                // Regenerate metadata from the new webp file.
                $new_meta = wp_generate_attachment_metadata( $id, $dest );
                if ( ! is_wp_error( $new_meta ) ) {
                    wp_update_attachment_metadata( $id, $new_meta );
                }
            }
        }

        $count = count( $ids );

        return new WP_REST_Response( [
            'success'     => true,
            'converted'   => $converted,
            'skipped'     => $skipped,
            'errors'      => $errors,
            'has_more'    => $count === $limit,
            'next_offset' => $offset + $count,
        ], 200 );
    }

    /**
     * REST handler: delete all sidecar .webp or .avif files from the media library.
     */
    public static function delete_all_converted( WP_REST_Request $request ) {
        $format = sanitize_text_field( $request->get_param( 'format' ) ?: 'webp' );
        if ( ! in_array( $format, [ 'webp', 'avif' ], true ) ) {
            return new WP_Error( 'invalid_format', 'Format must be webp or avif.', [ 'status' => 400 ] );
        }

        $ids = get_posts( [
            'post_type'   => 'attachment',
            'post_status' => 'any',
            'numberposts' => -1,
            'fields'      => 'ids',
        ] );

        $deleted = 0;

        foreach ( $ids as $id ) {
            $file = get_attached_file( $id );
            if ( ! $file ) {
                continue;
            }
            $sidecar = preg_replace( '/\.[^.]+$/', '.' . $format, $file );
            if ( $sidecar && $sidecar !== $file && file_exists( $sidecar ) ) {
                if ( @unlink( $sidecar ) ) {
                    $deleted++;
                }
            }
        }

        return new WP_REST_Response( [
            'success' => true,
            'deleted' => $deleted,
            'message' => "Deleted {$deleted} .{$format} sidecar files.",
        ], 200 );
    }

    /**
     * REST handler: return conversion stats (total images, how many already converted).
     */
    public static function get_convert_stats( WP_REST_Request $request ) {
        $format = sanitize_text_field( $request->get_param( 'format' ) ?: 'webp' );
        if ( ! in_array( $format, [ 'webp', 'avif' ], true ) ) {
            $format = 'webp';
        }

        $ids   = get_posts( [
            'post_type'      => 'attachment',
            'post_mime_type' => [ 'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff' ],
            'numberposts'    => -1,
            'post_status'    => 'any',
            'fields'         => 'ids',
        ] );
        $total     = count( $ids );
        $converted = 0;

        foreach ( $ids as $id ) {
            $file = get_attached_file( $id );
            if ( ! $file ) {
                continue;
            }
            $dest = preg_replace( '/\.[^.]+$/', '.' . $format, $file );
            if ( $dest && file_exists( $dest ) ) {
                $converted++;
            }
        }

        return new WP_REST_Response( [
            'total'     => $total,
            'converted' => $converted,
            'remaining' => $total - $converted,
        ], 200 );
    }

    // ── Sidecar cleanup ────────────────────────────────────────────────────────

    /**
     * Hook: delete_attachment
     * When a media library item is deleted, also remove any .webp / .avif sidecar files.
     *
     * @param int $attachment_id WP attachment post ID.
     */
    public static function delete_sidecar_files( int $attachment_id ): void {
        $file = get_attached_file( $attachment_id );
        if ( ! $file ) {
            return;
        }

        $meta    = wp_get_attachment_metadata( $attachment_id );
        $dir     = trailingslashit( dirname( $file ) );
        $formats = [ 'webp', 'avif' ];

        foreach ( $formats as $ext ) {
            // Delete sidecar for the full-size image.
            $sidecar = preg_replace( '/\.[^.]+$/', '.' . $ext, $file );
            if ( $sidecar && $sidecar !== $file && file_exists( $sidecar ) ) {
                @unlink( $sidecar );
            }

            // Delete sidecars for each registered thumbnail size.
            if ( ! empty( $meta['sizes'] ) ) {
                foreach ( $meta['sizes'] as $size ) {
                    if ( empty( $size['file'] ) ) {
                        continue;
                    }
                    $thumb_sidecar = $dir . preg_replace( '/\.[^.]+$/', '.' . $ext, $size['file'] );
                    if ( file_exists( $thumb_sidecar ) ) {
                        @unlink( $thumb_sidecar );
                    }
                }
            }
        }
    }

    // ── WebP serving ───────────────────────────────────────────────────────────

    /**
     * Filter: wp_get_attachment_url
     * Transparently serve the .webp sidecar when the browser accepts WebP and the
     * "Serve WebP" option is enabled.
     *
     * @param string $url           Original attachment URL.
     * @param int    $attachment_id Attachment post ID.
     * @return string               WebP URL or original URL.
     */
    public static function maybe_serve_webp( string $url, int $attachment_id ): string {
        if ( ! get_option( 'wmp_webp_serve_webp', false ) ) {
            return $url;
        }

        // Only serve WebP for raster images.
        $mime = get_post_mime_type( $attachment_id );
        if ( ! $mime || ! in_array( $mime, [ 'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff' ], true ) ) {
            return $url;
        }

        // Check browser support via Accept header.
        $accept = isset( $_SERVER['HTTP_ACCEPT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_ACCEPT'] ) ) : '';
        if ( strpos( $accept, 'image/webp' ) === false ) {
            return $url;
        }

        // Check that a .webp sidecar exists on disk.
        $file = get_attached_file( $attachment_id );
        if ( ! $file ) {
            return $url;
        }
        $webp_file = preg_replace( '/\.[^.]+$/', '.webp', $file );
        if ( ! $webp_file || ! file_exists( $webp_file ) ) {
            return $url;
        }

        // Build the WebP URL by replacing just the file name portion.
        $upload_dir = wp_upload_dir();
        $base_dir   = untrailingslashit( $upload_dir['basedir'] );
        $base_url   = untrailingslashit( $upload_dir['baseurl'] );

        return str_replace( $base_dir, $base_url, $webp_file );
    }

    // ── .htaccess helpers ──────────────────────────────────────────────────────

    /**
     * Write Apache rewrite rules into wp-content/uploads/.htaccess so the web
     * server transparently serves .webp files when the browser supports them.
     * Works alongside the PHP filter — the .htaccess method is faster because it
     * bypasses PHP entirely.
     */
    private static function write_htaccess_webp(): void {
        $upload_dir  = wp_upload_dir();
        $htaccess    = trailingslashit( $upload_dir['basedir'] ) . '.htaccess';
        $marker      = 'WP Manager Pro WebP';

        $rules = [
            '<IfModule mod_rewrite.c>',
            '  RewriteEngine On',
            '  RewriteCond %{HTTP_ACCEPT} image/webp',
            '  RewriteCond %{REQUEST_FILENAME} \.(jpe?g|png|gif|bmp|tiff?)$',
            '  RewriteCond %{REQUEST_FILENAME}\.webp -f',
            '  RewriteRule ^ %{REQUEST_URI}.webp [L,T=image/webp]',
            '</IfModule>',
        ];

        insert_with_markers( $htaccess, $marker, $rules );
    }

    /**
     * Remove the WebP rewrite rules we added to uploads/.htaccess.
     */
    private static function remove_htaccess_webp(): void {
        $upload_dir = wp_upload_dir();
        $htaccess   = trailingslashit( $upload_dir['basedir'] ) . '.htaccess';
        $marker     = 'WP Manager Pro WebP';

        insert_with_markers( $htaccess, $marker, [] );
    }

    // ── Thumbnails ─────────────────────────────────────────────────────────────

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
     * Allow AVIF uploads when enabled.
     */
    public static function maybe_allow_avif( $mimes ) {
        if ( get_option( 'wmp_avif_enabled', false ) ) {
            $mimes['avif']  = 'image/avif';
            $mimes['avifs'] = 'image/avif';
        }
        return $mimes;
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
