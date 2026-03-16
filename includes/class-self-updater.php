<?php
namespace WP_Manager_Pro;

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Self_Updater
 *
 * Integrates WP Manager Pro with WordPress's native plugin update system
 * using GitHub Releases as the update source.
 *
 * - Hooks into pre_set_site_transient_update_plugins to inject update data.
 * - Hooks into plugins_api to supply changelog / plugin info.
 * - Caches GitHub API responses for 12 hours (transient).
 * - Shows "View Changelog" link in the Plugins list update row.
 */
class Self_Updater {

    const TRANSIENT_KEY  = 'wmp_github_update_data';
    const GITHUB_REPO    = 'nurkamol/wp-manager-pro';
    const CACHE_LIFETIME = 43200; // 12 hours

    public static function init(): void {
        add_filter( 'pre_set_site_transient_update_plugins', [ self::class, 'check_for_update' ] );
        add_filter( 'plugins_api',  [ self::class, 'plugin_info' ], 10, 3 );
        add_action( 'in_plugin_update_message-' . WP_MANAGER_PRO_BASENAME, [ self::class, 'update_message' ], 10, 2 );
        add_action( 'upgrader_process_complete', [ self::class, 'after_update' ], 10, 2 );
    }

    // ── Inject update data into WP's transient ────────────────────────────────

    public static function check_for_update( $transient ) {
        if ( empty( $transient->checked ) ) {
            return $transient;
        }

        $release = self::get_latest_release();
        if ( ! $release ) {
            return $transient;
        }

        $latest_version = ltrim( $release['tag_name'], 'v' );

        if ( version_compare( $latest_version, WP_MANAGER_PRO_VERSION, '>' ) ) {
            $transient->response[ WP_MANAGER_PRO_BASENAME ] = (object) [
                'id'            => 'github.com/' . self::GITHUB_REPO,
                'slug'          => 'wp-manager-pro',
                'plugin'        => WP_MANAGER_PRO_BASENAME,
                'new_version'   => $latest_version,
                'url'           => 'https://github.com/' . self::GITHUB_REPO,
                'package'       => self::get_download_url( $release ),
                'icons'         => [],
                'banners'       => [],
                'banners_rtl'   => [],
                'tested'        => '',
                'requires_php'  => '7.4',
                'compatibility' => new \stdClass(),
            ];
        } else {
            // No update — set no_update so WP shows "Up to date" correctly.
            $transient->no_update[ WP_MANAGER_PRO_BASENAME ] = (object) [
                'id'          => 'github.com/' . self::GITHUB_REPO,
                'slug'        => 'wp-manager-pro',
                'plugin'      => WP_MANAGER_PRO_BASENAME,
                'new_version' => $latest_version,
                'url'         => 'https://github.com/' . self::GITHUB_REPO,
                'package'     => '',
            ];
        }

        return $transient;
    }

    // ── Supply plugin info for the "View details" modal ───────────────────────

    public static function plugin_info( $result, $action, $args ) {
        if ( 'plugin_information' !== $action ) {
            return $result;
        }

        if ( ! isset( $args->slug ) || 'wp-manager-pro' !== $args->slug ) {
            return $result;
        }

        $release = self::get_latest_release();
        if ( ! $release ) {
            return $result;
        }

        $latest_version = ltrim( $release['tag_name'], 'v' );
        $changelog_html = self::parse_changelog( $release['body'] ?? '' );

        return (object) [
            'name'              => 'WP Manager Pro',
            'slug'              => 'wp-manager-pro',
            'version'           => $latest_version,
            'author'            => '<a href="https://github.com/nurkamol">nurkamol</a>',
            'homepage'          => 'https://github.com/' . self::GITHUB_REPO,
            'requires'          => '5.9',
            'tested'            => get_bloginfo( 'version' ),
            'requires_php'      => '7.4',
            'last_updated'      => $release['published_at'] ?? '',
            'download_link'     => self::get_download_url( $release ),
            'sections'          => [
                'description' => '<p>A comprehensive, agency-ready WordPress management suite — built with React 19, TypeScript, and the WordPress REST API.</p>',
                'changelog'   => $changelog_html ?: '<p>See <a href="https://github.com/' . self::GITHUB_REPO . '/blob/main/CHANGELOG.md" target="_blank">CHANGELOG.md</a> on GitHub.</p>',
            ],
        ];
    }

