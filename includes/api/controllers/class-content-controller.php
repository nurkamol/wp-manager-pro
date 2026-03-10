<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

/**
 * Content_Controller
 *
 * Bulk Post Editor, Post Duplicator, Scheduled Post Manager, Options Table Editor.
 *
 * v2.3.0
 */
class Content_Controller {

    // =========================================================================
    // GET /content/post-types
    // =========================================================================

    /**
     * Returns all registered public post types.
     */
    public static function get_post_types( WP_REST_Request $request ) {
        $types = get_post_types( [ 'public' => true ], 'objects' );
        $out   = [];
        foreach ( $types as $type ) {
            $out[] = [
                'slug'  => $type->name,
                'label' => $type->label,
            ];
        }
        return rest_ensure_response( $out );
    }

    // =========================================================================
    // GET /content/authors
    // =========================================================================

    /**
     * Returns users who have the ability to publish posts.
     */
    public static function get_authors( WP_REST_Request $request ) {
        $users = get_users( [
            'capability' => 'edit_posts',
            'number'     => 200,
        ] );
        $out = [];
        foreach ( $users as $user ) {
            $out[] = [
                'id'   => $user->ID,
                'name' => $user->display_name,
            ];
        }
        return rest_ensure_response( $out );
    }

    // =========================================================================
    // GET /content/posts
    // =========================================================================

    /**
     * Paginated list of posts with optional filters.
     */
    public static function get_posts( WP_REST_Request $request ) {
        $post_type = sanitize_key( $request->get_param( 'post_type' ) ?: 'any' );
        $status    = sanitize_text_field( $request->get_param( 'status' ) ?: 'any' );
        $search    = sanitize_text_field( $request->get_param( 'search' ) ?: '' );
        $per_page  = min( 100, max( 1, (int) ( $request->get_param( 'per_page' ) ?: 20 ) ) );
        $page      = max( 1, (int) ( $request->get_param( 'page' ) ?: 1 ) );

        $args = [
            'post_type'      => $post_type,
            'post_status'    => $status,
            'posts_per_page' => $per_page,
            'paged'          => $page,
            'orderby'        => 'date',
            'order'          => 'DESC',
        ];

        if ( $search ) {
            $args['s'] = $search;
        }

        $query = new \WP_Query( $args );
        $posts = [];

        foreach ( $query->posts as $post ) {
            $author = get_userdata( $post->post_author );
            $cats   = [];
            if ( is_object_in_taxonomy( $post->post_type, 'category' ) ) {
                $term_objs = wp_get_post_categories( $post->ID, [ 'fields' => 'all' ] );
                foreach ( $term_objs as $t ) {
                    $cats[] = [ 'id' => $t->term_id, 'name' => $t->name ];
                }
            }

            $posts[] = [
                'id'         => $post->ID,
                'title'      => get_the_title( $post ),
                'status'     => $post->post_status,
                'post_type'  => $post->post_type,
                'date'       => $post->post_date,
                'author_id'  => (int) $post->post_author,
                'author'     => $author ? $author->display_name : '',
                'categories' => $cats,
                'edit_link'  => get_edit_post_link( $post->ID, '' ),
                'view_link'  => get_permalink( $post->ID ),
            ];
        }

        return rest_ensure_response( [
            'posts'       => $posts,
            'total'       => (int) $query->found_posts,
            'total_pages' => (int) $query->max_num_pages,
            'page'        => $page,
        ] );
    }

    // =========================================================================
    // POST /content/posts/bulk-edit
    // =========================================================================

