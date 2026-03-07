<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Maintenance_Controller {

    private static $maintenance_file;
    private static $custom_template;

    private static function init() {
        self::$maintenance_file  = ABSPATH . '.maintenance';
        self::$custom_template   = WP_CONTENT_DIR . '/maintenance.php';
    }

    public static function get_status( WP_REST_Request $request ) {
        self::init();

        $is_active = file_exists( self::$maintenance_file );
        $message   = get_option( 'wmp_maintenance_message', 'We are performing scheduled maintenance. We will be back shortly.' );
        $title     = get_option( 'wmp_maintenance_title', 'Site Under Maintenance' );
        $end_time  = get_option( 'wmp_maintenance_end_time', '' );
        $bypass    = get_option( 'wmp_maintenance_bypass', [] );

        return new WP_REST_Response( [
            'active'   => $is_active,
            'message'  => $message,
            'title'    => $title,
            'end_time' => $end_time,
            'bypass'   => $bypass,
        ], 200 );
    }

    public static function toggle( WP_REST_Request $request ) {
        self::init();

        $enable   = (bool) $request->get_param( 'enable' );
        $message  = sanitize_textarea_field( $request->get_param( 'message' ) );
        $title    = sanitize_text_field( $request->get_param( 'title' ) );
        $end_time = sanitize_text_field( $request->get_param( 'end_time' ) );

        // Save settings.
        if ( $message ) update_option( 'wmp_maintenance_message', $message );
        if ( $title )   update_option( 'wmp_maintenance_title', $title );
        if ( $end_time ) update_option( 'wmp_maintenance_end_time', $end_time );

        if ( $enable ) {
            // Create .maintenance file.
            $content = '<?php $upgrading = ' . time() . '; ?>';
            $result  = file_put_contents( self::$maintenance_file, $content );

            // Create custom maintenance template.
            self::create_maintenance_template( $title ?: 'Site Under Maintenance', $message ?: '' );

            if ( $result === false ) {
                return new WP_Error( 'maintenance_failed', 'Failed to enable maintenance mode. Check file permissions.', [ 'status' => 500 ] );
            }

            return new WP_REST_Response( [
                'success' => true,
                'active'  => true,
                'message' => 'Maintenance mode enabled.',
            ], 200 );

        } else {
            // Remove .maintenance file.
            if ( file_exists( self::$maintenance_file ) ) {
                $result = @unlink( self::$maintenance_file );
                if ( ! $result ) {
                    return new WP_Error( 'maintenance_failed', 'Failed to disable maintenance mode. Check file permissions.', [ 'status' => 500 ] );
                }
            }

            return new WP_REST_Response( [
                'success' => true,
                'active'  => false,
                'message' => 'Maintenance mode disabled.',
            ], 200 );
        }
    }

    private static function create_maintenance_template( $title, $message ) {
        $title    = esc_html( $title );
        $message  = esc_html( $message );
        $end_time = get_option( 'wmp_maintenance_end_time', '' );

        $html = <<<HTML
<?php
// Custom maintenance page created by WP Manager Pro
http_response_code(503);
header('Retry-After: 3600');
?>
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{$title}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    background: linear-gradient(135deg, #1e1e2e 0%, #16213e 50%, #0f3460 100%);
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    color: #fff;
  }
  .container { text-align: center; padding: 40px; max-width: 600px; }
  .icon { font-size: 80px; margin-bottom: 20px; animation: spin 3s linear infinite; }
  @keyframes spin { 100% { transform: rotate(360deg); } }
  h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: 16px; }
  p { font-size: 1.1rem; opacity: 0.85; line-height: 1.6; margin-bottom: 30px; }
  .badge {
    display: inline-block; background: rgba(255,255,255,0.15);
    border: 1px solid rgba(255,255,255,0.3); border-radius: 50px;
    padding: 8px 24px; font-size: 0.9rem; backdrop-filter: blur(10px);
  }
</style>
</head>
<body>
  <div class="container">
    <div class="icon">⚙️</div>
    <h1>{$title}</h1>
    <p>{$message}</p>
    <div class="badge">We'll be back soon</div>
  </div>
</body>
</html>
HTML;

        file_put_contents( self::$custom_template, $html );
    }
}
