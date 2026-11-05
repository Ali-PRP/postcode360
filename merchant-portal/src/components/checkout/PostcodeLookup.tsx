// src/components/checkout/PostcodeLookup.tsx
import React, { useEffect, useState } from "react";
import { Crosshair, AlertTriangle } from "lucide-react";
import { postcode360Api } from "../../services/api";
import type { LookupResponse, PostcodeData } from "../../types/postcode360";

interface PostcodeLookupProps {
  onResolved: (lookup: LookupResponse) => void;
}

export const PostcodeLookup: React.FC<PostcodeLookupProps> = ({
  onResolved,
}) => {
  const [code, setCode] = useState("FC-02-A09-DB-09");
  const [forceMock, setForceMock] = useState(true);
  const [mockRegistry, setMockRegistry] = useState<
    Record<string, PostcodeData>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLookup, setLastLookup] = useState<LookupResponse | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const mocks = await postcode360Api.getMockPostcodes();
        setMockRegistry(mocks);
      } catch {
        // Fallback handled inside api service
      }
      handleLookup("FC-02-A09-DB-09", true);
    };
    init();
  }, []);

  const handleLookup = async (targetCode: string, mockFlag = forceMock) => {
    setLoading(true);
    setError(null);
    try {
      const res = await postcode360Api.lookupPostcode({
        code: targetCode,
        force_mock: mockFlag,
      });
      setLastLookup(res);
      onResolved(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Postcode lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const place = lastLookup?.data;
  const tier3BuildingCode = place
    ? place.postcode.split("-").slice(3).join("-") || "DB-09"
    : "DB-09";

  return (
    <section className="rounded-2xl border border-white/10 bg-[#111116] p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 font-mono text-xs font-bold text-emerald-300">
            2
          </span>
          <div>
            <h2 className="text-sm font-semibold text-white">
              Smart 3-Tier Spatial Postcode Lookup
            </h2>
            <p className="font-mono text-[11px] text-zinc-400">
              POST /v1/lookup • GET /v1/mock/postcodes
            </p>
          </div>
        </div>

        <label className="flex cursor-pointer select-none items-center gap-2 text-xs text-zinc-300">
          <input
            type="checkbox"
            checked={forceMock}
            onChange={(e) => setForceMock(e.target.checked)}
            className="rounded border-white/20 bg-[#08080A] text-emerald-500 focus:ring-0"
          />
          <span className="font-mono text-[11px] text-zinc-400">
            force_mock
          </span>
        </label>
      </div>

      {/* Quick-Select Abuja Pilot Pills */}
      {Object.keys(mockRegistry).length > 0 && (
        <div className="space-y-1.5">
          <span className="block font-mono text-[11px] text-zinc-400">
            Quick-Select Pre-Loaded Abuja Pilot Postcodes:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {Object.values(mockRegistry).map((item) => {
              const isSelected = place?.postcode === item.postcode;
              return (
                <button
                  key={item.postcode}
                  type="button"
                  onClick={() => {
                    setCode(item.postcode);
                    handleLookup(item.postcode, forceMock);
                  }}
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 font-mono text-xs transition ${
                    isSelected
                      ? "border-emerald-500/50 bg-emerald-500/25 font-semibold text-emerald-300"
                      : "border-white/10 bg-[#08080A] text-zinc-300 hover:border-white/25"
                  }`}
                >
                  <span>{item.district}</span>
                  <span className="text-[10px] text-zinc-400">
                    ({item.postcode})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Search Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLookup(code, forceMock);
        }}
        className="space-y-1.5"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-300">FindAm 3-Tier Code</span>
          <span className="font-mono text-[11px] text-zinc-400">
            Format: FC-02-A09-DB-09
          </span>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="FC-02-A09-DB-09"
            className="flex-1 rounded-xl border border-white/15 bg-[#08080A] px-3.5 py-2.5 font-mono text-sm text-emerald-300 focus:border-emerald-400 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2.5 text-xs font-semibold text-zinc-950 shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            <Crosshair className="h-3.5 w-3.5" />
            <span>{loading ? "Resolving..." : "Resolve Postcode"}</span>
          </button>
        </div>
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 3-Column Tier Dissection & Enriched Parcel Card */}
      {lastLookup && place && (
        <div className="space-y-3 rounded-xl border border-white/10 bg-[#08080A] p-3.5">
          <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
            <div className="rounded-lg border border-white/5 bg-[#111116] p-2">
              <div className="text-[10px] text-zinc-500">TIER 1 (STATE)</div>
              <div className="truncate font-semibold text-emerald-300">
                {place.tier1_state || "FC (FCT Abuja)"}
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-[#111116] p-2">
              <div className="text-[10px] text-zinc-500">TIER 2 (SECTOR)</div>
              <div className="truncate font-semibold text-cyan-300">
                {place.district || "Wuse II"}
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-[#111116] p-2">
              <div className="text-[10px] text-zinc-500">TIER 3 (BUILDING)</div>
              <div className="truncate font-semibold text-violet-300">
                {tier3BuildingCode}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-bold text-emerald-300">
              {lastLookup.source}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-zinc-300">
              {lastLookup.latency_ms}ms
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-emerald-300">
              Confidence: {(place.confidence * 100).toFixed(1)}%
            </span>
            {place.building_type && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-zinc-400">
                {place.building_type}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/5 pt-2 text-xs">
            <span className="font-medium text-zinc-200">
              {place.street}, {place.district}, {place.lga}
            </span>
            <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400">
              {place.plus_code && <span>Plus: {place.plus_code}</span>}
              {place.nipost_legacy && (
                <span>• NIPOST: {place.nipost_legacy}</span>
              )}
            </div>
          </div>

          {place.building_polygon && (
            <div className="truncate font-mono text-[10px] text-zinc-500">
              building_polygon:{" "}
              {JSON.stringify(place.building_polygon).slice(0, 96)}...
            </div>
          )}
        </div>
      )}
    </section>
  );
};
