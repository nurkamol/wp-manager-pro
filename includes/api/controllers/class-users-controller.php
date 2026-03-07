<?php
namespace WP_Manager_Pro\API\Controllers;

if ( ! defined( 'ABSPATH' ) ) exit;

use WP_REST_Request;
use WP_REST_Response;
use WP_Error;

class Users_Controller {

    public static function get_users( WP_REST_Request $request ) {
        $page    = absint( $request->get_param( 'page' ) ) ?: 1;
        $limit   = min( absint( $request->get_param( 'limit' ) ) ?: 20, 100 );
        $search  = sanitize_text_field( $request->get_param( 'search' ) );
        $role    = sanitize_text_field( $request->get_param( 'role' ) );

        $args = [
            'number'  => $limit,
            'offset'  => ( $page - 1 ) * $limit,
            'orderby' => 'registered',
            'order'   => 'DESC',
        ];

        if ( $search ) {
            $args['search']         = '*' . $search . '*';
            $args['search_columns'] = [ 'user_login', 'user_email', 'display_name' ];
        }

        if ( $role ) {
            $args['role'] = $role;
        }

        $user_query = new \WP_User_Query( $args );
        $users      = $user_query->get_results();
        $total      = $user_query->get_total();

        $current_user_id = get_current_user_id();

        $formatted = array_map( function( $user ) use ( $current_user_id ) {
            return [
                'id'           => $user->ID,
                'login'        => $user->user_login,
                'email'        => $user->user_email,
                'display_name' => $user->display_name,
                'first_name'   => $user->first_name,
                'last_name'    => $user->last_name,
                'registered'   => $user->user_registered,
                'roles'        => $user->roles,
                'avatar'       => get_avatar_url( $user->ID, [ 'size' => 40 ] ),
                'is_current'   => $user->ID === $current_user_id,
                'post_count'   => count_user_posts( $user->ID ),
                'admin_url'    => admin_url( 'user-edit.php?user_id=' . $user->ID ),
                'status'       => get_user_meta( $user->ID, 'wmp_user_status', true ) ?: 'active',
            ];
        }, $users );

        // Get available roles.
        global $wp_roles;
        $roles = [];
        if ( $wp_roles ) {
            foreach ( $wp_roles->roles as $key => $role_data ) {
                $roles[] = [ 'key' => $key, 'name' => $role_data['name'] ];
            }
        }

        return new WP_REST_Response( [
            'users' => $formatted,
            'total' => $total,
            'page'  => $page,
            'limit' => $limit,
            'pages' => ceil( $total / $limit ),
            'roles' => $roles,
        ], 200 );
    }

    public static function change_role( WP_REST_Request $request ) {
        $user_id = absint( $request->get_param( 'user_id' ) );
        $role    = sanitize_text_field( $request->get_param( 'role' ) );

        if ( ! $user_id || ! $role ) {
            return new WP_Error( 'missing_params', 'User ID and role are required.', [ 'status' => 400 ] );
        }

        // Cannot change own role.
        if ( $user_id === get_current_user_id() ) {
            return new WP_Error( 'cannot_change_own', 'Cannot change your own role.', [ 'status' => 403 ] );
        }

        $user = get_user_by( 'id', $user_id );

        if ( ! $user ) {
            return new WP_Error( 'user_not_found', 'User not found.', [ 'status' => 404 ] );
        }

        // Validate role exists.
        global $wp_roles;
        if ( ! array_key_exists( $role, $wp_roles->roles ) ) {
            return new WP_Error( 'invalid_role', 'Invalid role.', [ 'status' => 400 ] );
        }

        $user->set_role( $role );

        return new WP_REST_Response( [
            'success' => true,
            'message' => sprintf( 'User %s role changed to %s.', $user->display_name, $role ),
        ], 200 );
    }

    public static function login_as_user( WP_REST_Request $request ) {
        $user_id = absint( $request->get_param( 'user_id' ) );

        if ( ! $user_id ) {
            return new WP_Error( 'missing_param', 'User ID is required.', [ 'status' => 400 ] );
        }

        if ( $user_id === get_current_user_id() ) {
            return new WP_Error( 'same_user', 'You are already logged in as this user.', [ 'status' => 400 ] );
        }

        $user = get_user_by( 'id', $user_id );

        if ( ! $user ) {
            return new WP_Error( 'user_not_found', 'User not found.', [ 'status' => 404 ] );
        }

        // Store original admin in session.
        $original_user_id = get_current_user_id();
        update_user_meta( $user_id, 'wmp_original_admin', $original_user_id );

        // Generate a temporary login token.
        $token = wp_generate_password( 32, false );
        set_transient( 'wmp_login_as_' . $user_id, [
            'token'    => $token,
            'admin_id' => $original_user_id,
        ], 300 ); // 5 minutes.

        $login_url = add_query_arg( [
            'wmp_login_as' => $user_id,
            'wmp_token'    => $token,
        ], admin_url() );

        return new WP_REST_Response( [
            'success'   => true,
            'login_url' => $login_url,
            'message'   => 'Switching to user: ' . $user->display_name,
        ], 200 );
    }

    public static function delete_user( WP_REST_Request $request ) {
        $user_id     = absint( $request->get_param( 'user_id' ) );
        $reassign_id = absint( $request->get_param( 'reassign' ) );

        if ( ! $user_id ) {
            return new WP_Error( 'missing_param', 'User ID is required.', [ 'status' => 400 ] );
        }

        if ( $user_id === get_current_user_id() ) {
            return new WP_Error( 'cannot_delete_self', 'Cannot delete your own account.', [ 'status' => 403 ] );
        }

        require_once ABSPATH . 'wp-admin/includes/user.php';

        $result = wp_delete_user( $user_id, $reassign_id ?: null );

        if ( ! $result ) {
            return new WP_Error( 'delete_failed', 'Failed to delete user.', [ 'status' => 500 ] );
        }

        return new WP_REST_Response( [ 'success' => true, 'message' => 'User deleted successfully.' ], 200 );
    }
}
