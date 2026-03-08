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
        self::$maintenance_file = ABSPATH . '.maintenance';
        self::$custom_template  = WP_CONTENT_DIR . '/maintenance.php';
    }

    public static function get_status( WP_REST_Request $request ) {
        self::init();

        return new WP_REST_Response( [
            'active'         => file_exists( self::$maintenance_file ),
            'message'        => get_option( 'wmp_maintenance_message', 'We are performing scheduled maintenance. We will be back shortly.' ),
            'title'          => get_option( 'wmp_maintenance_title', 'Site Under Maintenance' ),
            'end_time'       => get_option( 'wmp_maintenance_end_time', '' ),
            'bg_start'       => get_option( 'wmp_maintenance_bg_start', '#1e1e2e' ),
            'bg_end'         => get_option( 'wmp_maintenance_bg_end', '#0f3460' ),
            'accent'         => get_option( 'wmp_maintenance_accent', '#3b82f6' ),
            'text_color'     => get_option( 'wmp_maintenance_text_color', '#ffffff' ),
            'logo'           => get_option( 'wmp_maintenance_logo', '⚙️' ),
            'badge_text'     => get_option( 'wmp_maintenance_badge_text', "We'll be back soon" ),
            'show_badge'     => (bool) get_option( 'wmp_maintenance_show_badge', true ),
            'show_countdown' => (bool) get_option( 'wmp_maintenance_show_countdown', true ),
        ], 200 );
    }

    public static function save_settings( WP_REST_Request $request ) {
        self::init();
        self::persist_settings( $request );
        if ( file_exists( self::$maintenance_file ) ) {
            self::create_maintenance_template();
        }
        return new WP_REST_Response( [ 'success' => true, 'message' => 'Settings saved.' ], 200 );
    }

    public static function toggle( WP_REST_Request $request ) {
        self::init();

        $enable = (bool) $request->get_param( 'enable' );
        self::persist_settings( $request );

        if ( $enable ) {
            $content = '<?php $upgrading = ' . time() . '; ?>';
            $result  = file_put_contents( self::$maintenance_file, $content );
            self::create_maintenance_template();
            if ( $result === false ) {
                return new WP_Error( 'maintenance_failed', 'Failed to enable maintenance mode. Check file permissions.', [ 'status' => 500 ] );
            }
            return new WP_REST_Response( [ 'success' => true, 'active' => true ], 200 );
        } else {
            if ( file_exists( self::$maintenance_file ) ) {
                $result = @unlink( self::$maintenance_file );
                if ( ! $result ) {
                    return new WP_Error( 'maintenance_failed', 'Failed to disable maintenance mode. Check file permissions.', [ 'status' => 500 ] );
                }
            }
            return new WP_REST_Response( [ 'success' => true, 'active' => false ], 200 );
        }
    }

    private static function persist_settings( WP_REST_Request $request ) {
        $text_fields = [
            'message'    => 'wmp_maintenance_message',
            'title'      => 'wmp_maintenance_title',
            'end_time'   => 'wmp_maintenance_end_time',
            'logo'       => 'wmp_maintenance_logo',
            'badge_text' => 'wmp_maintenance_badge_text',
        ];
        foreach ( $text_fields as $param => $option ) {
            $val = $request->get_param( $param );
            if ( $val !== null ) {
                update_option( $option, 'message' === $param ? sanitize_textarea_field( $val ) : sanitize_text_field( $val ) );
            }
        }

        $color_fields = [
            'bg_start'   => 'wmp_maintenance_bg_start',
            'bg_end'     => 'wmp_maintenance_bg_end',
            'accent'     => 'wmp_maintenance_accent',
            'text_color' => 'wmp_maintenance_text_color',
        ];
        foreach ( $color_fields as $param => $option ) {
            $val = $request->get_param( $param );
            if ( $val !== null ) {
                $clean = sanitize_hex_color( $val );
                if ( $clean ) update_option( $option, $clean );
            }
        }

        $show_badge     = $request->get_param( 'show_badge' );
        $show_countdown = $request->get_param( 'show_countdown' );
        if ( $show_badge !== null )     update_option( 'wmp_maintenance_show_badge',     (bool) $show_badge );
        if ( $show_countdown !== null ) update_option( 'wmp_maintenance_show_countdown', (bool) $show_countdown );
    }

    private static function create_maintenance_template() {
        $title     = esc_html( get_option( 'wmp_maintenance_title', 'Site Under Maintenance' ) );
        $message   = esc_html( get_option( 'wmp_maintenance_message', 'We are performing scheduled maintenance. We will be back shortly.' ) );
        $end_time  = get_option( 'wmp_maintenance_end_time', '' );
        $bg_start  = get_option( 'wmp_maintenance_bg_start', '#1e1e2e' );
        $bg_end    = get_option( 'wmp_maintenance_bg_end', '#0f3460' );
        $accent    = get_option( 'wmp_maintenance_accent', '#3b82f6' );
        $text_clr  = get_option( 'wmp_maintenance_text_color', '#ffffff' );
        $logo      = esc_html( get_option( 'wmp_maintenance_logo', '⚙️' ) );
        $badge_txt = esc_html( get_option( 'wmp_maintenance_badge_text', "We'll be back soon" ) );
        $show_badge     = (bool) get_option( 'wmp_maintenance_show_badge', true );
        $show_countdown = (bool) get_option( 'wmp_maintenance_show_countdown', true );

        $countdown_html = '';
        $countdown_js   = '';
        if ( $show_countdown && ! empty( $end_time ) ) {
            $end_ts = strtotime( $end_time );
            if ( $end_ts && $end_ts > time() ) {
                $countdown_html = '<div class="countdown" id="countdown"></div>';
                $countdown_js   = '<script>(function(){var e=' . $end_ts . '*1e3;function p(n){return n<10?"0"+n:n}function t(){var d=Math.max(0,e-Date.now()),h=Math.floor(d/36e5),m=Math.floor(d%36e5/6e4),s=Math.floor(d%6e4/1e3),el=document.getElementById("countdown");if(el)el.innerHTML="<span>"+p(h)+"h</span><span>"+p(m)+"m</span><span>"+p(s)+"s</span>";if(d>0)setTimeout(t,1e3)}t()})()</script>';
            }
        }

        $badge_html = $show_badge ? '<div class="badge"><span class="dot"></span>' . $badge_txt . '</div>' : '';

        $html  = '<?php http_response_code(503);header("Retry-After: 3600"); ?>' . "\n";
        $html .= '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">';
        $html .= '<title>' . $title . '</title><style>';
        $html .= '*{margin:0;padding:0;box-sizing:border-box}';
        $html .= 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:linear-gradient(135deg,' . $bg_start . ' 0%,' . $bg_end . ' 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;color:' . $text_clr . ';overflow:hidden}';
        $html .= 'body::before{content:"";position:fixed;inset:0;background:radial-gradient(ellipse at 15% 50%,rgba(255,255,255,.06) 0%,transparent 55%),radial-gradient(ellipse at 85% 20%,rgba(255,255,255,.04) 0%,transparent 50%);pointer-events:none}';
        $html .= '.container{text-align:center;padding:60px 40px;max-width:560px;position:relative;z-index:1;animation:fadeUp .6s ease both}';
        $html .= '@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}';
        $html .= '.icon{display:inline-flex;align-items:center;justify-content:center;width:88px;height:88px;font-size:44px;background:rgba(255,255,255,.1);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.2);border-radius:24px;margin-bottom:32px;animation:float 3.5s ease-in-out infinite}';
        $html .= '@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}';
        $html .= 'h1{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:800;letter-spacing:-.025em;margin-bottom:14px;line-height:1.2}';
        $html .= '.divider{width:48px;height:3px;background:' . $accent . ';margin:0 auto 22px;border-radius:2px}';
        $html .= 'p{font-size:1.05rem;line-height:1.75;opacity:.82;margin-bottom:36px;max-width:420px;margin-left:auto;margin-right:auto}';
        $html .= '.badge{display:inline-flex;align-items:center;gap:10px;background:' . $accent . ';border-radius:50px;padding:10px 28px;font-size:.9rem;font-weight:600}';
        $html .= '.dot{width:8px;height:8px;background:rgba(255,255,255,.9);border-radius:50%;animation:pulse 1.5s ease-in-out infinite}';
        $html .= '@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}';
        $html .= '.countdown{display:flex;gap:16px;justify-content:center;margin-bottom:32px}';
        $html .= '.countdown span{background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:12px;padding:12px 20px;font-size:1.1rem;font-weight:700;min-width:64px;font-variant-numeric:tabular-nums}';
        $html .= '@media(max-width:480px){.container{padding:40px 24px}}';
        $html .= '</style></head><body>';
        $html .= '<div class="container">';
        $html .= '<div class="icon">' . $logo . '</div>';
        $html .= '<h1>' . $title . '</h1>';
        $html .= '<div class="divider"></div>';
        $html .= '<p>' . $message . '</p>';
        $html .= $countdown_html;
        $html .= $badge_html;
        $html .= '</div>' . $countdown_js . '</body></html>';

        file_put_contents( self::$custom_template, $html );
    }
}
