// src/components/admin/AdminDashboard.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Navigation,
  Siren,
  PackageCheck,
  Clock,
  Truck,
  Phone,
  MapPin,
  Search,
} from "lucide-react";
import { postcode360Api } from "../../services/api";
import { PostcodeMap } from "../map/PostcodeMap";
import type { NearestItem, OrderResponse } from "../../types/postcode360";

export type OrderStatusFilter = "ALL" | "PENDING" | "DISPATCHED" | "DELIVERED";

export const AdminDashboard: React.FC = () => {
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [riders, setRiders] = useState<NearestItem[]>([]);
  const [emergencies, setEmergencies] = useState<NearestItem[]>([]);
  const [riderSource, setRiderSource] = useState<string>("postgis_gist_knn");
  const [emergencyType, setEmergencyType] = useState<
    "HOSPITAL" | "POLICE" | "FIRE"
  >("HOSPITAL");
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingSpatial, setLoadingSpatial] = useState(false);

  const fetchOrders = async () => {
    setLoadingOrders(true);
    try {
      const list = await postcode360Api.listOrders(50);
      setOrders(list);
      if (list.length > 0 && !selectedOrder) {
        inspectOrder(list[0], emergencyType);
      }
    } catch {
      // Handled gracefully if empty
    } finally {
      setLoadingOrders(false);
    }
  };

  const inspectOrder = async (
    order: OrderResponse,
    facilityType: "HOSPITAL" | "POLICE" | "FIRE" = emergencyType,
  ) => {
    setSelectedOrder(order);
    setLoadingSpatial(true);
    try {
      const [riderRes, emgRes] = await Promise.all([
        postcode360Api.getNearestRiders(order.lat, order.lng),
        postcode360Api.getNearestEmergency(order.lat, order.lng, facilityType),
      ]);
      setRiders(riderRes.results);
      setRiderSource(riderRes.source);
      setEmergencies(emgRes.results);
    } catch {
      setRiders([]);
      setEmergencies([]);
    } finally {
      setLoadingSpatial(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const handleUpdateOrderStatus = async (
    orderId: string,
    newStatus: "PENDING" | "DISPATCHED" | "DELIVERED",
  ) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.order_id === orderId ? { ...o, order_status: newStatus } : o,
      ),
    );
    if (selectedOrder?.order_id === orderId) {
      setSelectedOrder({ ...selectedOrder, order_status: newStatus });
    }
    if ("updateOrderStatus" in postcode360Api) {
      await (postcode360Api as any).updateOrderStatus(orderId, newStatus);
    }
  };

  const statusCounts = useMemo(() => {
    const counts = {
      ALL: orders.length,
      PENDING: 0,
      DISPATCHED: 0,
      DELIVERED: 0,
    };
    orders.forEach((o) => {
      const st = (o.order_status || "PENDING").toUpperCase();
      if (st === "PENDING") counts.PENDING += 1;
      else if (st === "DISPATCHED") counts.DISPATCHED += 1;
      else if (st === "DELIVERED") counts.DELIVERED += 1;
    });
    return counts;
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return orders.filter((ord) => {
      const ordStatus = (ord.order_status || "PENDING").toUpperCase();
      const matchesStatus =
        statusFilter === "ALL" || ordStatus === statusFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        ord.postcode.toLowerCase().includes(q) ||
        (ord.customer_name || "").toLowerCase().includes(q) ||
        (ord.delivery_address || "").toLowerCase().includes(q) ||
        (ord.idempotency_key || "").toLowerCase().includes(q) ||
        (ord.order_id || "").toLowerCase().includes(q);
      return matchesStatus && matchesSearch;
    });
  }, [orders, statusFilter, searchQuery]);

  const getStatusBadge = (status: string) => {
    switch (status.toUpperCase()) {
      case "DELIVERED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
            <PackageCheck className="h-3 w-3" /> DELIVERED
          </span>
        );
      case "DISPATCHED":
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
            <Truck className="h-3 w-3" /> DISPATCHED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] text-amber-300">
            <Clock className="h-3 w-3" /> PENDING
          </span>
        );
    }
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Column: Live PostGIS Orders Table (7 cols) */}
      <div className="space-y-4 lg:col-span-7">
        <div className="overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/30">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-200 dark:border-zinc-800 px-5 py-4">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
                SPATIAL DISPATCH &amp; ORDER LEDGER
              </span>
              <h2 className="mt-0.5 text-base font-semibold text-slate-900 dark:text-white">
                Live Orders ({filteredOrders.length} of {orders.length})

              </h2>
            </div>

            <button
              type="button"
              onClick={fetchOrders}
              disabled={loadingOrders}
              className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-100 dark:bg-zinc-800 px-3 py-1.5 font-mono text-xs text-slate-700 dark:text-zinc-200 transition-all hover:bg-zinc-700"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loadingOrders ? "animate-spin" : ""}`}
              />
              Refresh GET /orders
            </button>
          </div>

          {/* Status Filter Pills (ALL | PENDING | DISPATCHED | DELIVERED) & Search Input */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0A0A0C] px-5 py-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  "ALL",
                  "PENDING",
                  "DISPATCHED",
                  "DELIVERED",
                ] as OrderStatusFilter[]
              ).map((st) => {
                const active = statusFilter === st;
                const count = statusCounts[st];
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] font-semibold transition-all ${
                      active
                        ? st === "PENDING"
                          ? "border-amber-500/50 bg-amber-500/20 text-amber-300"
                          : st === "DISPATCHED"
                            ? "border-cyan-500/50 bg-cyan-500/20 text-cyan-300"
                            : "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                        : "border-slate-200 dark:border-zinc-800 bg-zinc-900/80 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200"
                    }`}
                  >
                    <span>{st}</span>
                    <span className="rounded bg-black/40 px-1.5 py-0.5 text-[10px]">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative min-w-[200px] flex-1 sm:max-w-[240px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter postcode, customer, key..."
                className="h-8 w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#08080A] pl-8 pr-3 font-mono text-xs text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          {filteredOrders.length === 0 ? (
            <div className="space-y-2 p-10 text-center">
              <p className="text-sm text-zinc-400">
                No orders match filter &quot;{statusFilter}&quot;.
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("ALL");
                  setSearchQuery("");
                }}
                className="font-mono text-xs text-emerald-400 hover:underline"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="max-h-[640px] overflow-x-auto overflow-y-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0A0A0C] font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3">Postcode / Address</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Idempotency Key</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 text-xs">
                  {filteredOrders.map((ord) => {
                    const isSelected = selectedOrder?.order_id === ord.order_id;
                    return (
                      <tr
                        key={ord.order_id}
                        onClick={() => inspectOrder(ord, emergencyType)}
                        className={`cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-emerald-500/10"
                            : "hover:bg-zinc-900/60"
                        }`}
                      >
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 font-mono font-semibold text-emerald-300">
                            <MapPin className="h-3.5 w-3.5 shrink-0" />
                            {ord.postcode}
                          </div>
                          <div className="mt-0.5 max-w-[210px] truncate text-[11px] text-zinc-400">
                            {ord.delivery_address}
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="font-medium text-zinc-200">
                            {ord.customer_name || "Walk-in Customer"}
                          </div>
                          <div className="font-mono text-[10px] text-zinc-500">
                            {ord.customer_phone}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono text-[11px] text-amber-300">
                          {ord.idempotency_key}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-semibold text-white">
                          ₦{(ord.amount_ngn || 15500).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5">
                          {getStatusBadge(ord.order_status)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Satellite Building Polygon Map & PostGIS KNN Inspector (5 cols) */}
      <div className="space-y-4 lg:col-span-5 lg:sticky lg:top-24 lg:self-start">
        <PostcodeMap
          centerLat={selectedOrder?.lat || 9.0765}
          centerLng={selectedOrder?.lng || 7.4892}
          postcodeLabel={selectedOrder?.postcode || "FC-02-A09-DB-09"}
          addressLabel={
            selectedOrder?.delivery_address || "Select an order to inspect"
          }
          buildingPolygon={selectedOrder?.building_polygon}
          riders={riders}
          emergencies={emergencies}
          resolutionSource={riderSource}
        />

        {/* Selected Order Status Switcher & Nearest Riders Card */}
        <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4">
          {selectedOrder && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-200 dark:border-zinc-800 pb-3">
              <div>
                <span className="font-mono text-[10px] text-zinc-400">
                  ACTIVE ORDER STATUS ({selectedOrder.postcode})
                </span>
                <div className="text-xs font-semibold text-white">
                  {selectedOrder.customer_name || "Walk-in Customer"} •{" "}
                  <span className="font-mono text-amber-300">
                    {selectedOrder.idempotency_key}
                  </span>
                </div>
              </div>
              <div className="flex gap-1">
                {(["PENDING", "DISPATCHED", "DELIVERED"] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() =>
                      handleUpdateOrderStatus(selectedOrder.order_id, st)
                    }
                    className={`rounded border px-2 py-0.5 font-mono text-[10px] font-semibold transition ${
                      selectedOrder.order_status.toUpperCase() === st
                        ? "border-emerald-400 bg-emerald-500 text-black"
                        : "border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#08080A] text-zinc-400 hover:text-white"
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Navigation className="h-4 w-4 text-cyan-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                PostGIS KNN Nearest Riders ({riders.length})
              </h3>
            </div>
            <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
              {loadingSpatial ? "QUERYING..." : riderSource}
            </span>
          </div>

          <div className="space-y-2">
            {riders.map((r, idx) => (
              <div
                key={r.id}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3 ${
                  idx === 0
                    ? "border-cyan-500/40 bg-cyan-500/10"
                    : "border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#08080A]"
                }`}
              >
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <span>{r.name}</span>
                    {idx === 0 && (
                      <span className="rounded bg-cyan-400 px-1.5 py-0.2 font-mono text-[9px] font-bold text-black">
                        CLOSEST
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 flex items-center gap-2 font-mono text-[10px] text-zinc-400">
                    <span className="text-emerald-400">
                      {r.category_or_status}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Phone className="h-2.5 w-2.5" /> {r.phone || "N/A"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-cyan-300">
                    {Math.round(r.distance_meters)}m
                  </span>
                  {selectedOrder && (
                    <button
                      type="button"
                      onClick={() =>
                        handleUpdateOrderStatus(
                          selectedOrder.order_id,
                          "DISPATCHED",
                        )
                      }
                      className="rounded-lg bg-cyan-400 px-2.5 py-1 text-[11px] font-semibold text-black transition-all hover:bg-cyan-300"
                    >
                      {selectedOrder.order_status === "DISPATCHED"
                        ? "Assigned ✓"
                        : "Assign"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Nearest Emergency Responder Card (GET /emergency/nearest) */}
        <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Siren className="h-4 w-4 text-amber-400" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                Emergency Services
              </h3>
            </div>

            <div className="flex gap-1">
              {(["HOSPITAL", "POLICE", "FIRE"] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => {
                    setEmergencyType(type);
                    if (selectedOrder) inspectOrder(selectedOrder, type);
                  }}
                  className={`rounded border px-2 py-0.5 font-mono text-[10px] transition-all ${
                    emergencyType === type
                      ? "border-amber-400 bg-amber-400 font-bold text-black"
                      : "border-slate-200 dark:border-zinc-800 bg-zinc-900 text-zinc-400"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {emergencies.map((emg) => (
              <div
                key={emg.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#08080A] p-2.5 text-xs"
              >
                <div>
                  <span className="font-medium text-zinc-200">{emg.name}</span>
                  <span className="block font-mono text-[10px] text-zinc-500">
                    Emergency Line: {emg.phone || "112"}
                  </span>
                </div>
                <span className="font-mono text-xs font-semibold text-amber-300">
                  {Math.round(emg.distance_meters)}m
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
