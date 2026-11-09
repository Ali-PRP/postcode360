// src/components/checkout/PostcodeLookup.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Database,
  Layers,
  MapPin,
  Search,
} from "lucide-react";
import {
  postcode360Api,
  normalizeCanonicalPostcode,
  type AutocompleteSuggestion,
} from "../../services/api";
import type { LookupResponse, PostcodeData } from "../../types/postcode360";

interface PostcodeLookupProps {
  onResolved: (lookup: LookupResponse) => void;
}

interface PreloadedPostcodeItem {
  postcode: string;
  state: string;
  district: string;
  street: string;
  category: "ABUJA_PILOT" | "NATIONWIDE_LIVE" | "TEST_SANDBOX";
}

const PRELOADED_POSTCODES: PreloadedPostcodeItem[] = [
  // Abuja Pilot Mock Postcodes
  {
    postcode: "FC-02-A09-DB-09",
    state: "FCT Abuja",
    district: "Wuse II",
    street: "42 Adetokunbo Ademola Crescent",
    category: "ABUJA_PILOT",
  },
  {
    postcode: "FC-02-B12-GA-01",
    state: "FCT Abuja",
    district: "Garki Area 11",
    street: "18 Tafawa Balewa Way / Ahmadu Bello Way",
    category: "ABUJA_PILOT",
  },
  {
    postcode: "FC-01-M04-MA-03",
    state: "FCT Abuja",
    district: "Maitama",
    street: "9 Yedseram / Aguiyi Ironsi Street",
    category: "ABUJA_PILOT",
  },
  {
    postcode: "FC-01-C01-CB-05",
    state: "FCT Abuja",
    district: "Central Business District",
    street: "Plot 1141 Shehu Shagari Way",
    category: "ABUJA_PILOT",
  },
  {
    postcode: "FC-03-J07-JB-11",
    state: "FCT Abuja",
    district: "Jabi",
    street: "25 Bala Sokoto Way, Jabi Lakefront",
    category: "ABUJA_PILOT",
  },
  // Official NIPOST Live Sample Postcodes (docs.postcode.gov.ng/concepts/lookup-levels)
  {
    postcode: "EK-01-A03-FK-01",
    state: "Ekiti",
    district: "Ado Ekiti",
    street: "NTA Road, Back of Fabian Hotel, Ado Ekiti",
    category: "NATIONWIDE_LIVE",
  },
  {
    postcode: "LA-11-W06-TC-10",
    state: "Lagos",
    district: "Eti-Osa / Victoria Island",
    street: "10 TC Close, W06 District, Lagos",
    category: "NATIONWIDE_LIVE",
  },
  {
    postcode: "LA-11-U34-ZR-63",
    state: "Lagos",
    district: "Ikeja / Mainland",
    street: "63 ZR Avenue, U34 District, Lagos",
    category: "NATIONWIDE_LIVE",
  },
  {
    postcode: "FC-03-B06-AG-12",
    state: "FCT Abuja",
    district: "B06 District",
    street: "Plot 12 AG Crescent, Abuja",
    category: "NATIONWIDE_LIVE",
  },
  {
    postcode: "FC-02-B19-RT-30",
    state: "FCT Abuja",
    district: "B19 District",
    street: "Plot 30 RT Way, Abuja",
    category: "NATIONWIDE_LIVE",
  },
  {
    postcode: "KN-31-F82-WJ-80",
    state: "Kano",
    district: "Nassarawa / Kano Municipal",
    street: "80 WJ Road, F82 District, Kano",
    category: "NATIONWIDE_LIVE",
  },
  {
    postcode: "EN-05-V19-CD-22",
    state: "Enugu",
    district: "Independence Layout",
    street: "22 CD Close, V19 District, Enugu",
    category: "NATIONWIDE_LIVE",
  },
  {
    postcode: "AK-11-I61-ZF-12",
    state: "Akwa Ibom",
    district: "Uyo (I61)",
    street: "Plot 12 ZF Area, Uyo",
    category: "NATIONWIDE_LIVE",
  },
  {
    postcode: "OG-14-T18-BN-16",
    state: "Ogun",
    district: "Abeokuta South",
    street: "16 BN Avenue, T18 District, Abeokuta",
    category: "NATIONWIDE_LIVE",
  },
  {
    postcode: "BA-02-M67-BL-69",
    state: "Bauchi",
    district: "Bauchi Municipal",
    street: "69 BL Crescent, M67 District, Bauchi",
    category: "NATIONWIDE_LIVE",
  },
  {
    postcode: "NI-09-J67-QC-65",
    state: "Niger",
    district: "Chanchaga / Minna",
    street: "65 QC Road, J67 District, Minna",
    category: "NATIONWIDE_LIVE",
  },
  // Official NIPOST Test Key Sandbox Postcodes (docs.postcode.gov.ng/authentication)
  {
    postcode: "FC-01-A01-KP-27",
    state: "FCT Abuja",
    district: "Central Area (Sandbox)",
    street: "Public Building KP-27, FCT",
    category: "TEST_SANDBOX",
  },
  {
    postcode: "FC-01-A01-LR-01",
    state: "FCT Abuja",
    district: "Central Area (Sandbox)",
    street: "Public Building LR-01, FCT",
    category: "TEST_SANDBOX",
  },
  {
    postcode: "FC-01-A01-MH-01",
    state: "FCT Abuja",
    district: "Central Area (Sandbox)",
    street: "Public Building MH-01, FCT",
    category: "TEST_SANDBOX",
  },
  {
    postcode: "FC-01-A01-MV-01",
    state: "FCT Abuja",
    district: "Central Area (Sandbox)",
    street: "Public Building MV-01, FCT",
    category: "TEST_SANDBOX",
  },
  {
    postcode: "FC-01-A01-MW-01",
    state: "FCT Abuja",
    district: "Central Area (Sandbox)",
    street: "Public Building MW-01, FCT",
    category: "TEST_SANDBOX",
  },
];

