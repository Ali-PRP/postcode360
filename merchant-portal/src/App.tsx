// src/App.tsx
import { useEffect, useState } from "react";
import { Truck, HeartPulse, ShieldCheck } from "lucide-react";
import { Navbar, type ActiveTab } from "./components/layout/Navbar";
import { PiiSessionCard } from "./components/checkout/PiiSessionCard";
import { PostcodeLookup } from "./components/checkout/PostcodeLookup";
import { OrderCheckout } from "./components/checkout/OrderCheckout";
import { PostcodeMap } from "./components/map/PostcodeMap";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { PluginTemplates } from "./components/plugins/PluginTemplates";
import { postcode360Api } from "./services/api";
import type {
  LookupResponse,
  NearestItem,
  OrderResponse,
  WidgetSessionResponse,
} from "./types/postcode360";

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("checkout");
  const [session, setSession] = useState<WidgetSessionResponse | null>(null);
  const [lookupResult, setLookupResult] = useState<LookupResponse | null>(null);
  const [checkoutRiders, setCheckoutRiders] = useState<NearestItem[]>([]);
  const [checkoutEmergencies, setCheckoutEmergencies] = useState<NearestItem[]>(
    [],
  );
  const [emergencyType, setEmergencyType] = useState<
    "HOSPITAL" | "POLICE" | "FIRE"
  >("HOSPITAL");
  const [lastOrder, setLastOrder] = useState<OrderResponse | null>(null);
  const [orderCount, setOrderCount] = useState<number>(0);

  const activePlace = lookupResult?.data || null;

  const refreshSpatialNeighbors = async (
    lat: number,
    lng: number,
    emgType: "HOSPITAL" | "POLICE" | "FIRE" = emergencyType,
  ) => {
    try {
      const [riderRes, emgRes] = await Promise.all([
        postcode360Api.getNearestRiders(lat, lng),
        postcode360Api.getNearestEmergency(lat, lng, emgType),
      ]);
      setCheckoutRiders(riderRes.results);
      setCheckoutEmergencies(emgRes.results);
    } catch {
      // Handled gracefully by service fallback
    }
  };

  useEffect(() => {
    postcode360Api
      .listOrders(50)
      .then((list) => setOrderCount(list.length))
      .catch(() => {});
  }, [activeTab]);

  return (
    <div className="flex min-h-screen flex-col bg-[#08080A] text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-200">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onTabChange={setActiveTab}
        orderCount={orderCount}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6">
        {activeTab === "checkout" && (
          <div className="space-y-6">
            {/* Storefront Hero Banner & 3-Item Luxury Abaya Cart Breakdown */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-gradient-to-r from-[#111116] via-[#16161E] to-[#111116] p-4 sm:p-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-400">
                    TASK #5 • PRIORITY 0
                  </span>
                  <span className="font-mono text-xs text-zinc-400">
                    @findam/widget v1.2 • Origin: {window.location.origin}
                  </span>
                </div>
                <h1 className="text-lg font-bold text-white sm:text-xl">
                  Abuja Luxury Abayas &amp; Goods — Spatial Checkout Simulator
                </h1>
                <p className="text-xs text-zinc-400 sm:text-sm">
                  Simulates a live Nigerian e-commerce checkout performing
                  Zero-PII HMAC-SHA256 handshakes, 3-tier NIPOST/PostGIS polygon
                  resolution, and idempotent order submission.
                </p>
              </div>

              <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-[#08080A] px-4 py-3">
                <div>
                  <div className="font-mono text-[11px] uppercase text-zinc-400">
                    Cart Total (3 Items)
                  </div>
                  <div className="font-mono text-xl font-bold text-emerald-400">
                    ₦28,500
                  </div>
                </div>
                <div className="h-8 w-px bg-white/10" />
                <div className="space-y-0.5 text-xs text-zinc-400">
                  <div>Royal Emirati Silk Abaya • ₦22,000</div>
                  <div>Zari Embroidered Sheila • ₦5,000</div>
                  <div className="text-cyan-400">
                    Abuja Express Rider • ₦1,500
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left Column: 3-Step Checkout Controls (5 cols) */}
              <div className="space-y-5 lg:col-span-5">
                <PiiSessionCard
                  session={session}
                  onSessionCreated={setSession}
                />

                <PostcodeLookup
                  onResolved={(res) => {
                    setLookupResult(res);
                    refreshSpatialNeighbors(
                      res.data.lat,
                      res.data.lng,
                      emergencyType,
                    );
                  }}
                />

                <OrderCheckout
                  resolvedPostcode={activePlace}
                  onOrderCreated={(order, nearestRiders) => {
                    setLastOrder(order);
                    setCheckoutRiders(nearestRiders);
                    if (!order.idempotent_replay) {
                      setOrderCount((c) => c + 1);
                    }
                  }}
                />
              </div>

              {/* Right Column: Interactive MapLibre + CAD Viewer & Split KNN Cards (7 cols) */}
              <div className="space-y-5 lg:col-span-7">
                <PostcodeMap
                  centerLat={activePlace?.lat || 9.0765}
                  centerLng={activePlace?.lng || 7.4892}
                  postcodeLabel={activePlace?.postcode || "FC-02-A09-DB-09"}
                  addressLabel={
                    activePlace
                      ? `${activePlace.street}, ${activePlace.district}, ${activePlace.lga}`
                      : "42 Adetokunbo Ademola Crescent, Wuse II, Abuja"
                  }
                  buildingPolygon={activePlace?.building_polygon}
                  riders={checkoutRiders}
                  emergencies={checkoutEmergencies}
                  confidence={activePlace?.confidence}
                  resolutionSource={lookupResult?.source}
                  latencyMs={lookupResult?.latency_ms}
                  title={`Abuja Spatial Resolution • ${activePlace?.district || "Wuse II"} (${activePlace?.postcode || "FC-02-A09-DB-09"})`}
                />

                {/* Split KNN Cards: Nearest Riders & Emergency Response Lookup */}
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                  {/* Nearest Riders Card */}
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-[#111116] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-400">
                          <Truck className="h-4 w-4" />
                          <span>PostGIS GiST KNN Nearest Riders</span>
                        </h3>
                        <p className="font-mono text-[11px] text-zinc-400">
                          GET /riders/nearest?lat=
                          {(activePlace?.lat || 9.0765).toFixed(4)}&amp;lng=
                          {(activePlace?.lng || 7.4892).toFixed(4)}
                        </p>
                      </div>
                      <span className="rounded border border-cyan-500/30 bg-cyan-500/15 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
                        {checkoutRiders.length} Active
                      </span>
                    </div>

                    <div className="space-y-2">
                      {checkoutRiders.slice(0, 3).map((r, idx) => (
                        <div
                          key={r.id}
                          className={`flex items-center justify-between rounded-xl border p-2.5 text-xs ${
                            idx === 0
                              ? "border-cyan-500/40 bg-cyan-500/10"
                              : "border-white/5 bg-[#08080A]"
                          }`}
                        >
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 font-semibold text-white">
                              <span>{r.name}</span>
                              {idx === 0 && (
                                <span className="rounded bg-cyan-400 px-1.5 py-0.5 font-mono text-[9px] font-bold text-zinc-950">
                                  CLOSEST
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-[11px] text-zinc-400">
                              {r.vehicle || "TVS Apache 200"} •{" "}
                              {r.plate || "ABJ-482-KW"}
                            </div>
                          </div>
                          <div className="text-right font-mono">
                            <div className="text-sm font-bold text-cyan-300">
                              {Math.round(r.distance_meters)}m
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              ~{r.eta_mins || 3} mins • {r.rating || 4.9}★
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Emergency Response Lookup Card */}
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-[#111116] p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-rose-400">
                          <HeartPulse className="h-4 w-4" />
                          <span>Emergency Response Lookup</span>
                        </h3>
                        <p className="font-mono text-[11px] text-zinc-400">
                          GET /emergency/nearest?type={emergencyType}
                        </p>
                      </div>

                      <div className="flex rounded-lg border border-white/10 bg-[#08080A] p-0.5 font-mono text-[10px]">
                        {(["HOSPITAL", "POLICE", "FIRE"] as const).map(
                          (type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                setEmergencyType(type);
                                refreshSpatialNeighbors(
                                  activePlace?.lat || 9.0765,
                                  activePlace?.lng || 7.4892,
                                  type,
                                );
                              }}
                              className={`rounded px-2 py-1 transition ${
                                emergencyType === type
                                  ? "bg-rose-500/25 font-bold text-rose-300"
                                  : "text-zinc-400 hover:text-white"
                              }`}
                            >
                              {type}
                            </button>
                          ),
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      {checkoutEmergencies.slice(0, 3).map((emg, idx) => (
                        <div
                          key={emg.id}
                          className={`flex items-center justify-between rounded-xl border p-2.5 text-xs ${
                            idx === 0
                              ? "border-rose-500/35 bg-rose-500/10"
                              : "border-white/5 bg-[#08080A]"
                          }`}
                        >
                          <div className="space-y-0.5 pr-2">
                            <div className="truncate font-semibold text-white">
                              {emg.name}
                            </div>
                            <div className="truncate text-[11px] text-zinc-400">
                              {emg.trauma_level ||
                                emg.address ||
                                `Emergency Line: ${emg.phone || "112"}`}
                            </div>
                          </div>
                          <div className="shrink-0 text-right font-mono">
                            <div className="text-sm font-bold text-rose-300">
                              {Math.round(emg.distance_meters)}m
                            </div>
                            <div className="text-[10px] text-zinc-400">
                              {emg.category_or_status}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {lastOrder && checkoutRiders.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4">
                    <div>
                      <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-400">
                        LIVE POSTGIS ST_DWITHIN DISPATCH PREVIEW
                      </span>
                      <h4 className="mt-0.5 text-sm font-semibold text-white">
                        Closest Rider: {checkoutRiders[0].name} (
                        {Math.round(checkoutRiders[0].distance_meters)}m away)
                      </h4>
                      <p className="mt-0.5 text-xs text-zinc-400">
                        Order{" "}
                        <span className="font-mono text-zinc-200">
                          {lastOrder.idempotency_key}
                        </span>{" "}
                        is ready in the Admin Dashboard.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setActiveTab("admin")}
                      className="rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-black transition-all hover:bg-cyan-300"
                    >
                      Open in Admin Dashboard →
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === "admin" && <AdminDashboard />}

        {activeTab === "plugins" && <PluginTemplates />}
      </main>

      <footer className="mt-10 border-t border-white/10 px-6 py-5 text-center">
        <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 font-mono text-[11px] text-zinc-500">
          <span>
            FindAm // postcode360 • Team A Frontend Workspace • Abuja Luxury
            Abayas &amp; Goods • ₦28,500
          </span>
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Zero-PII • PostGIS EPSG:4326 • HMAC-SHA256 • Origin-bound JWT •
            raw_pii_retained: false
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
