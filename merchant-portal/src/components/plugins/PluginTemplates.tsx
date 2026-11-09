// src/components/plugins/PluginTemplates.tsx
import React, { useState } from "react";
import {
  Copy,
  Check,
  Code2,
  SlidersHorizontal,
} from "lucide-react";

const WOOCOMMERCE_PHP_CODE = `<?php
/**
 * Plugin Name: Postcode360 Spatial Postcode Checkout for WooCommerce
 * Plugin URI:  https://github.com/Ali-PRP/postcode360
 * Description: Embeds the Postcode360 3-Tier Spatial Postcode Resolution widget into WooCommerce checkout (Abuja Pilot). Zero-PII HMAC-SHA256 verification + PostGIS building polygon resolution.
 * Version:     1.2.0
 * Author:      NovaSync Solutions
 * License:     MIT
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly
}

class Postcode360_WooCommerce_Postcode_Checkout {

    private $api_base_url;
    private $publishable_key;

    public function __construct() {
        $this->api_base_url    = get_option( 'postcode360_api_base_url', 'http://localhost:8000' );
        $this->publishable_key = get_option( 'postcode360_publishable_key', 'pk_test_postcode360_abuja_01' );

        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_postcode360_widget' ) );
        add_action( 'woocommerce_after_checkout_billing_form', array( $this, 'render_postcode360_widget_container' ) );
        add_action( 'woocommerce_checkout_process', array( $this, 'validate_postcode360_postcode' ) );
        add_action( 'woocommerce_checkout_update_order_meta', array( $this, 'save_postcode360_spatial_meta' ) );
    }

    public function enqueue_postcode360_widget() {
        if ( ! is_checkout() ) {
            return;
        }

        wp_enqueue_style(
            'maplibre-gl-css',
            'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
            array(),
            '4.7.1'
        );

        wp_enqueue_script(
            'postcode360-widget-sdk',
            'http://localhost:5173/postcode360-widget.js',
            array( 'jquery' ),
            '1.2.0',
            true
        );

        wp_localize_script( 'postcode360-widget-sdk', 'Postcode360Config', array(
            'apiBaseUrl'     => esc_url_raw( $this->api_base_url ),
            'publishableKey' => esc_attr( $this->publishable_key ),
            'origin'         => esc_url_raw( get_site_url() ),
            'pilotRegion'    => 'ABUJA_FCT',
            'forceMock'      => true,
        ) );
    }

    public function render_postcode360_widget_container( $checkout ) {
        echo '<div id="postcode360-woocommerce-mount" class="postcode360-checkout-card">';
        echo '  <h4>' . esc_html__( 'Postcode360 Spatial Postcode Verification (Abuja)', 'postcode360' ) . '</h4>';
        echo '  <p class="postcode360-privacy-note">Zero-PII HMAC-SHA256 verification • PostGIS Building Footprint</p>';
        echo '  <div id="postcode360-widget-root"></div>';

        woocommerce_form_field( 'postcode360_postcode', array(
            'type'        => 'text',
            'class'       => array( 'form-row-wide' ),
            'label'       => __( 'Resolved Postcode360 Postcode', 'postcode360' ),
            'placeholder' => __( 'FC-02-A09-DB-09', 'postcode360' ),
            'required'    => true,
        ), $checkout->get_value( 'postcode360_postcode' ) );

        echo '<input type="hidden" name="postcode360_subject_hash" id="postcode360_subject_hash" value="" />';
        echo '<input type="hidden" name="postcode360_idempotency_key" id="postcode360_idempotency_key" value="' . esc_attr( wp_generate_uuid4() ) . '" />';
        echo '</div>';
    }

    public function validate_postcode360_postcode() {
        if ( empty( $_POST['postcode360_postcode'] ) ) {
            wc_add_notice( __( 'Please verify and resolve your Postcode360 Spatial Postcode (e.g. FC-02-A09-DB-09) before placing your order.', 'postcode360' ), 'error' );
        }
    }

    public function save_postcode360_spatial_meta( $order_id ) {
        if ( ! empty( $_POST['postcode360_postcode'] ) ) {
            $postcode        = sanitize_text_field( $_POST['postcode360_postcode'] );
            $subject_hash    = sanitize_text_field( $_POST['postcode360_subject_hash'] ?? '' );
            $idempotency_key = sanitize_text_field( $_POST['postcode360_idempotency_key'] ?? 'wc-ord-' . $order_id );

            update_post_meta( $order_id, '_postcode360_postcode', $postcode );
            update_post_meta( $order_id, '_postcode360_subject_hash', $subject_hash );
            update_post_meta( $order_id, '_postcode360_idempotency_key', $idempotency_key );

            $order = wc_get_order( $order_id );
            $payload = array(
                'idempotency_key' => $idempotency_key,
                'postcode'        => $postcode,
                'customer_name'   => $order->get_formatted_billing_full_name(),
                'customer_phone'  => $order->get_billing_phone(),
                'amount_ngn'      => (float) $order->get_total(),
                'notes'           => $order->get_customer_note(),
            );

            wp_remote_post( trailingslashit( $this->api_base_url ) . 'orders', array(
                'headers' => array(
                    'Content-Type' => 'application/json',
                    'Origin'       => get_site_url(),
                ),
                'body'    => wp_json_encode( $payload ),
                'timeout' => 10,
            ) );
        }
    }
}

new Postcode360_WooCommerce_Postcode_Checkout();
`;

