<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;

/**
 * Custom Post Type Manager Controller
 * Stores CPT/Taxonomy definitions in wp_options and registers them at init.
 */
class CPT_Controller {

    const CPT_OPTION  = 'wmp_custom_post_types';
    const TAX_OPTION  = 'wmp_custom_taxonomies';

    // ── Init hook — register all saved CPTs & taxonomies ──────────────────────

    public static function register_all() {
        $cpts = get_option( self::CPT_OPTION, [] );
        foreach ( $cpts as $config ) {
            self::do_register_cpt( $config );
        }

        $taxes = get_option( self::TAX_OPTION, [] );
        foreach ( $taxes as $config ) {
            self::do_register_taxonomy( $config );
        }
    }

    // ── Internal helpers ───────────────────────────────────────────────────────

    private static function do_register_cpt( array $c ) {
        $slug = sanitize_key( $c['slug'] ?? '' );
        if ( ! $slug ) return;

        $singular = sanitize_text_field( $c['singular'] ?? ucfirst( $slug ) );
        $plural   = sanitize_text_field( $c['plural']   ?? $singular . 's' );

        $labels = [
            'name'               => $plural,
            'singular_name'      => $singular,
            'add_new'            => 'Add New',
            'add_new_item'       => 'Add New ' . $singular,
            'edit_item'          => 'Edit ' . $singular,
            'new_item'           => 'New ' . $singular,
            'view_item'          => 'View ' . $singular,
            'search_items'       => 'Search ' . $plural,
            'not_found'          => 'No ' . strtolower( $plural ) . ' found',
            'not_found_in_trash' => 'No ' . strtolower( $plural ) . ' found in Trash',
            'menu_name'          => $plural,
        ];

        $supports = $c['supports'] ?? [ 'title', 'editor', 'thumbnail' ];

        $args = [
            'labels'              => $labels,
            'description'         => sanitize_textarea_field( $c['description'] ?? '' ),
            'public'              => ! empty( $c['public'] ),
            'show_ui'             => true,
            'show_in_menu'        => true,
            'show_in_rest'        => ! empty( $c['show_in_rest'] ),
            'menu_icon'           => sanitize_text_field( $c['menu_icon'] ?? 'dashicons-admin-post' ),
            'supports'            => array_map( 'sanitize_key', (array) $supports ),
            'has_archive'         => ! empty( $c['has_archive'] ),
            'rewrite'             => [ 'slug' => $slug ],
        ];

        register_post_type( $slug, $args );
    }

    private static function do_register_taxonomy( array $c ) {
        $slug       = sanitize_key( $c['slug'] ?? '' );
        $post_types = array_map( 'sanitize_key', (array) ( $c['post_types'] ?? [] ) );
        if ( ! $slug || empty( $post_types ) ) return;

        $singular = sanitize_text_field( $c['singular'] ?? ucfirst( $slug ) );
        $plural   = sanitize_text_field( $c['plural']   ?? $singular . 's' );

        $labels = [
            'name'              => $plural,
            'singular_name'     => $singular,
            'search_items'      => 'Search ' . $plural,
            'all_items'         => 'All ' . $plural,
            'parent_item'       => 'Parent ' . $singular,
            'parent_item_colon' => 'Parent ' . $singular . ':',
            'edit_item'         => 'Edit ' . $singular,
            'update_item'       => 'Update ' . $singular,
            'add_new_item'      => 'Add New ' . $singular,
            'new_item_name'     => 'New ' . $singular . ' Name',
            'menu_name'         => $plural,
        ];

        $args = [
            'labels'       => $labels,
            'hierarchical' => ! empty( $c['hierarchical'] ),
            'public'       => ! empty( $c['public'] ),
            'show_ui'      => true,
            'show_in_rest' => ! empty( $c['show_in_rest'] ),
            'rewrite'      => [ 'slug' => $slug ],
        ];

        register_taxonomy( $slug, $post_types, $args );
    }

    // ── REST: CPTs ─────────────────────────────────────────────────────────────

    public static function get_cpts( WP_REST_Request $request ): WP_REST_Response {
        $cpts = get_option( self::CPT_OPTION, [] );
        return new WP_REST_Response( array_values( $cpts ), 200 );
    }

