<?php
namespace WP_Manager_Pro;

if ( ! defined( 'ABSPATH' ) ) exit;

class Admin {

    public static function add_plugin_links( $links ) {
        $open_link = '<a href="' . admin_url( 'admin.php?page=wp-manager-pro' ) . '">' . __( 'Open', 'wp-manager-pro' ) . '</a>';
        array_unshift( $links, $open_link );
        return $links;
    }

    public static function add_plugin_meta( $plugin_meta, $plugin_file ) {
        if ( WP_MANAGER_PRO_BASENAME !== $plugin_file ) {
            return $plugin_meta;
        }

        $plugin_meta[] = '<a href="https://github.com/nurkamol/wp-manager-pro#faq" target="_blank" rel="noopener">' . __( 'FAQ', 'wp-manager-pro' ) . '</a>';
        $plugin_meta[] = '<a href="https://github.com/nurkamol/wp-manager-pro/blob/main/CHANGELOG.md" target="_blank" rel="noopener">' . __( 'Changelog', 'wp-manager-pro' ) . '</a>';

        return $plugin_meta;
    }

    public static function register_menu() {
        // Custom SVG: 3 stat cards + 3 management bars — clean dashboard icon.
        $icon = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">'
            . '<rect fill="#a0a5aa" x="1" y="1" width="5" height="5" rx="1"/>'
            . '<rect fill="#a0a5aa" x="7.5" y="1" width="5" height="5" rx="1"/>'
            . '<rect fill="#a0a5aa" x="14" y="1" width="5" height="5" rx="1"/>'
            . '<rect fill="#a0a5aa" x="1" y="9" width="18" height="2" rx="1"/>'
            . '<rect fill="#a0a5aa" x="1" y="13" width="12" height="2" rx="1"/>'
            . '<rect fill="#a0a5aa" x="1" y="17" width="15" height="2" rx="1"/>'
            . '</svg>';

        $menu_label = get_option( 'wmp_menu_label', '' );
        if ( empty( $menu_label ) ) {
            $menu_label = __( 'WP Manager', 'wp-manager-pro' );
        }

        add_menu_page(
            __( 'WP Manager Pro', 'wp-manager-pro' ),
            $menu_label,
            'manage_options',
            'wp-manager-pro',
            [ self::class, 'render_page' ],
            'data:image/svg+xml;base64,' . base64_encode( $icon ),
            2
        );
    }

