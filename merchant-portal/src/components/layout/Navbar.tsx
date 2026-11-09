// src/components/layout/Navbar.tsx
import React, { useEffect, useState } from "react";
import {
  Bike,
  MapPin,
  ShoppingBag,
  LayoutDashboard,
  Code2,
  Database,
  RefreshCw,
  ShieldCheck,
  Terminal,
  Radio,
  Store,
  Sun,
  Moon,
} from "lucide-react";
import { postcode360Api } from "../../services/api";
import type {
  ApiTelemetryEntry,
  HealthResponse,
} from "../../types/postcode360";

export type ActiveTab = "checkout" | "storefront" | "admin" | "rider" | "plugins";

export interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab?: (tab: ActiveTab) => void;
  onTabChange?: (tab: ActiveTab) => void;
  orderCount?: number;
  isDarkMode?: boolean;
  onToggleDarkMode?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onTabChange,
  orderCount = 0,
  isDarkMode = true,
  onToggleDarkMode,
}) => {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  const [showLogs, setShowLogs] = useState<boolean>(false);
  const [logs, setLogs] = useState<ApiTelemetryEntry[]>(() =>
    postcode360Api.getTelemetryLogs(),
  );

  const handleSwitch = (tab: ActiveTab) => {
    if (setActiveTab) setActiveTab(tab);
    if (onTabChange) onTabChange(tab);
  };

  const fetchHealth = async () => {
    setChecking(true);
    try {
      const data = await postcode360Api.checkHealth();
      setHealth(data);
      setApiOnline(data.status === "healthy");
    } catch {
      setApiOnline(false);
      setHealth(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    fetchHealth();
    const unsubscribe = postcode360Api.subscribeTelemetry(() => {
      setLogs([...postcode360Api.getTelemetryLogs()]);
    });
    const interval = setInterval(fetchHealth, 15000);
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 dark:border-white/10 bg-white/90 dark:bg-[#090d16]/90 backdrop-blur-xl transition-colors">
      <div className="mx-auto max-w-[1440px] px-4 py-2.5 sm:px-6">
        {/* Top Row: Brand on Left, Navigation Tabs, Utilities on Right */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Brand Identity */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/25 via-cyan-500/15 to-violet-500/25 text-emerald-500 dark:text-emerald-400 shadow-sm">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Postcode<span className="text-emerald-500 dark:text-emerald-400">360</span>
                </span>
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Nigeria Spatial
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                Spatial Postcode Resolution &amp; Dispatch Platform
              </p>
            </div>
          </div>

          {/* Center/Right Navigation Tabs */}
          <nav className="ml-auto flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100/80 dark:bg-[#111625] p-1">
            <button
              type="button"
              onClick={() => handleSwitch("checkout")}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "checkout"
                  ? "bg-white dark:bg-emerald-500 font-semibold text-slate-900 dark:text-zinc-950 shadow-sm"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5" />
              <span>Checkout</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitch("storefront")}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "storefront"
                  ? "bg-white dark:bg-emerald-500 font-semibold text-slate-900 dark:text-zinc-950 shadow-sm"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Store className="h-3.5 w-3.5" />
              <span>Storefront</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitch("admin")}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "admin"
                  ? "bg-white dark:bg-emerald-500 font-semibold text-slate-900 dark:text-zinc-950 shadow-sm"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <LayoutDashboard className="h-3.5 w-3.5" />
              <span>Admin</span>
              {orderCount > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 font-mono text-[9px] font-bold ${
                    activeTab === "admin"
                      ? "bg-emerald-500/20 text-emerald-700 dark:bg-zinc-950 dark:text-emerald-400"
                      : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                  }`}
                >
                  {orderCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSwitch("rider")}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "rider"
                  ? "bg-white dark:bg-emerald-500 font-semibold text-slate-900 dark:text-zinc-950 shadow-sm"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Bike className="h-3.5 w-3.5" />
              <span>Dispatch Hub</span>
            </button>

            <button
              type="button"
              onClick={() => handleSwitch("plugins")}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "plugins"
                  ? "bg-white dark:bg-emerald-500 font-semibold text-slate-900 dark:text-zinc-950 shadow-sm"
                  : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span>Plugins</span>
            </button>
          </nav>

          {/* Theme Toggle & API status */}
          <div className="flex items-center gap-1.5">
            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10 transition"
              >
                {isDarkMode ? (
                  <Sun className="h-4 w-4 text-amber-400" />
                ) : (
                  <Moon className="h-4 w-4 text-slate-700" />
                )}
              </button>
            )}
          </div>
        </div>

        {/* Compact Telemetry Sub-Row */}
        <div className="mt-2 flex flex-wrap items-center justify-end gap-1.5 border-t border-slate-100 dark:border-white/5 pt-2">
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] px-2.5 py-1 text-[10px]">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                apiOnline
                  ? "bg-emerald-400 shadow-[0_0_6px_#34d399]"
                  : "bg-amber-400"
              }`}
            />
            <span className="font-mono text-slate-600 dark:text-zinc-300">
              {apiOnline ? "FASTAPI LIVE" : "POSTGIS HYBRID"}
            </span>

            {health && (
              <span
                className={`hidden items-center gap-1 rounded border px-1.5 py-0.2 text-[9px] font-medium sm:inline-flex ${
                  health.postgis_connected
                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300"
                    : "border-slate-200 dark:border-white/10 bg-white/5 text-slate-500 dark:text-zinc-400"
                }`}
              >
                <Database className="h-2.5 w-2.5" />
                {health.postgis_connected ? "PostGIS Live" : "Spatial Cache"}
              </span>
            )}
          </div>

          <div className="hidden items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2 py-1 text-[10px] text-emerald-600 dark:text-emerald-400 sm:flex">
            <ShieldCheck className="h-3 w-3" />
            <span>Zero-PII</span>
          </div>

          <button
            type="button"
            onClick={() => setShowLogs((prev) => !prev)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 font-mono text-[10px] transition ${
              showLogs
                ? "border-violet-500/40 bg-violet-500/20 text-violet-700 dark:text-violet-300"
                : "border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] text-slate-600 dark:text-zinc-300 hover:border-slate-300 dark:hover:border-white/20"
            }`}
          >
            <Terminal className="h-3 w-3 text-violet-500 dark:text-violet-400" />
            <span>API Logs ({logs.length})</span>
          </button>

          <button
            type="button"
            onClick={fetchHealth}
            disabled={checking}
            title="Refresh Backend Health"
            className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] p-1 text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${checking ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Collapsible Live API Contract Telemetry Drawer */}
      {showLogs && (
        <div className="max-h-64 overflow-y-auto border-t border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-[#0B0C10] px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 font-mono text-xs text-slate-600 dark:text-zinc-400">
                <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-500 dark:text-emerald-400" />
                Live Contract Telemetry (`Origin: {window.location.origin}` •
                FastAPI + PostGIS Engine)
              </span>
              <button
                type="button"
                onClick={() => postcode360Api.clearTelemetryLogs()}
                className="font-mono text-[11px] text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300"
              >
                Clear Log
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="py-3 text-center font-mono text-xs text-slate-500 dark:text-zinc-500">
                No API requests recorded yet. Trigger a lookup or order to see
                live telemetry.
              </div>
            ) : (
              <div className="space-y-1.5 font-mono text-[11px]">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-white/5 bg-white dark:bg-[#111116] px-3 py-1.5 shadow-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-slate-400 dark:text-zinc-500">{log.timestamp}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          log.method === "POST"
                            ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-300"
                            : log.method === "PATCH"
                              ? "bg-amber-500/20 text-amber-600 dark:text-amber-300"
                              : "bg-cyan-500/20 text-cyan-600 dark:text-cyan-300"
                        }`}
                      >
                        {log.method}
                      </span>
                      <span className="text-slate-800 dark:text-zinc-200 font-semibold">{log.endpoint}</span>
                      {Boolean(log.requestBody) && (
                        <span className="max-w-md truncate text-slate-500 dark:text-zinc-400">
                          req: {JSON.stringify(log.requestBody)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-violet-600 dark:text-violet-400">{log.mode}</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                        HTTP {log.status}
                      </span>
                      <span className="text-slate-500 dark:text-zinc-400">{log.latencyMs}ms</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};

export default Navbar;