const SHOPIFY_LIQUID_CODE = `{% comment %}
  File: extensions/postcode360-checkout/blocks/postcode-widget.liquid
  Shopify Theme App Extension Block for Postcode360
{% endcomment %}

<div
  id="postcode360-shopify-embed-{{ block.id }}"
  class="postcode360-shopify-widget-wrapper"
  data-api-base="{{ block.settings.api_base_url | escape }}"
  data-publishable-key="{{ block.settings.publishable_key | escape }}"
  data-force-mock="{{ block.settings.force_mock_sandbox }}"
  data-accent-color="{{ block.settings.accent_color }}"
>
  <div class="postcode360-widget-header">
    <span class="postcode360-badge-emerald">Postcode360</span>
    <span class="postcode360-zero-pii-pill">Zero-PII HMAC-SHA256</span>
  </div>

  <p class="postcode360-helper-text">
    {{ block.settings.heading_text | default: "Verify your 3-Tier Abuja Postcode for instant rider dispatch" }}
  </p>

  <!-- Step 1: Zero-PII Handshake Input -->
  <div class="postcode360-field-group">
    <label for="postcode360-nin-email-{{ block.id }}">NIN (11 Digits) or Email (Hashed via HMAC-SHA256)</label>
    <div class="postcode360-row">
      <input
        type="text"
        id="postcode360-nin-email-{{ block.id }}"
        placeholder="12345678901 or shopper@postcode360.ng"
        autocomplete="off"
      />
      <button type="button" id="postcode360-verify-btn-{{ block.id }}">
        Verify & Unlock
      </button>
    </div>
  </div>

  <!-- Step 2: 3-Tier Spatial Postcode Lookup -->
  <div class="postcode360-field-group" id="postcode360-lookup-panel-{{ block.id }}" style="display:none;">
    <label for="postcode360-postcode-input-{{ block.id }}">NIPOST / Postcode360 3-Tier Code</label>
    <div class="postcode360-row">
      <input
        type="text"
        id="postcode360-postcode-input-{{ block.id }}"
        name="attributes[postcode360_postcode]"
        placeholder="FC-02-A09-DB-09"
        value="{{ cart.attributes.postcode360_postcode }}"
      />
      <button type="button" id="postcode360-resolve-btn-{{ block.id }}">
        Resolve Polygon
      </button>
    </div>
    <input type="hidden" name="attributes[postcode360_subject_hash]" id="postcode360-hash-{{ block.id }}" />
    <input type="hidden" name="attributes[postcode360_coordinates]" id="postcode360-coords-{{ block.id }}" />
  </div>

  <!-- MapLibre GL Building Footprint Canvas -->
  <div id="postcode360-maplibre-{{ block.id }}" style="height: 220px; width: 100%; border-radius: 10px; margin-top: 12px;"></div>
</div>

{% schema %}
{
  "name": "Postcode360 Postcode Widget",
  "target": "section",
  "settings": [
    {
      "type": "text",
      "id": "heading_text",
      "label": "Widget Heading",
      "default": "Verify your 3-Tier Abuja Postcode for instant delivery"
    },
    {
      "type": "text",
      "id": "api_base_url",
      "label": "FastAPI Backend URL",
      "default": "http://localhost:8000"
    },
    {
      "type": "text",
      "id": "publishable_key",
      "label": "Merchant Publishable Key",
      "default": "pk_test_postcode360_abuja_01"
    },
    {
      "type": "checkbox",
      "id": "force_mock_sandbox",
      "label": "Enable Abuja PostGIS Mock Sandbox",
      "default": true
    },
    {
      "type": "color",
      "id": "accent_color",
      "label": "Primary Brand Accent Color",
      "default": "#10B981"
    }
  ]
}
{% endschema %}
`;


