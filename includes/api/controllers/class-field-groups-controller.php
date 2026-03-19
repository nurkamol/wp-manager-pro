<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;

/**
 * Field Groups Controller
 * ACF-like field groups stored in wp_options as wmp_field_groups.
 * Also registers meta boxes on the WordPress edit-post screens.
 */
class Field_Groups_Controller {

    const OPTION_KEY = 'wmp_field_groups';

    // ── REST: List all field groups ───────────────────────────────────────────

    public static function list_groups( WP_REST_Request $request ): WP_REST_Response {
        $groups = get_option( self::OPTION_KEY, [] );
        return new WP_REST_Response( array_values( $groups ), 200 );
    }

    // ── REST: Create or update a field group ─────────────────────────────────

    public static function save_group( WP_REST_Request $request ): WP_REST_Response {
        $body = $request->get_json_params();

        // Determine id: from URL param (PUT) or body (POST with id = update), or generate new.
        $id = sanitize_key( $request->get_param( 'id' ) ?? '' );
        if ( ! $id ) {
            $id = sanitize_key( $body['id'] ?? '' );
        }

        $groups = get_option( self::OPTION_KEY, [] );

        // If no id found yet, generate one.
        if ( ! $id ) {
            $id = 'fg_' . uniqid();
        }

        $title = sanitize_text_field( $body['title'] ?? '' );
        if ( ! $title ) {
            return new WP_REST_Response( [ 'error' => 'Title is required.' ], 400 );
        }

        // Sanitize location (array of post type slugs).
        $location = array_map( 'sanitize_key', (array) ( $body['location'] ?? [] ) );

        // Sanitize fields.
        $raw_fields = (array) ( $body['fields'] ?? [] );
        $fields = [];
        foreach ( $raw_fields as $f ) {
            $field_id   = sanitize_key( $f['id'] ?? ( 'f_' . uniqid() ) );
            $field_type = sanitize_key( $f['type'] ?? 'text' );
            $allowed_types = [
                'text', 'textarea', 'number', 'email', 'url',
                'select', 'checkbox', 'radio', 'true_false',
                'image', 'wysiwyg', 'date', 'color',
            ];
            if ( ! in_array( $field_type, $allowed_types, true ) ) {
                $field_type = 'text';
            }

            $options = [];
            if ( isset( $f['options'] ) && is_array( $f['options'] ) ) {
                // For select/checkbox/radio: choices stored as raw textarea string.
                if ( isset( $f['options']['choices'] ) ) {
                    $options['choices'] = sanitize_textarea_field( $f['options']['choices'] );
                }
            }

            $fields[] = [
                'id'           => $field_id,
                'type'         => $field_type,
                'label'        => sanitize_text_field( $f['label'] ?? '' ),
                'name'         => sanitize_key( $f['name'] ?? '' ),
                'required'     => ! empty( $f['required'] ),
                'instructions' => sanitize_textarea_field( $f['instructions'] ?? '' ),
                'options'      => $options,
            ];
        }

        $now = current_time( 'c' );

        if ( isset( $groups[ $id ] ) ) {
            // Preserve created timestamp on update.
            $created = $groups[ $id ]['created'] ?? $now;
        } else {
            $created = $now;
        }

        $groups[ $id ] = [
            'id'          => $id,
            'title'       => $title,
            'description' => sanitize_textarea_field( $body['description'] ?? '' ),
            'location'    => $location,
            'fields'      => $fields,
            'active'      => isset( $body['active'] ) ? (bool) $body['active'] : true,
            'created'     => $created,
        ];

        update_option( self::OPTION_KEY, $groups );

        return new WP_REST_Response( $groups[ $id ], 200 );
    }

    // ── REST: Delete a field group ────────────────────────────────────────────

