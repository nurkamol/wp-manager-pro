<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

/**
 * Security Scanner Controller — v2.7.0
 *
 * Endpoints:
 *  GET  /scanner/malware       — scan plugin/theme PHP files for malicious patterns
 *  GET  /scanner/vulns         — check installed plugins/themes against WPScan CVE feed
 *  GET  /scanner/ssl           — verify SSL certificate validity and expiry
 *  GET  /scanner/core          — compare WP version + PHP EOL status
 *  POST /scanner/api-key       — save WPScan API key
 */
class Security_Scanner_Controller {

    // ── Malware patterns ──────────────────────────────────────────────────────

    private static $malware_patterns = [
        [
            'id'       => 'eval_base64',
            'label'    => 'eval(base64_decode(…))',
            'severity' => 'critical',
            'regex'    => '/eval\s*\(\s*base64_decode\s*\(/i',
        ],
        [
            'id'       => 'eval_gzip',
            'label'    => 'eval(gzinflate/gzuncompress/gzdecode(…))',
            'severity' => 'critical',
            'regex'    => '/eval\s*\(\s*gz(?:inflate|uncompress|decode)\s*\(/i',
        ],
        [
            'id'       => 'eval_rot13',
            'label'    => 'eval(str_rot13(…))',
            'severity' => 'critical',
            'regex'    => '/eval\s*\(\s*str_rot13\s*\(/i',
        ],
        [
            'id'       => 'preg_replace_e',
            'label'    => 'preg_replace with /e modifier',
            'severity' => 'critical',
            'regex'    => '/preg_replace\s*\(\s*[\'"].*\/e[\'"\s,]/i',
        ],
        [
            'id'       => 'assert_request',
            'label'    => 'assert() with user input',
            'severity' => 'critical',
            'regex'    => '/assert\s*\(\s*\$_(POST|GET|REQUEST|COOKIE)/i',
        ],
        [
            'id'       => 'system_request',
            'label'    => 'system/exec/passthru with user input',
            'severity' => 'critical',
            'regex'    => '/(?:system|exec|passthru)\s*\(\s*\$_(POST|GET|REQUEST|COOKIE)/i',
        ],
        [
            'id'       => 'shell_exec_request',
            'label'    => 'shell_exec() with user input',
            'severity' => 'critical',
            'regex'    => '/shell_exec\s*\(\s*\$_(POST|GET|REQUEST|COOKIE)/i',
        ],
        [
            'id'       => 'create_function',
            'label'    => 'create_function() — commonly abused',
            'severity' => 'warning',
            'regex'    => '/create_function\s*\(\s*[\'"]/',
        ],
        [
            'id'       => 'base64_decode_long',
            'label'    => 'Long base64-encoded string (>500 chars)',
            'severity' => 'warning',
            'regex'    => '/base64_decode\s*\(\s*[\'"][A-Za-z0-9+\/]{500,}[\'"]/',
        ],
        [
            'id'       => 'variable_function_call',
            'label'    => 'Dynamic variable function call $x($y)',
            'severity' => 'warning',
            'regex'    => '/\$[a-zA-Z_]\w*\s*\(\s*\$_(POST|GET|REQUEST|COOKIE)/i',
        ],
        [
            'id'       => 'webshell_marker',
            'label'    => 'Known webshell marker (FilesMan, r57, c99)',
            'severity' => 'critical',
            'regex'    => '/(?:FilesMan|WSO Shell|r57shell|c99shell|b374k)/i',
        ],
        [
            'id'       => 'js_unescape',
            'label'    => 'JavaScript document.write(unescape(…))',
            'severity' => 'warning',
            'regex'    => '/document\.write\s*\(\s*unescape\s*\(/i',
        ],
        [
            'id'       => 'hex_encoded_string',
            'label'    => 'Long hex-encoded string in eval',
            'severity' => 'warning',
            'regex'    => '/eval\s*\(\s*[\'"](?:\\\\x[0-9a-fA-F]{2}){20,}/',
        ],
    ];

    // ── PHP EOL map ───────────────────────────────────────────────────────────

