// cspell:ignore Banex Wuse Garki Maitama Jabi AMAC Bwari Gwagwalada Kubwa Dutse Termii NIPOST msisdn ussd
// src/components/rider/RiderDashboard.tsx
import React, { useEffect, useState } from "react";
import {
  Bike,
  BatteryCharging,
  Camera,
  CheckCircle2,
  MapPin,
  Navigation,
  PackageCheck,
  PhoneCall,
  PlusCircle,
  Radio,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Truck,
} from "lucide-react";
import confetti from "canvas-confetti";
import { postcode360Api } from "../../services/api";
import { PostcodeMap } from "../map/PostcodeMap";
import type {
  AliasRecord,
  OrderResponse,
  PodSubmitResponse,
  RiderRecord,
  SosIncidentRecord,
  UssdDialResponse,
} from "../../types/postcode360";

function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371e3;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export const RiderDashboard: React.FC = () => {
  const [subTab, setSubTab] = useState<"rider" | "rescue">("rider");

  // Phase 1 State: Rider, Orders, Aliases
  const [riders, setRiders] = useState<RiderRecord[]>([]);
  const [activeRider, setActiveRider] = useState<RiderRecord | null>(null);
  const [orders, setOrders] = useState<OrderResponse[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(
    null,
  );
  const [aliases, setAliases] = useState<AliasRecord[]>([]);
  const [selectedAlias, setSelectedAlias] = useState<AliasRecord | null>(null);

  // POD state
  const [podUrl, setPodUrl] = useState(
    "https://images.postcode360.ng/pod/wuse2-gate-verified.jpg",
  );
  const [podResult, setPodResult] = useState<PodSubmitResponse | null>(null);
  const [submittingPod, setSubmittingPod] = useState(false);

  // TP-Code Minting state
  const [aliasName, setAliasName] = useState("Banex Plaza Extension Gate 2");
  const [district, setDistrict] = useState("Wuse II");
  const [canonicalCode, setCanonicalCode] = useState("FC-02-A09-DB-09");
  const [mintLat, setMintLat] = useState(9.0758);
  const [mintLng, setMintLng] = useState(7.4904);
  const [minting, setMinting] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState<string | null>(null);
  const [telemetrySaved, setTelemetrySaved] = useState(false);
  const [isMarkingVertices, setIsMarkingVertices] = useState(false);
  const [markedVertices, setMarkedVertices] = useState<number[][]>([
    [7.49025, 9.07592],
    [7.49058, 9.07595],
    [7.49060, 9.07565],
    [7.49022, 9.07562],
  ]);
  const [mintPodUrl, setMintPodUrl] = useState("https://images.postcode360.ng/pod/tp-gate-and-pod-verified.jpg");

  // Phase 2 State: Rescue & USSD *347#
  const [incidents, setIncidents] = useState<SosIncidentRecord[]>([]);
  const [selectedIncident, setSelectedIncident] =
    useState<SosIncidentRecord | null>(null);
  const [sosPostcode, setSosPostcode] = useState("FC-02-A09-DB-09");
  const [sosAddress, setSosAddress] = useState(
    "42 Adetokunbo Ademola Crescent, Wuse II",
  );
  const [sosLat] = useState(9.0765);
  const [sosLng] = useState(7.4892);
  const [sosType, setSosType] = useState<"HOSPITAL" | "POLICE" | "FIRE">(
    "HOSPITAL",
  );
  const [sosTriage, setSosTriage] = useState<"RED" | "YELLOW">("RED");
  const [sosLoading, setSosLoading] = useState(false);

  // USSD *347# state
  const [ussdInput, setUssdInput] = useState("*347*FC-02-A09-DB-09#");
  const [ussdResult, setUssdResult] = useState<UssdDialResponse | null>(null);
  const [ussdLoading, setUssdLoading] = useState(false);

  const loadWorkspace = async () => {
    try {
      const [riderList, orderList, aliasList, incidentList] = await Promise.all([
        postcode360Api.listRiders(),
        postcode360Api.listOrders(50),
        postcode360Api.listAliases(),
        postcode360Api.listIncidents(),
      ]);
      setRiders(riderList);
      if (riderList.length > 0 && !activeRider) {
        setActiveRider(riderList[0]);
      }
      setOrders(orderList);
      if (orderList.length > 0 && !selectedOrder) {
        const dispatched =
          orderList.find((o) => o.order_status === "DISPATCHED") ||
          orderList[0];
        setSelectedOrder(dispatched);
      }
      setAliases(aliasList);
      setIncidents(incidentList);
      if (incidentList.length > 0 && !selectedIncident) {
        setSelectedIncident(incidentList[0]);
      }
    } catch {
      // Handled gracefully
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  const handleBroadcastTelemetry = async () => {
    if (!activeRider) return;
    try {
      await postcode360Api.updateRiderTelemetry(activeRider.rider_id, {
        lat: activeRider.lat,
        lng: activeRider.lng,
        is_available: activeRider.is_available,
        battery_pct: activeRider.battery_pct,
      });
      setTelemetrySaved(true);
      setTimeout(() => setTelemetrySaved(false), 2000);
    } catch {
      // Ignore
    }
  };

  const handleSimulateApproach = async () => {
    if (!activeRider) return;
    const targetLat = selectedOrder?.lat ?? selectedAlias?.lat ?? 9.0765;
    const targetLng = selectedOrder?.lng ?? selectedAlias?.lng ?? 7.4892;
    // Step 35% closer to target
    const step = 0.35;
    const newLat = +(activeRider.lat + (targetLat - activeRider.lat) * step).toFixed(6);
    const newLng = +(activeRider.lng + (targetLng - activeRider.lng) * step).toFixed(6);
    const updatedRider = { ...activeRider, lat: newLat, lng: newLng };
    setActiveRider(updatedRider);
    setRiders((prev) =>
      prev.map((r) => (r.rider_id === updatedRider.rider_id ? updatedRider : r)),
    );
    try {
      await postcode360Api.updateRiderTelemetry(updatedRider.rider_id, {
        lat: newLat,
        lng: newLng,
        is_available: updatedRider.is_available,
        battery_pct: Math.max(10, activeRider.battery_pct - 1),
      });
    } catch {
      // Ignore
    }
  };

  const handleAcceptDispatch = async (order: OrderResponse) => {
    if (!activeRider) return;
    try {
      await postcode360Api.dispatchOrder(
        order.order_id,
        activeRider.rider_id,
        activeRider.rider_name,
      );
      const updated = {
        ...order,
        order_status: "DISPATCHED",
        assigned_rider: activeRider.rider_name,
      };
      setOrders((prev) =>
        prev.map((o) => (o.order_id === order.order_id ? updated : o)),
      );
      setSelectedOrder(updated);
      setPodResult(null);
    } catch {
      // Ignore
    }
  };

  const handleCompletePod = async () => {
    if (!selectedOrder || !activeRider) return;
    setSubmittingPod(true);
    try {
      const res = await postcode360Api.submitPod(selectedOrder.order_id, {
        rider_id: activeRider.rider_id,
        rider_lat: selectedOrder.lat + 0.0001,
        rider_lng: selectedOrder.lng + 0.0001,
        pod_image_url: podUrl,
        recipient_signature: "Verified at Gate",
      });
      setPodResult(res);
      const updated = { ...selectedOrder, order_status: "DELIVERED" };
      setOrders((prev) =>
        prev.map((o) => (o.order_id === selectedOrder.order_id ? updated : o)),
      );
      setSelectedOrder(updated);
      const refreshedAliases = await postcode360Api.listAliases();
      setAliases(refreshedAliases);
    } finally {
      setSubmittingPod(false);
    }
  };

  const handleAutoTraceVertices = () => {
    setIsMarkingVertices(true);
    setMarkedVertices([]);
    const corners = [
      [+(mintLng - 0.00018).toFixed(5), +(mintLat + 0.00014).toFixed(5)],
      [+(mintLng + 0.00018).toFixed(5), +(mintLat + 0.00015).toFixed(5)],
      [+(mintLng + 0.00019).toFixed(5), +(mintLat - 0.00014).toFixed(5)],
      [+(mintLng - 0.00019).toFixed(5), +(mintLat - 0.00015).toFixed(5)],
    ];
    corners.forEach((c, idx) => {
      setTimeout(() => {
        setMarkedVertices((prev) => [...prev, c]);
      }, (idx + 1) * 150);
    });
  };

  const handleMintTpCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setMinting(true);
    try {
      const closedPolygon =
        markedVertices.length >= 4
          ? [...markedVertices, markedVertices[0]]
          : undefined;

      const created = await postcode360Api.mintAlias({
        lat: mintLat,
        lng: mintLng,
        alias_name: aliasName,
        canonical_postcode: canonicalCode,
        district,
        proof_image_url: mintPodUrl,
        pod_image_url: mintPodUrl,
        building_polygon: closedPolygon,
      });
      setAliases((prev) => [created, ...prev]);
      setSelectedAlias(created);
      setSelectedOrder(null);
      setIsMarkingVertices(false);
    } finally {
      setMinting(false);
    }
  };

  const handleVerifyDeliveryCount = async (code: string) => {
    setVerifyingCode(code);
    try {
      const updated = await postcode360Api.verifyAlias(code);
      setAliases((prev) =>
        prev.map((a) => (a.alias_code === updated.alias_code ? updated : a)),
      );
      if (selectedAlias?.alias_code === updated.alias_code) {
        setSelectedAlias(updated);
      }
      if (updated.delivery_count >= 3 || updated.verified) {
        try {
          confetti({
            particleCount: 55,
            spread: 75,
            origin: { y: 0.6 },
            colors: ["#10b981", "#f59e0b", "#06b6d4"],
          });
        } catch {}
      }
    } finally {
      setVerifyingCode(null);
    }
  };

  const handleTriggerSos = async (e: React.FormEvent) => {
    e.preventDefault();
    setSosLoading(true);
    try {
      const created = await postcode360Api.triggerSos({
        postcode: sosPostcode,
        emergency_type: sosType,
        triage_level: sosTriage,
        lat: sosLat,
        lng: sosLng,
        address: sosAddress,
        caller_phone: "+2348039912001",
      });
      setIncidents((prev) => [created, ...prev]);
      setSelectedIncident(created);
    } finally {
      setSosLoading(false);
    }
  };

  const handleResolveIncident = async (incidentId: string) => {
    try {
      const resolved = await postcode360Api.resolveIncident(incidentId);
      setIncidents((prev) =>
        prev.map((inc) =>
          inc.incident_id === resolved.incident_id ? resolved : inc,
        ),
      );
      if (selectedIncident?.incident_id === resolved.incident_id) {
        setSelectedIncident(resolved);
      }
      const refreshedAliases = await postcode360Api.listAliases();
      setAliases(refreshedAliases);
    } catch {
      // Ignore
    }
  };

  const handleDialUssd = async (e: React.FormEvent) => {
    e.preventDefault();
    setUssdLoading(true);
    try {
      const res = await postcode360Api.dialUssd(ussdInput);
      setUssdResult(res);
    } finally {
      setUssdLoading(false);
    }
  };

  const mapLat =
    subTab === "rescue" && selectedIncident
      ? selectedIncident.lat
      : (selectedAlias?.lat ?? selectedOrder?.lat ?? 9.0765);
  const mapLng =
    subTab === "rescue" && selectedIncident
      ? selectedIncident.lng
      : (selectedAlias?.lng ?? selectedOrder?.lng ?? 7.4892);
  const mapCode =
    subTab === "rescue" && selectedIncident
      ? selectedIncident.postcode
      : (selectedAlias?.alias_code ??
        selectedOrder?.postcode ??
        "FC-02-A09-DB-09");
  const mapAddress =
    subTab === "rescue" && selectedIncident
      ? `${selectedIncident.address} • Assigned: ${selectedIncident.assigned_responder}`
      : selectedAlias
        ? `${selectedAlias.alias_name} (${selectedAlias.district})`
        : (selectedOrder?.delivery_address ?? "Wuse II, AMAC, Abuja");
  const mapPolygon =
    selectedAlias?.building_polygon ?? selectedOrder?.building_polygon;

  const currentDistanceMeters = activeRider
    ? getDistanceMeters(activeRider.lat, activeRider.lng, mapLat, mapLng)
    : 0;

  return (
    <div className="space-y-5">
      {/* Top Sub-Navigation Bar across Logistics & Enumerator SDK Deliverables */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#111116] border border-white/10 p-3.5">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
            3PL LOGISTICS &amp; FIELD ENUMERATION ENGINE • @postcode360/enumerator-sdk
          </span>
          <h1 className="text-sm font-bold text-white">
            Dispatch Operations &amp; Field Address Minting
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-[#08080A] border border-white/10 p-1">
          <button
            type="button"
            data-demo="dispatch-subtab-rider"
            onClick={() => setSubTab("rider")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              subTab === "rider"
                ? "bg-emerald-500 font-semibold text-zinc-950"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Bike className="h-3.5 w-3.5" />
            <span>Rider OS &amp; Address Minting</span>
          </button>

          <button
            type="button"
            data-demo="dispatch-subtab-rescue"
            onClick={() => setSubTab("rescue")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              subTab === "rescue"
                ? "bg-emerald-500 font-semibold text-zinc-950"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <ShieldAlert className="h-3.5 w-3.5" />
            <span>Emergency &amp; USSD *347#</span>
          </button>
        </div>
      </div>

      {subTab === "rider" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: 5 Cols */}
          <div className="lg:col-span-5 space-y-5">
            {/* Card 1: Active Courier Console */}
            <section className="rounded-2xl bg-[#111116] border border-white/10 p-5 space-y-4 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
                    RIDER OS TELEMETRY &amp; SPATIAL DISPATCH
                  </span>
                  <h2 className="mt-0.5 text-sm font-bold text-white flex items-center gap-2">
                    <Bike className="h-4 w-4 text-emerald-400" />
                    <span>Active Courier Console</span>
                  </h2>
                </div>

                <button
                  type="button"
                  data-demo="rider-sync-fleet"
                  onClick={loadWorkspace}
                  className="flex items-center gap-1.5 rounded-lg bg-[#08080A] border border-white/10 px-3 py-1.5 font-mono text-xs text-zinc-300 hover:border-white/25 hover:text-white transition"
                >
                  <RefreshCw className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Sync Fleet</span>
                </button>
              </div>

              {activeRider && (
                <div className="space-y-3">
                  <div>
                    <label className="block font-mono text-[10px] text-zinc-400 mb-1">
                      ACTIVE RIDER PROFILE (POSTGIS rider_loc)
                    </label>
                    <select
                      value={activeRider.rider_id}
                      onChange={(e) => {
                        const found = riders.find(
                          (r) => r.rider_id === e.target.value,
                        );
                        if (found) setActiveRider(found);
                      }}
                      className="w-full bg-[#08080A] border border-white/15 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-emerald-400"
                    >
                      {riders.map((r) => (
                        <option key={r.rider_id} value={r.rider_id}>
                          {r.rider_name} • {r.phone}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveRider({
                          ...activeRider,
                          is_available: !activeRider.is_available,
                        })
                      }
                      className={`py-2 px-3 rounded-xl border font-mono text-xs font-semibold transition ${
                        activeRider.is_available
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                          : "bg-amber-500/15 border-amber-500/40 text-amber-300"
                      }`}
                    >
                      Status: {activeRider.is_available ? "AVAILABLE" : "BUSY"}
                    </button>

                    <div className="flex items-center justify-center gap-1.5 rounded-xl bg-[#08080A] border border-white/10 px-3 py-2 font-mono text-xs text-cyan-300">
                      <BatteryCharging className="h-4 w-4 text-cyan-400" />
                      <span>Battery: {activeRider.battery_pct}%</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
                    <span className="font-mono text-[11px] text-zinc-400">
                      GPS: [{activeRider.lat.toFixed(4)}°N,{" "}
                      {activeRider.lng.toFixed(4)}°E]
                    </span>
                    <div className="flex items-center gap-2">
                      {(selectedOrder || selectedAlias) && (
                        <button
                          type="button"
                          onClick={handleSimulateApproach}
                          className="rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-1.5 font-mono text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/25 transition flex items-center gap-1.5"
                          title="Step courier 35% closer to destination"
                        >
                          <Navigation className="h-3 w-3" />
                          <span>Simulate Approach</span>
                        </button>
                      )}
                      <button
                        type="button"
                        data-demo="rider-ping-gps"
                        onClick={handleBroadcastTelemetry}
                        className="rounded-lg bg-cyan-500/15 border border-cyan-500/30 px-3 py-1.5 font-mono text-[11px] text-cyan-300 hover:bg-cyan-500/20 transition"
                      >
                        {telemetrySaved
                          ? "✓ Ping Saved"
                          : "Ping Location"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Card 2: Rider Delivery Queue & POD */}
            <section className="rounded-2xl bg-[#111116] border border-white/10 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                    LAST-MILE ROOFTOP NAVIGATION &amp; PROOF OF DELIVERY
                  </span>
                  <h3 className="mt-0.5 text-sm font-bold text-white">
                    Rider Delivery Queue ({orders.length})
                  </h3>
                </div>
                <span className="rounded-full bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 font-mono text-[10px] text-violet-300">
                  RBAC: RESTRICTED
                </span>
              </div>

              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {orders.map((ord) => {
                  const isSelected =
                    !selectedAlias && selectedOrder?.order_id === ord.order_id;
                  return (
                    <div
                      key={ord.order_id}
                      onClick={() => {
                        setSelectedAlias(null);
                        setSelectedOrder(ord);
                        setPodResult(null);
                      }}
                      className={`cursor-pointer rounded-xl border p-3 transition ${
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500/40"
                          : "bg-[#08080A] border-white/5 hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-emerald-300">
                            {ord.postcode}
                          </span>
                          <span className="text-xs font-medium text-white">
                            {ord.customer_name || "Customer"}
                          </span>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                            ord.order_status === "DELIVERED"
                              ? "bg-emerald-500/20 text-emerald-300"
                              : ord.order_status === "DISPATCHED"
                                ? "bg-cyan-500/20 text-cyan-300"
                                : "bg-amber-500/15 text-amber-300"
                          }`}
                        >
                          {ord.order_status}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-[11px] text-zinc-400">
                        {ord.delivery_address} • Gate Note: &ldquo;
                        {ord.notes || "Gate verified"}&rdquo;
                      </p>
                    </div>
                  );
                })}
              </div>

              {selectedOrder && (
                <div className="rounded-xl bg-[#08080A] border border-white/10 p-3.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono text-[10px] text-zinc-400">
                        ORDER KEY: {selectedOrder.idempotency_key}
                      </span>
                      <h4 className="text-xs font-semibold text-white">
                        {selectedOrder.delivery_address}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleSimulateApproach}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 px-2.5 py-1 text-xs font-mono font-semibold text-emerald-300 transition"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        <span>Approach ({currentDistanceMeters}m)</span>
                      </button>
                      {selectedOrder.order_status === "PENDING" && (
                        <button
                          type="button"
                          data-demo="rider-accept-dispatch"
                          onClick={() => handleAcceptDispatch(selectedOrder)}
                          className="flex items-center gap-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 px-3 py-1.5 text-xs font-bold text-zinc-950 transition"
                        >
                          <Truck className="h-3.5 w-3.5" />
                          <span>Accept Dispatch</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {selectedOrder.order_status !== "DELIVERED" && (
                    <div className="space-y-2 pt-2 border-t border-white/10">
                      <label className="block font-mono text-[10px] text-zinc-400">
                        PROOF OF DELIVERY (PHOTO URL + POSTGIS GPS HANDSHAKE)
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={podUrl}
                          onChange={(e) => setPodUrl(e.target.value)}
                          className="flex-1 bg-[#111116] border border-white/15 rounded-xl px-3 py-2 font-mono text-xs text-zinc-200 focus:outline-none focus:border-emerald-400"
                        />
                        <button
                          type="button"
                          disabled={submittingPod}
                          data-demo="rider-complete-pod"
                          onClick={handleCompletePod}
                          className="flex items-center gap-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 px-3.5 py-2 text-xs font-bold text-zinc-950 transition"
                        >
                          <Camera className="h-3.5 w-3.5" />
                          <span>
                            {submittingPod ? "Verifying..." : "Complete POD"}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}

                  {podResult && (
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-emerald-300">
                        <span className="flex items-center gap-1.5">
                          <PackageCheck className="h-4 w-4" />
                          <span>POD Verified • Order DELIVERED</span>
                        </span>
                        <span className="font-mono text-[10px]">
                          GPS Offset: {podResult.gps_distance_from_polygon_m}m
                        </span>
                      </div>
                      <p className="font-mono text-[11px] text-zinc-300">
                        Polygon Proximity Verified:{" "}
                        {String(podResult.gps_verified)} •{" "}
                        {new Date(podResult.delivered_at).toLocaleTimeString()}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Card 3: Mint Temporary Postcode (TP-ABJ-XXXX) */}
            <section className="rounded-2xl bg-[#111116] border border-amber-500/30 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
                    CROWDSOURCED ENUMERATION ENGINE (TP-CODE MINTING)
                  </span>
                  <h3 className="mt-0.5 text-sm font-bold text-white">
                    Mint Temporary Postcode (TP-ABJ-XXXX)
                  </h3>
                </div>
                <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 font-mono text-[10px] text-amber-300">
                  90-DAY TTL
                </span>
              </div>

              <form onSubmit={handleMintTpCode} className="space-y-3">
                <div>
                  <label className="block font-mono text-[10px] text-zinc-400 mb-1">
                    INFORMAL LANDMARK / COMPOUND GATE NAME
                  </label>
                  <input
                    type="text"
                    value={aliasName}
                    onChange={(e) => setAliasName(e.target.value)}
                    required
                    className="w-full bg-[#08080A] border border-white/15 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] text-zinc-400 mb-1">
                      ABUJA DISTRICT (AMAC)
                    </label>
                    <input
                      type="text"
                      value={district}
                      onChange={(e) => setDistrict(e.target.value)}
                      className="w-full bg-[#08080A] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-zinc-400 mb-1">
                      PARENT NIPOST CODE
                    </label>
                    <input
                      type="text"
                      value={canonicalCode}
                      onChange={(e) =>
                        setCanonicalCode(e.target.value.toUpperCase())
                      }
                      className="w-full bg-[#08080A] border border-white/15 rounded-xl px-3 py-2 font-mono text-xs text-emerald-300 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="font-mono text-[10px] text-zinc-400">
                      CAPTURED LATITUDE &amp; LONGITUDE
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeRider) {
                          setMintLat(activeRider.lat);
                          setMintLng(activeRider.lng);
                        } else {
                          setMintLat(mapLat);
                          setMintLng(mapLng);
                        }
                      }}
                      className="flex items-center gap-1 rounded-md bg-cyan-500/15 border border-cyan-500/30 px-2 py-0.5 text-[10px] font-mono text-cyan-300 hover:bg-cyan-500/25 transition"
                    >
                      <Navigation className="h-2.5 w-2.5" />
                      <span>Capture Courier GPS</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      step="0.0001"
                      value={mintLat}
                      onChange={(e) =>
                        setMintLat(parseFloat(e.target.value) || 9.0758)
                      }
                      className="w-full bg-[#08080A] border border-white/15 rounded-xl px-3 py-2 font-mono text-xs text-white focus:outline-none"
                    />
                    <input
                      type="number"
                      step="0.0001"
                      value={mintLng}
                      onChange={(e) =>
                        setMintLng(parseFloat(e.target.value) || 7.4904)
                      }
                      className="w-full bg-[#08080A] border border-white/15 rounded-xl px-3 py-2 font-mono text-xs text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* Interactive Building Vertex & Gate Enumerator Bar */}
                <div className="space-y-2 pt-1 border-t border-white/5">
                  <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400">
                    <span>BUILDING VERTICES ({markedVertices.length} CORNERS)</span>
                    <span className="text-amber-400 font-bold">ROOFTOP ENUMERATION</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      id="btn-toggle-vertex-mark"
                      data-demo="rider-toggle-vertex-mark"
                      type="button"
                      onClick={() => setIsMarkingVertices((prev) => !prev)}
                      className={`py-2 px-3 rounded-xl border font-mono text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
                        isMarkingVertices
                          ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                          : "bg-[#08080A] border-white/10 text-zinc-300 hover:border-emerald-500/30 hover:text-white"
                      }`}
                    >
                      <span>✏️ Mark Corners ({markedVertices.length})</span>
                    </button>

                    <button
                      id="btn-auto-trace-vertices"
                      data-demo="rider-trace-vertices"
                      type="button"
                      onClick={handleAutoTraceVertices}
                      className="py-2 px-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 font-mono text-xs font-semibold transition flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                      <span>⚡ Trace 4 Corners (V1–V4)</span>
                    </button>
                  </div>

                  {/* Gate Photo & Proof of Delivery input */}
                  <div>
                    <label className="block font-mono text-[10px] text-zinc-400 mb-1">
                      GATE PHOTO / PROOF OF DELIVERY (POD URL)
                    </label>
                    <input
                      type="text"
                      value={mintPodUrl}
                      onChange={(e) => setMintPodUrl(e.target.value)}
                      className="w-full bg-[#08080A] border border-white/15 rounded-xl px-3 py-1.5 font-mono text-[11px] text-zinc-300 focus:outline-none focus:border-emerald-400"
                    />
                  </div>

                  {/* Live Enumeration Summary Pill */}
                  <div className="rounded-xl bg-[#08080A] border border-white/10 p-2.5 font-mono text-[11px] space-y-1">
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-500">Gate GPS:</span>
                      <span className="text-cyan-300">[{mintLat.toFixed(4)}°N, {mintLng.toFixed(4)}°E]</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-500">Marked Polygon:</span>
                      <span className="text-amber-300 font-semibold">
                        {markedVertices.length > 0
                          ? `V1 → ${markedVertices.map((_, i) => `V${i + 1}`).slice(1).join(" → ")} (${markedVertices.length} vertices)`
                          : "None (Click map or Trace)"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-300">
                      <span className="text-zinc-500">POD &amp; Gate Photo:</span>
                      <span className="text-emerald-400 font-semibold">Verified ✓</span>
                    </div>
                  </div>
                </div>

                <button
                  id="btn-submit-mint-tp"
                  data-demo="rider-mint-tp"
                  type="submit"
                  disabled={minting}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>
                    {minting
                      ? "Minting into PostGIS aliases..."
                      : "Mint Temporary Postcode (POST /v1/alias/mint)"}
                  </span>
                </button>
              </form>
            </section>
          </div>

          {/* Right Column: 7 Cols */}
          <div className="lg:col-span-7 space-y-5">
            <PostcodeMap
              centerLat={mapLat}
              centerLng={mapLng}
              postcodeLabel={mapCode}
              addressLabel={mapAddress}
              buildingPolygon={mapPolygon}
              resolutionSource={
                selectedAlias ? "postgis_alias_tp" : "rider_nav_polygon"
              }
              heightClass="h-[440px]"
              isMarkingVertices={isMarkingVertices}
              markedVertices={markedVertices}
              onAddVertex={(lng, lat) => {
                setMarkedVertices((prev) => [...prev, [lng, lat]]);
              }}
              riders={
                activeRider
                  ? [
                      {
                        id: activeRider.rider_id,
                        name: activeRider.rider_name,
                        category_or_status: activeRider.is_available
                          ? "AVAILABLE"
                          : "BUSY",
                        phone: activeRider.phone,
                        lat: activeRider.lat,
                        lng: activeRider.lng,
                        distance_meters: Math.max(10, currentDistanceMeters),
                      },
                    ]
                  : []
              }
            />

            {/* Minted TP-Code & Community Alias Trust Ledger */}
            <section className="rounded-2xl bg-[#111116] border border-white/10 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-400" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      Minted Temporary Postcodes &amp; Trust Progression (
                      {aliases.length})
                    </h3>
                    <p className="font-mono text-[11px] text-zinc-400">
                      Auto-promotes from TP-Code to Verified Alias after 3
                      deliveries (POST /v1/verify)
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {aliases.map((item, idx) => {
                  const isSelected =
                    selectedAlias?.alias_code === item.alias_code;
                  const progressPct = Math.min(
                    100,
                    Math.round((item.delivery_count / 3) * 100),
                  );
                  return (
                    <div
                      key={item.alias_code}
                      onClick={() => {
                        setSelectedAlias(item);
                        setSelectedOrder(null);
                      }}
                      className={`cursor-pointer rounded-xl border p-3.5 transition ${
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500/40"
                          : "bg-[#08080A] border-white/10 hover:border-white/25"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-1 font-mono text-xs font-bold text-amber-300">
                            <MapPin className="h-3.5 w-3.5" />
                            <span>{item.alias_code}</span>
                          </span>
                          {item.verified ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                              <ShieldCheck className="h-3 w-3" />
                              <span>VERIFIED ALIAS</span>
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-mono text-[10px] text-amber-300">
                              TEMP CODE (90d TTL)
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          data-demo={idx === 0 ? "rider-verify-tp-0" : undefined}
                          disabled={verifyingCode === item.alias_code}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerifyDeliveryCount(item.alias_code);
                          }}
                          className="flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-1 font-mono text-[10px] font-semibold text-emerald-300 hover:bg-emerald-500/30 transition"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>
                            {verifyingCode === item.alias_code
                              ? "Updating..."
                              : "+1 Verified Delivery"}
                          </span>
                        </button>
                      </div>

                      <p className="mt-1.5 text-xs font-medium text-zinc-200">
                        {item.alias_name} •{" "}
                        <span className="font-mono text-[11px] text-zinc-400">
                          Parent: {item.canonical_postcode || "FC-02-A09-DB-09"}
                        </span>
                      </p>

                      <div className="mt-2.5 space-y-1">
                        <div className="flex items-center justify-between font-mono text-[10px] text-zinc-400">
                          <span>TRUST SCORE: {item.trust_score}</span>
                          <span className="flex items-center gap-1 text-cyan-300">
                            <Navigation className="h-2.5 w-2.5" />
                            <span>
                              Deliveries: {item.delivery_count} / 3 for
                              Permanent Promotion
                            </span>
                          </span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full transition-all duration-500 ${
                              item.verified ? "bg-emerald-400" : "bg-amber-400"
                            }`}
                            style={{ width: `${progressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}

      {subTab === "rescue" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: 5 Cols */}
          <div className="lg:col-span-5 space-y-5">
            {/* Card 1: 1-Tap SOS Trigger & Termii 2G SMS */}
            <section className="rounded-2xl bg-[#111116] border border-white/10 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-amber-400">
                    EMERGENCY RESPONSE • 1-TAP SOS &amp; TERMII SMS
                  </span>
                  <h2 className="mt-0.5 text-sm font-bold text-white flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-emerald-400" />
                    <span>1-Tap SOS &amp; Termii 2G SMS Broadcast</span>
                  </h2>
                </div>
                <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 font-mono text-[10px] text-emerald-300">
                  NG-SECURE
                </span>
              </div>

              <form onSubmit={handleTriggerSos} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] text-zinc-400 mb-1">
                      ACTIVE POSTCODE / TP-CODE
                    </label>
                    <input
                      type="text"
                      value={sosPostcode}
                      onChange={(e) =>
                        setSosPostcode(e.target.value.toUpperCase())
                      }
                      className="w-full bg-[#08080A] border border-white/15 rounded-xl px-3 py-2 font-mono text-xs text-emerald-300 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] text-zinc-400 mb-1">
                      RESPONDER TYPE (KNN)
                    </label>
                    <select
                      value={sosType}
                      onChange={(e) =>
                        setSosType(
                          e.target.value as "HOSPITAL" | "POLICE" | "FIRE",
                        )
                      }
                      className="w-full bg-[#08080A] border border-white/15 rounded-xl px-3 py-2 font-mono text-xs text-white focus:outline-none"
                    >
                      <option value="HOSPITAL">HOSPITAL (Trauma)</option>
                      <option value="POLICE">POLICE (FCT Command)</option>
                      <option value="FIRE">FIRE SERVICE</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block font-mono text-[10px] text-zinc-400 mb-1">
                    VERIFIED LANDMARK / STREET
                  </label>
                  <input
                    type="text"
                    value={sosAddress}
                    onChange={(e) => setSosAddress(e.target.value)}
                    className="w-full bg-[#08080A] border border-white/15 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSosTriage("RED")}
                    className={`py-2 px-3 rounded-xl border font-mono text-xs font-bold transition ${
                      sosTriage === "RED"
                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                        : "bg-[#08080A] border-white/10 text-zinc-400"
                    }`}
                  >
                    TRIAGE: RED (CRITICAL)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSosTriage("YELLOW")}
                    className={`py-2 px-3 rounded-xl border font-mono text-xs font-bold transition ${
                      sosTriage === "YELLOW"
                        ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                        : "bg-[#08080A] border-white/10 text-zinc-400"
                    }`}
                  >
                    TRIAGE: YELLOW (URGENT)
                  </button>
                </div>

                <button
                  data-demo="rescue-trigger-sos"
                  type="submit"
                  disabled={sosLoading}
                  className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition"
                >
                  <PhoneCall className="h-4 w-4" />
                  <span>
                    {sosLoading
                      ? "Routing via PostGIS KNN..."
                      : "Trigger SOS & Broadcast Termii 2G SMS (POST /v1/emergency/sos)"}
                  </span>
                </button>
              </form>
            </section>

            {/* Card 2: USSD *347*postcode# Simulator */}
            <section className="rounded-2xl bg-[#111116] border border-white/10 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
                    FEATURE-PHONE INCLUSION (ZERO DATA)
                  </span>
                  <h3 className="mt-0.5 text-sm font-bold text-white flex items-center gap-2">
                    <Smartphone className="h-4 w-4 text-cyan-400" />
                    <span>USSD *347*postcode# Zero-Data Dialer</span>
                  </h3>
                </div>
                <span className="rounded-full bg-cyan-500/15 border border-cyan-500/30 px-2.5 py-0.5 font-mono text-[10px] text-cyan-300">
                  2G GSM READY
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  "*347*FC-02-A09-DB-09#",
                  "*347*TP-ABJ-7K2P#",
                  "*347*FC-01-M04-MA-03#",
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setUssdInput(preset)}
                    className="rounded-lg bg-[#08080A] border border-white/10 px-2 py-1 font-mono text-[11px] text-zinc-300 hover:border-cyan-400/40 hover:text-cyan-300 transition"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <form onSubmit={handleDialUssd} className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ussdInput}
                    onChange={(e) => setUssdInput(e.target.value)}
                    className="flex-1 bg-[#08080A] border border-white/15 rounded-xl px-3.5 py-2 font-mono text-xs text-cyan-300 focus:outline-none focus:border-cyan-400"
                  />
                  <button
                    data-demo="rescue-dial-ussd"
                    type="submit"
                    disabled={ussdLoading}
                    className="flex items-center gap-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 px-4 py-2 font-mono text-xs font-bold text-zinc-950 transition"
                  >
                    <span>{ussdLoading ? "Dialing..." : "SEND"}</span>
                  </button>
                </div>
              </form>

              {ussdResult && (
                <div className="rounded-xl bg-[#08080A] border border-cyan-500/30 p-3.5 font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between text-cyan-400 border-b border-white/5 pb-1">
                    <span>USSD SESSION READY</span>
                    <span className="text-[10px]">
                      POSTCODE: {ussdResult.resolved_postcode}
                    </span>
                  </div>
                  <pre className="whitespace-pre-wrap font-mono text-[11px] text-zinc-200">
                    {ussdResult.screen_text}
                  </pre>
                </div>
              )}
            </section>
          </div>

          {/* Right Column: 7 Cols */}
          <div className="lg:col-span-7 space-y-5">
            <PostcodeMap
              centerLat={mapLat}
              centerLng={mapLng}
              postcodeLabel={mapCode}
              addressLabel={mapAddress}
              buildingPolygon={mapPolygon}
              resolutionSource="emergency_knn_responder"
              heightClass="h-[440px]"
              riders={
                selectedIncident
                  ? [
                      {
                        id: selectedIncident.incident_id,
                        name: selectedIncident.assigned_responder,
                        category_or_status: selectedIncident.emergency_type,
                        phone: selectedIncident.responder_phone,
                        lat: selectedIncident.lat + 0.0045,
                        lng: selectedIncident.lng + 0.0045,
                        distance_meters: selectedIncident.distance_meters,
                      },
                    ]
                  : []
              }
            />

            {/* Emergency Dispatcher Ledger */}
            <section className="rounded-2xl bg-[#111116] border border-white/10 p-5 space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-emerald-400 animate-pulse" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white">
                      EMERGENCY DISPATCH CONSOLE (
                      {incidents.length})
                    </h3>
                    <p className="font-mono text-[11px] text-zinc-400">
                      Closing an incident increments postcode trust score +1
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-violet-500/15 border border-violet-500/30 px-2.5 py-0.5 font-mono text-[10px] text-violet-300">
                  RBAC: SECURITY TIER
                </span>
              </div>

              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {incidents.map((inc, idx) => {
                  const isSelected =
                    selectedIncident?.incident_id === inc.incident_id;
                  return (
                    <div
                      key={inc.incident_id}
                      onClick={() => setSelectedIncident(inc)}
                      className={`cursor-pointer rounded-xl border p-3.5 transition space-y-2 ${
                        isSelected
                          ? "bg-emerald-500/10 border-emerald-500/40"
                          : "bg-[#08080A] border-white/10 hover:border-white/25"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-white">
                            {inc.incident_id}
                          </span>
                          <span className="font-mono text-xs font-bold text-emerald-300">
                            {inc.postcode}
                          </span>
                          <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                            {inc.triage_level} • {inc.emergency_type}
                          </span>
                        </div>

                        {inc.status !== "RESOLVED" ? (
                          <button
                            type="button"
                            data-demo={idx === 0 ? "rescue-resolve-incident" : undefined}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleResolveIncident(inc.incident_id);
                            }}
                            className="flex items-center gap-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-2.5 py-1 font-mono text-[10px] font-bold text-zinc-950 transition"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Resolve &amp; Trust +1</span>
                          </button>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-300">
                            <ShieldCheck className="h-3 w-3" />
                            <span>RESOLVED • TRUST +1</span>
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-zinc-200">
                        Responder:{" "}
                        <strong className="text-cyan-300">
                          {inc.assigned_responder}
                        </strong>{" "}
                        • {Math.round(inc.distance_meters)}m away • ETA{" "}
                        {inc.eta_minutes} mins
                      </p>

                      <div className="rounded-lg bg-[#111116] border border-white/5 p-2 font-mono text-[10px] text-zinc-400">
                        {inc.termii_sms_preview}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}
    </div>
  );
};