    public static function delete_group( WP_REST_Request $request ): WP_REST_Response {
        $id     = sanitize_key( $request->get_param( 'id' ) );
        $groups = get_option( self::OPTION_KEY, [] );

        if ( ! isset( $groups[ $id ] ) ) {
            return new WP_REST_Response( [ 'error' => 'Field group not found.' ], 404 );
        }

        unset( $groups[ $id ] );
        update_option( self::OPTION_KEY, $groups );

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    // ── Meta boxes — register on add_meta_boxes hook ─────────────────────────

    public static function register_meta_boxes() {
        $groups = get_option( self::OPTION_KEY, [] );

        foreach ( $groups as $group ) {
            if ( empty( $group['active'] ) ) continue;
            $location = (array) ( $group['location'] ?? [] );
            if ( empty( $location ) ) continue;

            foreach ( $location as $post_type ) {
                add_meta_box(
                    'wmp_fg_' . $group['id'],
                    esc_html( $group['title'] ),
                    [ self::class, 'render_meta_box' ],
                    sanitize_key( $post_type ),
                    'normal',
                    'default',
                    [ 'group' => $group ]
                );
            }
        }
    }

    // ── Meta box renderer ─────────────────────────────────────────────────────

    public static function render_meta_box( \WP_Post $post, array $box ) {
        $group = $box['args']['group'] ?? [];
        $fields = (array) ( $group['fields'] ?? [] );

        wp_nonce_field( 'wmp_fg_save_' . $group['id'], 'wmp_fg_nonce_' . $group['id'] );

        echo '<div class="wmp-field-group" style="display:grid;gap:12px;padding:4px 0;">';

        foreach ( $fields as $field ) {
            $meta_key = sanitize_key( $field['name'] );
            $value    = get_post_meta( $post->ID, $meta_key, true );
            $field_id = esc_attr( 'wmp_field_' . $meta_key );
            $label    = esc_html( $field['label'] ?: $field['name'] );

            echo '<div class="wmp-field" style="display:flex;flex-direction:column;gap:4px;">';
            echo '<label for="' . $field_id . '" style="font-weight:600;font-size:13px;">' . $label;
            if ( ! empty( $field['required'] ) ) {
                echo ' <span style="color:#d63638">*</span>';
            }
            echo '</label>';

            if ( ! empty( $field['instructions'] ) ) {
                echo '<p style="margin:0;color:#646970;font-size:12px;">' . esc_html( $field['instructions'] ) . '</p>';
            }

            self::render_field_input( $field, $field_id, $meta_key, $value );

            echo '</div>';
        }

        echo '</div>';
    }

    // ── Field input renderer ──────────────────────────────────────────────────

    private static function render_field_input( array $field, string $field_id, string $meta_key, $value ) {
        $type     = $field['type'] ?? 'text';
        $name_att = 'wmp_meta[' . $meta_key . ']';

        switch ( $type ) {
            case 'textarea':
                echo '<textarea id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $name_att ) . '" rows="4" style="width:100%;">' . esc_textarea( $value ) . '</textarea>';
                break;

            case 'wysiwyg':
                wp_editor( $value, $field_id, [
                    'textarea_name' => $name_att,
                    'textarea_rows' => 8,
                ] );
                break;

            case 'select':
                $choices = self::parse_choices( $field['options']['choices'] ?? '' );
                echo '<select id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $name_att ) . '" style="width:100%;">';
                echo '<option value="">— Select —</option>';
                foreach ( $choices as $choice_val => $choice_label ) {
                    echo '<option value="' . esc_attr( $choice_val ) . '"' . selected( $value, $choice_val, false ) . '>' . esc_html( $choice_label ) . '</option>';
                }
                echo '</select>';
                break;

            case 'radio':
                $choices = self::parse_choices( $field['options']['choices'] ?? '' );
                $saved_vals = (array) $value;
                foreach ( $choices as $choice_val => $choice_label ) {
                    $checked = checked( in_array( $choice_val, $saved_vals, true ), true, false );
                    echo '<label style="display:flex;align-items:center;gap:6px;font-weight:normal;">';
                    echo '<input type="radio" name="' . esc_attr( $name_att ) . '" value="' . esc_attr( $choice_val ) . '"' . $checked . '>';
                    echo esc_html( $choice_label ) . '</label>';
                }
                break;

            case 'checkbox':
                $choices = self::parse_choices( $field['options']['choices'] ?? '' );
                $saved_vals = (array) ( is_array( $value ) ? $value : ( $value ? [ $value ] : [] ) );
                foreach ( $choices as $choice_val => $choice_label ) {
                    $checked = checked( in_array( $choice_val, $saved_vals, true ), true, false );
                    echo '<label style="display:flex;align-items:center;gap:6px;font-weight:normal;">';
                    echo '<input type="checkbox" name="' . esc_attr( $name_att ) . '[]" value="' . esc_attr( $choice_val ) . '"' . $checked . '>';
                    echo esc_html( $choice_label ) . '</label>';
                }
                break;

            case 'true_false':
                $checked = checked( ! empty( $value ), true, false );
                echo '<label style="display:flex;align-items:center;gap:6px;font-weight:normal;">';
                echo '<input type="checkbox" id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $name_att ) . '" value="1"' . $checked . '>';
                echo esc_html( $field['label'] );
                echo '</label>';
                break;

            case 'image':
                $attachment_id = absint( $value );
                echo '<div style="display:flex;flex-direction:column;gap:6px;">';
                if ( $attachment_id ) {
                    echo wp_get_attachment_image( $attachment_id, 'thumbnail', false, [ 'style' => 'max-width:150px;border-radius:4px;' ] );
                }
                echo '<input type="number" id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $name_att ) . '" value="' . esc_attr( $value ) . '" placeholder="Attachment ID" style="width:200px;">';
                echo '</div>';
                break;

            case 'color':
                echo '<input type="color" id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $name_att ) . '" value="' . esc_attr( $value ?: '#000000' ) . '" style="width:60px;height:36px;">';
                break;

            case 'date':
                echo '<input type="date" id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $name_att ) . '" value="' . esc_attr( $value ) . '" style="width:200px;">';
                break;

            case 'number':
                echo '<input type="number" id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $name_att ) . '" value="' . esc_attr( $value ) . '" style="width:200px;">';
                break;

            case 'email':
                echo '<input type="email" id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $name_att ) . '" value="' . esc_attr( $value ) . '" style="width:100%;">';
                break;

            case 'url':
                echo '<input type="url" id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $name_att ) . '" value="' . esc_attr( $value ) . '" style="width:100%;">';
                break;

            default: // text
                echo '<input type="text" id="' . esc_attr( $field_id ) . '" name="' . esc_attr( $name_att ) . '" value="' . esc_attr( $value ) . '" style="width:100%;">';
                break;
        }
    }

    // ── save_post hook ────────────────────────────────────────────────────────

    public static function save_meta( int $post_id ) {
        // Bail on auto-save.
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
        if ( wp_is_post_revision( $post_id ) ) return;

        $post_type = get_post_type( $post_id );
        $groups    = get_option( self::OPTION_KEY, [] );

        foreach ( $groups as $group ) {
            if ( empty( $group['active'] ) ) continue;
            $location = (array) ( $group['location'] ?? [] );
            if ( ! in_array( $post_type, $location, true ) ) continue;

            // Verify nonce.
            $nonce_key = 'wmp_fg_nonce_' . $group['id'];
            if ( ! isset( $_POST[ $nonce_key ] ) ) continue;
            if ( ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST[ $nonce_key ] ) ), 'wmp_fg_save_' . $group['id'] ) ) continue;

