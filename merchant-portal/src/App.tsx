// src/App.tsx
import { useEffect, useState } from "react";
import { Truck, HeartPulse, ShoppingBag, Code2 } from "lucide-react";
import { Navbar, type ActiveTab } from "./components/layout/Navbar";
import { CustomerCheckoutWidget } from "./components/checkout/CustomerCheckoutWidget";
import { PiiSessionCard } from "./components/checkout/PiiSessionCard";
import { PostcodeLookup } from "./components/checkout/PostcodeLookup";
import { OrderCheckout } from "./components/checkout/OrderCheckout";
import { BookmarkSyncBar } from "./components/checkout/BookmarkSyncBar";
import { PostcodeMap } from "./components/map/PostcodeMap";
import { AdminDashboard } from "./components/admin/AdminDashboard";
import { PluginTemplates } from "./components/plugins/PluginTemplates";
import { RiderDashboard } from "./components/rider/RiderDashboard";
import { SocialStorefront } from "./components/storefront/SocialStorefront";
import { postcode360Api } from "./services/api";
import type {
  LookupResponse,
  NearestItem,
  OrderResponse,
  WidgetSessionResponse,
} from "./types/postcode360";

export function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("checkout");
  const [checkoutSubMode, setCheckoutSubMode] = useState<"customer" | "developer">("customer");
  const [session, setSession] = useState<WidgetSessionResponse | null>(null);
  const [lookupResult, setLookupResult] = useState<LookupResponse | null>(null);
  const [checkoutRiders, setCheckoutRiders] = useState<NearestItem[]>([]);
  const [checkoutEmergencies, setCheckoutEmergencies] = useState<NearestItem[]>([]);
  const [emergencyType, setEmergencyType] = useState<"HOSPITAL" | "POLICE" | "FIRE">("HOSPITAL");
  const [lastOrder, setLastOrder] = useState<OrderResponse | null>(null);
  const [orderCount, setOrderCount] = useState<number>(0);

  // Dark/Light Theme state with localStorage persistence
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    const saved = localStorage.getItem("postcode360_theme");
    return saved ? saved === "dark" : true;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("postcode360_theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("postcode360_theme", "light");
    }
  }, [isDarkMode]);

  const toggleDarkMode = () => {
    setIsDarkMode((prev) => !prev);
  };

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
  }, [activeTab, lastOrder]);

  return (
    <div className="flex min-h-screen flex-col bg-[#f8fafc] dark:bg-[#090d16] text-slate-900 dark:text-zinc-100 selection:bg-emerald-500/30 selection:text-emerald-700 dark:selection:text-emerald-200 transition-colors">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onTabChange={setActiveTab}
        orderCount={orderCount}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />

      <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6">
        {/* TAB 1: SPATIAL CHECKOUT */}
        {activeTab === "checkout" && (
          <div className="space-y-6">
            {/* Top Submode Switcher: Customer Checkout vs Developer Mode */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] p-3 shadow-sm">
              <div className="inline-flex rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#111625] p-1 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setCheckoutSubMode("customer")}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 transition ${
                    checkoutSubMode === "customer"
                      ? "bg-white text-emerald-800 dark:bg-emerald-600 dark:text-white shadow-sm font-bold"
                      : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  <ShoppingBag className="h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                  <span>Customer Checkout</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCheckoutSubMode("developer")}
                  className={`flex items-center gap-1.5 rounded-lg px-4 py-2 transition ${
                    checkoutSubMode === "developer"
                      ? "bg-white text-slate-900 dark:bg-emerald-600 dark:text-white shadow-sm font-bold"
                      : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white"
                  }`}
                >
                  <Code2 className="h-4 w-4" />
                  <span>Developer Mode</span>
                </button>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs text-slate-500 dark:text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {checkoutSubMode === "customer"
                    ? "Live Buyer Experience"
                    : "SaaS Engineer Sandbox • Zero-PII HMAC-SHA256 & PostGIS KNN"}
                </span>
              </div>
            </div>

            {checkoutSubMode === "customer" ? (
              <CustomerCheckoutWidget
                initialPostcode={activePlace}
                onOrderCompleted={(order, riders) => {
                  setLastOrder(order);
                  setCheckoutRiders(riders);
                }}
              />
            ) : (
              <div className="space-y-6">
                {/* Clean Hero Card showcasing the core basis distinctly */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] p-5 shadow-sm">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                        3-Tier Spatial Postcode Resolution
                      </span>
                      <span className="font-mono text-xs text-slate-500 dark:text-zinc-400">
                        Zero-PII Checkout &amp; PostGIS Dispatch
                      </span>
                    </div>
                    <h1 className="text-lg font-bold text-slate-900 dark:text-white sm:text-xl">
                      Spatial Checkout &amp; Last-Mile Verification
                    </h1>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 sm:text-sm">
                      Resolves verified rooftop parcels, executes HMAC-SHA256 identity handshakes, and prevents duplicate charges.
                    </p>
                  </div>

                  <div className="flex items-center gap-4 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] px-4 py-3">
                    <div>
                      <div className="font-mono text-[11px] uppercase text-slate-500 dark:text-zinc-400">
                        Cart Total (3 Items)
                      </div>
                      <div className="font-mono text-xl font-bold text-emerald-600 dark:text-emerald-400">
                        ₦180,000
                      </div>
                    </div>
                    <div className="h-8 w-px bg-slate-200 dark:bg-white/10" />
                    <div className="space-y-0.5 text-xs text-slate-600 dark:text-zinc-300">
                      <div>Royal Amber Arabian Oud (100ml) • ₦100,000</div>
                      <div>Structured Leather Handbag • ₦60,000</div>
                      <div className="text-cyan-600 dark:text-cyan-400 font-medium">
                        Silk Monogram Scarf • ₦20,000
                      </div>
                    </div>
                  </div>
                </div>

                {/* Saved Postcodes Bookmark Bar */}
                <BookmarkSyncBar />

                {/* Main 12-Col Workspace: Left Steps (6 cols) & Right Spatial Map (6 cols) */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
                  <div className="space-y-6 lg:col-span-6">
                    <PiiSessionCard
                      session={session}
                      onSessionCreated={(sess) => setSession(sess)}
                    />

                    <PostcodeLookup
                      onResolved={(res) => {
                        setLookupResult(res);
                        refreshSpatialNeighbors(res.data.lat, res.data.lng);
                      }}
                    />

                    <OrderCheckout
                      resolvedPostcode={activePlace}
                      onOrderCreated={(order, riders) => {
                        setLastOrder(order);
                        setCheckoutRiders(riders);
                      }}
                    />
                  </div>

                  {/* Right Column: Spatial Vector Map & Civic Proximity */}
                  <div className="space-y-4 lg:col-span-6">
                    <PostcodeMap
                      lat={activePlace?.lat || 9.0765}
                      lng={activePlace?.lng || 7.4892}
                      buildingPolygon={activePlace?.building_polygon || null}
                      postcode={activePlace?.postcode || "FC-02-A09-DB-09"}
                      addressLabel={`${activePlace?.street || "Adetokunbo Ademola Crescent"}, ${activePlace?.district || "Wuse II"}, ${activePlace?.state || "Abuja"}`}
                      title={`${activePlace?.state || "FCT Abuja"} • ${activePlace?.district || "Wuse II"} (${activePlace?.postcode || "FC-02-A09-DB-09"})`}
                      riders={checkoutRiders}
                      emergencies={checkoutEmergencies}
                      resolvedSource={lookupResult?.source}
                    />

                    {/* Dispatch & Emergency Civic Center Cards */}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {/* Nearest PostGIS Dispatch Riders */}
                      <div className="space-y-2.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] p-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                          <div className="flex items-center gap-2">
                            <Truck className="h-4 w-4 text-cyan-500 dark:text-cyan-400" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                              Nearest Dispatch Riders
                            </h3>
                          </div>
                          <span className="font-mono text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold">
                            PostGIS KNN
                          </span>
                        </div>

                        <div className="space-y-2">
                          {checkoutRiders.slice(0, 3).map((r, idx) => (
                            <div
                              key={r.id}
                              className={`flex items-center justify-between rounded-xl border p-2.5 text-xs ${
                                idx === 0
                                  ? "border-cyan-500/40 bg-cyan-500/10"
                                  : "border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#111625]"
                              }`}
                            >
                              <div className="space-y-0.5">
                                <div className="font-semibold text-slate-900 dark:text-white">
                                  {r.name}
                                </div>
                                <div className="text-[11px] text-slate-500 dark:text-zinc-400">
                                  {r.vehicle} • {r.plate || "ABJ-BOX"}
                                </div>
                              </div>
                              <div className="text-right font-mono">
                                <div className="font-bold text-cyan-600 dark:text-cyan-400">
                                  {Math.round(r.distance_meters)}m
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                                  ~{r.eta_mins || 8} mins
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Nearby Civic Facilities */}
                      <div className="space-y-2.5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] p-4 shadow-sm">
                        <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-2">
                          <div className="flex items-center gap-2">
                            <HeartPulse className="h-4 w-4 text-rose-500 dark:text-rose-400" />
                            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-zinc-200">
                              Emergency Centers
                            </h3>
                          </div>
                          <div className="flex gap-1 font-mono text-[10px]">
                            {(["HOSPITAL", "POLICE", "FIRE"] as const).map((type) => (
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
                                className={`rounded px-1.5 py-0.5 transition ${
                                  emergencyType === type
                                    ? "bg-rose-500 text-white font-bold"
                                    : "text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-white"
                                }`}
                              >
                                {type}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {checkoutEmergencies.slice(0, 3).map((emg, idx) => (
                            <div
                              key={emg.id}
                              className={`flex items-center justify-between rounded-xl border p-2.5 text-xs ${
                                idx === 0
                                  ? "border-rose-500/40 bg-rose-500/10"
                                  : "border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-[#111625]"
                              }`}
                            >
                              <div className="space-y-0.5 pr-2">
                                <div className="truncate font-semibold text-slate-900 dark:text-white">
                                  {emg.name}
                                </div>
                                <div className="truncate text-[11px] text-slate-500 dark:text-zinc-400">
                                  {emg.trauma_level || emg.address || `Emergency: ${emg.phone || "112"}`}
                                </div>
                              </div>
                              <div className="shrink-0 text-right font-mono">
                                <div className="text-xs font-bold text-rose-600 dark:text-rose-400">
                                  {Math.round(emg.distance_meters)}m
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-zinc-400">
                                  {emg.category_or_status}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Live Order Confirmation Banner */}
                    {lastOrder && checkoutRiders.length > 0 && (
                      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4">
                        <div>
                          <span className="font-mono text-[10px] uppercase tracking-widest text-cyan-600 dark:text-cyan-400 font-semibold">
                            PostGIS Spatial Dispatch Active
                          </span>
                          <h4 className="mt-0.5 text-sm font-semibold text-slate-900 dark:text-white">
                            Assigned Rider: {checkoutRiders[0].name} ({Math.round(checkoutRiders[0].distance_meters)}m away)
                          </h4>
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
                            Order <span className="font-mono font-bold text-slate-700 dark:text-zinc-200">{lastOrder.idempotency_key}</span> has been dispatched.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setActiveTab("admin")}
                          className="rounded-xl bg-cyan-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-cyan-600"
                        >
                          Track in Admin Dashboard →
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: NO-CODE SOCIAL STOREFRONT */}
        {activeTab === "storefront" && (
          <SocialStorefront
            onOrderCreated={(order, riders) => {
              setLastOrder(order);
              setCheckoutRiders(riders);
            }}
            onOpenAdmin={() => setActiveTab("admin")}
          />
        )}

        {/* TAB 3: ADMIN DASHBOARD */}
        {activeTab === "admin" && <AdminDashboard />}

        {/* TAB 4: DISPATCH HUB */}
        {activeTab === "rider" && <RiderDashboard />}

        {/* TAB 5: PLUGINS & EXTENSIONS */}
        {activeTab === "plugins" && <PluginTemplates />}
      </main>

      {/* Minimalist Footer as per Requirement 5 */}
      <footer className="mt-12 border-t border-slate-200 dark:border-white/10 px-6 py-5 text-center transition-colors">
        <p className="text-xs font-medium text-slate-500 dark:text-zinc-400">
          Postcode360 by NovaSync Solutions
        </p>
      </footer>
    </div>
  );
}

export default App;