    public static function enqueue_assets( $hook ) {
        if ( 'toplevel_page_wp-manager-pro' !== $hook ) {
            return;
        }

        $build_dir = WP_MANAGER_PRO_PATH . 'assets/build/';
        $build_url = WP_MANAGER_PRO_URL . 'assets/build/';

        // Enqueue main CSS (Vite outputs as style.css or index.css).
        // Use filemtime() as the version so the browser always fetches the
        // latest build after a deploy — no manual version bump required.
        $css_file = file_exists( $build_dir . 'index.css' ) ? 'index.css' : 'style.css';
        if ( file_exists( $build_dir . $css_file ) ) {
            wp_enqueue_style(
                'wp-manager-pro',
                $build_url . $css_file,
                [],
                filemtime( $build_dir . $css_file )
            );
        }

        // Enqueue main JS.
        if ( file_exists( $build_dir . 'index.js' ) ) {
            wp_enqueue_script(
                'wp-manager-pro',
                $build_url . 'index.js',
                [],
                filemtime( $build_dir . 'index.js' ),
                true
            );

            wp_localize_script( 'wp-manager-pro', 'wpManagerPro', [
                'apiUrl'   => rest_url( 'wp-manager-pro/v1' ),
                'nonce'    => wp_create_nonce( 'wp_rest' ),
                'siteUrl'  => get_site_url(),
                'adminUrl' => admin_url(),
                'version'  => WP_MANAGER_PRO_VERSION,
                'user'     => [
                    'name'   => wp_get_current_user()->display_name,
                    'email'  => wp_get_current_user()->user_email,
                    'avatar' => get_avatar_url( get_current_user_id(), [ 'size' => 40 ] ),
                ],
                'branding' => [
                    'pluginName' => get_option( 'wmp_plugin_name', '' ),
                    'menuLabel'  => get_option( 'wmp_menu_label', '' ),
                    'logoUrl'    => get_option( 'wmp_logo_url', '' ),
                ],
            ] );
        }

        // Dequeue WordPress's own command palette (WP 6.3+) on our page.
        // Our plugin ships its own palette — having both causes Cmd+K conflicts.
        wp_dequeue_script( 'wp-commands' );
        wp_dequeue_script( 'wp-command-palette' );
        add_action( 'admin_print_scripts', function() {
            // Block the commands package loaded inline by Gutenberg core
            wp_dequeue_script( 'wp-commands' );
        }, 100 );

        // Suppress third-party admin notices on our full-screen page.
        // remove_all_actions clears callbacks already registered by the time
        // admin_enqueue_scripts fires (covers admin_init / early-registered notices).
        remove_all_actions( 'admin_notices' );
        remove_all_actions( 'all_admin_notices' );
        remove_all_actions( 'network_admin_notices' );
        remove_all_actions( 'user_admin_notices' );

        // Remove conflicting admin styles to give our app full control.
        // The notice CSS below catches anything registered after this point
        // (e.g. plugins that hook admin_head to add notices).
        add_action( 'admin_head', function() {
            echo '<style>
                #wpcontent { padding-left: 0 !important; }
                #wpbody-content { padding-bottom: 0 !important; }
                .wp-manager-pro-page #wpcontent,
                .wp-manager-pro-page #wpbody { padding: 0 !important; }
                #wpfooter { display: none; }
                #wpwrap { background: #f0f2f5; }

                /* Hide any notice that slips through after admin_enqueue_scripts */
                body.toplevel_page_wp-manager-pro .notice,
                body.toplevel_page_wp-manager-pro .notice-warning,
                body.toplevel_page_wp-manager-pro .notice-error,
                body.toplevel_page_wp-manager-pro .notice-info,
                body.toplevel_page_wp-manager-pro .notice-success,
                body.toplevel_page_wp-manager-pro div.error,
                body.toplevel_page_wp-manager-pro div.updated,
                body.toplevel_page_wp-manager-pro .update-nag {
                    display: none !important;
                }
            </style>';
        } );
    }

    public static function render_page() {
        echo '<div id="wp-manager-pro-root" class="wp-manager-pro-page"></div>';
    }

    // ── Admin Bar Maintenance Toggle ───────────────────────────────────────────

    /**
     * Add maintenance mode toggle node to the WP admin bar.
     * Visible on both frontend and backend for administrators.
     *
     * @param \WP_Admin_Bar $wp_admin_bar
     */
    public static function add_maintenance_bar_item( \WP_Admin_Bar $wp_admin_bar ) {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        // Respect the "Show in Admin Bar" setting (default OFF for fresh installs).
        if ( ! (bool) get_option( 'wmp_maintenance_show_adminbar_toggle', false ) ) {
            return;
        }

        $active = (bool) get_option( 'wmp_maintenance_active', false );

        $toggle = sprintf(
            '<span class="wmp-ab-icon">⚙</span>'
            . '<span class="wmp-ab-label">%s</span>'
            . '<span class="wmp-ab-toggle" data-active="%s" title="%s"><span class="wmp-ab-knob"></span></span>',
            esc_html__( 'Maintenance', 'wp-manager-pro' ),
            $active ? '1' : '0',
            $active
                ? esc_attr__( 'Maintenance is ON — click to disable', 'wp-manager-pro' )
                : esc_attr__( 'Maintenance is OFF — click to enable', 'wp-manager-pro' )
        );

        $wp_admin_bar->add_node( [
            'id'     => 'wmp-maintenance',
            'title'  => $toggle,
            'href'   => '#',
            'meta'   => [
                'class' => 'wmp-maintenance-item' . ( $active ? ' wmp-maint-active' : '' ),
            ],
        ] );
    }

    // ── Admin Bar Redis Cache Node ─────────────────────────────────────────────

