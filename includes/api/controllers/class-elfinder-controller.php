<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;

/**
 * elFinder connector — boots the bundled elFinder PHP library with a single
 * LocalFileSystem volume rooted at ABSPATH. The REST route's permission
 * callback ( manage_options ) plus the WP REST nonce gate every request; the
 * connector then speaks elFinder's own protocol and exits.
 */
class Elfinder_Controller {

    /**
     * Handle an elFinder connector request and stream the response.
     */
    public static function run( WP_REST_Request $request ) {
        // elFinder's library is global-symbol (no namespace) and its autoload.php
        // declares a global elFinderAutoloader() function. Other plugins ship
        // elFinder too (e.g. Filester), so requiring our copy unconditionally would
        // fatally redeclare those symbols. Only load our bundled copy when no
        // elFinder is present yet; otherwise reuse whatever is already loaded.
        if ( ! class_exists( '\elFinder' ) ) {
            require_once WP_MANAGER_PRO_PATH . 'includes/vendor/elfinder/php/autoload.php';
        }

        // elFinder caches volume state in its own PHP session.
        if ( PHP_SESSION_ACTIVE !== session_status() && ! headers_sent() ) {
            @session_start();
        }

        $uploads = wp_upload_dir();
        $tmb_dir = $uploads['basedir'] . '/wmp-elfinder-tmb';

        $opts = [
            'roots' => [
                [
                    'driver'          => 'LocalFileSystem',
                    'path'            => rtrim( ABSPATH, '/\\' ),
                    'URL'             => site_url( '/' ),
                    'alias'           => 'Site Root',
                    'tmbPath'         => $tmb_dir,
                    'tmbURL'          => $uploads['baseurl'] . '/wmp-elfinder-tmb',
                    'uploadOverwrite' => false,
                    'utf8fix'         => true,
                    'accessControl'   => [ self::class, 'access_control' ],
                ],
            ],
        ];

        // elFinderConnector reads the request, emits headers + body itself, then
        // we exit before WordPress tries to serialise a REST response.
        $connector = new \elFinderConnector( new \elFinder( $opts ) );
        $connector->run();
        exit;
    }

    /**
     * Restrict access to sensitive files. `wp-config.php` stays visible and
     * readable but cannot be written, renamed, moved, or deleted.
     *
     * @return bool|null true to allow, false to deny, null for default.
     */
    public static function access_control( $attr, $path, $data, $volume, $is_dir, $relpath ) {
        if ( 'wp-config.php' === basename( $path ) ) {
            if ( 'write' === $attr )  return false; // no overwrite/edit.
            if ( 'locked' === $attr ) return true;  // no rename/move/delete.
            return null;                            // read allowed.
        }

        return null;
    }
}
