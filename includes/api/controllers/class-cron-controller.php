<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Cron_Controller
 *
 * Full WP-Cron management: event browser, manual trigger, delete events,
 * custom schedule CRUD, and cron health reporting.
 *
 * v2.1.0
 */
class Cron_Controller {

    /** option key for custom schedules added via the UI */
    const CUSTOM_SCHEDULES_OPTION = 'wmp_custom_cron_schedules';

    // -------------------------------------------------------------------------
    // GET /cron/events
    // -------------------------------------------------------------------------

    /**
     * Returns all scheduled cron events, sorted by next-run timestamp.
     */
    public static function get_events( WP_REST_Request $request ) {
        $cron_array = _get_cron_array();
        if ( ! is_array( $cron_array ) ) {
            return rest_ensure_response( [] );
        }

        $schedules = wp_get_schedules();
        $events    = [];

        foreach ( $cron_array as $timestamp => $hooks ) {
            foreach ( $hooks as $hook => $hook_events ) {
                foreach ( $hook_events as $event_key => $event ) {
                    $schedule_label = '';
                    $interval       = 0;
                    if ( ! empty( $event['schedule'] ) && isset( $schedules[ $event['schedule'] ] ) ) {
                        $schedule_label = $schedules[ $event['schedule'] ]['display'];
                        $interval       = (int) $schedules[ $event['schedule'] ]['interval'];
                    }

                    $events[] = [
                        'hook'           => $hook,
                        'timestamp'      => (int) $timestamp,
                        'next_run_human' => self::human_time_diff_future( $timestamp ),
                        'schedule'       => $event['schedule'] ?? '',
                        'schedule_label' => $schedule_label,
                        'interval'       => $interval,
                        'args'           => $event['args'] ?? [],
                        'args_hash'      => md5( serialize( $event['args'] ?? [] ) ),
                        'is_core'        => self::is_core_hook( $hook ),
                    ];
                }
            }
        }

        // Sort by next run time ascending
        usort( $events, fn( $a, $b ) => $a['timestamp'] - $b['timestamp'] );

        return rest_ensure_response( $events );
    }

    // -------------------------------------------------------------------------
    // POST /cron/run
    // -------------------------------------------------------------------------

    /**
     * Manually trigger a cron event immediately.
     *
     * Body: { hook: string, args?: array }
     */
    public static function run_event( WP_REST_Request $request ) {
        $hook = sanitize_text_field( $request->get_param( 'hook' ) );
        $args = $request->get_param( 'args' );
        if ( ! is_array( $args ) ) {
            $args = [];
        }

        if ( empty( $hook ) ) {
            return new WP_Error( 'missing_hook', 'Hook name is required.', [ 'status' => 400 ] );
        }

        // Capture any output and errors
        ob_start();
        $start = microtime( true );
        try {
            do_action_ref_array( $hook, $args );
            $success = true;
            $error   = null;
        } catch ( \Throwable $e ) {
            $success = false;
            $error   = $e->getMessage();
        }
        $output   = ob_get_clean();
        $duration = round( ( microtime( true ) - $start ) * 1000, 2 ); // ms

        return rest_ensure_response( [
            'success'  => $success,
            'hook'     => $hook,
            'duration' => $duration,
            'output'   => $output,
            'error'    => $error,
        ] );
    }

    // -------------------------------------------------------------------------
    // DELETE /cron/event
    // -------------------------------------------------------------------------

    /**
     * Delete (unschedule) all occurrences of an event hook.
     *
     * Body: { hook: string, timestamp?: int, args?: array }
     * - If timestamp + args provided: unschedule the single specific event.
     * - Otherwise: clear all scheduled hooks with that name.
     */
    public static function delete_event( WP_REST_Request $request ) {
        $hook      = sanitize_text_field( $request->get_param( 'hook' ) );
        $timestamp = (int) $request->get_param( 'timestamp' );
        $args      = $request->get_param( 'args' );

        if ( empty( $hook ) ) {
            return new WP_Error( 'missing_hook', 'Hook name is required.', [ 'status' => 400 ] );
        }

        if ( $timestamp && is_array( $args ) ) {
            $result = wp_unschedule_event( $timestamp, $hook, $args );
        } else {
            $result = wp_clear_scheduled_hook( $hook );
        }

        if ( false === $result ) {
            return new WP_Error( 'delete_failed', 'Could not unschedule the event.', [ 'status' => 500 ] );
        }

        return rest_ensure_response( [ 'success' => true, 'hook' => $hook ] );
    }

    // -------------------------------------------------------------------------
    // GET /cron/schedules
    // -------------------------------------------------------------------------

    /**
     * Returns all registered cron schedules (built-in + custom).
     */
    public static function get_schedules( WP_REST_Request $request ) {
        $all      = wp_get_schedules();
        $custom   = (array) get_option( self::CUSTOM_SCHEDULES_OPTION, [] );
        $result   = [];

        foreach ( $all as $key => $sched ) {
            $result[] = [
                'key'      => $key,
                'display'  => $sched['display'],
                'interval' => (int) $sched['interval'],
                'is_custom'=> isset( $custom[ $key ] ),
            ];
        }

        // Sort by interval asc
        usort( $result, fn( $a, $b ) => $a['interval'] - $b['interval'] );

        return rest_ensure_response( $result );
    }

    // -------------------------------------------------------------------------
    // POST /cron/schedules
    // -------------------------------------------------------------------------