const ENUMERATOR_SDK_CODE = `import { Postcode360Enumerator } from "@postcode360/enumerator-sdk";

// Initialize the Logistics & Crowdsourced Enumerator SDK in rider app
const enumerator = new Postcode360Enumerator({
  publishableKey: "pk_test_postcode360_abuja_01",
  partnerId: "gokada-logistics-abj",
  offlineSyncRadiusKm: 50,
  autoPromoteThreshold: 3, // Auto-promotes TP codes after 3 verified deliveries
});

// 1. Resolve Delivery Rooftop Polygon
const delivery = await enumerator.resolveRooftop({
  postcode: "FC-02-A09-DB-09",
  fallbackGps: { lat: 9.0765, lng: 7.4892 },
});

// 2. Mint Temporary Postcode (TP-...) for unmapped address
const newAddress = await enumerator.mintTemporaryCode({
  aliasName: "Banex Plaza Extension Gate 2",
  district: "Wuse II",
  coords: { lat: 9.0758, lng: 7.4904 },
  proofImageUrl: "https://images.postcode360.ng/pod/banex-gate2.jpg",
});

// 3. Verify Proof of Delivery (POD) GPS inside rooftop boundary
const podResult = await enumerator.submitDeliveryProof({
  orderId: "ord-wuse2-2026-001",
  riderId: "rider-haruna-01",
  riderCoords: { lat: 9.0765, lng: 7.4892 },
  podPhotoUrl: "https://images.postcode360.ng/pod/delivered-42-ademola.jpg",
});

console.log("GPS Distance from Rooftop:", podResult.gps_distance_from_polygon_m, "meters");
console.log("Rooftop GPS Verified:", podResult.gps_verified);
`;

