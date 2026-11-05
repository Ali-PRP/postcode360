// src/components/layout/Navbar.tsx
import React, { useEffect, useState } from "react";
import {
  MapPin,
  ShoppingBag,
  LayoutDashboard,
  Code2,
  Database,
  RefreshCw,
  ShieldCheck,
  GitBranch,
  Terminal,
  Radio,
} from "lucide-react";
import { postcode360Api } from "../../services/api";
import type {
  ApiTelemetryEntry,
  HealthResponse,
} from "../../types/postcode360";

export type ActiveTab = "checkout" | "admin" | "plugins";

export interface NavbarProps {
  activeTab: ActiveTab;
  setActiveTab?: (tab: ActiveTab) => void;
  onTabChange?: (tab: ActiveTab) => void;
  orderCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  onTabChange,
  orderCount = 0,
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
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#08080A]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6">
        {/* Brand Identity */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/40 bg-gradient-to-br from-emerald-500/25 via-cyan-500/15 to-violet-500/25 text-emerald-400 shadow-lg shadow-emerald-950/50">
            <MapPin className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base font-bold tracking-tight text-white sm:text-lg">
                FindAm <span className="font-mono text-emerald-400">//</span>{" "}
                postcode<span className="text-emerald-400">360</span>
              </span>
              <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-violet-300">
                Team A • Abuja Pilot
              </span>
              <span className="hidden items-center gap-1 rounded border border-white/10 bg-[#111116] px-2 py-0.5 font-mono text-[10px] text-zinc-400 md:inline-flex">
                <GitBranch className="h-3 w-3 text-cyan-400" />
                fea/merchant
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              3-Tier Spatial Postcode Resolution • Zero-PII HMAC • PostGIS GiST
              KNN
            </p>
          </div>
        </div>

        {/* Navigation Tabs (Tasks #5, #7, #6) */}
        <nav className="flex max-w-full items-center gap-1.5 overflow-x-auto rounded-xl border border-white/10 bg-[#111116] p-1">
          <button
            type="button"
            onClick={() => handleSwitch("checkout")}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
              activeTab === "checkout"
                ? "bg-emerald-500 font-semibold text-zinc-950 shadow-md shadow-emerald-500/20"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>Task #5: Checkout &amp; Widget</span>
          </button>

          <button
            type="button"
            onClick={() => handleSwitch("admin")}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
              activeTab === "admin"
                ? "bg-emerald-500 font-semibold text-zinc-950 shadow-md shadow-emerald-500/20"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5" />
            <span>Task #7: Back-Office Admin</span>
            {orderCount > 0 && (
              <span
                className={`ml-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-bold ${
                  activeTab === "admin"
                    ? "bg-zinc-950 text-emerald-400"
                    : "bg-emerald-500/20 text-emerald-300"
                }`}
              >
                {orderCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleSwitch("plugins")}
            className={`flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-medium transition-all ${
              activeTab === "plugins"
                ? "bg-emerald-500 font-semibold text-zinc-950 shadow-md shadow-emerald-500/20"
                : "text-zinc-400 hover:bg-white/5 hover:text-white"
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>Task #5 &amp; #6: WooCommerce + Shopify</span>
          </button>
        </nav>

        {/* Live Telemetry Badges & API Logs Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#111116] px-3 py-1.5 text-xs">
            <span
              className={`h-2 w-2 rounded-full ${
                apiOnline
                  ? "bg-emerald-400 shadow-[0_0_8px_#34d399]"
                  : "bg-amber-400"
              }`}
            />
            <span className="font-mono text-[11px] text-zinc-300">
              {apiOnline ? "FASTAPI LIVE" : "POSTGIS HYBRID"}
            </span>

            {health && (
              <span
                className={`hidden items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium sm:inline-flex ${
                  health.postgis_connected
                    ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                    : "border-white/10 bg-white/5 text-zinc-400"
                }`}
                title={health.db_error || "PostGIS Spatial Engine"}
              >
                <Database className="h-3 w-3" />
                {health.postgis_connected ? "PostGIS Live" : "Mock Cache"}
              </span>
            )}
          </div>

          <div className="hidden items-center gap-1 rounded-lg border border-emerald-500/20 bg-emerald-500/5 px-2.5 py-1.5 text-[11px] text-emerald-300 xl:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            <span>Zero-PII HMAC</span>
          </div>

          <button
            type="button"
            onClick={() => setShowLogs((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs transition ${
              showLogs
                ? "border-violet-500/40 bg-violet-500/20 text-violet-300"
                : "border-white/10 bg-[#111116] text-zinc-300 hover:border-white/20"
            }`}
          >
            <Terminal className="h-3.5 w-3.5 text-violet-400" />
            <span>API Logs ({logs.length})</span>
          </button>

          <button
            type="button"
            onClick={fetchHealth}
            disabled={checking}
            title="Refresh Backend Health"
            className="rounded-lg border border-white/10 bg-[#111116] p-2 text-zinc-400 hover:border-white/20 hover:text-zinc-200 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Collapsible Live API Contract Telemetry Drawer */}
      {showLogs && (
        <div className="max-h-64 overflow-y-auto border-t border-white/10 bg-[#0B0C10] px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 font-mono text-xs text-zinc-400">
                <Radio className="h-3.5 w-3.5 animate-pulse text-emerald-400" />
                Live Contract Telemetry (`Origin: {window.location.origin}` •
                FastAPI + PostGIS Hybrid Engine)
              </span>
              <button
                type="button"
                onClick={() => postcode360Api.clearTelemetryLogs()}
                className="font-mono text-[11px] text-zinc-500 hover:text-zinc-300"
              >
                Clear Log
              </button>
            </div>

            {logs.length === 0 ? (
              <div className="py-3 text-center font-mono text-xs text-zinc-500">
                No API requests recorded yet. Trigger a lookup or order to see
                live telemetry.
              </div>
            ) : (
              <div className="space-y-1.5 font-mono text-[11px]">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-white/5 bg-[#111116] px-3 py-1.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-zinc-500">{log.timestamp}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          log.method === "POST"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : log.method === "PATCH"
                              ? "bg-amber-500/20 text-amber-300"
                              : "bg-cyan-500/20 text-cyan-300"
                        }`}
                      >
                        {log.method}
                      </span>
                      <span className="text-zinc-200">{log.endpoint}</span>
                      {Boolean(log.requestBody) && (
                        <span className="max-w-md truncate text-zinc-500">
                          req: {JSON.stringify(log.requestBody)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-violet-400">{log.mode}</span>
                      <span className="text-emerald-400">
                        HTTP {log.status}
                      </span>
                      <span className="text-zinc-400">{log.latencyMs}ms</span>
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
