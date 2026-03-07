<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Files_Controller {

    // Allowed base paths.
    private static $allowed_roots = [];

    private static function get_allowed_roots() {
        if ( empty( self::$allowed_roots ) ) {
            self::$allowed_roots = [
                'root'    => ABSPATH,
                'content' => WP_CONTENT_DIR,
                'plugins' => WP_PLUGIN_DIR,
                'themes'  => get_theme_root(),
                'uploads' => wp_upload_dir()['basedir'],
            ];
        }
        return self::$allowed_roots;
    }

    private static function sanitize_path( $path ) {
        // Default to ABSPATH if no path given.
        if ( empty( $path ) ) {
            return ABSPATH;
        }

        // Normalize path.
        $path = str_replace( '\\', '/', $path );
        $path = realpath( $path );

        if ( ! $path ) {
            return false;
        }

        // Security: ensure path is within ABSPATH.
        $abspath = realpath( ABSPATH );
        if ( strpos( $path, $abspath ) !== 0 ) {
            return false;
        }

        return $path;
    }

    public static function list_files( WP_REST_Request $request ) {
        $path      = $request->get_param( 'path' ) ?: ABSPATH;
        $safe_path = self::sanitize_path( $path );

        if ( ! $safe_path ) {
            return new WP_Error( 'invalid_path', 'Invalid or forbidden path.', [ 'status' => 403 ] );
        }

        if ( ! is_dir( $safe_path ) ) {
            return new WP_Error( 'not_directory', 'Path is not a directory.', [ 'status' => 400 ] );
        }

        $items     = [];
        $dir_items = @scandir( $safe_path );

        if ( ! $dir_items ) {
            return new WP_Error( 'cannot_read', 'Cannot read directory.', [ 'status' => 500 ] );
        }

        foreach ( $dir_items as $item ) {
            if ( $item === '.' || $item === '..' ) continue;

            $full_path = $safe_path . DIRECTORY_SEPARATOR . $item;
            $is_dir    = is_dir( $full_path );

            $items[] = [
                'name'     => $item,
                'path'     => $full_path,
                'type'     => $is_dir ? 'directory' : 'file',
                'size'     => $is_dir ? null : filesize( $full_path ),
                'modified' => filemtime( $full_path ),
                'writable' => is_writable( $full_path ),
                'ext'      => $is_dir ? null : strtolower( pathinfo( $item, PATHINFO_EXTENSION ) ),
            ];
        }

        // Sort: directories first, then files alphabetically.
        usort( $items, function( $a, $b ) {
            if ( $a['type'] === 'directory' && $b['type'] !== 'directory' ) return -1;
            if ( $a['type'] !== 'directory' && $b['type'] === 'directory' ) return 1;
            return strcmp( $a['name'], $b['name'] );
        } );

        // Build breadcrumbs.
        $abspath     = realpath( ABSPATH );
        $rel_path    = str_replace( $abspath, '', $safe_path );
        $parts       = array_filter( explode( DIRECTORY_SEPARATOR, $rel_path ) );
        $breadcrumbs = [ [ 'name' => 'Root', 'path' => $abspath ] ];
        $current     = $abspath;
        foreach ( $parts as $part ) {
            $current      .= DIRECTORY_SEPARATOR . $part;
            $breadcrumbs[] = [ 'name' => $part, 'path' => $current ];
        }

        return new WP_REST_Response( [
            'path'        => $safe_path,
            'items'       => $items,
            'breadcrumbs' => $breadcrumbs,
            'writable'    => is_writable( $safe_path ),
        ], 200 );
    }

    public static function read_file( WP_REST_Request $request ) {
        $path      = $request->get_param( 'path' );
        $safe_path = self::sanitize_path( $path );

        if ( ! $safe_path ) {
            return new WP_Error( 'invalid_path', 'Invalid or forbidden path.', [ 'status' => 403 ] );
        }

        if ( ! is_file( $safe_path ) ) {
            return new WP_Error( 'not_file', 'Path is not a file.', [ 'status' => 400 ] );
        }

        // Max 2MB for reading.
        if ( filesize( $safe_path ) > 2 * 1024 * 1024 ) {
            return new WP_Error( 'file_too_large', 'File is too large to edit (max 2MB).', [ 'status' => 400 ] );
        }

        // Only allow text-like files.
        $allowed_ext = [ 'php', 'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'less', 'html', 'htm', 'json', 'xml', 'txt', 'md', 'yml', 'yaml', 'env', 'htaccess', 'conf', 'config', 'ini', 'log', 'svg', 'twig', 'blade' ];
        $ext         = strtolower( pathinfo( $safe_path, PATHINFO_EXTENSION ) );

        if ( ! in_array( $ext, $allowed_ext ) && ! empty( $ext ) ) {
            return new WP_Error( 'file_type_not_allowed', 'File type cannot be edited.', [ 'status' => 400 ] );
        }

        $content = file_get_contents( $safe_path );

        if ( $content === false ) {
            return new WP_Error( 'cannot_read', 'Cannot read file.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [
            'path'     => $safe_path,
            'name'     => basename( $safe_path ),
            'content'  => $content,
            'ext'      => $ext,
            'size'     => filesize( $safe_path ),
            'modified' => filemtime( $safe_path ),
            'writable' => is_writable( $safe_path ),
        ], 200 );
    }

    public static function write_file( WP_REST_Request $request ) {
        $path    = $request->get_param( 'path' );
        $content = $request->get_param( 'content' );

        $safe_path = self::sanitize_path( $path );

        if ( ! $safe_path ) {
            return new WP_Error( 'invalid_path', 'Invalid or forbidden path.', [ 'status' => 403 ] );
        }

        if ( ! is_writable( $safe_path ) ) {
            return new WP_Error( 'not_writable', 'File is not writable.', [ 'status' => 403 ] );
        }

        $result = file_put_contents( $safe_path, $content );

        if ( $result === false ) {
            return new WP_Error( 'write_failed', 'Failed to write file.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => 'File saved successfully.', 'bytes' => $result ], 200 );
    }

    public static function delete_file( WP_REST_Request $request ) {
        $path      = $request->get_param( 'path' );
        $safe_path = self::sanitize_path( $path );

        if ( ! $safe_path ) {
            return new WP_Error( 'invalid_path', 'Invalid or forbidden path.', [ 'status' => 403 ] );
        }

        // Prevent deleting critical files.
        $protected = [
            ABSPATH . 'wp-config.php',
            ABSPATH . '.htaccess',
            ABSPATH . 'index.php',
        ];
        if ( in_array( $safe_path, $protected ) ) {
            return new WP_Error( 'protected_file', 'This file is protected and cannot be deleted.', [ 'status' => 403 ] );
        }

        if ( is_dir( $safe_path ) ) {
            $result = self::delete_directory( $safe_path );
        } else {
            $result = @unlink( $safe_path );
        }

        if ( ! $result ) {
            return new WP_Error( 'delete_failed', 'Failed to delete file.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => 'Deleted successfully.' ], 200 );
    }

    public static function create_directory( WP_REST_Request $request ) {
        $path = $request->get_param( 'path' );

        // Sanitize parent path.
        $parent      = dirname( $path );
        $safe_parent = self::sanitize_path( $parent );

        if ( ! $safe_parent ) {
            return new WP_Error( 'invalid_path', 'Invalid or forbidden path.', [ 'status' => 403 ] );
        }

        $new_dir = $safe_parent . DIRECTORY_SEPARATOR . basename( $path );
        $result  = @mkdir( $new_dir, 0755, true );

        if ( ! $result ) {
            return new WP_Error( 'mkdir_failed', 'Failed to create directory.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => 'Directory created.', 'path' => $new_dir ], 200 );
    }

    public static function upload_file( WP_REST_Request $request ) {
        $target_dir = $request->get_param( 'path' );
        $safe_dir   = self::sanitize_path( $target_dir );

        if ( ! $safe_dir ) {
            return new WP_Error( 'invalid_path', 'Invalid or forbidden path.', [ 'status' => 403 ] );
        }

        if ( ! is_dir( $safe_dir ) ) {
            return new WP_Error( 'not_directory', 'Target path is not a directory.', [ 'status' => 400 ] );
        }

        if ( ! is_writable( $safe_dir ) ) {
            return new WP_Error( 'not_writable', 'Target directory is not writable.', [ 'status' => 403 ] );
        }

        $files = $request->get_file_params();

        if ( empty( $files['file'] ) ) {
            return new WP_Error( 'missing_file', 'No file was uploaded.', [ 'status' => 400 ] );
        }

        $file = $files['file'];

        if ( $file['error'] !== UPLOAD_ERR_OK ) {
            return new WP_Error( 'upload_error', 'File upload error code: ' . $file['error'], [ 'status' => 400 ] );
        }

        // Sanitize the filename.
        $sanitized_name = sanitize_file_name( $file['name'] );

        if ( empty( $sanitized_name ) ) {
            return new WP_Error( 'invalid_filename', 'Invalid file name.', [ 'status' => 400 ] );
        }

        $target = $safe_dir . DIRECTORY_SEPARATOR . $sanitized_name;

        // Ensure the resolved target does not escape the allowed path.
        $target_real = realpath( $safe_dir ) . DIRECTORY_SEPARATOR . $sanitized_name;
        $abspath     = realpath( ABSPATH );
        if ( strpos( $target_real, $abspath ) !== 0 ) {
            return new WP_Error( 'invalid_path', 'Target path is outside the allowed directory.', [ 'status' => 403 ] );
        }

        if ( ! move_uploaded_file( $file['tmp_name'], $target ) ) {
            return new WP_Error( 'upload_failed', 'Failed to move uploaded file to destination.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [
            'success' => true,
            'name'    => $sanitized_name,
            'path'    => $target,
            'size'    => filesize( $target ),
            'message' => 'File uploaded successfully.',
        ], 200 );
    }

    public static function rename_file( WP_REST_Request $request ) {
        $path     = $request->get_param( 'path' );
        $new_name = $request->get_param( 'name' );

        $safe_path = self::sanitize_path( $path );

        if ( ! $safe_path ) {
            return new WP_Error( 'invalid_path', 'Invalid or forbidden path.', [ 'status' => 403 ] );
        }

        if ( ! file_exists( $safe_path ) ) {
            return new WP_Error( 'not_found', 'File or directory not found.', [ 'status' => 404 ] );
        }

        // Validate new name: no path separators allowed.
        if ( empty( $new_name ) || strpos( $new_name, '/' ) !== false || strpos( $new_name, '\\' ) !== false ) {
            return new WP_Error( 'invalid_name', 'New name must not contain path separators.', [ 'status' => 400 ] );
        }

        $safe_name = sanitize_file_name( $new_name );

        if ( empty( $safe_name ) ) {
            return new WP_Error( 'invalid_name', 'Invalid new file name.', [ 'status' => 400 ] );
        }

        // Prevent renaming critical files.
        $protected_names = [ 'wp-config.php', '.htaccess', 'index.php' ];
        if ( in_array( basename( $safe_path ), $protected_names ) ) {
            return new WP_Error( 'protected_file', 'This file is protected and cannot be renamed.', [ 'status' => 403 ] );
        }

        $new_path = dirname( $safe_path ) . DIRECTORY_SEPARATOR . $safe_name;

        // Validate new path is still within ABSPATH.
        $abspath = realpath( ABSPATH );
        if ( strpos( realpath( dirname( $safe_path ) ) . DIRECTORY_SEPARATOR . $safe_name, $abspath ) !== 0 ) {
            return new WP_Error( 'invalid_path', 'New path is outside the allowed directory.', [ 'status' => 403 ] );
        }

        if ( file_exists( $new_path ) ) {
            return new WP_Error( 'already_exists', 'A file or directory with that name already exists.', [ 'status' => 409 ] );
        }

        if ( ! rename( $safe_path, $new_path ) ) {
            return new WP_Error( 'rename_failed', 'Failed to rename the file or directory.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [
            'success'  => true,
            'message'  => 'Renamed successfully.',
            'new_path' => $new_path,
            'name'     => $safe_name,
        ], 200 );
    }

    private static function delete_directory( $dir ) {
        if ( ! is_dir( $dir ) ) return false;
        $files = array_diff( scandir( $dir ), [ '.', '..' ] );
        foreach ( $files as $file ) {
            $path = $dir . DIRECTORY_SEPARATOR . $file;
            is_dir( $path ) ? self::delete_directory( $path ) : @unlink( $path );
        }
        return @rmdir( $dir );
    }
}
