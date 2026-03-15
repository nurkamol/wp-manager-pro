<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Maintenance_Controller {

    // ── REST Handlers ─────────────────────────────────────────────────────────

    public static function get_status( WP_REST_Request $request ) {
        // Build available roles list (slug => label), excluding administrator
        // which always bypasses maintenance regardless of settings.
        $available_roles = [];
        foreach ( wp_roles()->get_names() as $slug => $name ) {
            if ( 'administrator' !== $slug ) {
                $available_roles[ $slug ] = translate_user_role( $name );
            }
        }

        return new WP_REST_Response( [
            'active'          => (bool) get_option( 'wmp_maintenance_active', false ),
            'message'         => get_option( 'wmp_maintenance_message', 'We are performing scheduled maintenance. We will be back shortly.' ),
            'title'           => get_option( 'wmp_maintenance_title', 'Site Under Maintenance' ),
            'end_time'        => get_option( 'wmp_maintenance_end_time', '' ),
            'bg_start'        => get_option( 'wmp_maintenance_bg_start', '#1e1e2e' ),
            'bg_end'          => get_option( 'wmp_maintenance_bg_end', '#0f3460' ),
            'accent'          => get_option( 'wmp_maintenance_accent', '#3b82f6' ),
            'text_color'      => get_option( 'wmp_maintenance_text_color', '#ffffff' ),
            'logo'            => get_option( 'wmp_maintenance_logo', '⚙️' ),
            'badge_text'      => get_option( 'wmp_maintenance_badge_text', "We'll be back soon" ),
            'show_badge'      => (bool) get_option( 'wmp_maintenance_show_badge', true ),
            'show_countdown'  => (bool) get_option( 'wmp_maintenance_show_countdown', false ),
            'bypass_roles'    => (array) get_option( 'wmp_maintenance_bypass_roles', [] ),
            'available_roles' => $available_roles,
            'bypass_key'      => self::get_or_generate_bypass_key(),
            'scope'                   => get_option( 'wmp_maintenance_scope', 'all' ),
            'scope_paths'             => get_option( 'wmp_maintenance_scope_paths', '' ),
            'show_adminbar_toggle'    => (bool) get_option( 'wmp_maintenance_show_adminbar_toggle', true ),
            'home_url'                => trailingslashit( home_url() ),
        ], 200 );
    }

    public static function save_settings( WP_REST_Request $request ) {
        self::persist_settings( $request );
        return new WP_REST_Response( [ 'success' => true, 'message' => 'Settings saved.' ], 200 );
    }

    public static function toggle( WP_REST_Request $request ) {
        $enable = (bool) $request->get_param( 'enable' );

        // Save any settings sent along with the toggle.
        self::persist_settings( $request );

        // Store state as a plain WP option — never write .maintenance file.
        // The .maintenance file approach blocks REST API requests before nonce
        // verification, making it impossible to toggle back via the API.
        update_option( 'wmp_maintenance_active', $enable );

        return new WP_REST_Response( [ 'success' => true, 'active' => $enable ], 200 );
    }

    // ── Maintenance Page Handler (template_redirect hook) ─────────────────────
    //
    // template_redirect fires only for frontend page loads — NOT for REST API,
    // NOT for wp-admin, so the API remains fully accessible at all times.

    public static function handle_maintenance() {
        // Skip if not active.
        if ( ! (bool) get_option( 'wmp_maintenance_active', false ) ) {
            return;
        }

        // ── Scope check: only apply maintenance to pages in scope ──────────────
        $scope = get_option( 'wmp_maintenance_scope', 'all' );

        if ( 'home' === $scope ) {
            // Only block the front page / blog index.
            if ( ! is_front_page() && ! is_home() ) {
                return;
            }
        } elseif ( 'paths' === $scope ) {
            $raw_paths = (string) get_option( 'wmp_maintenance_scope_paths', '' );
            $path_list = array_filter( array_map( 'trim', explode( "\n", $raw_paths ) ) );
            if ( empty( $path_list ) ) {
                return; // No paths defined → nothing to block.
            }
            // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized
            $current  = isset( $_SERVER['REQUEST_URI'] ) ? wp_parse_url( wp_unslash( $_SERVER['REQUEST_URI'] ), PHP_URL_PATH ) : '/';
            $current  = '/' . ltrim( (string) $current, '/' );
            $in_scope = false;
            foreach ( $path_list as $pattern ) {
                if ( fnmatch( $pattern, $current ) ) {
                    $in_scope = true;
                    break;
                }
            }
            if ( ! $in_scope ) {
                return;
            }
        }

        // ── Bypass: administrators always see the site normally ────────────────
        if ( is_user_logged_in() && current_user_can( 'manage_options' ) ) {
            return;
        }

        // ── Bypass: configured roles ───────────────────────────────────────────
        if ( is_user_logged_in() ) {
            $bypass_roles = (array) get_option( 'wmp_maintenance_bypass_roles', [] );
            if ( $bypass_roles ) {
                $user = wp_get_current_user();
                foreach ( $bypass_roles as $role ) {
                    if ( in_array( sanitize_key( $role ), (array) $user->roles, true ) ) {
                        return;
                    }
                }
            }
        }

        // ── Bypass: secret URL key + cookie (7-day pass) ──────────────────────
        $bypass_key = get_option( 'wmp_maintenance_bypass_key', '' );
        if ( $bypass_key ) {
            // Check URL param — set cookie and allow access.
            // phpcs:ignore WordPress.Security.NonceVerification.Recommended
            $param = isset( $_GET['wmp_preview'] ) ? sanitize_text_field( wp_unslash( $_GET['wmp_preview'] ) ) : '';
            if ( $param && hash_equals( (string) $bypass_key, $param ) ) {
                setcookie( 'wmp_preview', $bypass_key, time() + 7 * DAY_IN_SECONDS, COOKIEPATH, COOKIE_DOMAIN, is_ssl(), true );
                return;
            }
            // Check cookie.
            $cookie = isset( $_COOKIE['wmp_preview'] ) ? sanitize_text_field( wp_unslash( $_COOKIE['wmp_preview'] ) ) : '';
            if ( $cookie && hash_equals( (string) $bypass_key, $cookie ) ) {
                return;
            }
        }

        // ── Show maintenance page ──────────────────────────────────────────────
        status_header( 503 );
        nocache_headers();
        header( 'Retry-After: 3600' );
        header( 'Content-Type: text/html; charset=UTF-8' );

        echo self::generate_html(); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        exit;
    }

    // ── Private Helpers ───────────────────────────────────────────────────────

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
                if ( $clean ) {
                    update_option( $option, $clean );
                }
            }
        }

        $show_badge           = $request->get_param( 'show_badge' );
        $show_countdown       = $request->get_param( 'show_countdown' );
        $show_adminbar_toggle = $request->get_param( 'show_adminbar_toggle' );
        if ( $show_badge !== null )           update_option( 'wmp_maintenance_show_badge',           (bool) $show_badge );
        if ( $show_countdown !== null )       update_option( 'wmp_maintenance_show_countdown',       (bool) $show_countdown );
        if ( $show_adminbar_toggle !== null ) update_option( 'wmp_maintenance_show_adminbar_toggle', (bool) $show_adminbar_toggle );

        // Bypass roles — array of role slugs allowed to see the site during maintenance.
        $bypass_roles = $request->get_param( 'bypass_roles' );
        if ( $bypass_roles !== null ) {
            $clean = array_values( array_filter( array_map( 'sanitize_key', (array) $bypass_roles ) ) );
            update_option( 'wmp_maintenance_bypass_roles', $clean );
        }

        // Secret bypass key — save if explicitly provided (e.g. after regenerate).
        $bypass_key = $request->get_param( 'bypass_key' );
        if ( ! empty( $bypass_key ) ) {
            update_option( 'wmp_maintenance_bypass_key', sanitize_text_field( $bypass_key ) );
        }

        // Scope — 'all' | 'home' | 'paths'.
        $scope = $request->get_param( 'scope' );
        if ( $scope !== null ) {
            $clean_scope = in_array( $scope, [ 'all', 'home', 'paths' ], true ) ? $scope : 'all';
            update_option( 'wmp_maintenance_scope', $clean_scope );
        }

        // Scope paths — newline-separated URL path patterns.
        $scope_paths = $request->get_param( 'scope_paths' );
        if ( $scope_paths !== null ) {
            update_option( 'wmp_maintenance_scope_paths', sanitize_textarea_field( $scope_paths ) );
        }
    }

    /**
     * Return the stored bypass key, generating a new one if absent.
     */
    private static function get_or_generate_bypass_key(): string {
        $key = (string) get_option( 'wmp_maintenance_bypass_key', '' );
        if ( empty( $key ) ) {
            $key = wp_generate_password( 16, false );
            update_option( 'wmp_maintenance_bypass_key', $key );
        }
        return $key;
    }

    private static function generate_html(): string {
        $title          = esc_html( get_option( 'wmp_maintenance_title', 'Site Under Maintenance' ) );
        $message        = esc_html( get_option( 'wmp_maintenance_message', 'We are performing scheduled maintenance. We will be back shortly.' ) );
        $end_time       = get_option( 'wmp_maintenance_end_time', '' );
        $bg_start       = get_option( 'wmp_maintenance_bg_start', '#1e1e2e' );
        $bg_end         = get_option( 'wmp_maintenance_bg_end', '#0f3460' );
        $accent         = get_option( 'wmp_maintenance_accent', '#3b82f6' );
        $text_clr       = get_option( 'wmp_maintenance_text_color', '#ffffff' );
        $logo           = esc_html( get_option( 'wmp_maintenance_logo', '⚙️' ) );
        $badge_txt      = esc_html( get_option( 'wmp_maintenance_badge_text', "We'll be back soon" ) );
        $show_badge     = (bool) get_option( 'wmp_maintenance_show_badge', true );
        $show_countdown = (bool) get_option( 'wmp_maintenance_show_countdown', false );

        $countdown_html = '';
        $countdown_js   = '';
        if ( $show_countdown && ! empty( $end_time ) ) {
            $end_ts = strtotime( $end_time );
            if ( $end_ts && $end_ts > time() ) {
                $countdown_html = '<div class="countdown" id="countdown"></div>';
                $countdown_js   = '<script>(function(){var e=' . $end_ts . '*1e3;function p(v){return v<10?"0"+v:v}function t(){var d=Math.max(0,e-Date.now()),D=Math.floor(d/864e5),H=Math.floor(d%864e5/36e5),M=Math.floor(d%36e5/6e4),S=Math.floor(d%6e4/1e3),el=document.getElementById("countdown");if(el)el.innerHTML="<div class=\'cd-card\'><div class=\'cd-num\'>"+p(D)+"</div><div class=\'cd-lbl\'>Days</div></div><div class=\'cd-card\'><div class=\'cd-num\'>"+p(H)+"</div><div class=\'cd-lbl\'>Hrs</div></div><div class=\'cd-card\'><div class=\'cd-num\'>"+p(M)+"</div><div class=\'cd-lbl\'>Min</div></div><div class=\'cd-card\'><div class=\'cd-num\'>"+p(S)+"</div><div class=\'cd-lbl\'>Sec</div></div>";if(d>0)setTimeout(t,1e3)}t()})()</script>';
            }
        }

        $badge_html = $show_badge
            ? '<div class="badge"><span class="dot"></span>' . $badge_txt . '</div>'
            : '';

        $html  = '<!DOCTYPE html><html lang="en">' . "\n";
        $html .= '<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">';
        $html .= '<title>' . $title . '</title><style>';
        $html .= '*{margin:0;padding:0;box-sizing:border-box}';
        $html .= 'body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;background:linear-gradient(135deg,' . esc_attr( $bg_start ) . ' 0%,' . esc_attr( $bg_end ) . ' 100%);min-height:100vh;display:flex;align-items:center;justify-content:center;color:' . esc_attr( $text_clr ) . ';overflow:hidden}';
        $html .= 'body::before{content:"";position:fixed;inset:0;background:radial-gradient(ellipse at 15% 50%,rgba(255,255,255,.06) 0%,transparent 55%),radial-gradient(ellipse at 85% 20%,rgba(255,255,255,.04) 0%,transparent 50%);pointer-events:none}';
        $html .= '.container{text-align:center;padding:60px 40px;max-width:560px;position:relative;z-index:1;animation:fadeUp .6s ease both}';
        $html .= '@keyframes fadeUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}';
        $html .= '.icon{display:inline-flex;align-items:center;justify-content:center;width:88px;height:88px;font-size:44px;background:rgba(255,255,255,.1);backdrop-filter:blur(20px);border:1px solid rgba(255,255,255,.2);border-radius:24px;margin-bottom:28px;animation:float 3.5s ease-in-out infinite}';
        $html .= '@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}';
        $html .= 'h1{font-size:clamp(1.6rem,4vw,2.4rem);font-weight:800;letter-spacing:-.025em;margin-bottom:14px;line-height:1.2}';
        $html .= '.divider{width:48px;height:3px;background:' . esc_attr( $accent ) . ';margin:0 auto 22px;border-radius:2px}';
        $html .= 'p{font-size:1.05rem;line-height:1.75;opacity:.82;margin-bottom:36px;max-width:420px;margin-left:auto;margin-right:auto}';
        $html .= '.badge{display:inline-flex;align-items:center;gap:10px;background:' . esc_attr( $accent ) . ';border-radius:50px;padding:10px 28px;font-size:.9rem;font-weight:600}';
        $html .= '.dot{width:8px;height:8px;background:rgba(255,255,255,.9);border-radius:50%;animation:pulse 1.5s ease-in-out infinite}';
        $html .= '@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.7)}}';
        $html .= '.countdown{display:flex;gap:8px;justify-content:center;margin-bottom:32px}';
        $html .= '.cd-card{background:' . esc_attr( $accent ) . '20;border:1px solid ' . esc_attr( $accent ) . '40;border-radius:8px;padding:8px 6px;min-width:44px;text-align:center}';
        $html .= '.cd-num{font-size:1.1rem;font-weight:700;color:' . esc_attr( $accent ) . ';font-variant-numeric:tabular-nums}';
        $html .= '.cd-lbl{font-size:9px;opacity:.6;margin-top:2px;text-transform:uppercase;letter-spacing:.05em}';
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

        return $html;
    }
}