    /**
     * Add a Redis Cache node to the admin bar when the object cache drop-in is
     * active and Redis is reachable. Shows Flush Cache + link to settings.
     *
     * @param \WP_Admin_Bar $wp_admin_bar
     */
    public static function add_redis_bar_item( \WP_Admin_Bar $wp_admin_bar ) {
        if ( ! current_user_can( 'manage_options' ) ) {
            return;
        }

        // Respect the show/hide setting (default ON).
        if ( ! (bool) get_option( 'wmp_redis_show_adminbar', 1 ) ) {
            return;
        }

        // Only show when our (or any) object-cache drop-in is installed.
        if ( ! file_exists( WP_CONTENT_DIR . '/object-cache.php' ) ) {
            return;
        }

        // Require our drop-in's is_connected() method on the global cache object.
        global $wp_object_cache;
        if ( ! isset( $wp_object_cache ) || ! method_exists( $wp_object_cache, 'is_connected' ) ) {
            return;
        }
        if ( ! $wp_object_cache->is_connected() ) {
            return;
        }

        // Grab Redis version for the badge.
        $redis_ver = '';
        if ( method_exists( $wp_object_cache, 'get_redis_server_info' ) ) {
            $info = $wp_object_cache->get_redis_server_info();
            if ( ! empty( $info['redis_version'] ) ) {
                $redis_ver = esc_html( $info['redis_version'] );
            }
        }

        $plugin_url = admin_url( 'admin.php?page=wp-manager-pro#/performance' );

        // Parent node.
        $title = '<span class="wmp-redis-dot"></span>'
               . '<span class="wmp-redis-label">Redis Cache</span>'
               . ( $redis_ver ? '<span class="wmp-redis-ver">' . $redis_ver . '</span>' : '' );

        $wp_admin_bar->add_node( [
            'id'    => 'wmp-redis',
            'title' => $title,
            'href'  => $plugin_url,
            'meta'  => [ 'class' => 'wmp-redis-item' ],
        ] );

        // Sub-node: Flush Cache.
        $wp_admin_bar->add_node( [
            'id'     => 'wmp-redis-flush',
            'parent' => 'wmp-redis',
            'title'  => '🗑&nbsp; Flush Cache',
            'href'   => '#',
            'meta'   => [ 'class' => 'wmp-redis-flush-btn' ],
        ] );

        // Sub-node: Go to settings.
        $wp_admin_bar->add_node( [
            'id'     => 'wmp-redis-settings',
            'parent' => 'wmp-redis',
            'title'  => '⚙&nbsp; Object Cache Settings',
            'href'   => $plugin_url,
        ] );
    }