export const PostcodeLookup: React.FC<PostcodeLookupProps> = ({
  onResolved,
}) => {
  const [code, setCode] = useState("FC-02-A09-DB-09");
  const [forceMock, setForceMock] = useState(false);
  const [mockRegistry, setMockRegistry] = useState<
    Record<string, PostcodeData>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastLookup, setLastLookup] = useState<LookupResponse | null>(null);

  // Live Autocomplete suggestions (GET /v1/search/autocomplete)
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Slide-over Drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerFilter, setDrawerFilter] = useState<
    "ALL" | "ABUJA_PILOT" | "NATIONWIDE_LIVE" | "TEST_SANDBOX"
  >("ALL");
  const [drawerSearch, setDrawerSearch] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        const mocks = await postcode360Api.getMockPostcodes();
        setMockRegistry(mocks);
      } catch {
        // Fallback handled in api service
      }
      handleLookup("FC-02-A09-DB-09", false);
    };
    init();
  }, []);

  // Close drawer on Escape
  useEffect(() => {
    if (!isDrawerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isDrawerOpen]);

  const handleInputChange = async (rawVal: string) => {
    const upper = rawVal.toUpperCase();
    setCode(upper);
    if (upper.trim().length >= 2) {
      const list = await postcode360Api.autocompletePostcode(upper);
      setSuggestions(list);
      setShowSuggestions(list.length > 0);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  const handleLookup = async (targetCode: string, mockFlag = forceMock) => {
    if (!targetCode.trim()) return;
    setShowSuggestions(false);
    setLoading(true);
    setError(null);
    try {
      const normalized = normalizeCanonicalPostcode(targetCode);
      const res = await postcode360Api.lookupPostcode({
        code: normalized,
        force_mock: mockFlag,
      });
      setCode(res.data.postcode);
      setLastLookup(res);
      onResolved(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Postcode lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const allPreloadedItems = useMemo(() => {
    const map = new Map<string, PreloadedPostcodeItem>();
    PRELOADED_POSTCODES.forEach((item) => map.set(item.postcode, item));
    Object.values(mockRegistry).forEach((m) => {
      if (!map.has(m.postcode)) {
        map.set(m.postcode, {
          postcode: m.postcode,
          state: m.state || "FCT Abuja",
          district: m.district || m.lga || "AMAC",
          street: m.street || "Verified Parcel",
          category: "ABUJA_PILOT",
        });
      }
    });
    return Array.from(map.values());
  }, [mockRegistry]);

  const filteredDrawerItems = useMemo(() => {
    const q = drawerSearch.trim().toLowerCase();
    return allPreloadedItems.filter((item) => {
      const matchesTab =
        drawerFilter === "ALL" || item.category === drawerFilter;
      const matchesQuery =
        !q ||
        item.postcode.toLowerCase().includes(q) ||
        item.state.toLowerCase().includes(q) ||
        item.district.toLowerCase().includes(q) ||
        item.street.toLowerCase().includes(q);
      return matchesTab && matchesQuery;
    });
  }, [allPreloadedItems, drawerFilter, drawerSearch]);

  const place = lastLookup?.data;
  const segments = useMemo(() => {
    const parts = (place?.postcode || "FC-02-A09-DB-09").split("-");
    return {
      state: parts[0] || "FC",
      lga: parts[1] || "02",
      district: parts[2] || "A09",
      area: parts[3] || "DB",
      unit: parts[4] || "09",
    };
  }, [place?.postcode]);

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] p-5 space-y-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 font-mono text-xs font-bold text-emerald-300">
            2
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Smart 3-Tier Spatial Postcode Lookup
            </h2>
            <p className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
              API-First (api.postcode.gov.ng) → PostGIS → Mock Fallback
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 font-mono text-[11px] font-semibold text-emerald-300 transition hover:bg-emerald-500/25"
          >
            <Layers className="h-3.5 w-3.5 text-emerald-400" />
            <span>Preloaded Postcodes</span>
            <span className="rounded-full bg-black/50 px-1.5 py-0.2 text-[10px] text-emerald-200">
              {allPreloadedItems.length}
            </span>
          </button>

          <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={forceMock}
              onChange={(e) => setForceMock(e.target.checked)}
              className="rounded border-white/20 bg-[#08080A] text-emerald-500 focus:ring-0"
            />
            <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
              force_mock
            </span>
          </label>
        </div>
      </div>

      {/* Search Input + Live Autocomplete Dropdown */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleLookup(code, forceMock);
        }}
        className="relative space-y-1.5"
      >
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-zinc-300">
            5-Segment Nigerian Postcode (Hyphenated, Spaced, or Compact)
          </span>
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            className="font-mono text-[11px] text-cyan-400 hover:underline"
          >
            Browse Preloaded Drawer →
          </button>
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={code}
            onChange={(e) => handleInputChange(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 180)}
            placeholder="EK-01-A03-FK-01, LA-11-W06-TC-10, or FC02A09DB09"
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

        {/* Live Segment-Aware Autocomplete Suggestions */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-xl border border-white/15 bg-[#0B0C10] p-1.5 shadow-2xl">
            <div className="px-2.5 py-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500">
              GET /v1/search/autocomplete Suggestions
            </div>
            {suggestions.map((sug) => (
              <button
                key={sug.postcode}
                type="button"
                onMouseDown={() => {
                  setCode(sug.postcode);
                  setShowSuggestions(false);
                  handleLookup(sug.postcode, forceMock);
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition hover:bg-emerald-500/15"
              >
                <div>
                  <span className="font-mono font-bold text-emerald-300">
                    {sug.postcode}
                  </span>
                  {sug.street && (
                    <span className="ml-2 text-zinc-300">{sug.street}</span>
                  )}
                </div>
                <span className="font-mono text-[10px] text-zinc-400">
                  {sug.district || sug.lga}, {sug.state}
                </span>
              </button>
            ))}
          </div>
        )}
      </form>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Official 5-Segment Breakdown + 3-Tier Dissection Card */}
      {lastLookup && place && (
        <div className="space-y-3 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] p-3.5">
          {/* 5-Segment Official NIPOST Structure (AA-99-H77-BB-55) */}
          <div className="grid grid-cols-5 gap-1.5 font-mono text-[10px]">
            <div className="rounded-lg border border-white/5 bg-[#111116] p-1.5 text-center">
              <div className="text-[9px] text-zinc-500">STATE</div>
              <div className="font-bold text-emerald-300">{segments.state}</div>
            </div>
            <div className="rounded-lg border border-white/5 bg-[#111116] p-1.5 text-center">
              <div className="text-[9px] text-zinc-500">LGA</div>
              <div className="font-bold text-cyan-300">{segments.lga}</div>
            </div>
            <div className="rounded-lg border border-white/5 bg-[#111116] p-1.5 text-center">
              <div className="text-[9px] text-zinc-500">DISTRICT</div>
              <div className="font-bold text-cyan-300">{segments.district}</div>
            </div>
            <div className="rounded-lg border border-white/5 bg-[#111116] p-1.5 text-center">
              <div className="text-[9px] text-zinc-500">AREA</div>
              <div className="font-bold text-violet-300">{segments.area}</div>
            </div>
            <div className="rounded-lg border border-white/5 bg-[#111116] p-1.5 text-center">
              <div className="text-[9px] text-zinc-500">UNIT</div>
              <div className="font-bold text-violet-300">{segments.unit}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 font-mono text-[11px]">
            <div className="rounded-lg border border-white/5 bg-[#111116] p-2">
              <div className="text-[10px] text-zinc-500">TIER 1 (STATE)</div>
              <div className="truncate font-semibold text-emerald-300">
                {place.tier1_state || place.state}
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-[#111116] p-2">
              <div className="text-[10px] text-zinc-500">TIER 2 (SECTOR)</div>
              <div className="truncate font-semibold text-cyan-300">
                {place.district || place.lga}
              </div>
            </div>
            <div className="rounded-lg border border-white/5 bg-[#111116] p-2">
              <div className="text-[10px] text-zinc-500">TIER 3 (BUILDING)</div>
              <div className="truncate font-semibold text-violet-300">
                {segments.area}-{segments.unit}
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
              {place.street}, {place.district}, {place.lga}, {place.state}
            </span>
            <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-400">
              <span>
                [{place.lat.toFixed(4)}°N, {place.lng.toFixed(4)}°E]
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Slide-Over Preloaded Postcodes Drawer */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm"
          onClick={() => setIsDrawerOpen(false)}
        >
          <div
            className="flex h-full w-full max-w-md flex-col border-l border-white/10 bg-[#0B0C10] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 bg-[#111116] px-5 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                  <Database className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Preloaded Postcodes Directory
                  </h3>
                  <p className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                    Click any postcode to resolve &amp; center map
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] px-2.5 py-1 font-mono text-xs text-slate-500 dark:text-zinc-400 transition hover:border-white/25 hover:text-white"
              >
                ESC ✕
              </button>
            </div>

            <div className="space-y-3 border-b border-white/10 bg-[#08080A] px-5 py-3.5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  value={drawerSearch}
                  onChange={(e) => setDrawerSearch(e.target.value)}
                  placeholder="Search state, district, street, or code..."
                  className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] py-2 pl-9 pr-3 font-mono text-xs text-white placeholder-zinc-500 focus:border-emerald-400 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap gap-1.5 font-mono text-[10px]">
                {(
                  [
                    { id: "ALL", label: "All Codes" },
                    { id: "ABUJA_PILOT", label: "Abuja Pilot" },
                    { id: "NATIONWIDE_LIVE", label: "NIPOST Live Samples" },
                    { id: "TEST_SANDBOX", label: "Test Sandbox" },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setDrawerFilter(tab.id)}
                    className={`rounded-lg border px-2.5 py-1 font-semibold transition ${
                      drawerFilter === tab.id
                        ? "border-emerald-500/50 bg-emerald-500/20 text-emerald-300"
                        : "border-white/10 bg-[#111116] text-zinc-400 hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              {filteredDrawerItems.map((item) => {
                const isSelected = place?.postcode === item.postcode;
                return (
                  <button
                    key={item.postcode}
                    type="button"
                    onClick={() => {
                      setCode(item.postcode);
                      setIsDrawerOpen(false);
                      handleLookup(item.postcode, forceMock);
                    }}
                    className={`w-full rounded-xl border p-3.5 text-left transition ${
                      isSelected
                        ? "border-emerald-500/50 bg-emerald-500/15"
                        : "border-white/10 bg-[#111116] hover:border-emerald-500/30 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-mono text-xs font-bold text-emerald-300">
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                        {item.postcode}
                      </span>

                      <div className="flex items-center gap-1.5">
                        <span
                          className={`rounded px-1.5 py-0.5 font-mono text-[9px] font-semibold ${
                            item.category === "ABUJA_PILOT"
                              ? "bg-violet-500/20 text-violet-300"
                              : item.category === "NATIONWIDE_LIVE"
                                ? "bg-cyan-500/20 text-cyan-300"
                                : "bg-amber-500/20 text-amber-300"
                          }`}
                        >
                          {item.category === "ABUJA_PILOT"
                            ? "ABUJA PILOT"
                            : item.category === "NATIONWIDE_LIVE"
                              ? "NIPOST LIVE"
                              : "SANDBOX"}
                        </span>
                        {isSelected && (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        )}
                      </div>
                    </div>

                    <div className="mt-1 text-xs font-semibold text-slate-900 dark:text-white">
                      {item.district} •{" "}
                      <span className="font-normal text-zinc-400">
                        {item.state}
                      </span>
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-zinc-400">
                      {item.street}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-white/10 bg-[#111116] px-5 py-3 font-mono text-[11px] text-slate-500 dark:text-zinc-400">
              <span>Showing {filteredDrawerItems.length} postcodes</span>
              <span className="text-emerald-400">
                {forceMock ? "Mode: Mock Override" : "Mode: API-First"}
              </span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