    public static function save_cpt( WP_REST_Request $request ): WP_REST_Response {
        $body = $request->get_json_params();
        $slug = sanitize_key( $body['slug'] ?? '' );

        if ( ! $slug ) {
            return new WP_REST_Response( [ 'error' => 'Slug is required.' ], 400 );
        }

        // Guard against overwriting built-in post types.
        $reserved = [ 'post', 'page', 'attachment', 'revision', 'nav_menu_item', 'custom_css', 'customize_changeset', 'oembed_cache', 'user_request', 'wp_block', 'wp_template', 'wp_template_part', 'wp_global_styles', 'wp_navigation' ];
        if ( in_array( $slug, $reserved, true ) ) {
            return new WP_REST_Response( [ 'error' => 'This slug is reserved by WordPress.' ], 400 );
        }

        $cpts          = get_option( self::CPT_OPTION, [] );
        $cpts[ $slug ] = [
            'slug'         => $slug,
            'singular'     => sanitize_text_field( $body['singular']    ?? ucfirst( $slug ) ),
            'plural'       => sanitize_text_field( $body['plural']      ?? ucfirst( $slug ) . 's' ),
            'description'  => sanitize_textarea_field( $body['description'] ?? '' ),
            'menu_icon'    => sanitize_text_field( $body['menu_icon']   ?? 'dashicons-admin-post' ),
            'public'       => ! empty( $body['public'] ),
            'show_in_rest' => ! empty( $body['show_in_rest'] ),
            'has_archive'  => ! empty( $body['has_archive'] ),
            'supports'     => array_map( 'sanitize_key', (array) ( $body['supports'] ?? [ 'title', 'editor' ] ) ),
        ];

        update_option( self::CPT_OPTION, $cpts );

        return new WP_REST_Response( [ 'success' => true, 'slug' => $slug ], 200 );
    }

    public static function delete_cpt( WP_REST_Request $request ): WP_REST_Response {
        $slug = sanitize_key( $request->get_param( 'slug' ) );
        $cpts = get_option( self::CPT_OPTION, [] );

        if ( ! isset( $cpts[ $slug ] ) ) {
            return new WP_REST_Response( [ 'error' => 'CPT not found.' ], 404 );
        }

        unset( $cpts[ $slug ] );
        update_option( self::CPT_OPTION, $cpts );

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    // ── REST: Taxonomies ───────────────────────────────────────────────────────

    public static function get_taxonomies( WP_REST_Request $request ): WP_REST_Response {
        $taxes = get_option( self::TAX_OPTION, [] );
        return new WP_REST_Response( array_values( $taxes ), 200 );
    }

    public static function save_taxonomy( WP_REST_Request $request ): WP_REST_Response {
        $body = $request->get_json_params();
        $slug = sanitize_key( $body['slug'] ?? '' );

        if ( ! $slug ) {
            return new WP_REST_Response( [ 'error' => 'Slug is required.' ], 400 );
        }

        $reserved = [ 'category', 'post_tag', 'nav_menu', 'link_category', 'post_format' ];
        if ( in_array( $slug, $reserved, true ) ) {
            return new WP_REST_Response( [ 'error' => 'This slug is reserved by WordPress.' ], 400 );
        }

        $taxes         = get_option( self::TAX_OPTION, [] );
        $taxes[ $slug ] = [
            'slug'         => $slug,
            'singular'     => sanitize_text_field( $body['singular']   ?? ucfirst( $slug ) ),
            'plural'       => sanitize_text_field( $body['plural']     ?? ucfirst( $slug ) . 's' ),
            'hierarchical' => ! empty( $body['hierarchical'] ),
            'public'       => ! empty( $body['public'] ),
            'show_in_rest' => ! empty( $body['show_in_rest'] ),
            'post_types'   => array_map( 'sanitize_key', (array) ( $body['post_types'] ?? [] ) ),
        ];

        update_option( self::TAX_OPTION, $taxes );

        return new WP_REST_Response( [ 'success' => true, 'slug' => $slug ], 200 );
    }

    public static function delete_taxonomy( WP_REST_Request $request ): WP_REST_Response {
        $slug  = sanitize_key( $request->get_param( 'slug' ) );
        $taxes = get_option( self::TAX_OPTION, [] );

        if ( ! isset( $taxes[ $slug ] ) ) {
            return new WP_REST_Response( [ 'error' => 'Taxonomy not found.' ], 404 );
        }

        unset( $taxes[ $slug ] );
        update_option( self::TAX_OPTION, $taxes );

        return new WP_REST_Response( [ 'success' => true ], 200 );
    }

    // ── REST: List all registered post types (built-in + custom) for taxonomy picker ──

    public static function get_all_post_types( WP_REST_Request $request ): WP_REST_Response {
        $post_types = get_post_types( [ 'show_ui' => true ], 'objects' );
        $result = [];
        foreach ( $post_types as $pt ) {
            $result[] = [
                'slug'  => $pt->name,
                'label' => $pt->labels->name ?? $pt->name,
            ];
        }
        return new WP_REST_Response( $result, 200 );
    }
}