            // Check permission.
            if ( ! current_user_can( 'edit_post', $post_id ) ) continue;

            $meta_input = (array) ( $_POST['wmp_meta'] ?? [] );
            $fields = (array) ( $group['fields'] ?? [] );

            foreach ( $fields as $field ) {
                $meta_key  = sanitize_key( $field['name'] );
                if ( ! $meta_key ) continue;

                $field_type = $field['type'] ?? 'text';
                $raw_value  = $meta_input[ $meta_key ] ?? null;

                $clean = self::sanitize_field_value( $field_type, $raw_value );
                update_post_meta( $post_id, $meta_key, $clean );
            }
        }
    }

    // ── Sanitization per field type ───────────────────────────────────────────

    private static function sanitize_field_value( string $type, $raw ) {
        switch ( $type ) {
            case 'textarea':
                return sanitize_textarea_field( wp_unslash( (string) $raw ) );

            case 'wysiwyg':
                return wp_kses_post( wp_unslash( (string) $raw ) );

            case 'number':
                return is_numeric( $raw ) ? (float) $raw : '';

            case 'email':
                return sanitize_email( wp_unslash( (string) $raw ) );

            case 'url':
                return esc_url_raw( wp_unslash( (string) $raw ) );

            case 'true_false':
                return $raw === '1' ? '1' : '0';

            case 'image':
                return absint( $raw );

            case 'color':
                $color = sanitize_hex_color( wp_unslash( (string) $raw ) );
                return $color ?: '';

            case 'date':
                $date = sanitize_text_field( wp_unslash( (string) $raw ) );
                // Validate date format YYYY-MM-DD.
                $dt = \DateTime::createFromFormat( 'Y-m-d', $date );
                return ( $dt && $dt->format( 'Y-m-d' ) === $date ) ? $date : '';

            case 'checkbox':
                // Comes as array.
                if ( ! is_array( $raw ) ) return [];
                return array_map( 'sanitize_text_field', array_map( 'wp_unslash', $raw ) );

            case 'radio':
            case 'select':
                return sanitize_text_field( wp_unslash( (string) $raw ) );

            default: // text
                return sanitize_text_field( wp_unslash( (string) ( $raw ?? '' ) ) );
        }
    }

    // ── Helper: parse choices textarea ───────────────────────────────────────

    private static function parse_choices( string $raw ): array {
        $choices = [];
        $lines   = explode( "\n", $raw );
        foreach ( $lines as $line ) {
            $line = trim( $line );
            if ( ! $line ) continue;
            if ( strpos( $line, ':' ) !== false ) {
                [ $val, $label ] = explode( ':', $line, 2 );
                $choices[ trim( $val ) ] = trim( $label );
            } else {
                $choices[ $line ] = $line;
            }
        }
        return $choices;
    }
}
