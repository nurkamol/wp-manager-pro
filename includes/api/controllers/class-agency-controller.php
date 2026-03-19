<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Agency_Controller
 *
 * Handles all agency-focused features:
 *  - wp_mail Interceptor: capture, log, preview, resend, dev mode
 *  - White-label Login Page: custom logo, colours, heading, footer
 *  - Admin UI Customiser: hide WP admin menu items and dashboard widgets
 *  - Client Report Generator: one-click HTML report
 *  - Coming Soon Mode: pre-launch page with email capture and countdown
 */
class Agency_Controller {

    // ── Option keys ────────────────────────────────────────────────────────────

    // Mail Interceptor
    const OPT_MAIL_DEV_MODE  = 'wmp_mail_dev_mode';
    const OPT_MAIL_LOG       = 'wmp_mail_log';
    const MAX_MAIL_LOG       = 100;

    // Login Page
    const OPT_LOGIN_LOGO         = 'wmp_login_logo_url';
    const OPT_LOGIN_BG_COLOR     = 'wmp_login_bg_color';
    const OPT_LOGIN_BG_IMAGE     = 'wmp_login_bg_image';
    const OPT_LOGIN_HEADING      = 'wmp_login_heading';
    const OPT_LOGIN_FOOTER       = 'wmp_login_footer';
    const OPT_LOGIN_BTN_COLOR    = 'wmp_login_btn_color';
    const OPT_LOGIN_ENABLED      = 'wmp_login_custom_enabled';
    const OPT_LOGIN_SHOW_PRIVACY = 'wmp_login_show_privacy';
    const OPT_LOGIN_LINKS_HTML   = 'wmp_login_links_html';
    const OPT_LOGIN_FORM_HTML    = 'wmp_login_form_html';
    const OPT_LOGIN_CARD_BG      = 'wmp_login_card_bg';
    const OPT_LOGIN_TEXT_COLOR   = 'wmp_login_text_color';
    const OPT_LOGIN_LINK_COLOR   = 'wmp_login_link_color';
    const OPT_LOGIN_CARD_RADIUS  = 'wmp_login_card_radius';
    const OPT_LOGIN_INPUT_RADIUS = 'wmp_login_input_radius';
    const OPT_LOGIN_FORM_WIDTH   = 'wmp_login_form_width';
    const OPT_LOGIN_CARD_SHADOW  = 'wmp_login_card_shadow';
    const OPT_LOGIN_OVERLAY       = 'wmp_login_overlay';
    const OPT_LOGIN_CUSTOM_CSS    = 'wmp_login_custom_css';
    const OPT_LOGIN_LAYOUT        = 'wmp_login_layout';          // centered | split
    const OPT_LOGIN_BRAND_COLOR   = 'wmp_login_brand_color';     // split right-panel bg
    const OPT_LOGIN_BRAND_IMAGE   = 'wmp_login_brand_image';     // split right-panel image
    const OPT_LOGIN_HEADING_SUB   = 'wmp_login_heading_sub';     // subtitle below heading
    const OPT_LOGIN_BTN_FULL      = 'wmp_login_btn_full_width';  // full-width button

    // Admin Customiser
    const OPT_HIDDEN_MENUS   = 'wmp_hidden_admin_menus';
    const OPT_HIDDEN_WIDGETS = 'wmp_hidden_dashboard_widgets';

    // Coming Soon
    const OPT_CS_ACTIVE          = 'wmp_coming_soon_active';
    const OPT_CS_TITLE           = 'wmp_coming_soon_title';
    const OPT_CS_MESSAGE         = 'wmp_coming_soon_message';
    const OPT_CS_LAUNCH_DATE     = 'wmp_coming_soon_launch_date';
    const OPT_CS_EMAIL_CAPTURE   = 'wmp_coming_soon_email_capture';
    const OPT_CS_EMAILS          = 'wmp_coming_soon_emails';
    const OPT_CS_BG_COLOR        = 'wmp_coming_soon_bg_color';
    const OPT_CS_ACCENT_COLOR    = 'wmp_coming_soon_accent_color';
    const OPT_CS_BG_IMAGE        = 'wmp_coming_soon_bg_image';
    const OPT_CS_LOGO_URL        = 'wmp_coming_soon_logo_url';

    // ── Mail Interceptor ───────────────────────────────────────────────────────

    public static function get_mail_settings( WP_REST_Request $request ): WP_REST_Response {
        return new WP_REST_Response( [
            'dev_mode'  => (bool) get_option( self::OPT_MAIL_DEV_MODE, false ),
            'log_count' => count( (array) get_option( self::OPT_MAIL_LOG, [] ) ),
        ], 200 );
    }

    public static function save_mail_settings( WP_REST_Request $request ): WP_REST_Response {
        $dev_mode = (bool) $request->get_param( 'dev_mode' );
        update_option( self::OPT_MAIL_DEV_MODE, $dev_mode );
        return new WP_REST_Response( [ 'success' => true, 'dev_mode' => $dev_mode ], 200 );
    }

    public static function get_mail_log( WP_REST_Request $request ): WP_REST_Response {
        $log = (array) get_option( self::OPT_MAIL_LOG, [] );
        // Newest first
        $log = array_reverse( $log );
        return new WP_REST_Response( [ 'items' => $log ], 200 );
    }