    /**
     * Apply field changes to multiple posts.
     * Accepts: { ids: int[], updates: { status?, date?, author_id?, category_id? } }
     */
    public static function bulk_edit_posts( WP_REST_Request $request ) {
        $ids     = array_map( 'absint', (array) $request->get_param( 'ids' ) );
        $updates = (array) $request->get_param( 'updates' );

        if ( empty( $ids ) || empty( $updates ) ) {
            return new WP_Error( 'invalid_params', 'ids and updates are required', [ 'status' => 400 ] );
        }

        $updated = 0;

        foreach ( $ids as $post_id ) {
            if ( ! get_post( $post_id ) ) {
                continue;
            }

            $post_data = [ 'ID' => $post_id ];

            if ( isset( $updates['status'] ) && $updates['status'] !== '' ) {
                $post_data['post_status'] = sanitize_text_field( $updates['status'] );
            }

            if ( isset( $updates['date'] ) && $updates['date'] !== '' ) {
                $post_data['post_date']     = get_date_from_gmt( sanitize_text_field( $updates['date'] ) );
                $post_data['post_date_gmt'] = sanitize_text_field( $updates['date'] );
            }

            if ( isset( $updates['author_id'] ) && $updates['author_id'] !== '' ) {
                $post_data['post_author'] = absint( $updates['author_id'] );
            }

            if ( count( $post_data ) > 1 ) {
                wp_update_post( $post_data );
            }

            if ( isset( $updates['category_id'] ) && $updates['category_id'] !== '' ) {
                $cat_id = absint( $updates['category_id'] );
                if ( is_object_in_taxonomy( get_post_type( $post_id ), 'category' ) ) {
                    wp_set_post_categories( $post_id, [ $cat_id ] );
                }
            }

            $updated++;
        }

        return rest_ensure_response( [ 'updated' => $updated ] );
    }

    // =========================================================================
    // POST /content/posts/duplicate
    // =========================================================================

    /**
     * Clone a post as a new draft.
     * Accepts: { id, copy_meta?, copy_taxonomies?, copy_thumbnail? }
     */
    public static function duplicate_post( WP_REST_Request $request ) {
        $id              = absint( $request->get_param( 'id' ) );
        $copy_meta       = $request->get_param( 'copy_meta' ) !== false;
        $copy_taxonomies = $request->get_param( 'copy_taxonomies' ) !== false;
        $copy_thumbnail  = $request->get_param( 'copy_thumbnail' ) !== false;

        $original = get_post( $id );
        if ( ! $original ) {
            return new WP_Error( 'not_found', 'Post not found', [ 'status' => 404 ] );
        }

        $new_post = [
            'post_title'     => $original->post_title . ' (Copy)',
            'post_content'   => $original->post_content,
            'post_excerpt'   => $original->post_excerpt,
            'post_status'    => 'draft',
            'post_type'      => $original->post_type,
            'post_author'    => $original->post_author,
            'post_parent'    => $original->post_parent,
            'menu_order'     => $original->menu_order,
            'comment_status' => $original->comment_status,
            'ping_status'    => $original->ping_status,
        ];

        $new_id = wp_insert_post( $new_post );
        if ( is_wp_error( $new_id ) ) {
            return new WP_Error( 'duplicate_failed', $new_id->get_error_message(), [ 'status' => 500 ] );
        }

        // Copy post meta.
        if ( $copy_meta ) {
            $skip_keys = [ '_thumbnail_id', '_wp_old_slug', '_edit_lock', '_edit_last' ];
            $meta_data = get_post_meta( $id );
            foreach ( $meta_data as $meta_key => $meta_values ) {
                if ( in_array( $meta_key, $skip_keys, true ) ) {
                    continue;
                }
                foreach ( $meta_values as $meta_value ) {
                    add_post_meta( $new_id, $meta_key, maybe_unserialize( $meta_value ) );
                }
            }
        }

        // Copy taxonomies.
        if ( $copy_taxonomies ) {
            $taxonomies = get_object_taxonomies( $original->post_type );
            foreach ( $taxonomies as $taxonomy ) {
                $terms = wp_get_object_terms( $id, $taxonomy, [ 'fields' => 'ids' ] );
                if ( ! empty( $terms ) && ! is_wp_error( $terms ) ) {
                    wp_set_object_terms( $new_id, $terms, $taxonomy );
                }
            }
        }

        // Copy featured image.
        if ( $copy_thumbnail ) {
            $thumbnail_id = get_post_thumbnail_id( $id );
            if ( $thumbnail_id ) {
                set_post_thumbnail( $new_id, $thumbnail_id );
            }
        }

        return rest_ensure_response( [
            'new_id'    => $new_id,
            'edit_link' => get_edit_post_link( $new_id, '' ),
        ] );
    }