    private static $php_eol = [
        '5.6' => '2018-12-31',
        '7.0' => '2019-12-03',
        '7.1' => '2019-12-01',
        '7.2' => '2020-11-30',
        '7.3' => '2021-12-06',
        '7.4' => '2022-11-28',
        '8.0' => '2023-11-26',
        '8.1' => '2024-11-25',
        '8.2' => '2026-12-31',
        '8.3' => '2027-12-31',
        '8.4' => '2028-12-31',
    ];

    // ─────────────────────────────────────────────────────────────────────────
    // Malware Scanner
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /scanner/malware?scope=plugins|themes|all
     * Scans PHP files in wp-content for known malicious code patterns.
     */
    public static function scan_malware( \WP_REST_Request $request ): \WP_REST_Response {
        $scope = sanitize_text_field( $request->get_param( 'scope' ) ?: 'all' );

        $scan_dirs = [];
        if ( in_array( $scope, [ 'plugins', 'all' ], true ) ) {
            $scan_dirs['plugins'] = WP_PLUGIN_DIR;
        }
        if ( in_array( $scope, [ 'themes', 'all' ], true ) ) {
            $scan_dirs['themes'] = get_theme_root();
        }

        $findings      = [];
        $scanned_count = 0;
        $max_files     = 8000;
        $ignored_paths = get_option( 'wmp_scanner_ignored', [] );

        foreach ( $scan_dirs as $area => $root ) {
            if ( ! is_dir( $root ) ) continue;

            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator( $root, \RecursiveDirectoryIterator::SKIP_DOTS )
            );

            foreach ( $iterator as $file ) {
                if ( $scanned_count >= $max_files ) break 2;

                /** @var \SplFileInfo $file */
                if ( ! $file->isFile() ) continue;
                $ext = strtolower( $file->getExtension() );
                if ( ! in_array( $ext, [ 'php', 'js', 'html' ], true ) ) continue;

                $scanned_count++;
                $path = $file->getRealPath();

                // Skip WP Manager Pro's own files — pattern label strings stored
                // in the source code match the same regexes, causing false positives.
                if ( strpos( $path, WP_PLUGIN_DIR . DIRECTORY_SEPARATOR . 'wp-manager-pro' . DIRECTORY_SEPARATOR ) === 0 ) continue;

                // Skip user-ignored files.
                $rel = str_replace( WP_CONTENT_DIR . DIRECTORY_SEPARATOR, '', $path );
                if ( in_array( $rel, $ignored_paths, true ) ) continue;

                // Skip very large files (>512 KB) to avoid memory issues.
                if ( $file->getSize() > 512 * 1024 ) continue;

                $contents = @file_get_contents( $path );
                if ( false === $contents ) continue;

                foreach ( self::$malware_patterns as $pattern ) {
                    if ( preg_match( $pattern['regex'], $contents, $match ) ) {
                        // Find the approximate line number.
                        $line   = 0;
                        $lines  = explode( "\n", $contents );
                        foreach ( $lines as $i => $line_content ) {
                            if ( preg_match( $pattern['regex'], $line_content ) ) {
                                $line = $i + 1;
                                break;
                            }
                        }

                        $findings[] = [
                            'area'     => $area,
                            'file'     => str_replace( WP_CONTENT_DIR . DIRECTORY_SEPARATOR, '', $path ),
                            'pattern'  => $pattern['label'],
                            'severity' => $pattern['severity'],
                            'line'     => $line,
                            'snippet'  => isset( $lines[ $line - 1 ] )
                                ? trim( substr( $lines[ $line - 1 ], 0, 200 ) )
                                : '',
                        ];

                        // Only report each file once per pattern ID.
                        break;
                    }
                }
            }
        }

        return rest_ensure_response( [
            'scanned' => $scanned_count,
            'clean'   => count( $findings ) === 0,
            'findings' => $findings,
            'scope'   => $scope,
        ] );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Vulnerability Database
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /scanner/vulns
     * Checks installed plugins and themes against the WPScan CVE API.
     */
    public static function get_vulnerabilities( \WP_REST_Request $request ): \WP_REST_Response {
        $api_key = get_option( 'wmp_wpscan_api_key', '' );

        if ( ! $api_key ) {
            return rest_ensure_response( [
                'error'        => 'no_api_key',
                'message'      => 'WPScan API key not configured. Add your free API key in the scanner settings.',
                'api_key_url'  => 'https://wpscan.com/register',
                'results'      => [],
            ] );
        }

        if ( ! function_exists( 'get_plugins' ) ) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }

        $plugins = get_plugins();
        $themes  = wp_get_themes();
        $results = [];

        // Check plugins.
        foreach ( $plugins as $file => $data ) {
            $slug = dirname( $file );
            if ( '.' === $slug ) $slug = basename( $file, '.php' );

            $vuln_data = self::fetch_wpscan_vulns( 'plugins', $slug, $data['Version'], $api_key );
            if ( $vuln_data !== null ) {
                $results[] = $vuln_data;
            }
        }

        // Check themes.
        foreach ( $themes as $slug => $theme ) {
            $vuln_data = self::fetch_wpscan_vulns( 'themes', $slug, $theme->get( 'Version' ), $api_key );
            if ( $vuln_data !== null ) {
                $results[] = $vuln_data;
            }
        }

        // Sort: items with vulnerabilities first.
        usort( $results, function ( $a, $b ) {
            return count( $b['vulnerabilities'] ) - count( $a['vulnerabilities'] );
        } );

        return rest_ensure_response( [
            'results' => $results,
            'total'   => count( $results ),
            'with_vulns' => count( array_filter( $results, fn( $r ) => count( $r['vulnerabilities'] ) > 0 ) ),
        ] );
    }

    /**
     * Fetch vulnerability data from WPScan API for a single plugin/theme.
     */
    private static function fetch_wpscan_vulns( string $type, string $slug, string $version, string $api_key ): ?array {
        $url      = "https://wpscan.com/api/v3/{$type}/{$slug}";
        $response = wp_remote_get( $url, [
            'headers' => [ 'Authorization' => "Token token={$api_key}" ],
            'timeout' => 10,
        ] );

        if ( is_wp_error( $response ) ) return null;

        $code = wp_remote_retrieve_response_code( $response );
        if ( 200 !== (int) $code ) return null;

        $body = json_decode( wp_remote_retrieve_body( $response ), true );
        if ( ! isset( $body[ $slug ] ) ) return null;

        $item  = $body[ $slug ];
        $vulns = [];

        foreach ( $item['vulnerabilities'] ?? [] as $v ) {
            // Check if this vulnerability affects the installed version.
            $affects = true;
            if ( ! empty( $v['fixed_in'] ) && version_compare( $version, $v['fixed_in'], '>=' ) ) {
                $affects = false;
            }
            if ( ! $affects ) continue;

            $vulns[] = [
                'id'          => $v['id'] ?? '',
                'title'       => $v['title'] ?? '',
                'type'        => $v['vuln_type'] ?? '',
                'severity'    => strtolower( $v['cvss']['severity'] ?? 'unknown' ),
                'score'       => $v['cvss']['score'] ?? null,
                'fixed_in'    => $v['fixed_in'] ?? null,
                'references'  => array_values( array_merge(
                    array_map( fn( $u ) => [ 'type' => 'url', 'url' => $u ], $v['references']['url'] ?? [] ),
                    array_map( fn( $c ) => [ 'type' => 'cve', 'url' => "https://nvd.nist.gov/vuln/detail/{$c}" ], $v['references']['cve'] ?? [] )
                ) ),
            ];
        }

        return [
            'type'            => $type === 'plugins' ? 'plugin' : 'theme',
            'slug'            => $slug,
            'name'            => $item['friendly_name'] ?? ucwords( str_replace( '-', ' ', $slug ) ),
            'version'         => $version,
            'latest_version'  => $item['latest_version'] ?? null,
            'vulnerabilities' => $vulns,
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SSL Monitor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /scanner/ssl
     * Verifies SSL certificate validity and expiry for the site domain.
     */
    public static function get_ssl( \WP_REST_Request $request ): \WP_REST_Response {
        $site_url = get_site_url();
        $parsed   = wp_parse_url( $site_url );
        $host     = $parsed['host'] ?? '';

        if ( ! $host ) {
            return new \WP_Error( 'no_host', 'Could not determine site hostname.', [ 'status' => 500 ] );
        }

        // Check if site is HTTPS.
        $is_https = ( $parsed['scheme'] ?? '' ) === 'https';

        if ( ! $is_https ) {
            return rest_ensure_response( [
                'host'       => $host,
                'https'      => false,
                'valid'      => false,
                'error'      => 'Site is not using HTTPS',
                'cert'       => null,
                'score_note' => 'No SSL — site is served over plain HTTP',
            ] );
        }

        // Attempt SSL connection to retrieve certificate.
        $context = stream_context_create( [
            'ssl' => [
                'capture_peer_cert'  => true,
                'verify_peer'        => false,
                'verify_peer_name'   => false,
            ],
        ] );

        $socket = @stream_socket_client(
            "ssl://{$host}:443",
            $errno,
            $errstr,
            15,
            STREAM_CLIENT_CONNECT,
            $context
        );

        if ( ! $socket ) {
            return rest_ensure_response( [
                'host'    => $host,
                'https'   => true,
                'valid'   => false,
                'error'   => "Could not connect to {$host}:443 — {$errstr}",
                'cert'    => null,
            ] );
        }

        $params = stream_context_get_params( $socket );
        fclose( $socket );

        $cert_resource = $params['options']['ssl']['peer_certificate'] ?? null;
        if ( ! $cert_resource ) {
            return rest_ensure_response( [
                'host'  => $host,
                'https' => true,
                'valid' => false,
                'error' => 'Could not retrieve certificate.',
                'cert'  => null,
            ] );
        }

        $cert   = openssl_x509_parse( $cert_resource );
        $now    = time();
        $valid_from    = $cert['validFrom_time_t'] ?? 0;
        $valid_to      = $cert['validTo_time_t'] ?? 0;
        $days_remaining = (int) round( ( $valid_to - $now ) / DAY_IN_SECONDS );

        $issuer_parts   = $cert['issuer'] ?? [];
        $subject_parts  = $cert['subject'] ?? [];

        $san = '';
        foreach ( $cert['extensions']['subjectAltName'] ?? [] as $v ) {
            $san = $v;
        }
        if ( isset( $cert['extensions']['subjectAltName'] ) ) {
            $san = $cert['extensions']['subjectAltName'];
        }

        return rest_ensure_response( [
            'host'         => $host,
            'https'        => true,
            'valid'        => $valid_to > $now && $valid_from <= $now,
            'error'        => null,
            'days_remaining' => $days_remaining,
            'cert'         => [
                'subject'     => $subject_parts['CN'] ?? implode( ', ', array_values( $subject_parts ) ),
                'issuer'      => $issuer_parts['O'] ?? $issuer_parts['CN'] ?? 'Unknown',
                'valid_from'  => gmdate( 'Y-m-d H:i:s', $valid_from ),
                'valid_to'    => gmdate( 'Y-m-d H:i:s', $valid_to ),
                'san'         => $san,
                'serial'      => $cert['serialNumberHex'] ?? '',
                'version'     => $cert['version'] ?? '',
            ],
        ] );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core Status
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * GET /scanner/core
     * Compares WP version + flags EOL PHP.
     */
    public static function get_core_status( \WP_REST_Request $request ): \WP_REST_Response {
        global $wp_version;

        // Fetch latest WP version from the version-check API.
        $latest_wp    = null;
        $is_latest_wp = false;

        $response = wp_remote_get( 'https://api.wordpress.org/core/version-check/1.7/', [
            'timeout' => 10,
        ] );

        if ( ! is_wp_error( $response ) ) {
            $body = json_decode( wp_remote_retrieve_body( $response ), true );
            $latest_wp = $body['offers'][0]['version'] ?? null;
            if ( $latest_wp ) {
                $is_latest_wp = version_compare( $wp_version, $latest_wp, '>=' );
            }
        }

        // PHP version check.
        $php_version = phpversion();
        $php_short   = implode( '.', array_slice( explode( '.', $php_version ), 0, 2 ) );
        $php_eol_date = self::$php_eol[ $php_short ] ?? null;
        $php_is_eol   = $php_eol_date ? ( strtotime( $php_eol_date ) < time() ) : false;
        $php_eol_soon = $php_eol_date && ! $php_is_eol
            ? ( strtotime( $php_eol_date ) - time() ) < 90 * DAY_IN_SECONDS
            : false;

        // Also check MySQL/MariaDB version.
        global $wpdb;
        $db_version = $wpdb->db_version();

        return rest_ensure_response( [
            'wp' => [
                'version'    => $wp_version,
                'latest'     => $latest_wp,
                'is_latest'  => $is_latest_wp,
                'site_url'   => get_site_url(),
                'multisite'  => is_multisite(),
            ],
            'php' => [
                'version'    => $php_version,
                'short'      => $php_short,
                'is_eol'     => $php_is_eol,
                'eol_soon'   => $php_eol_soon,
                'eol_date'   => $php_eol_date,
            ],
            'db' => [
                'version'    => $db_version,
            ],
        ] );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // API Key Management
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * POST /scanner/api-key
     * Save or clear the WPScan API key.
     */
    public static function save_api_key( \WP_REST_Request $request ): \WP_REST_Response {
        $key = sanitize_text_field( $request->get_param( 'api_key' ) ?? '' );
        update_option( 'wmp_wpscan_api_key', $key );
        return rest_ensure_response( [ 'saved' => true ] );
    }

    /**
     * GET /scanner/api-key
     * Returns whether an API key is configured (never exposes the raw key).
     */
    public static function get_api_key_status( \WP_REST_Request $request ): \WP_REST_Response {
        $key = get_option( 'wmp_wpscan_api_key', '' );
        return rest_ensure_response( [
            'configured' => ! empty( $key ),
            'masked'     => $key ? str_repeat( '*', max( 0, strlen( $key ) - 4 ) ) . substr( $key, -4 ) : '',
        ] );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // File Inspection & Actions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Resolve a wp-content-relative path to an absolute path, validating it
     * stays inside wp-content. Returns false on invalid/traversal attempts.
     */
    private static function resolve_content_path( string $rel_path ) {
        $abs = realpath( WP_CONTENT_DIR . DIRECTORY_SEPARATOR . ltrim( $rel_path, '/\\' ) );
        if ( ! $abs ) return false;
        if ( strpos( $abs, realpath( WP_CONTENT_DIR ) . DIRECTORY_SEPARATOR ) !== 0 ) return false;
        return $abs;
    }

    /**
     * GET /scanner/file?path=...&line=...
     * Returns the file content (split into lines) centred around the flagged line.
     * Sends ±40 lines of context so the React modal can highlight the match.
     */
    public static function get_file_content( \WP_REST_Request $request ) {
        $rel_path = sanitize_text_field( $request->get_param( 'path' ) ?? '' );
        $flag_line = absint( $request->get_param( 'line' ) ?? 0 );

        if ( ! $rel_path ) {
            return new \WP_Error( 'missing_path', 'path is required.', [ 'status' => 400 ] );
        }

        $abs = self::resolve_content_path( $rel_path );
        if ( ! $abs || ! is_file( $abs ) ) {
            return new \WP_Error( 'not_found', 'File not found or path is invalid.', [ 'status' => 404 ] );
        }

        if ( filesize( $abs ) > 1024 * 1024 ) {
            return new \WP_Error( 'too_large', 'File exceeds 1 MB — open via File Manager.', [ 'status' => 413 ] );
        }

        $lines = file( $abs, FILE_IGNORE_NEW_LINES );
        if ( false === $lines ) {
            return new \WP_Error( 'read_error', 'Could not read file.', [ 'status' => 500 ] );
        }

        $total = count( $lines );
        $ctx   = 40;
        $start = $flag_line > 0 ? max( 0, $flag_line - $ctx - 1 ) : 0;
        $end   = $flag_line > 0 ? min( $total - 1, $flag_line + $ctx - 1 ) : $total - 1;

        $slice = [];
        for ( $i = $start; $i <= $end; $i++ ) {
            $slice[] = [ 'n' => $i + 1, 'text' => $lines[ $i ] ];
        }

        return rest_ensure_response( [
            'path'      => $rel_path,
            'total_lines' => $total,
            'flag_line' => $flag_line,
            'lines'     => $slice,
        ] );
    }

    /**
     * DELETE /scanner/file
     * Permanently deletes the file. Requires { path, confirm: true }.
     */
    public static function delete_file( \WP_REST_Request $request ) {
        $rel_path = sanitize_text_field( $request->get_param( 'path' ) ?? '' );
        $confirm  = (bool) $request->get_param( 'confirm' );

        if ( ! $rel_path ) return new \WP_Error( 'missing_path', 'path is required.', [ 'status' => 400 ] );
        if ( ! $confirm )  return new \WP_Error( 'not_confirmed', 'confirm must be true.', [ 'status' => 400 ] );

        $abs = self::resolve_content_path( $rel_path );
        if ( ! $abs || ! is_file( $abs ) ) {
            return new \WP_Error( 'not_found', 'File not found.', [ 'status' => 404 ] );
        }

        if ( ! @unlink( $abs ) ) {
            return new \WP_Error( 'delete_failed', 'Could not delete file — check permissions.', [ 'status' => 500 ] );
        }

        return rest_ensure_response( [ 'deleted' => true, 'path' => $rel_path ] );
    }

    /**
     * POST /scanner/quarantine
     * Moves the file to wp-content/wmp-quarantine/{relative_path}.
     */
    public static function quarantine_file( \WP_REST_Request $request ) {
        $rel_path = sanitize_text_field( $request->get_param( 'path' ) ?? '' );
        $confirm  = (bool) $request->get_param( 'confirm' );

        if ( ! $rel_path ) return new \WP_Error( 'missing_path', 'path is required.', [ 'status' => 400 ] );
        if ( ! $confirm )  return new \WP_Error( 'not_confirmed', 'confirm must be true.', [ 'status' => 400 ] );

        $abs = self::resolve_content_path( $rel_path );
        if ( ! $abs || ! is_file( $abs ) ) {
            return new \WP_Error( 'not_found', 'File not found.', [ 'status' => 404 ] );
        }

        $quarantine_base = WP_CONTENT_DIR . '/wmp-quarantine';
        $dest            = $quarantine_base . '/' . ltrim( $rel_path, '/\\' );
        $dest_dir        = dirname( $dest );

        if ( ! wp_mkdir_p( $dest_dir ) ) {
            return new \WP_Error( 'mkdir_failed', 'Could not create quarantine directory.', [ 'status' => 500 ] );
        }

        // Add .quarantined extension so the file won't execute if the dir becomes web-accessible.
        $dest .= '.quarantined';

        if ( ! @rename( $abs, $dest ) ) {
            return new \WP_Error( 'move_failed', 'Could not move file to quarantine.', [ 'status' => 500 ] );
        }

        // Drop a .htaccess in the quarantine root to block direct HTTP access.
        $htaccess = $quarantine_base . '/.htaccess';
        if ( ! file_exists( $htaccess ) ) {
            @file_put_contents( $htaccess, "Options -Indexes\nDeny from all\n" );
        }

        return rest_ensure_response( [ 'quarantined' => true, 'dest' => 'wmp-quarantine/' . ltrim( $rel_path, '/\\' ) . '.quarantined' ] );
    }

    /**
     * POST /scanner/ignore
     * Adds a file path to the scanner ignore list (stored in wp_options).
     */
    public static function ignore_file( \WP_REST_Request $request ) {
        $rel_path = sanitize_text_field( $request->get_param( 'path' ) ?? '' );
        if ( ! $rel_path ) return new \WP_Error( 'missing_path', 'path is required.', [ 'status' => 400 ] );

        $ignored = get_option( 'wmp_scanner_ignored', [] );
        if ( ! in_array( $rel_path, $ignored, true ) ) {
            $ignored[] = $rel_path;
            update_option( 'wmp_scanner_ignored', $ignored );
        }

        return rest_ensure_response( [ 'ignored' => true, 'path' => $rel_path ] );
    }

    /**
     * GET /scanner/ignored
     */
    public static function get_ignored_files( \WP_REST_Request $request ) {
        return rest_ensure_response( get_option( 'wmp_scanner_ignored', [] ) );
    }

    /**
     * DELETE /scanner/ignored
     * Removes a path from the ignore list.
     */
    public static function remove_ignored_file( \WP_REST_Request $request ) {
        $rel_path = sanitize_text_field( $request->get_param( 'path' ) ?? '' );
        if ( ! $rel_path ) return new \WP_Error( 'missing_path', 'path is required.', [ 'status' => 400 ] );

        $ignored = get_option( 'wmp_scanner_ignored', [] );
        $ignored = array_values( array_filter( $ignored, fn( $p ) => $p !== $rel_path ) );
        update_option( 'wmp_scanner_ignored', $ignored );

        return rest_ensure_response( [ 'removed' => true ] );
    }
}