    public static function clear_mail_log( WP_REST_Request $request ): WP_REST_Response {
        delete_option( self::OPT_MAIL_LOG );
        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    public static function resend_mail( WP_REST_Request $request ): WP_REST_Response|WP_Error {
        $id  = sanitize_text_field( $request->get_param( 'id' ) );
        $log = (array) get_option( self::OPT_MAIL_LOG, [] );

        $entry = null;
        foreach ( $log as $item ) {
            if ( $item['id'] === $id ) { $entry = $item; break; }
        }

        if ( ! $entry ) {
            return new WP_Error( 'not_found', 'Email entry not found.', [ 'status' => 404 ] );
        }

        $headers = [];
        if ( ! empty( $entry['content_type'] ) ) {
            $headers[] = 'Content-Type: ' . $entry['content_type'];
        }

        // Temporarily disable dev mode for this send
        $was_dev = get_option( self::OPT_MAIL_DEV_MODE, false );
        if ( $was_dev ) {
            update_option( self::OPT_MAIL_DEV_MODE, false );
        }

        $result = wp_mail(
            $entry['to'],
            $entry['subject'],
            $entry['message'],
            $headers
        );

        if ( $was_dev ) {
            update_option( self::OPT_MAIL_DEV_MODE, true );
        }

        return new WP_REST_Response( [
            'success' => $result,
            'message' => $result ? 'Email resent successfully.' : 'Failed to resend email.',
        ], 200 );
    }

    /**
     * Hooked to wp_mail filter — intercept outgoing emails.
     * Always logs; in dev mode also suppresses sending by setting to/subject to empty.
     */
    public static function intercept_mail( array $args ): array {
        $id    = uniqid( 'wmp_mail_', true );
        $entry = [
            'id'           => $id,
            'to'           => is_array( $args['to'] ) ? implode( ', ', $args['to'] ) : (string) $args['to'],
            'subject'      => (string) $args['subject'],
            'message'      => (string) $args['message'],
            'headers'      => (array) $args['headers'],
            'content_type' => self::extract_content_type( (array) $args['headers'] ),
            'date'         => current_time( 'mysql' ),
            'status'       => 'sent',
        ];

        $dev_mode = (bool) get_option( self::OPT_MAIL_DEV_MODE, false );
        if ( $dev_mode ) {
            $entry['status'] = 'intercepted';
            // Redirect to a non-existent address to prevent delivery.
            $args['to']      = 'devnull@wmp-intercepted.invalid';
            $args['subject'] = '[INTERCEPTED] ' . $args['subject'];
        }

        // Append to log, keep last MAX_MAIL_LOG entries.
        $log   = (array) get_option( self::OPT_MAIL_LOG, [] );
        $log[] = $entry;
        if ( count( $log ) > self::MAX_MAIL_LOG ) {
            $log = array_slice( $log, - self::MAX_MAIL_LOG );
        }
        update_option( self::OPT_MAIL_LOG, $log );

        return $args;
    }

    private static function extract_content_type( array $headers ): string {
        foreach ( $headers as $h ) {
            if ( stripos( $h, 'content-type:' ) === 0 ) {
                return trim( substr( $h, 13 ) );
            }
        }
        return 'text/plain; charset=UTF-8';
    }

    // ── White-label Login Page ─────────────────────────────────────────────────

    public static function get_login_settings( WP_REST_Request $request ): WP_REST_Response {
        return new WP_REST_Response( [
            'enabled'          => (bool) get_option( self::OPT_LOGIN_ENABLED, false ),
            'logo_url'         => (string) get_option( self::OPT_LOGIN_LOGO, '' ),
            'bg_color'         => (string) get_option( self::OPT_LOGIN_BG_COLOR, '#f0f0f1' ),
            'bg_image'         => (string) get_option( self::OPT_LOGIN_BG_IMAGE, '' ),
            'heading'          => (string) get_option( self::OPT_LOGIN_HEADING, '' ),
            'footer'           => (string) get_option( self::OPT_LOGIN_FOOTER, '' ),
            'btn_color'        => (string) get_option( self::OPT_LOGIN_BTN_COLOR, '#2271b1' ),
            'show_privacy'     => (bool) get_option( self::OPT_LOGIN_SHOW_PRIVACY, false ),
            'custom_links_html'=> (string) get_option( self::OPT_LOGIN_LINKS_HTML, '' ),
            'form_html'        => (string) get_option( self::OPT_LOGIN_FORM_HTML, '' ),
            'card_bg'          => (string) get_option( self::OPT_LOGIN_CARD_BG,     '#ffffff' ),
            'text_color'       => (string) get_option( self::OPT_LOGIN_TEXT_COLOR,  '#1d2327' ),
            'link_color'       => (string) get_option( self::OPT_LOGIN_LINK_COLOR,  '' ),
            'card_radius'      => (int)    get_option( self::OPT_LOGIN_CARD_RADIUS,  8 ),
            'input_radius'     => (int)    get_option( self::OPT_LOGIN_INPUT_RADIUS, 6 ),
            'form_width'       => (int)    get_option( self::OPT_LOGIN_FORM_WIDTH,  360 ),
            'card_shadow'      => (string) get_option( self::OPT_LOGIN_CARD_SHADOW, 'md' ),
            'overlay'          => (int)    get_option( self::OPT_LOGIN_OVERLAY,       0 ),
            'custom_css'       => (string) get_option( self::OPT_LOGIN_CUSTOM_CSS,   '' ),
            'layout'           => (string) get_option( self::OPT_LOGIN_LAYOUT,       'centered' ),
            'brand_color'      => (string) get_option( self::OPT_LOGIN_BRAND_COLOR,  '#e8e8e8' ),
            'brand_image'      => (string) get_option( self::OPT_LOGIN_BRAND_IMAGE,  '' ),
            'heading_sub'      => (string) get_option( self::OPT_LOGIN_HEADING_SUB,  '' ),
            'btn_full_width'   => (bool)   get_option( self::OPT_LOGIN_BTN_FULL,     false ),
        ], 200 );
    }

    public static function save_login_settings( WP_REST_Request $request ): WP_REST_Response {
        $fields = [
            'enabled'          => [ self::OPT_LOGIN_ENABLED,      'bool'  ],
            'logo_url'         => [ self::OPT_LOGIN_LOGO,         'url'   ],
            'bg_color'         => [ self::OPT_LOGIN_BG_COLOR,     'color' ],
            'bg_image'         => [ self::OPT_LOGIN_BG_IMAGE,     'url'   ],
            'heading'          => [ self::OPT_LOGIN_HEADING,      'text'  ],
            'footer'           => [ self::OPT_LOGIN_FOOTER,       'text'  ],
            'btn_color'        => [ self::OPT_LOGIN_BTN_COLOR,    'color' ],
            'show_privacy'     => [ self::OPT_LOGIN_SHOW_PRIVACY, 'bool'  ],
            'custom_links_html'=> [ self::OPT_LOGIN_LINKS_HTML,   'html'  ],
            'form_html'        => [ self::OPT_LOGIN_FORM_HTML,    'html'  ],
            'card_bg'          => [ self::OPT_LOGIN_CARD_BG,      'color' ],
            'text_color'       => [ self::OPT_LOGIN_TEXT_COLOR,   'color' ],
            'link_color'       => [ self::OPT_LOGIN_LINK_COLOR,   'color' ],
            'card_radius'      => [ self::OPT_LOGIN_CARD_RADIUS,  'int'   ],
            'input_radius'     => [ self::OPT_LOGIN_INPUT_RADIUS, 'int'   ],
            'form_width'       => [ self::OPT_LOGIN_FORM_WIDTH,   'int'   ],
            'card_shadow'      => [ self::OPT_LOGIN_CARD_SHADOW,  'text'  ],
            'overlay'          => [ self::OPT_LOGIN_OVERLAY,       'int'   ],
            'custom_css'       => [ self::OPT_LOGIN_CUSTOM_CSS,    'css'   ],
            'layout'           => [ self::OPT_LOGIN_LAYOUT,        'text'  ],
            'brand_color'      => [ self::OPT_LOGIN_BRAND_COLOR,   'color' ],
            'brand_image'      => [ self::OPT_LOGIN_BRAND_IMAGE,   'url'   ],
            'heading_sub'      => [ self::OPT_LOGIN_HEADING_SUB,   'text'  ],
            'btn_full_width'   => [ self::OPT_LOGIN_BTN_FULL,      'bool'  ],
        ];

        foreach ( $fields as $param => [ $opt, $type ] ) {
            $val = $request->get_param( $param );
            if ( null === $val ) continue;
            switch ( $type ) {
                case 'bool':  update_option( $opt, (bool) $val ); break;
                case 'url':   update_option( $opt, esc_url_raw( $val ) ); break;
                case 'color': update_option( $opt, sanitize_hex_color( $val ) ?: $val ); break;
                case 'html':  update_option( $opt, wp_kses_post( $val ) ); break;
                case 'int':   update_option( $opt, absint( $val ) ); break;
                case 'css':   update_option( $opt, wp_strip_all_tags( $val ) ); break;
                default:      update_option( $opt, sanitize_text_field( $val ) ); break;
            }
        }

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    /**
     * Hooked to login_head — inject custom login page CSS.
     *
     * login_head fires AFTER wp_print_styles('login'), so our <style> block
     * is output AFTER the core login stylesheet link element. Combined with
     * !important, this guarantees our overrides actually win every time.
     */
    public static function apply_login_styles(): void {
        if ( ! get_option( self::OPT_LOGIN_ENABLED, false ) ) return;

        $logo         = esc_url( get_option( self::OPT_LOGIN_LOGO,        '' ) );
        $bg_color     = esc_attr( get_option( self::OPT_LOGIN_BG_COLOR,   '#f0f0f1' ) );
        $bg_image     = esc_url( get_option( self::OPT_LOGIN_BG_IMAGE,    '' ) );
        $btn_color    = esc_attr( get_option( self::OPT_LOGIN_BTN_COLOR,  '#2271b1' ) );
        $card_bg      = esc_attr( get_option( self::OPT_LOGIN_CARD_BG,    '#ffffff' ) );
        $text_color   = esc_attr( get_option( self::OPT_LOGIN_TEXT_COLOR, '#1d2327' ) );
        $link_color   = esc_attr( get_option( self::OPT_LOGIN_LINK_COLOR, '' ) ) ?: $btn_color;
        $card_radius  = absint( get_option( self::OPT_LOGIN_CARD_RADIUS,   12 ) );
        $input_radius = absint( get_option( self::OPT_LOGIN_INPUT_RADIUS,  8 ) );
        $form_width   = absint( get_option( self::OPT_LOGIN_FORM_WIDTH,   400 ) );
        $card_shadow  = sanitize_text_field( get_option( self::OPT_LOGIN_CARD_SHADOW, 'md' ) );
        $overlay      = absint( get_option( self::OPT_LOGIN_OVERLAY, 0 ) );
        $custom_css   = wp_strip_all_tags( get_option( self::OPT_LOGIN_CUSTOM_CSS, '' ) );
        $layout       = sanitize_key( get_option( self::OPT_LOGIN_LAYOUT, 'centered' ) );
        $brand_color  = esc_attr( get_option( self::OPT_LOGIN_BRAND_COLOR, '#e8e8e8' ) );
        $brand_image  = esc_url( get_option( self::OPT_LOGIN_BRAND_IMAGE, '' ) );
        $btn_full     = (bool) get_option( self::OPT_LOGIN_BTN_FULL, false );
        $heading_sub  = esc_html( get_option( self::OPT_LOGIN_HEADING_SUB, '' ) );

        $shadows = [
            'none' => 'none',
            'sm'   => '0 4px 16px rgba(0,0,0,.08)',
            'md'   => '0 8px 40px rgba(0,0,0,.14)',
            'lg'   => '0 20px 60px rgba(0,0,0,.22)',
            'xl'   => '0 32px 80px rgba(0,0,0,.30)',
        ];
        $shadow = $shadows[ $card_shadow ] ?? $shadows['md'];

        // ── Body & background ────────────────────────────────────────────────
        $css  = "html { height: 100%; }";
        $css .= "body.login { background-color: {$bg_color}; min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 20px; box-sizing: border-box; }";

        if ( $bg_image ) {
            $css .= "body.login { background-image: url('{$bg_image}'); background-size: cover; background-position: center; background-repeat: no-repeat; }";
        }
        if ( $bg_image && $overlay > 0 ) {
            $alpha = round( $overlay / 100, 2 );
            $css .= "body.login::before { content: ''; position: fixed; inset: 0; background: rgba(0,0,0,{$alpha}); z-index: 0; }";
        }

        if ( $layout === 'split' ) {
            // ── Split layout ─────────────────────────────────────────────────
            $split_width = $form_width * 2;
            $css .= "#login { display: flex; flex-direction: row; background: {$card_bg}; border-radius: {$card_radius}px; box-shadow: {$shadow}; width: 100%; max-width: {$split_width}px; padding: 0; overflow: hidden; position: relative; z-index: 1; margin: 0 auto; min-height: 500px; }";

            // Form panel — left side
            $css .= "#login > h1, #login > form, #login > #nav, #login > #backtoblog, #login > .wmp-login-footer, #login > .login-footer { position: relative; z-index: 1; flex-shrink: 0; width: 50%; box-sizing: border-box; }";
            $css .= "#login > h1 { padding: 44px 44px 0; margin: 0; }";
            $css .= "#login > form { padding: 0 44px 0; margin-top: 20px; }";
            $css .= "#login > #nav, #login > #backtoblog { padding: 8px 44px; }";
            $css .= "#login > .wmp-login-footer, #login > .login-footer { padding: 8px 44px 32px; }";
            $css .= ".login h1 { text-align: left; margin-bottom: 4px; }";

            // Heading + subtitle in split mode
            $css .= ".wmp-heading { font-size: 26px; font-weight: 800; color: {$text_color}; margin: 0 0 6px; line-height: 1.2; }";
            $css .= ".wmp-heading-sub { font-size: 14px; color: #64748b; margin: 0 0 24px; }";

            // Brand panel — right side, injected div
            $brand_bg_image_css = $brand_image ? "background-image: url('{$brand_image}'); background-size: cover; background-position: center;" : '';
            $css .= "#wmp-brand-panel { flex: 1; background-color: {$brand_color}; {$brand_bg_image_css} display: flex; align-items: center; justify-content: center; border-radius: 0 {$card_radius}px {$card_radius}px 0; }";
            $css .= "#wmp-brand-panel img { max-width: 60%; max-height: 120px; object-fit: contain; }";
            $css .= "#wmp-brand-panel .wmp-brand-placeholder { width: 80px; height: 80px; border: 2px solid rgba(0,0,0,.12); border-radius: 12px; display: flex; align-items: center; justify-content: center; }";

            // Full-width button in split layout
            $css .= ".wp-core-ui .button-primary { float: none; width: 100%; text-align: center; display: block; }";
            $css .= "p.submit { margin: 16px 0 0; }";
            $css .= "p.forgetmenot { display: none; }"; // hide Remember Me in split (clean look)
            $css .= "#loginform p.submit { overflow: visible; }";
            $css .= "#nav { text-align: center; }";
            $css .= "#backtoblog { text-align: center; }";

        } else {
            // ── Centered layout (default) ─────────────────────────────────────
            $css .= "#login { background: {$card_bg}; border-radius: {$card_radius}px; padding: 40px 40px 32px; box-shadow: {$shadow}; width: 100%; max-width: {$form_width}px; position: relative; z-index: 1; margin: 0 auto; }";
            $css .= ".login h1 { text-align: center; margin-bottom: 24px; }";
            if ( $logo ) {
                $css .= ".login h1 a { background-image: url('{$logo}'); background-size: contain; background-repeat: no-repeat; background-position: center; width: 100%; max-width: 200px; height: 72px; display: block; margin: 0 auto; text-indent: -9999px; }";
            } else {
                $css .= ".login h1 a { display: none; }";
            }
            $css .= ".wmp-heading { font-size: 22px; font-weight: 700; color: {$text_color}; text-align: center; margin: 0 0 4px; }";
            $css .= ".wmp-heading-sub { font-size: 13px; color: #64748b; text-align: center; margin: 0 0 20px; }";
            $css .= "p.forgetmenot { float: left; margin: 0; }";
            $css .= "p.submit { margin: 0; }";
            if ( $btn_full ) {
                $css .= ".wp-core-ui .button-primary { float: none; width: 100%; display: block; margin-top: 4px; }";
                $css .= "#loginform p.submit { overflow: visible; }";
                $css .= "p.forgetmenot { float: none; margin-bottom: 8px; }";
            } else {
                $css .= ".wp-core-ui .button-primary { float: right; }";
                $css .= "#loginform p.submit { overflow: hidden; }";
            }
        }

        // ── Shared styles (both layouts) ─────────────────────────────────────
        $css .= ".login label { color: {$text_color}; font-size: 13px; font-weight: 600; }";
        $css .= ".login input[type='text'], .login input[type='password'], .login input[type='email'] { border: 1.5px solid #e2e8f0; border-radius: {$input_radius}px; padding: 10px 14px; font-size: 14px; color: {$text_color}; background: #f8fafc; width: 100%; box-sizing: border-box; transition: border-color .2s, box-shadow .2s; }";
        $css .= ".login input[type='text']:focus, .login input[type='password']:focus { border-color: {$btn_color}; box-shadow: 0 0 0 3px {$btn_color}25; outline: none; background: #fff; }";
        $css .= ".wp-pwd { position: relative; }";
        $css .= ".wp-hide-pw { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #94a3b8; padding: 4px; }";
        $css .= "p.forgetmenot label { font-weight: 400; color: {$text_color}; font-size: 13px; }";
        $css .= ".wp-core-ui .button-primary { background: {$btn_color}; border: none; border-radius: {$input_radius}px; padding: 11px 20px; font-size: 14px; font-weight: 600; letter-spacing: .3px; color: #fff; cursor: pointer; transition: filter .2s, transform .1s; box-shadow: 0 2px 8px {$btn_color}55; }";
        $css .= ".wp-core-ui .button-primary:hover { filter: brightness(1.08); transform: translateY(-1px); }";
        $css .= ".wp-core-ui .button-primary:active { transform: translateY(0); }";
        $css .= "#nav, #backtoblog { margin-top: 12px; }";
        $css .= "#nav a, #backtoblog a { color: {$link_color}; font-size: 13px; text-decoration: none; }";
        $css .= "#nav a:hover, #backtoblog a:hover { text-decoration: underline; }";
        $css .= "#login_error, .login .message, .login .success { border-radius: {$input_radius}px; border-left-color: {$btn_color}; font-size: 13px; }";
        $css .= ".wmp-login-footer { text-align: center; font-size: 12px; color: #64748b; margin-top: 8px; }";

        if ( $custom_css ) {
            $css .= "\n/* Custom CSS */\n" . $custom_css;
        }

        // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- values are escaped above
        echo "\n<style id=\"wmp-login-custom\">\n{$css}\n</style>\n";
    }

    /** Hooked to login_header — inject heading, subtitle, and brand panel for split layout. */
    public static function inject_brand_panel(): void {
        if ( ! get_option( self::OPT_LOGIN_ENABLED, false ) ) return;

        $layout      = sanitize_key( get_option( self::OPT_LOGIN_LAYOUT, 'centered' ) );
        $heading     = esc_html( get_option( self::OPT_LOGIN_HEADING, '' ) );
        $heading_sub = esc_html( get_option( self::OPT_LOGIN_HEADING_SUB, '' ) );
        $logo        = esc_url( get_option( self::OPT_LOGIN_LOGO, '' ) );

        // Inject heading + subtitle for both layouts if set
        if ( $heading || $heading_sub ) {
            $site_name = esc_html( get_bloginfo( 'name' ) );
            $h  = $heading ?: $site_name;
            echo '<h2 class="wmp-heading">' . $h . '</h2>';
            if ( $heading_sub ) {
                echo '<p class="wmp-heading-sub">' . $heading_sub . '</p>';
            }
        }

        // Inject brand panel for split layout only
        if ( $layout === 'split' ) {
            echo '<div id="wmp-brand-panel">';
            if ( $logo ) {
                echo '<img src="' . esc_url( $logo ) . '" alt="' . esc_attr( get_bloginfo( 'name' ) ) . '" />';
            } else {
                echo '<div class="wmp-brand-placeholder"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgba(0,0,0,.3)" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg></div>';
            }
            echo '</div>';
        }
    }

    /** Hooked to login_headerurl */
    public static function login_header_url( string $url ): string {
        if ( ! get_option( self::OPT_LOGIN_ENABLED, false ) ) return $url;
        return home_url( '/' );
    }

    /** Hooked to login_headertext */
    public static function login_header_text( string $text ): string {
        if ( ! get_option( self::OPT_LOGIN_ENABLED, false ) ) return $text;
        $heading = get_option( self::OPT_LOGIN_HEADING, '' );
        return $heading ? esc_html( $heading ) : get_bloginfo( 'name' );
    }

    /** Hooked to login_footer — inject custom footer text + privacy/terms links. */
    public static function apply_login_footer(): void {
        if ( ! get_option( self::OPT_LOGIN_ENABLED, false ) ) return;

        $footer = get_option( self::OPT_LOGIN_FOOTER, '' );
        if ( $footer ) {
            echo '<p style="text-align:center;color:#666;font-size:12px;margin-top:12px;">' . esc_html( $footer ) . '</p>';
        }

        // Privacy Policy link (uses WP's built-in privacy page)
        if ( get_option( self::OPT_LOGIN_SHOW_PRIVACY, false ) ) {
            $privacy_url = get_privacy_policy_url();
            if ( $privacy_url ) {
                echo '<p style="text-align:center;font-size:12px;margin-top:8px;"><a href="' . esc_url( $privacy_url ) . '" style="color:#666;text-decoration:none;" rel="noopener">Privacy Policy</a></p>';
            }
        }

        // Custom links HTML (e.g. Terms, Cookie Policy)
        $links_html = get_option( self::OPT_LOGIN_LINKS_HTML, '' );
        if ( $links_html ) {
            echo '<div style="text-align:center;font-size:12px;margin-top:8px;color:#666;">' . wp_kses_post( $links_html ) . '</div>';
        }
    }

    /** Hooked to login_form — inject custom form fields HTML just before the submit button. */
    public static function apply_login_form_fields(): void {
        if ( ! get_option( self::OPT_LOGIN_ENABLED, false ) ) return;

        $form_html = get_option( self::OPT_LOGIN_FORM_HTML, '' );
        if ( $form_html ) {
            // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- saved via wp_kses_post
            echo wp_kses_post( $form_html );
        }
    }

    // ── Admin UI Customiser ────────────────────────────────────────────────────

    public static function get_admin_customiser( WP_REST_Request $request ): WP_REST_Response {
        return new WP_REST_Response( [
            'hidden_menus'   => (array) get_option( self::OPT_HIDDEN_MENUS, [] ),
            'hidden_widgets' => (array) get_option( self::OPT_HIDDEN_WIDGETS, [] ),
            'available_menus'   => self::get_available_menus(),
            'available_widgets' => self::get_available_widgets(),
        ], 200 );
    }

    public static function save_admin_customiser( WP_REST_Request $request ): WP_REST_Response {
        $menus   = $request->get_param( 'hidden_menus' );
        $widgets = $request->get_param( 'hidden_widgets' );

        if ( is_array( $menus ) ) {
            update_option( self::OPT_HIDDEN_MENUS, array_map( 'sanitize_text_field', $menus ) );
        }
        if ( is_array( $widgets ) ) {
            update_option( self::OPT_HIDDEN_WIDGETS, array_map( 'sanitize_text_field', $widgets ) );
        }

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    /** Hooked to admin_menu (priority 999) — remove hidden menu pages. */
    public static function apply_admin_customiser(): void {
        if ( current_user_can( 'manage_options' ) ) return; // Admins always see all menus.

        $hidden = (array) get_option( self::OPT_HIDDEN_MENUS, [] );
        foreach ( $hidden as $slug ) {
            remove_menu_page( $slug );
        }
    }

    /** Hooked to wp_dashboard_setup — remove hidden dashboard widgets. */
    public static function apply_widget_customiser(): void {
        if ( current_user_can( 'manage_options' ) ) return;

        $hidden = (array) get_option( self::OPT_HIDDEN_WIDGETS, [] );
        foreach ( $hidden as $widget_id ) {
            // widget_id format: "id::context::priority"
            $parts = explode( '::', $widget_id );
            if ( count( $parts ) === 3 ) {
                remove_meta_box( $parts[0], 'dashboard', $parts[1] );
            }
        }
    }

    private static function get_available_menus(): array {
        global $menu;
        if ( empty( $menu ) ) return [];

        $items = [];
        foreach ( $menu as $item ) {
            if ( empty( $item[0] ) || empty( $item[2] ) ) continue;
            // Strip HTML tags from menu label
            $label = wp_strip_all_tags( $item[0] );
            $label = preg_replace( '/\s*<span[^>]*>.*<\/span>/i', '', $label );
            $label = trim( $label );
            if ( empty( $label ) || $label === '—' ) continue;
            $items[] = [
                'slug'  => $item[2],
                'label' => $label,
            ];
        }
        return $items;
    }

    private static function get_available_widgets(): array {
        global $wp_meta_boxes;
        if ( empty( $wp_meta_boxes['dashboard'] ) ) return [];

        $items = [];
        foreach ( $wp_meta_boxes['dashboard'] as $context => $priorities ) {
            foreach ( $priorities as $priority => $boxes ) {
                foreach ( $boxes as $id => $box ) {
                    if ( empty( $box['title'] ) ) continue;
                    $items[] = [
                        'id'      => $id . '::' . $context . '::' . $priority,
                        'label'   => wp_strip_all_tags( $box['title'] ),
                        'context' => $context,
                    ];
                }
            }
        }
        return $items;
    }

    // ── Client Report Generator ────────────────────────────────────────────────

    public static function generate_report( WP_REST_Request $request ): WP_REST_Response {
        // Collect site data
        $site_name    = get_bloginfo( 'name' );
        $site_url     = get_site_url();
        $wp_version   = get_bloginfo( 'version' );
        $php_version  = PHP_VERSION;
        $generated_at = current_time( 'F j, Y \a\t g:i A' );

        // Active plugins
        $active_plugins = [];
        foreach ( get_option( 'active_plugins', [] ) as $plugin_file ) {
            $data = get_plugin_data( WP_PLUGIN_DIR . '/' . $plugin_file );
            $update_plugins = get_site_transient( 'update_plugins' );
            $has_update = isset( $update_plugins->response[ $plugin_file ] );
            $active_plugins[] = [
                'name'       => $data['Name'],
                'version'    => $data['Version'],
                'author'     => wp_strip_all_tags( $data['Author'] ),
                'has_update' => $has_update,
            ];
        }

        // Active theme
        $theme = wp_get_theme();
        $update_themes  = get_site_transient( 'update_themes' );
        $theme_has_update = isset( $update_themes->response[ $theme->get_stylesheet() ] );

        // Database size
        global $wpdb;
        $db_size = $wpdb->get_var( "SELECT ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) FROM information_schema.tables WHERE table_schema = DATABASE()" );

        // Backup info
        $backup_dir   = WP_CONTENT_DIR . '/wmp-backups/';
        $last_backup  = 'No backups found';
        if ( is_dir( $backup_dir ) ) {
            $files = glob( $backup_dir . '*.sql' );
            if ( $files ) {
                usort( $files, fn( $a, $b ) => filemtime( $b ) - filemtime( $a ) );
                $last_backup = date( 'F j, Y g:i A', filemtime( $files[0] ) );
            }
        }

        // Security score (from cached scan results or basic checks)
        $ssl_ok        = is_ssl() || ( isset( $_SERVER['HTTP_X_FORWARDED_PROTO'] ) && 'https' === $_SERVER['HTTP_X_FORWARDED_PROTO'] );
        $debug_off     = ! ( defined( 'WP_DEBUG' ) && WP_DEBUG );
        $updates_count = 0;
        if ( is_object( $update_plugins ) && ! empty( $update_plugins->response ) ) {
            $updates_count += count( $update_plugins->response );
        }
        if ( $theme_has_update ) $updates_count++;

        $score = 100;
        if ( ! $ssl_ok )      $score -= 20;
        if ( ! $debug_off )   $score -= 10;
        $score -= min( $updates_count * 5, 30 );
        $score  = max( $score, 0 );

        $report_data = [
            'site_name'      => $site_name,
            'site_url'       => $site_url,
            'generated_at'   => $generated_at,
            'wp_version'     => $wp_version,
            'php_version'    => $php_version,
            'db_size_mb'     => $db_size ? (float) $db_size : 0,
            'ssl'            => $ssl_ok,
            'debug_disabled' => $debug_off,
            'updates_pending'=> $updates_count,
            'last_backup'    => $last_backup,
            'active_plugins' => $active_plugins,
            'theme'          => [
                'name'       => $theme->get( 'Name' ),
                'version'    => $theme->get( 'Version' ),
                'author'     => $theme->get( 'Author' ),
                'has_update' => $theme_has_update,
            ],
            'score'          => $score,
        ];

        return new WP_REST_Response( $report_data, 200 );
    }

    // ── Coming Soon Mode ───────────────────────────────────────────────────────

    public static function get_coming_soon( WP_REST_Request $request ): WP_REST_Response {
        return new WP_REST_Response( [
            'active'        => (bool) get_option( self::OPT_CS_ACTIVE, false ),
            'title'         => (string) get_option( self::OPT_CS_TITLE, 'Coming Soon' ),
            'message'       => (string) get_option( self::OPT_CS_MESSAGE, 'We\'re working on something great. Stay tuned!' ),
            'launch_date'   => (string) get_option( self::OPT_CS_LAUNCH_DATE, '' ),
            'email_capture' => (bool) get_option( self::OPT_CS_EMAIL_CAPTURE, false ),
            'emails'        => (array) get_option( self::OPT_CS_EMAILS, [] ),
            'bg_color'      => (string) get_option( self::OPT_CS_BG_COLOR, '#0f172a' ),
            'accent_color'  => (string) get_option( self::OPT_CS_ACCENT_COLOR, '#6366f1' ),
            'bg_image'      => (string) get_option( self::OPT_CS_BG_IMAGE, '' ),
            'logo_url'      => (string) get_option( self::OPT_CS_LOGO_URL, '' ),
        ], 200 );
    }

    public static function save_coming_soon( WP_REST_Request $request ): WP_REST_Response {
        $fields = [
            'active'        => [ self::OPT_CS_ACTIVE,        'bool'  ],
            'title'         => [ self::OPT_CS_TITLE,         'text'  ],
            'message'       => [ self::OPT_CS_MESSAGE,       'text'  ],
            'launch_date'   => [ self::OPT_CS_LAUNCH_DATE,   'text'  ],
            'email_capture' => [ self::OPT_CS_EMAIL_CAPTURE, 'bool'  ],
            'bg_color'      => [ self::OPT_CS_BG_COLOR,      'color' ],
            'accent_color'  => [ self::OPT_CS_ACCENT_COLOR,  'color' ],
            'bg_image'      => [ self::OPT_CS_BG_IMAGE,      'url'   ],
            'logo_url'      => [ self::OPT_CS_LOGO_URL,      'url'   ],
        ];

        foreach ( $fields as $param => [ $opt, $type ] ) {
            $val = $request->get_param( $param );
            if ( null === $val ) continue;
            switch ( $type ) {
                case 'bool':  update_option( $opt, (bool) $val ); break;
                case 'color': update_option( $opt, sanitize_hex_color( $val ) ?: $val ); break;
                case 'url':   update_option( $opt, esc_url_raw( $val ) ); break;
                default:      update_option( $opt, sanitize_text_field( $val ) ); break;
            }
        }

        return new WP_REST_Response( [ 'success' => true, 'active' => (bool) get_option( self::OPT_CS_ACTIVE ) ], 200 );
    }

    public static function clear_coming_soon_emails( WP_REST_Request $request ): WP_REST_Response {
        delete_option( self::OPT_CS_EMAILS );
        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    /**
     * Hooked to template_redirect — show coming soon page to non-admins.
     */
    public static function apply_coming_soon(): void {
        if ( ! get_option( self::OPT_CS_ACTIVE, false ) ) return;
        if ( current_user_can( 'manage_options' ) ) return;
        if ( is_admin() ) return;

        // Allow WP login/logout
        if ( $GLOBALS['pagenow'] ?? '' === 'wp-login.php' ) return;

        // Handle email capture POST
        if ( isset( $_POST['wmp_cs_email'] ) ) {
            $email = sanitize_email( wp_unslash( $_POST['wmp_cs_email'] ) );
            if ( is_email( $email ) && get_option( self::OPT_CS_EMAIL_CAPTURE, false ) ) {
                $emails = (array) get_option( self::OPT_CS_EMAILS, [] );
                if ( ! in_array( $email, $emails, true ) ) {
                    $emails[] = $email;
                    update_option( self::OPT_CS_EMAILS, $emails );
                }
            }
        }

        $title         = esc_html( get_option( self::OPT_CS_TITLE, 'Coming Soon' ) );
        $message       = esc_html( get_option( self::OPT_CS_MESSAGE, "We're working on something great. Stay tuned!" ) );
        $launch_date   = get_option( self::OPT_CS_LAUNCH_DATE, '' );
        $email_capture = (bool) get_option( self::OPT_CS_EMAIL_CAPTURE, false );
        $bg_color      = esc_attr( get_option( self::OPT_CS_BG_COLOR, '#0f172a' ) );
        $accent_color  = esc_attr( get_option( self::OPT_CS_ACCENT_COLOR, '#6366f1' ) );
        $bg_image      = esc_url( get_option( self::OPT_CS_BG_IMAGE, '' ) );
        $logo_url      = esc_url( get_option( self::OPT_CS_LOGO_URL, '' ) );
        $site_name     = esc_html( get_bloginfo( 'name' ) );

        $countdown_js = '';
        if ( $launch_date ) {
            $ts = strtotime( $launch_date );
            if ( $ts ) {
                $countdown_js = sprintf( '
                    var target = %d * 1000;
                    function tick() {
                        var now  = Date.now();
                        var diff = Math.max(0, target - now);
                        var d = Math.floor(diff / 86400000);
                        var h = Math.floor((diff %% 86400000) / 3600000);
                        var m = Math.floor((diff %% 3600000) / 60000);
                        var s = Math.floor((diff %% 60000) / 1000);
                        var ed = document.getElementById("wmp-d"); if (ed) ed.textContent = d;
                        var eh = document.getElementById("wmp-h"); if (eh) eh.textContent = h;
                        var em = document.getElementById("wmp-m"); if (em) em.textContent = m;
                        var es = document.getElementById("wmp-s"); if (es) es.textContent = s;
                        if (diff > 0) setTimeout(tick, 1000);
                    }
                    tick();
                ', $ts );
            }
        }

        $email_form = '';
        if ( $email_capture ) {
            $current_url = esc_url( ( is_ssl() ? 'https' : 'http' ) . '://' . ( $_SERVER['HTTP_HOST'] ?? '' ) . ( $_SERVER['REQUEST_URI'] ?? '/' ) );
            $email_form  = sprintf(
                '<form method="post" action="%s" class="wmp-cs-form">
                    <input type="email" name="wmp_cs_email" placeholder="Enter your email" required>
                    <button type="submit">Notify Me</button>
                </form>',
                $current_url
            );
        }

        status_header( 200 );
        nocache_headers();

        $bg_css = $bg_image
            ? "background: url('{$bg_image}') center/cover no-repeat; background-color: {$bg_color};"
            : "background: {$bg_color};";

        $logo_html = $logo_url
            ? "<img src='{$logo_url}' alt='{$site_name}' style='max-height:70px;max-width:260px;object-fit:contain;margin-bottom:1.5rem;display:block;margin-left:auto;margin-right:auto;'>"
            : "<div style='font-size:2.5rem;margin-bottom:1rem'>🚀</div>";

        echo '<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>' . $title . ' — ' . $site_name . '</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' . $bg_css . 'color:#f8fafc;min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2rem}
  .wmp-cs-inner{max-width:600px;width:100%}
  h1{font-size:clamp(2rem,5vw,3rem);font-weight:800;letter-spacing:-.03em;margin-bottom:1rem;line-height:1.1}
  .wmp-cs-sub{font-size:1.125rem;color:rgba(248,250,252,.7);line-height:1.7;margin-bottom:2rem}
  #wmp-cs-countdown{display:flex;gap:1rem;justify-content:center;margin-bottom:2.5rem;flex-wrap:wrap}
  .wmp-cs-unit{background:rgba(255,255,255,.08);backdrop-filter:blur(8px);border:1px solid rgba(255,255,255,.1);border-radius:.75rem;padding:.75rem 1.25rem;min-width:70px}
  .wmp-cs-unit span{display:block;font-size:1.75rem;font-weight:700;color:' . $accent_color . ';line-height:1}
  .wmp-cs-unit small{display:block;font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:rgba(248,250,252,.5);margin-top:.25rem}
  .wmp-cs-form{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center}
  .wmp-cs-form input{flex:1;min-width:220px;padding:.7rem 1.1rem;border-radius:.5rem;border:1.5px solid rgba(255,255,255,.15);background:rgba(255,255,255,.07);color:#f8fafc;font-size:1rem;outline:none;transition:border-color .2s}
  .wmp-cs-form input::placeholder{color:rgba(248,250,252,.4)}
  .wmp-cs-form input:focus{border-color:' . $accent_color . '}
  .wmp-cs-form button{padding:.7rem 1.75rem;background:' . $accent_color . ';color:#fff;border:none;border-radius:.5rem;font-size:1rem;font-weight:600;cursor:pointer;transition:filter .2s,transform .15s}
  .wmp-cs-form button:hover{filter:brightness(1.12);transform:translateY(-1px)}
  .wmp-cs-divider{width:3rem;height:3px;background:' . $accent_color . ';border-radius:2px;margin:0 auto 2rem}
</style>
</head>
<body>
  <div class="wmp-cs-inner">
    ' . $logo_html . '
    <h1>' . $title . '</h1>
    <div class="wmp-cs-divider"></div>
    <p class="wmp-cs-sub">' . $message . '</p>
    ' . ( $launch_date ? '<div id="wmp-cs-countdown"><div class="wmp-cs-unit"><span id="wmp-d">0</span><small>Days</small></div><div class="wmp-cs-unit"><span id="wmp-h">0</span><small>Hours</small></div><div class="wmp-cs-unit"><span id="wmp-m">0</span><small>Mins</small></div><div class="wmp-cs-unit"><span id="wmp-s">0</span><small>Secs</small></div></div>' : '' ) . '
    ' . $email_form . '
  </div>
  ' . ( $countdown_js ? '<script>' . $countdown_js . '</script>' : '' ) . '
</body>
</html>';
        exit;
    }
}