export const PluginTemplates: React.FC = () => {
  const [activePluginTab, setActivePluginTab] = useState<
    "WOOCOMMERCE" | "SHOPIFY" | "ENUMERATOR"
  >("WOOCOMMERCE");
  const [copiedCode, setCopiedCode] = useState(false);
  const [shopifyHeading, setShopifyHeading] = useState(
    "Verify your 3-Tier Abuja Postcode for instant delivery",
  );
  const [shopifyAccent, setShopifyAccent] = useState("#10B981");

  const activeCode =
    activePluginTab === "WOOCOMMERCE"
      ? WOOCOMMERCE_PHP_CODE
      : activePluginTab === "SHOPIFY"
        ? SHOPIFY_LIQUID_CODE
        : ENUMERATOR_SDK_CODE;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Top Deliverable Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-violet-300">
              E-COMMERCE INTEGRATIONS
            </span>
            <span className="font-mono text-xs text-zinc-400">
              Drop-in E-Commerce Integrations
            </span>
          </div>
          <h1 className="mt-1 text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
            WooCommerce PHP Plugin &amp; Shopify Theme App Extension Liquid
            Block
          </h1>
          <p className="text-xs text-slate-500 dark:text-zinc-400 sm:text-sm">
            Production-ready plugin deliverables that inject{" "}
            <code className="text-emerald-300">@postcode360/widget</code> into
            WordPress/WooCommerce and Shopify checkouts.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900 dark:bg-[#08080A] p-1">
          <button
            type="button"
            onClick={() => setActivePluginTab("WOOCOMMERCE")}
            className={`rounded-lg px-3.5 py-2 font-mono text-xs font-semibold transition ${
              activePluginTab === "WOOCOMMERCE"
                ? "bg-violet-500 text-white"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            plugins/woocommerce-postcode360/postcode360-checkout.php
          </button>
          <button
            type="button"
            onClick={() => setActivePluginTab("SHOPIFY")}
            className={`rounded-lg px-3.5 py-2 font-mono text-xs font-semibold transition ${
              activePluginTab === "SHOPIFY"
                ? "bg-emerald-500 text-zinc-950"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            extensions/postcode360-checkout/blocks/postcode-widget.liquid
          </button>
          <button
            type="button"
            onClick={() => setActivePluginTab("ENUMERATOR")}
            className={`rounded-lg px-3.5 py-2 font-mono text-xs font-semibold transition ${
              activePluginTab === "ENUMERATOR"
                ? "bg-cyan-500 text-zinc-950"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            packages/@postcode360-enumerator-sdk/index.ts
          </button>
        </div>
      </div>

      {/* 12-Col Grid: Code Viewer (8 cols) + Shopify Theme Editor Simulator & Checklist (4 cols) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 8 Cols: Source Code Inspector */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] shadow-xl lg:col-span-8">
          <div className="flex items-center justify-between border-b border-white/10 bg-slate-100 dark:bg-[#16161E] px-4 py-3">
            <div className="flex items-center gap-2 font-mono text-xs text-slate-800 dark:text-zinc-200">
              <Code2 className="h-4 w-4 text-emerald-400" />
              <span>
                {activePluginTab === "WOOCOMMERCE"
                  ? "plugins/woocommerce-postcode360/postcode360-checkout.php"
                  : activePluginTab === "SHOPIFY"
                    ? "extensions/postcode360-checkout/blocks/postcode-widget.liquid"
                    : "packages/@postcode360-enumerator-sdk/index.ts"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-slate-900 dark:bg-[#08080A] px-3 py-1.5 font-mono text-xs text-emerald-300 transition hover:bg-white/10"
            >
              {copiedCode ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Copied to Clipboard</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy File</span>
                </>
              )}
            </button>
          </div>

          <pre className="max-h-[600px] flex-1 overflow-x-auto overflow-y-auto bg-slate-900 dark:bg-[#08080A] p-4 font-mono text-xs leading-relaxed text-zinc-300 sm:p-5">
            <code>{activeCode}</code>
          </pre>
        </div>

        {/* Right 4 Cols: Interactive Shopify Theme Editor Simulator & Contract Checklist */}
        <div className="space-y-5 lg:col-span-4">
          {/* Shopify Theme Editor Schema Simulator */}
          <div className="space-y-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] p-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <SlidersHorizontal className="h-4 w-4 text-emerald-400" />
                <span>Shopify Theme Editor Simulator</span>
              </h3>
              <span className="rounded bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
                App Embed Block
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="mb-1 block text-zinc-400">
                  Widget Heading (`block.settings.heading_text`)
                </label>
                <input
                  type="text"
                  value={shopifyHeading}
                  onChange={(e) => setShopifyHeading(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-slate-900 dark:bg-[#08080A] px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-zinc-400">
                  Brand Accent (`accent_color`)
                </span>
                <div className="flex items-center gap-2">
                  {["#10B981", "#8B5CF6", "#06B6D4"].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setShopifyAccent(c)}
                      className={`h-6 w-6 rounded-full border-2 ${
                        shopifyAccent === c
                          ? "border-white"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Live Embedded Block Preview */}
            <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900 dark:bg-[#08080A] p-4">
              <div className="flex items-center justify-between">
                <span
                  className="rounded px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-950"
                  style={{ backgroundColor: shopifyAccent }}
                >
                  Postcode360
                </span>
                <span className="font-mono text-[10px] text-zinc-400">
                  Zero-PII HMAC-SHA256
                </span>
              </div>
              <p className="text-xs font-medium text-slate-800 dark:text-zinc-200">
                {shopifyHeading}
              </p>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] p-2.5 font-mono text-[11px] text-emerald-300">
                <span>FC-02-A09-DB-09</span>
                <span className="text-zinc-400">Wuse II, Abuja</span>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] p-2 font-mono text-[11px] text-zinc-400">
                building_polygon: 7 vertices • TIER_1_REDIS_CACHE
              </div>
            </div>
          </div>

          </div>
      </div>
    </div>
  );
};