    // ── Show extra text in the WP Plugins list update row ────────────────────

    public static function update_message( $plugin_data, $response ): void {
        $release = self::get_latest_release();
        if ( ! $release || empty( $release['html_url'] ) ) {
            return;
        }
        printf(
            ' <a href="%s" target="_blank" rel="noopener" style="font-weight:600;">%s &rarr;</a>',
            esc_url( $release['html_url'] ),
            esc_html__( 'View Release Notes', 'wp-manager-pro' )
        );
    }

    // ── Clear cache after a successful self-update ────────────────────────────

    public static function after_update( $upgrader, $hook_extra ): void {
        if (
            isset( $hook_extra['action'], $hook_extra['type'], $hook_extra['plugins'] ) &&
            'update' === $hook_extra['action'] &&
            'plugin' === $hook_extra['type'] &&
            in_array( WP_MANAGER_PRO_BASENAME, (array) $hook_extra['plugins'], true )
        ) {
            delete_transient( self::TRANSIENT_KEY );
        }
    }

    // ── GitHub API helpers ────────────────────────────────────────────────────

    private static function get_latest_release(): ?array {
        $cached = get_transient( self::TRANSIENT_KEY );
        if ( false !== $cached ) {
            return $cached ?: null;
        }

        $api_url  = 'https://api.github.com/repos/' . self::GITHUB_REPO . '/releases/latest';
        $response = wp_remote_get( $api_url, [
            'timeout'    => 10,
            'user-agent' => 'WP-Manager-Pro/' . WP_MANAGER_PRO_VERSION . '; WordPress/' . get_bloginfo( 'version' ),
            'headers'    => [ 'Accept' => 'application/vnd.github.v3+json' ],
        ] );

        if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
            // Cache a failure (empty array) for 30 min to avoid hammering the API.
            set_transient( self::TRANSIENT_KEY, [], 1800 );
            return null;
        }

        $release = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( empty( $release['tag_name'] ) ) {
            set_transient( self::TRANSIENT_KEY, [], 1800 );
            return null;
        }

        set_transient( self::TRANSIENT_KEY, $release, self::CACHE_LIFETIME );
        return $release;
    }

    private static function get_download_url( array $release ): string {
        // Prefer an asset named wp-manager-pro-vX.Y.Z.zip
        if ( ! empty( $release['assets'] ) ) {
            foreach ( $release['assets'] as $asset ) {
                if ( isset( $asset['browser_download_url'] ) && str_ends_with( $asset['name'], '.zip' ) ) {
                    return $asset['browser_download_url'];
                }
            }
        }
        // Fallback: GitHub's auto-generated source zip (won't contain assets/build/)
        return $release['zipball_url'] ?? '';
    }

    private static function parse_changelog( string $markdown ): string {
        if ( empty( $markdown ) ) {
            return '';
        }
        // Minimal Markdown → HTML: headings, bold, bullets
        $html = esc_html( $markdown );
        $html = preg_replace( '/^### (.+)$/m',  '<h4>$1</h4>', $html );
        $html = preg_replace( '/^## (.+)$/m',   '<h3>$1</h3>', $html );
        $html = preg_replace( '/^# (.+)$/m',    '<h2>$1</h2>', $html );
        $html = preg_replace( '/\*\*(.+?)\*\*/', '<strong>$1</strong>', $html );
        $html = preg_replace( '/^[-*] (.+)$/m',  '<li>$1</li>', $html );
        $html = preg_replace( '/(<li>.*<\/li>)/s', '<ul>$1</ul>', $html );
        $html = nl2br( $html );
        return $html;
    }
}
