// src/components/checkout/OrderCheckout.tsx
import React, { useState } from "react";
import { ShoppingBag, Repeat, CheckCircle2, ShieldAlert } from "lucide-react";
import { postcode360Api } from "../../services/api";
import type {
  NearestItem,
  OrderResponse,
  PostcodeData,
} from "../../types/postcode360";

interface OrderCheckoutProps {
  resolvedPostcode: PostcodeData | null;
  onOrderCreated: (order: OrderResponse, nearestRiders: NearestItem[]) => void;
}

export const OrderCheckout: React.FC<OrderCheckoutProps> = ({
  resolvedPostcode,
  onOrderCreated,
}) => {
  const [customerName, setCustomerName] = useState("Hajiya Amina");
  const [customerPhone, setCustomerPhone] = useState("+2348030001122");
  const [notes, setNotes] = useState("Blue gate, opposite Access Bank");
  const [amountNgn] = useState(28500);
  const [idempotencyKey, setIdempotencyKey] = useState("ord-wuse2-2026-001");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<OrderResponse | null>(null);

  const submitOrder = async (keyToUse: string) => {
    if (!resolvedPostcode) return;
    setLoading(true);
    setError(null);

    try {
      const order = await postcode360Api.createOrder({
        idempotency_key: keyToUse.trim() || `ord-abj-${Date.now()}`,
        postcode: resolvedPostcode.postcode,
        customer_name: customerName,
        customer_phone: customerPhone,
        amount_ngn: amountNgn,
        notes,
      });
      setOrderResult(order);

      const riderRes = await postcode360Api.getNearestRiders(
        order.lat,
        order.lng,
      );
      onOrderCreated(order, riderRes.results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  const generateFreshKey = () => {
    const slug = (resolvedPostcode?.district || "abuja")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const randomSuffix = Math.floor(100 + Math.random() * 899);
    setIdempotencyKey(`ord-${slug}-2026-${randomSuffix}`);
    setOrderResult(null);
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-[#111116] p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-cyan-500/40 bg-cyan-500/20 font-mono text-xs font-bold text-cyan-300">
            3
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">
              Idempotent Order &amp; Dispatch Execution
            </h2>
            <p className="font-mono text-[11px] text-zinc-400">
              POST /orders • Strict Idempotency Key Protection
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] text-zinc-400">
            Customer Name
          </label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#08080A] px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-zinc-400">
            Customer Phone (NG)
          </label>
          <input
            type="text"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#08080A] px-3 py-2 font-mono text-xs text-white focus:border-emerald-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[11px] text-zinc-400">
            Delivery Gate / Landmark Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-[#08080A] px-3 py-2 text-xs text-white focus:border-emerald-400 focus:outline-none"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="font-mono text-[11px] text-zinc-400">
              idempotency_key
            </label>
            <button
              type="button"
              onClick={generateFreshKey}
              className="font-mono text-[10px] text-cyan-400 hover:underline"
            >
              + New Key
            </button>
          </div>
          <input
            type="text"
            value={idempotencyKey}
            onChange={(e) => setIdempotencyKey(e.target.value)}
            className="w-full rounded-lg border border-cyan-500/30 bg-[#08080A] px-3 py-2 font-mono text-xs text-cyan-300 focus:border-cyan-400 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Action Buttons: Primary Pay + Network Retry Simulator */}
      <div className="space-y-2.5 pt-1">
        <button
          type="button"
          disabled={loading || !resolvedPostcode}
          onClick={() => submitOrder(idempotencyKey)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-bold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-teal-400 disabled:opacity-50"
        >
          <ShoppingBag className="h-4 w-4" />
          <span>
            Pay ₦{amountNgn.toLocaleString()} &amp; Dispatch Nearest Rider
          </span>
        </button>

        <button
          type="button"
          disabled={loading || !resolvedPostcode}
          onClick={() => submitOrder(idempotencyKey)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-[#08080A] px-4 py-2.5 font-mono text-xs text-amber-300 transition hover:bg-amber-500/10 disabled:opacity-50"
        >
          <Repeat className="h-3.5 w-3.5" />
          <span>
            Simulate Network Retry / Double-Tap Pay (Re-send `{idempotencyKey}`)
          </span>
        </button>
      </div>

      {/* Order & Idempotency Status Banner */}
      {orderResult && (
        <div
          className={`space-y-1.5 rounded-xl border p-3.5 text-xs ${
            orderResult.idempotent_replay
              ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
          }`}
        >
          <div className="flex items-center justify-between font-mono font-bold">
            <span className="flex items-center gap-1.5">
              {orderResult.idempotent_replay ? (
                <>
                  <ShieldAlert className="h-4 w-4 text-amber-400" />
                  <span>IDEMPOTENT REPLAY INTERCEPTED (₦0 EXTRA CHARGED)</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span>
                    NEW ORDER CREATED IN POSTGIS ({orderResult.order_id})
                  </span>
                </>
              )}
            </span>
            <span className="rounded bg-black/40 px-2 py-0.5 text-[10px]">
              idempotent_replay:{" "}
              {String(Boolean(orderResult.idempotent_replay))}
            </span>
          </div>

          <p className="text-[11px] opacity-90">
            {orderResult.idempotent_replay
              ? `Re-transmitted key "${orderResult.idempotency_key}" matched existing order ${orderResult.order_id}. Duplicate payment prevented!`
              : `Order ${orderResult.order_id} committed for ${orderResult.postcode} (${orderResult.delivery_address}). Switch to Back-Office Admin to inspect or dispatch.`}
          </p>
        </div>
      )}
    </section>
  );
};
