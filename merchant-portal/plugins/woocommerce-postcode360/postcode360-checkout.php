<?php
/**
 * Plugin Name: postcode360 Checkout for WooCommerce
 * Plugin URI:  https://github.com/Ali-PRP/postcode360
 * Description: 3-Tier Nigerian Spatial Postcode Resolution (NIPOST + PostGIS) with Zero-PII Handshake & Idempotent Orders for WooCommerce Checkout.
 * Version:     1.0.0
 * Author:      Team postcode360 (Abuja Pilot)
 * License:     MIT
 */

if (!defined('ABSPATH')) {
    exit;
}

/**
 * 1. Inject the NIPOST / Alias Postcode field into WooCommerce Billing Checkout
 */
add_filter('woocommerce_checkout_fields', 'postcode360_register_checkout_field');
function postcode360_register_checkout_field($fields) {
    $fields['billing']['billing_postcode360'] = array(
        'type'        => 'text',
        'label'       => __('postcode360 Spatial Code (NIPOST / Alias)', 'postcode360'),
        'placeholder' => _x('FC-02-A09-DB-09', 'placeholder', 'postcode360'),
        'required'    => true,
        'class'       => array('form-row-wide', 'postcode360-field'),
        'clear'       => true,
        'priority'    => 65,
    );
    return $fields;
}

/**
 * 2. Enqueue the Origin-Bound postcode360 Widget Script on Checkout
 */
add_action('wp_enqueue_scripts', 'postcode360_enqueue_scripts');
function postcode360_enqueue_scripts() {
    if (!function_exists('is_checkout') || !is_checkout()) {
        return;
    }

    wp_enqueue_script(
        'postcode360-widget-sdk',
        'http://localhost:5173/postcode360-widget.js',
        array(),
        '1.0.0',
        true
    );

    wp_localize_script('postcode360-widget-sdk', 'Postcode360Config', array(
        'apiBaseUrl'     => 'http://localhost:8000',
        'publishableKey' => 'pk_test_findam_abuja_01',
        'origin'         => site_url(),
        'forceMock'      => true,
    ));
}

/**
 * 3. Forward WooCommerce Order to postcode360 POST /orders with Strict Idempotency Key
 */
add_action('woocommerce_checkout_order_processed', 'postcode360_sync_spatial_order', 10, 3);
function postcode360_sync_spatial_order($order_id, $posted_data, $order) {
    $postcode = isset($_POST['billing_postcode360'])
        ? sanitize_text_field($_POST['billing_postcode360'])
        : 'FC-02-A09-DB-09';

    $payload = array(
        'idempotency_key' => 'woo-ord-' . intval($order_id),
        'postcode'        => $postcode,
        'customer_name'   => trim($order->get_billing_first_name() . ' ' . $order->get_billing_last_name()),
        'customer_phone'  => $order->get_billing_phone(),
        'amount_ngn'      => floatval($order->get_total()),
        'notes'           => $order->get_customer_note(),
    );

    wp_remote_post('http://localhost:8000/orders', array(
        'headers' => array(
            'Content-Type' => 'application/json',
            'Origin'       => site_url(),
        ),
        'body'    => wp_json_encode($payload),
        'timeout' => 10,
    ));
}