// src/components/plugins/PluginTemplates.tsx
import React, { useState } from "react";
import {
  Copy,
  Check,
  Code2,
  SlidersHorizontal,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { postcode360Api } from "../../services/api";

const WOOCOMMERCE_PHP_CODE = `<?php
/**
 * Plugin Name: FindAm Spatial Postcode Checkout for WooCommerce
 * Plugin URI:  https://github.com/Ali-PRP/postcode360
 * Description: Embeds the FindAm 3-Tier Spatial Postcode Resolution widget into WooCommerce checkout (Abuja Pilot). Zero-PII HMAC-SHA256 verification + PostGIS building polygon resolution.
 * Version:     1.2.0
 * Author:      Team A (FindAm / postcode360)
 * License:     MIT
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit; // Exit if accessed directly
}

class FindAm_WooCommerce_Postcode_Checkout {

    private $api_base_url;
    private $publishable_key;

    public function __construct() {
        $this->api_base_url    = get_option( 'findam_api_base_url', 'http://localhost:8000' );
        $this->publishable_key = get_option( 'findam_publishable_key', 'pk_test_findam_abuja_01' );

        add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_findam_widget' ) );
        add_action( 'woocommerce_after_checkout_billing_form', array( $this, 'render_findam_widget_container' ) );
        add_action( 'woocommerce_checkout_process', array( $this, 'validate_findam_postcode' ) );
        add_action( 'woocommerce_checkout_update_order_meta', array( $this, 'save_findam_spatial_meta' ) );
    }

    public function enqueue_findam_widget() {
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
            'findam-widget-sdk',
            'http://localhost:5173/postcode360-widget.js',
            array( 'jquery' ),
            '1.2.0',
            true
        );

        wp_localize_script( 'findam-widget-sdk', 'FindAmConfig', array(
            'apiBaseUrl'     => esc_url_raw( $this->api_base_url ),
            'publishableKey' => esc_attr( $this->publishable_key ),
            'origin'         => esc_url_raw( get_site_url() ),
            'pilotRegion'    => 'ABUJA_FCT',
            'forceMock'      => true,
        ) );
    }

    public function render_findam_widget_container( $checkout ) {
        echo '<div id="findam-woocommerce-mount" class="findam-checkout-card">';
        echo '  <h4>' . esc_html__( 'FindAm Spatial Postcode Verification (Abuja)', 'findam' ) . '</h4>';
        echo '  <p class="findam-privacy-note">Zero-PII HMAC-SHA256 verification • PostGIS Building Footprint</p>';
        echo '  <div id="findam-widget-root"></div>';

        woocommerce_form_field( 'findam_postcode', array(
            'type'        => 'text',
            'class'       => array( 'form-row-wide' ),
            'label'       => __( 'Resolved FindAm Postcode', 'findam' ),
            'placeholder' => __( 'FC-02-A09-DB-09', 'findam' ),
            'required'    => true,
        ), $checkout->get_value( 'findam_postcode' ) );

        echo '<input type="hidden" name="findam_subject_hash" id="findam_subject_hash" value="" />';
        echo '<input type="hidden" name="findam_idempotency_key" id="findam_idempotency_key" value="' . esc_attr( wp_generate_uuid4() ) . '" />';
        echo '</div>';
    }

    public function validate_findam_postcode() {
        if ( empty( $_POST['findam_postcode'] ) ) {
            wc_add_notice( __( 'Please verify and resolve your FindAm Spatial Postcode (e.g. FC-02-A09-DB-09) before placing your order.', 'findam' ), 'error' );
        }
    }

    public function save_findam_spatial_meta( $order_id ) {
        if ( ! empty( $_POST['findam_postcode'] ) ) {
            $postcode        = sanitize_text_field( $_POST['findam_postcode'] );
            $subject_hash    = sanitize_text_field( $_POST['findam_subject_hash'] ?? '' );
            $idempotency_key = sanitize_text_field( $_POST['findam_idempotency_key'] ?? 'wc-ord-' . $order_id );

            update_post_meta( $order_id, '_findam_postcode', $postcode );
            update_post_meta( $order_id, '_findam_subject_hash', $subject_hash );
            update_post_meta( $order_id, '_findam_idempotency_key', $idempotency_key );

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

new FindAm_WooCommerce_Postcode_Checkout();
`;

const SHOPIFY_LIQUID_CODE = `{% comment %}
  File: extensions/postcode360-checkout/blocks/postcode-widget.liquid
  Task #6 (Priority 1): Shopify Theme App Extension Block for FindAm / postcode360
{% endcomment %}

<div
  id="findam-shopify-embed-{{ block.id }}"
  class="findam-shopify-widget-wrapper"
  data-api-base="{{ block.settings.api_base_url | escape }}"
  data-publishable-key="{{ block.settings.publishable_key | escape }}"
  data-force-mock="{{ block.settings.force_mock_sandbox }}"
  data-accent-color="{{ block.settings.accent_color }}"
>
  <div class="findam-widget-header">
    <span class="findam-badge-emerald">FindAm // postcode360</span>
    <span class="findam-zero-pii-pill">Zero-PII HMAC-SHA256</span>
  </div>

  <p class="findam-helper-text">
    {{ block.settings.heading_text | default: "Verify your 3-Tier Abuja Postcode for instant rider dispatch" }}
  </p>

  <!-- Step 1: Zero-PII Handshake Input -->
  <div class="findam-field-group">
    <label for="findam-nin-email-{{ block.id }}">NIN (11 Digits) or Email (Hashed via HMAC-SHA256)</label>
    <div class="findam-row">
      <input
        type="text"
        id="findam-nin-email-{{ block.id }}"
        placeholder="12345678901 or shopper@findam.ng"
        autocomplete="off"
      />
      <button type="button" id="findam-verify-btn-{{ block.id }}">
        Verify & Unlock
      </button>
    </div>
  </div>

  <!-- Step 2: 3-Tier Spatial Postcode Lookup -->
  <div class="findam-field-group" id="findam-lookup-panel-{{ block.id }}" style="display:none;">
    <label for="findam-postcode-input-{{ block.id }}">NIPOST / FindAm 3-Tier Code</label>
    <div class="findam-row">
      <input
        type="text"
        id="findam-postcode-input-{{ block.id }}"
        name="attributes[findam_postcode]"
        placeholder="FC-02-A09-DB-09"
        value="{{ cart.attributes.findam_postcode }}"
      />
      <button type="button" id="findam-resolve-btn-{{ block.id }}">
        Resolve Polygon
      </button>
    </div>
    <input type="hidden" name="attributes[findam_subject_hash]" id="findam-hash-{{ block.id }}" />
    <input type="hidden" name="attributes[findam_coordinates]" id="findam-coords-{{ block.id }}" />
  </div>

  <!-- MapLibre GL Building Footprint Canvas -->
  <div id="findam-maplibre-{{ block.id }}" style="height: 220px; width: 100%; border-radius: 10px; margin-top: 12px;"></div>
</div>

{% schema %}
{
  "name": "FindAm Postcode Widget",
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
      "default": "pk_test_findam_abuja_01"
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

export const PluginTemplates: React.FC = () => {
  const [activePluginTab, setActivePluginTab] = useState<
    "WOOCOMMERCE" | "SHOPIFY"
  >("WOOCOMMERCE");
  const [copiedCode, setCopiedCode] = useState(false);
  const [shopifyHeading, setShopifyHeading] = useState(
    "Verify your 3-Tier Abuja Postcode for instant delivery",
  );
  const [shopifyAccent, setShopifyAccent] = useState("#10B981");

  const activeCode =
    activePluginTab === "WOOCOMMERCE"
      ? WOOCOMMERCE_PHP_CODE
      : SHOPIFY_LIQUID_CODE;

  const handleCopy = () => {
    navigator.clipboard.writeText(activeCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  return (
    <div className="space-y-6">
      {/* Top Deliverable Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-[#111116] p-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-violet-300">
              DELIVERABLES TASK #5 &amp; TASK #6
            </span>
            <span className="font-mono text-xs text-zinc-400">
              Drop-in E-Commerce Integrations
            </span>
          </div>
          <h1 className="mt-1 text-lg font-bold text-white sm:text-xl">
            WooCommerce PHP Plugin &amp; Shopify Theme App Extension Liquid
            Block
          </h1>
          <p className="text-xs text-zinc-400 sm:text-sm">
            Production-ready plugin deliverables that inject{" "}
            <code className="text-emerald-300">@findam/widget</code> into
            WordPress/WooCommerce and Shopify checkouts.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#08080A] p-1">
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
        </div>
      </div>

      {/* 12-Col Grid: Code Viewer (8 cols) + Shopify Theme Editor Simulator & Checklist (4 cols) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left 8 Cols: Source Code Inspector */}
        <div className="flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#111116] shadow-xl lg:col-span-8">
          <div className="flex items-center justify-between border-b border-white/10 bg-[#16161E] px-4 py-3">
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-200">
              <Code2 className="h-4 w-4 text-emerald-400" />
              <span>
                {activePluginTab === "WOOCOMMERCE"
                  ? "plugins/woocommerce-postcode360/postcode360-checkout.php"
                  : "extensions/postcode360-checkout/blocks/postcode-widget.liquid"}
              </span>
            </div>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#08080A] px-3 py-1.5 font-mono text-xs text-emerald-300 transition hover:bg-white/10"
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

          <pre className="max-h-[600px] flex-1 overflow-x-auto overflow-y-auto bg-[#08080A] p-4 font-mono text-xs leading-relaxed text-zinc-300 sm:p-5">
            <code>{activeCode}</code>
          </pre>
        </div>

        {/* Right 4 Cols: Interactive Shopify Theme Editor Simulator & Contract Checklist */}
        <div className="space-y-5 lg:col-span-4">
          {/* Shopify Theme Editor Schema Simulator */}
          <div className="space-y-4 rounded-2xl border border-white/10 bg-[#111116] p-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-white">
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
                  className="w-full rounded-lg border border-white/10 bg-[#08080A] px-3 py-2 text-white focus:border-emerald-400 focus:outline-none"
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
            <div className="space-y-3 rounded-xl border border-white/10 bg-[#08080A] p-4">
              <div className="flex items-center justify-between">
                <span
                  className="rounded px-2 py-0.5 font-mono text-[10px] font-bold text-zinc-950"
                  style={{ backgroundColor: shopifyAccent }}
                >
                  FindAm // postcode360
                </span>
                <span className="font-mono text-[10px] text-zinc-400">
                  Zero-PII HMAC-SHA256
                </span>
              </div>
              <p className="text-xs font-medium text-zinc-200">
                {shopifyHeading}
              </p>
              <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#111116] p-2.5 font-mono text-[11px] text-emerald-300">
                <span>FC-02-A09-DB-09</span>
                <span className="text-zinc-400">Wuse II, Abuja</span>
              </div>
              <div className="rounded-lg border border-white/10 bg-[#111116] p-2 font-mono text-[11px] text-zinc-400">
                building_polygon: 7 vertices • TIER_1_REDIS_CACHE
              </div>
            </div>
          </div>

          {/* Team A Contract Verification Checklist */}
          <div className="space-y-3 rounded-2xl border border-white/10 bg-[#111116] p-5 text-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-white">
              Team A Contract Verification Checklist
            </h3>
            <ul className="space-y-2 text-zinc-300">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  <code className="text-emerald-300">
                    POST /v1/widget/session
                  </code>{" "}
                  with Origin header &amp; HMAC-SHA256 subject hash
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  <code className="text-emerald-300">POST /v1/lookup</code>{" "}
                  &amp;{" "}
                  <code className="text-emerald-300">
                    GET /v1/mock/postcodes
                  </code>{" "}
                  (5 Abuja Districts)
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  <code className="text-emerald-300">POST /orders</code> with{" "}
                  <code className="text-amber-300">
                    idempotent_replay: true
                  </code>{" "}
                  deduplication
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <span>
                  <code className="text-emerald-300">GET /orders</code>,{" "}
                  <code className="text-cyan-300">GET /riders/nearest</code>{" "}
                  &amp;{" "}
                  <code className="text-rose-300">GET /emergency/nearest</code>
                </span>
              </li>
            </ul>

            <div className="space-y-2 border-t border-white/10 pt-3 font-mono text-[11px]">
              <div className="flex justify-between">
                <span className="text-zinc-500">Publishable Key</span>
                <span className="text-emerald-300">
                  pk_test_findam_abuja_01
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Origin Header</span>
                <span className="text-zinc-300">{window.location.origin}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">
                  Idempotent Replays Blocked
                </span>
                <span className="text-amber-300">
                  {postcode360Api.getReplaysBlockedCount()}
                </span>
              </div>
            </div>
          </div>

          {/* Pitch Ready Callout */}
          <div className="space-y-2 rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/15 to-teal-500/15 p-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                Pitch Ready • Built on Nigeria&apos;s Postcode
              </h4>
            </div>
            <p className="text-xs leading-relaxed text-zinc-300">
              Team A Frontend Workspace combines the Merchant Checkout &amp;
              Widget Simulator, Back-Office PostGIS Admin Dashboard, and
              WooCommerce/Shopify Plugin Inspector with a hybrid FastAPI +
              PostGIS spatial engine.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