    /**
     * Create a custom cron schedule.
     *
     * Body: { key: string, display: string, interval: int (seconds) }
     */
    public static function create_schedule( WP_REST_Request $request ) {
        $key      = sanitize_key( $request->get_param( 'key' ) );
        $display  = sanitize_text_field( $request->get_param( 'display' ) );
        $interval = absint( $request->get_param( 'interval' ) );

        if ( empty( $key ) || empty( $display ) || $interval < 60 ) {
            return new WP_Error(
                'invalid_schedule',
                'Key, display name, and interval (≥ 60 seconds) are required.',
                [ 'status' => 400 ]
            );
        }

        $custom = (array) get_option( self::CUSTOM_SCHEDULES_OPTION, [] );
        if ( isset( $custom[ $key ] ) ) {
            return new WP_Error( 'duplicate_key', 'A schedule with that key already exists.', [ 'status' => 409 ] );
        }

        $custom[ $key ] = [
            'display'  => $display,
            'interval' => $interval,
        ];

        update_option( self::CUSTOM_SCHEDULES_OPTION, $custom );

        return rest_ensure_response( [
            'success'  => true,
            'key'      => $key,
            'display'  => $display,
            'interval' => $interval,
        ] );
    }

    // -------------------------------------------------------------------------
    // DELETE /cron/schedules
    // -------------------------------------------------------------------------

    /**
     * Delete a custom cron schedule.
     *
     * Body: { key: string }
     */
    public static function delete_schedule( WP_REST_Request $request ) {
        $key    = sanitize_key( $request->get_param( 'key' ) );
        $custom = (array) get_option( self::CUSTOM_SCHEDULES_OPTION, [] );

        if ( ! isset( $custom[ $key ] ) ) {
            return new WP_Error( 'not_found', 'Custom schedule not found.', [ 'status' => 404 ] );
        }

        unset( $custom[ $key ] );
        update_option( self::CUSTOM_SCHEDULES_OPTION, $custom );

        return rest_ensure_response( [ 'success' => true, 'key' => $key ] );
    }

    // -------------------------------------------------------------------------
    // GET /cron/health
    // -------------------------------------------------------------------------

    /**
     * Returns cron health status information.
     */
    public static function get_health( WP_REST_Request $request ) {
        $disabled        = defined( 'DISABLE_WP_CRON' ) && DISABLE_WP_CRON;
        $alternate_cron  = defined( 'ALTERNATE_WP_CRON' ) && ALTERNATE_WP_CRON;
        $lock_timeout    = defined( 'WP_CRON_LOCK_TIMEOUT' ) ? WP_CRON_LOCK_TIMEOUT : 60;

        // Last cron spawn time (WP stores this as a transient)
        $last_cron_time  = (int) get_transient( 'doing_cron' );
        $doing_cron      = (bool) $last_cron_time;

        // How long ago was cron last triggered? Use the earliest overdue event.
        $cron_array  = _get_cron_array();
        $overdue     = [];
        $total       = 0;
        $now         = time();

        if ( is_array( $cron_array ) ) {
            foreach ( $cron_array as $timestamp => $hooks ) {
                $total += count( $hooks );
                if ( $timestamp < $now ) {
                    foreach ( $hooks as $hook => $events ) {
                        foreach ( $events as $event ) {
                            $overdue[] = [
                                'hook'      => $hook,
                                'timestamp' => $timestamp,
                                'overdue_s' => $now - $timestamp,
                            ];
                        }
                    }
                }
            }
        }

        // site url for real cron hint
        $site_url = site_url();

        return rest_ensure_response( [
            'disabled'           => $disabled,
            'alternate_cron'     => $alternate_cron,
            'lock_timeout'       => (int) $lock_timeout,
            'doing_cron'         => $doing_cron,
            'total_events'       => $total,
            'overdue_count'      => count( $overdue ),
            'overdue_events'     => array_slice( $overdue, 0, 10 ),
            'real_cron_command'  => "*/5 * * * * curl -s {$site_url}/wp-cron.php?doing_wp_cron > /dev/null 2>&1",
            'wp_cli_command'     => 'wp cron event run --due-now',
        ] );
    }

    // -------------------------------------------------------------------------
    // Hook filter: inject custom schedules
    // -------------------------------------------------------------------------

    /**
     * Injects custom schedules saved via the UI into WordPress's schedule list.
     * Attach to 'cron_schedules' filter in class-plugin.php.
     */
    public static function inject_custom_schedules( array $schedules ): array {
        $custom = (array) get_option( self::CUSTOM_SCHEDULES_OPTION, [] );
        foreach ( $custom as $key => $sched ) {
            if ( ! isset( $schedules[ $key ] ) ) {
                $schedules[ $key ] = [
                    'interval' => (int) $sched['interval'],
                    'display'  => sanitize_text_field( $sched['display'] ),
                ];
            }
        }
        return $schedules;
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    /**
     * Human-readable time diff for a future timestamp.
     * Returns "in X minutes" / "X minutes ago" etc.
     */
    private static function human_time_diff_future( int $timestamp ): string {
        $now  = time();
        $diff = $timestamp - $now;

        if ( abs( $diff ) < 60 ) {
            return $diff >= 0 ? 'in a moment' : 'just now';
        }

        $abs  = abs( $diff );
        $str  = human_time_diff( $now, $timestamp );

        return $diff > 0 ? "in {$str}" : "{$str} ago";
    }

    /**
     * Determines if a hook belongs to WordPress core.
     */
    private static function is_core_hook( string $hook ): bool {
        $core = [
            'wp_version_check', 'wp_update_plugins', 'wp_update_themes',
            'wp_scheduled_delete', 'wp_privacy_delete_old_export_files',
            'wp_update_user_counts', 'wp_scheduled_auto_draft_delete',
            'delete_expired_transients', 'wp_https_detection',
            'wp_site_health_scheduled_check', 'recovery_mode_clean_expired_keys',
            'wp_delete_temp_updater_backups', 'wp_update_comment_type_batch',
        ];
        return in_array( $hook, $core, true ) || str_starts_with( $hook, 'wp_' );
    }
}