    // =========================================================================
    // GET /content/scheduled
    // =========================================================================

    /**
     * List all future-scheduled posts.
     */
    public static function get_scheduled( WP_REST_Request $request ) {
        $post_type = sanitize_key( $request->get_param( 'post_type' ) ?: 'any' );

        $args = [
            'post_type'      => $post_type,
            'post_status'    => 'future',
            'posts_per_page' => 200,
            'orderby'        => 'date',
            'order'          => 'ASC',
        ];

        $query = new \WP_Query( $args );
        $posts = [];

        $date_format = get_option( 'date_format' ) . ' ' . get_option( 'time_format' );

        foreach ( $query->posts as $post ) {
            $author = get_userdata( $post->post_author );
            $posts[] = [
                'id'              => $post->ID,
                'title'           => get_the_title( $post ),
                'post_type'       => $post->post_type,
                'scheduled_gmt'   => $post->post_date_gmt,
                'scheduled_local' => $post->post_date,
                'scheduled_fmt'   => date_i18n( $date_format, strtotime( $post->post_date ) ),
                'author'          => $author ? $author->display_name : '',
                'edit_link'       => get_edit_post_link( $post->ID, '' ),
                'view_link'       => get_permalink( $post->ID ),
            ];
        }

        // Gather distinct post types that have future posts.
        global $wpdb;
        $future_types = $wpdb->get_col(
            "SELECT DISTINCT post_type FROM {$wpdb->posts} WHERE post_status = 'future'"
        );

        return rest_ensure_response( [
            'posts'      => $posts,
            'total'      => count( $posts ),
            'post_types' => $future_types,
        ] );
    }

    // =========================================================================
    // GET /content/options
    // =========================================================================

    /**
     * Paginated, searchable list of wp_options rows.
     */
    public static function get_options( WP_REST_Request $request ) {
        global $wpdb;

        $search   = sanitize_text_field( $request->get_param( 'search' ) ?: '' );
        $per_page = min( 100, max( 1, (int) ( $request->get_param( 'per_page' ) ?: 30 ) ) );
        $page     = max( 1, (int) ( $request->get_param( 'page' ) ?: 1 ) );
        $autoload = $request->get_param( 'autoload' ); // 'yes', 'no', or null

        $where  = [];
        $params = [];

        if ( $search ) {
            $where[]  = 'option_name LIKE %s';
            $params[] = '%' . $wpdb->esc_like( $search ) . '%';
        }

        if ( $autoload !== null && $autoload !== '' ) {
            $where[]  = 'autoload = %s';
            $params[] = sanitize_text_field( $autoload );
        }

        $where_sql = $where ? 'WHERE ' . implode( ' AND ', $where ) : '';
        $offset    = ( $page - 1 ) * $per_page;

        $count_sql = "SELECT COUNT(*) FROM {$wpdb->options} {$where_sql}";
        $total     = $params
            ? (int) $wpdb->get_var( $wpdb->prepare( $count_sql, ...$params ) )
            : (int) $wpdb->get_var( $count_sql );

        $query_sql  = "SELECT option_name, option_value, autoload FROM {$wpdb->options} {$where_sql} ORDER BY option_name ASC LIMIT %d OFFSET %d";
        $all_params = array_merge( $params, [ $per_page, $offset ] );
        $rows       = $wpdb->get_results( $wpdb->prepare( $query_sql, ...$all_params ) );

        $options = [];
        foreach ( $rows as $row ) {
            $raw  = $row->option_value;
            $type = self::detect_option_type( $raw );

            $options[] = [
                'option_name'  => $row->option_name,
                'option_value' => mb_substr( $raw, 0, 500 ),
                'full_length'  => strlen( $raw ),
                'autoload'     => $row->autoload,
                'type'         => $type,
            ];
        }

        return rest_ensure_response( [
            'options'     => $options,
            'total'       => $total,
            'total_pages' => (int) ceil( $total / $per_page ),
            'page'        => $page,
        ] );
    }