    /**
     * Enqueue inline CSS + JS for the admin bar maintenance toggle.
     * Hooked to both wp_enqueue_scripts (frontend) and admin_enqueue_scripts (backend).
     */
    public static function enqueue_admin_bar_assets() {
        if ( ! is_admin_bar_showing() || ! current_user_can( 'manage_options' ) ) {
            return;
        }

        $api_url = esc_url_raw( rest_url( 'wp-manager-pro/v1/maintenance/toggle' ) );
        $nonce   = wp_create_nonce( 'wp_rest' );

        // ── Styles ──────────────────────────────────────────────────────────────
        wp_register_style( 'wmp-adminbar', false, [], WP_MANAGER_PRO_VERSION ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion
        wp_enqueue_style( 'wmp-adminbar' );
        wp_add_inline_style( 'wmp-adminbar', '
            /* Use #wpadminbar prefix throughout to beat WP admin bar specificity */
            #wpadminbar #wp-admin-bar-wmp-maintenance > .ab-item {
                display: flex !important;
                align-items: center !important;
                gap: 7px !important;
                cursor: pointer !important;
                padding: 0 12px !important;
                user-select: none !important;
                line-height: 1 !important;
            }
            #wpadminbar #wp-admin-bar-wmp-maintenance .wmp-ab-icon {
                font-size: 13px !important;
                line-height: 1 !important;
                opacity: .85 !important;
                width: auto !important;
                height: auto !important;
            }
            #wpadminbar #wp-admin-bar-wmp-maintenance .wmp-ab-label {
                font-size: 13px !important;
                font-weight: 500 !important;
                width: auto !important;
                height: auto !important;
            }
            /* Toggle pill — all dims !important to override WP span resets */
            #wpadminbar #wp-admin-bar-wmp-maintenance .wmp-ab-toggle {
                display: inline-flex !important;
                align-items: center !important;
                width: 38px !important;
                height: 20px !important;
                min-width: 38px !important;
                min-height: 20px !important;
                background: #555d65 !important;
                border-radius: 10px !important;
                position: relative !important;
                transition: background .22s !important;
                flex-shrink: 0 !important;
                margin-left: 2px !important;
                overflow: visible !important;
                vertical-align: middle !important;
            }
            #wpadminbar #wp-admin-bar-wmp-maintenance .wmp-ab-toggle[data-active="1"] {
                background: #e05252 !important;
            }
            /* Knob */
            #wpadminbar #wp-admin-bar-wmp-maintenance .wmp-ab-knob {
                display: block !important;
                width: 14px !important;
                height: 14px !important;
                min-width: 14px !important;
                min-height: 14px !important;
                background: #fff !important;
                border-radius: 50% !important;
                position: absolute !important;
                top: 50% !important;
                left: 3px !important;
                transform: translateY(-50%) !important;
                transition: left .22s !important;
                box-shadow: 0 1px 3px rgba(0,0,0,.35) !important;
            }
            #wpadminbar #wp-admin-bar-wmp-maintenance .wmp-ab-toggle[data-active="1"] .wmp-ab-knob {
                left: 21px !important;
            }
            /* Loading state */
            #wpadminbar #wp-admin-bar-wmp-maintenance.wmp-ab-loading .wmp-ab-toggle {
                opacity: .5 !important;
                pointer-events: none !important;
            }
            /* Active (maintenance ON) bar highlight */
            #wpadminbar #wp-admin-bar-wmp-maintenance.wmp-maint-active > .ab-item {
                background: rgba(224,82,82,.2) !important;
            }
            #wpadminbar #wp-admin-bar-wmp-maintenance.wmp-maint-active > .ab-item:hover {
                background: rgba(224,82,82,.32) !important;
            }
        ' );

        // ── Script ──────────────────────────────────────────────────────────────
        wp_register_script( 'wmp-adminbar', false, [], WP_MANAGER_PRO_VERSION, true ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.MissingVersion
        wp_enqueue_script( 'wmp-adminbar' );
        wp_add_inline_script( 'wmp-adminbar', sprintf(
            '(function(){
                var API = %s;
                var NON = %s;

                function wmpBindMaintenanceToggle() {
                    var bar = document.getElementById("wp-admin-bar-wmp-maintenance");
                    if (!bar) return;
                    var link   = bar.querySelector(".ab-item");
                    var toggle = bar.querySelector(".wmp-ab-toggle");
                    if (!link || !toggle || bar.dataset.wmpBound) return;
                    bar.dataset.wmpBound = "1";

                    link.addEventListener("click", function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (bar.classList.contains("wmp-ab-loading")) return;

                        var isActive = toggle.dataset.active === "1";
                        bar.classList.add("wmp-ab-loading");

                        fetch(API, {
                            method:  "POST",
                            headers: {
                                "Content-Type": "application/json",
                                "X-WP-Nonce":   NON
                            },
                            body: JSON.stringify({ enable: !isActive })
                        })
                        .then(function(r) { return r.json(); })
                        .then(function(data) {
                            var on = !!data.active;
                            toggle.dataset.active = on ? "1" : "0";
                            toggle.title = on
                                ? "Maintenance is ON \u2014 click to disable"
                                : "Maintenance is OFF \u2014 click to enable";
                            bar.classList.toggle("wmp-maint-active", on);
                        })
                        .catch(function(err) { console.error("[WP Manager] toggle error", err); })
                        .finally(function() { bar.classList.remove("wmp-ab-loading"); });
                    });
                }

                /* Run immediately — footer scripts execute after admin bar HTML is in DOM.
                   Also listen for DOMContentLoaded as a fallback for edge cases. */
                wmpBindMaintenanceToggle();
                document.addEventListener("DOMContentLoaded", wmpBindMaintenanceToggle);
            })();',
            wp_json_encode( $api_url ),
            wp_json_encode( $nonce )
        ) );

        // ── Redis admin bar CSS ──────────────────────────────────────────────────
        wp_add_inline_style( 'wmp-adminbar', '
            #wpadminbar #wp-admin-bar-wmp-redis > .ab-item {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                padding: 0 12px !important;
            }
            #wpadminbar #wp-admin-bar-wmp-redis .wmp-redis-dot {
                display: inline-block !important;
                width: 8px !important;
                height: 8px !important;
                min-width: 8px !important;
                min-height: 8px !important;
                border-radius: 50% !important;
                background: #22c55e !important;
                box-shadow: 0 0 0 2px rgba(34,197,94,.25) !important;
                flex-shrink: 0 !important;
            }
            #wpadminbar #wp-admin-bar-wmp-redis .wmp-redis-label {
                font-size: 13px !important;
                font-weight: 500 !important;
            }
            #wpadminbar #wp-admin-bar-wmp-redis .wmp-redis-ver {
                font-size: 10px !important;
                background: rgba(34,197,94,.18) !important;
                color: #86efac !important;
                border-radius: 4px !important;
                padding: 1px 5px !important;
                font-weight: 600 !important;
                letter-spacing: .02em !important;
            }
            #wpadminbar #wp-admin-bar-wmp-redis-flush.wmp-redis-flushing > .ab-item {
                opacity: .55 !important;
                pointer-events: none !important;
            }
            .wmp-redis-toast {
                position: fixed !important;
                bottom: 24px !important;
                right: 24px !important;
                z-index: 999999 !important;
                padding: 10px 18px !important;
                border-radius: 7px !important;
                font-size: 13px !important;
                font-weight: 500 !important;
                color: #fff !important;
                box-shadow: 0 4px 14px rgba(0,0,0,.22) !important;
                transition: opacity .3s !important;
                pointer-events: none !important;
            }
        ' );

        // ── Redis admin bar JS ───────────────────────────────────────────────────
        $flush_url = esc_url_raw( rest_url( 'wp-manager-pro/v1/performance/object-cache/flush' ) );
        $flush_nonce = wp_create_nonce( 'wp_rest' );

        wp_add_inline_script( 'wmp-adminbar', sprintf(
            '(function(){
                var FLUSH_API = %s;
                var FLUSH_NON = %s;

                function wmpRedisToast(msg, ok) {
                    var d = document.createElement("div");
                    d.className = "wmp-redis-toast";
                    d.style.background = ok ? "#22c55e" : "#ef4444";
                    d.textContent = msg;
                    document.body.appendChild(d);
                    setTimeout(function(){ d.style.opacity = "0"; setTimeout(function(){ if(d.parentNode) d.parentNode.removeChild(d); }, 350); }, 2600);
                }

                function wmpBindRedisFlush() {
                    var btn = document.getElementById("wp-admin-bar-wmp-redis-flush");
                    if (!btn || btn.dataset.wmpBound) return;
                    btn.dataset.wmpBound = "1";
                    var link = btn.querySelector(".ab-item");
                    if (!link) return;
                    link.addEventListener("click", function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        if (btn.classList.contains("wmp-redis-flushing")) return;
                        btn.classList.add("wmp-redis-flushing");
                        fetch(FLUSH_API, {
                            method: "POST",
                            headers: { "Content-Type": "application/json", "X-WP-Nonce": FLUSH_NON },
                            body: "{}"
                        })
                        .then(function(r){ return r.json(); })
                        .then(function(data){
                            wmpRedisToast(data.message || "Redis cache cleared", true);
                        })
                        .catch(function(){ wmpRedisToast("Flush failed — check connection", false); })
                        .finally(function(){ btn.classList.remove("wmp-redis-flushing"); });
                    });
                }

                wmpBindRedisFlush();
                document.addEventListener("DOMContentLoaded", wmpBindRedisFlush);
            })();',
            wp_json_encode( $flush_url ),
            wp_json_encode( $flush_nonce )
        ) );
    }
}
