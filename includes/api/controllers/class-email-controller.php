<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Email_Controller {

    // ── REST Handlers ─────────────────────────────────────────────────────────

    public static function get_settings( WP_REST_Request $request ) {
        $settings = get_option( 'wmp_smtp_settings', [] );
        // Never expose raw password.
        if ( ! empty( $settings['password'] ) ) {
            $settings['password'] = '••••••••';
        }
        return new WP_REST_Response( [ 'settings' => $settings ], 200 );
    }

    public static function save_settings( WP_REST_Request $request ) {
        $existing = get_option( 'wmp_smtp_settings', [] );

        $host       = sanitize_text_field( $request->get_param( 'host' ) ?: '' );
        $port       = absint( $request->get_param( 'port' ) ?: 587 );
        $username   = sanitize_text_field( $request->get_param( 'username' ) ?: '' );
        $password   = $request->get_param( 'password' );
        $encryption = sanitize_text_field( $request->get_param( 'encryption' ) ?: 'tls' );
        $from_email = sanitize_email( $request->get_param( 'from_email' ) ?: '' );
        $from_name  = sanitize_text_field( $request->get_param( 'from_name' ) ?: '' );
        $enabled    = (bool) $request->get_param( 'enabled' );

        // Keep existing password if user didn't change it.
        if ( $password === '••••••••' || $password === null ) {
            $password = $existing['password'] ?? '';
        }

        if ( ! in_array( $encryption, [ 'none', 'ssl', 'tls' ], true ) ) {
            $encryption = 'tls';
        }

        $settings = [
            'enabled'    => $enabled,
            'host'       => $host,
            'port'       => $port,
            'username'   => $username,
            'password'   => $password,
            'encryption' => $encryption,
            'from_email' => $from_email,
            'from_name'  => $from_name,
        ];

        update_option( 'wmp_smtp_settings', $settings );
        Audit_Controller::log( 'smtp.settings_saved', 'email', 'SMTP Settings' );

        // Return with masked password.
        $settings['password'] = $password ? '••••••••' : '';
        return new WP_REST_Response( [ 'success' => true, 'settings' => $settings ], 200 );
    }

    public static function send_test( WP_REST_Request $request ) {
        $to = sanitize_email( $request->get_param( 'to' ) ?: '' );
        if ( ! $to ) {
            return new WP_Error( 'missing_param', 'Recipient email is required.', [ 'status' => 400 ] );
        }

        $subject = '[WP Manager Pro] SMTP Test Email';
        $message = 'This is a test email sent from WP Manager Pro to verify your SMTP settings are working correctly.';
        $headers = [ 'Content-Type: text/plain; charset=UTF-8' ];

        $result = wp_mail( $to, $subject, $message, $headers );

        if ( $result ) {
            return new WP_REST_Response( [ 'success' => true, 'message' => 'Test email sent successfully.' ], 200 );
        }

        global $phpmailer;
        $error = isset( $phpmailer ) ? $phpmailer->ErrorInfo : 'Unknown error';
        return new WP_Error( 'send_failed', 'Failed to send test email: ' . $error, [ 'status' => 500 ] );
    }

    public static function get_log( WP_REST_Request $request ) {
        global $wpdb;
        $table     = $wpdb->prefix . 'wmp_email_log';
        $per_page  = min( 200, max( 10, absint( $request->get_param( 'per_page' ) ) ?: 50 ) );
        $page      = max( 1, absint( $request->get_param( 'page' ) ) ?: 1 );
        $offset    = ( $page - 1 ) * $per_page;
        $status    = sanitize_text_field( $request->get_param( 'status' ) ?: '' );

        if ( $status ) {
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $total  = (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM $table WHERE status = %s", $status ) );
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $emails = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $table WHERE status = %s ORDER BY id DESC LIMIT %d OFFSET %d", $status, $per_page, $offset ) );
        } else {
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $total  = (int) $wpdb->get_var( "SELECT COUNT(*) FROM $table" );
            // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
            $emails = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM $table ORDER BY id DESC LIMIT %d OFFSET %d", $per_page, $offset ) );
        }

        return new WP_REST_Response( [
            'emails'      => $emails,
            'total'       => $total,
            'page'        => $page,
            'per_page'    => $per_page,
            'total_pages' => (int) ceil( $total / $per_page ),
        ], 200 );
    }

    public static function clear_log( WP_REST_Request $request ) {
        global $wpdb;
        $table = $wpdb->prefix . 'wmp_email_log';
        // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
        $wpdb->query( "TRUNCATE TABLE $table" );
        Audit_Controller::log( 'email.log_cleared', 'email', 'Email Log' );
        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    // ── SMTP Configuration (phpmailer_init hook) ──────────────────────────────

    public static function configure_smtp( $phpmailer ) {
        $settings = get_option( 'wmp_smtp_settings', [] );

        if ( empty( $settings['enabled'] ) || empty( $settings['host'] ) ) {
            return;
        }

        $phpmailer->isSMTP();
        $phpmailer->Host       = $settings['host'];
        $phpmailer->Port       = (int) ( $settings['port'] ?? 587 );
        $phpmailer->SMTPAuth   = ! empty( $settings['username'] );
        $phpmailer->Username   = $settings['username'] ?? '';
        $phpmailer->Password   = $settings['password'] ?? '';
        $phpmailer->SMTPSecure = $settings['encryption'] === 'ssl' ? 'ssl' : ( $settings['encryption'] === 'tls' ? 'tls' : '' );

        if ( ! empty( $settings['from_email'] ) ) {
            $phpmailer->setFrom( $settings['from_email'], $settings['from_name'] ?? get_bloginfo( 'name' ) );
        }
    }

    // ── Email Logging (wp_mail hook) ──────────────────────────────────────────

    public static function log_sent_email( $mail_data ) {
        self::write_log( $mail_data['to'], $mail_data['subject'], $mail_data['message'], $mail_data['headers'], 'sent', '' );
    }

    public static function log_failed_email( $wp_error ) {
        $data = $wp_error->get_error_data();
        $to      = is_array( $data ) && isset( $data['to'] )      ? $data['to']      : '';
        $subject = is_array( $data ) && isset( $data['subject'] ) ? $data['subject'] : '';
        $message = is_array( $data ) && isset( $data['message'] ) ? $data['message'] : '';
        $headers = is_array( $data ) && isset( $data['headers'] ) ? $data['headers'] : '';
        self::write_log( $to, $subject, $message, $headers, 'failed', $wp_error->get_error_message() );
    }

    private static function write_log( $to, $subject, $message, $headers, $status, $error ) {
        global $wpdb;
        $table = $wpdb->prefix . 'wmp_email_log';

        if ( is_array( $to ) ) {
            $to = implode( ', ', $to );
        }
        if ( is_array( $headers ) ) {
            $headers = implode( "\n", $headers );
        }

        $wpdb->insert( $table, [
            'to_email'   => sanitize_text_field( (string) $to ),
            'subject'    => sanitize_text_field( (string) $subject ),
            'message'    => wp_kses_post( (string) $message ),
            'headers'    => sanitize_textarea_field( (string) $headers ),
            'status'     => $status,
            'error'      => sanitize_text_field( (string) $error ),
            'created_at' => current_time( 'mysql' ),
        ], [ '%s', '%s', '%s', '%s', '%s', '%s', '%s' ] );
    }
}