    // =========================================================================
    // GET /content/options/(?P<name>[\w%-]+)
    // =========================================================================

    /**
     * Return the full value of a single option (for the edit dialog).
     */
    public static function get_option_value( WP_REST_Request $request ) {
        $option_name = sanitize_text_field( rawurldecode( $request->get_param( 'name' ) ) );

        global $wpdb;
        $row = $wpdb->get_row(
            $wpdb->prepare(
                "SELECT option_name, option_value, autoload FROM {$wpdb->options} WHERE option_name = %s",
                $option_name
            )
        );

        if ( ! $row ) {
            return new WP_Error( 'not_found', 'Option not found', [ 'status' => 404 ] );
        }

        return rest_ensure_response( [
            'option_name'  => $row->option_name,
            'option_value' => $row->option_value,
            'autoload'     => $row->autoload,
        ] );
    }

    // =========================================================================
    // POST /content/options
    // =========================================================================

    /**
     * Create or update a wp_options row.
     * Accepts: { option_name, option_value, autoload? }
     */
    public static function update_option_value( WP_REST_Request $request ) {
        $option_name  = sanitize_text_field( $request->get_param( 'option_name' ) );
        $option_value = $request->get_param( 'option_value' ); // keep raw
        $autoload     = in_array( $request->get_param( 'autoload' ), [ 'yes', 'no' ], true )
            ? $request->get_param( 'autoload' )
            : 'yes';

        if ( ! $option_name ) {
            return new WP_Error( 'invalid_params', 'option_name is required', [ 'status' => 400 ] );
        }

        global $wpdb;
        $existing = $wpdb->get_var(
            $wpdb->prepare( "SELECT option_id FROM {$wpdb->options} WHERE option_name = %s", $option_name )
        );

        if ( $existing ) {
            $wpdb->update(
                $wpdb->options,
                [ 'option_value' => $option_value, 'autoload' => $autoload ],
                [ 'option_name'  => $option_name ],
                [ '%s', '%s' ],
                [ '%s' ]
            );
        } else {
            $wpdb->insert(
                $wpdb->options,
                [ 'option_name' => $option_name, 'option_value' => $option_value, 'autoload' => $autoload ],
                [ '%s', '%s', '%s' ]
            );
        }

        return rest_ensure_response( [ 'success' => true, 'option_name' => $option_name ] );
    }

    // =========================================================================
    // DELETE /content/options
    // =========================================================================

    /**
     * Delete a wp_options row.
     * Accepts: { option_name }
     */
    public static function delete_option_value( WP_REST_Request $request ) {
        $option_name = sanitize_text_field( $request->get_param( 'option_name' ) );

        if ( ! $option_name ) {
            return new WP_Error( 'invalid_params', 'option_name is required', [ 'status' => 400 ] );
        }

        $protected = [ 'siteurl', 'blogname', 'admin_email', 'blogdescription', 'blogpublic', 'blog_public', 'active_plugins' ];
        if ( in_array( $option_name, $protected, true ) ) {
            return new WP_Error( 'protected', 'This option is protected and cannot be deleted.', [ 'status' => 403 ] );
        }

        $result = delete_option( $option_name );
        return rest_ensure_response( [ 'success' => $result, 'option_name' => $option_name ] );
    }

    // =========================================================================
    // Private helpers
    // =========================================================================

    private static function detect_option_type( string $value ): string {
        if ( is_serialized( $value ) ) {
            return 'serialized';
        }
        if ( $value === '' ) {
            return 'empty';
        }
        if ( is_numeric( $value ) && strval( (int) $value ) === $value ) {
            return 'integer';
        }
        if ( is_numeric( $value ) ) {
            return 'float';
        }
        if ( strlen( $value ) > 1 && ( $value[0] === '{' || $value[0] === '[' ) ) {
            json_decode( $value );
            if ( json_last_error() === JSON_ERROR_NONE ) {
                return 'json';
            }
        }
        return 'string';
    }
}
