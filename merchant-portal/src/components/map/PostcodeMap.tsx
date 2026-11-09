// src/components/map/PostcodeMap.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  Compass,
  Crosshair,
  Layers,
  Maximize2,
  Navigation,
  Satellite,
  ShieldAlert,
} from "lucide-react";
import type { NearestItem } from "../../types/postcode360";

export interface PostcodeMapProps {
  lat?: number;
  lng?: number;
  centerLat?: number;
  centerLng?: number;
  postcode?: string;
  postcodeLabel?: string;
  addressLabel?: string;
  source?: string;
  resolutionSource?: string;
  resolvedSource?: string;
  latencyMs?: number | null;
  confidence?: number;
  buildingPolygon?: number[][] | null;
  riders?: NearestItem[];
  emergencies?: NearestItem[];
  selectedRiderId?: string | null;
  heightClass?: string;
  title?: string;
  theme?: "light" | "dark";
}

const ABUJA_DEFAULT = { lat: 9.0765, lng: 7.4892 };

/**
 * Distinct architectural building footprints (as [dLng, dLat] offsets from center)
 * so every Abuja postcode renders a visibly unique building geometry and vertex count.
 */
const ARCHITECTURAL_OFFSETS: Record<string, Array<[number, number]>> = {
  // Wuse II (FC-02-A09-DB-09): 6-vertex L-shaped commercial plaza
  "FC-02-A09-DB-09": [
    [-0.00024, 0.00020],
    [0.00024, 0.00020],
    [0.00024, -0.00020],
    [0.00002, -0.00020],
    [0.00002, 0.00002],
    [-0.00024, 0.00002],
  ],
  // CBD (FC-01-C01-CB-05): 8-vertex cruciform high-rise office tower podium
  "FC-01-C01-CB-05": [
    [-0.00012, 0.00026],
    [0.00012, 0.00026],
    [0.00026, 0.00010],
    [0.00026, -0.00010],
    [0.00012, -0.00026],
    [-0.00012, -0.00026],
    [-0.00026, -0.00010],
    [-0.00026, 0.00010],
  ],
  // Maitama (FC-01-M04-MA-03): 6-vertex hexagonal diplomatic villa enclave
  "FC-01-M04-MA-03": [
    [0.00000, 0.00026],
    [0.00025, 0.00012],
    [0.00020, -0.00018],
    [-0.00005, -0.00025],
    [-0.00026, -0.00010],
    [-0.00022, 0.00016],
  ],
  // Garki (FC-02-B12-GA-01): 8-vertex U-shaped gated courtyard compound
  "FC-02-B12-GA-01": [
    [-0.00026, 0.00022],
    [0.00026, 0.00022],
    [0.00026, -0.00020],
    [0.00010, -0.00020],
    [0.00010, 0.00005],
    [-0.00010, 0.00005],
    [-0.00010, -0.00020],
    [-0.00026, -0.00020],
  ],
  // Jabi (FC-03-J07-JB-11): 5-vertex pentagon lakefront terrace
  "FC-03-J07-JB-11": [
    [-0.00026, 0.00014],
    [0.00004, 0.00026],
    [0.00028, 0.00004],
    [0.00014, -0.00022],
    [-0.00020, -0.00018],
  ],
};

function buildPostcodePolygon(
  postcode: string,
  centerLng: number,
  centerLat: number,
  rawPolygon?: number[][] | null,
): number[][] {
  const cleanCode = (postcode || "FC-02-A09-DB-09").trim().toUpperCase();

  let offsets = ARCHITECTURAL_OFFSETS[cleanCode];
  if (!offsets) {
    if (cleanCode.includes("CB"))
      offsets = ARCHITECTURAL_OFFSETS["FC-01-C01-CB-05"];
    else if (cleanCode.includes("MA") || cleanCode.includes("MT"))
      offsets = ARCHITECTURAL_OFFSETS["FC-01-M04-MA-03"];
    else if (
      cleanCode.includes("GA") ||
      cleanCode.includes("GK") ||
      cleanCode.includes("KP")
    )
      offsets = ARCHITECTURAL_OFFSETS["FC-02-B12-GA-01"];
    else if (cleanCode.includes("JB"))
      offsets = ARCHITECTURAL_OFFSETS["FC-03-J07-JB-11"];
    else if (cleanCode.includes("DB"))
      offsets = ARCHITECTURAL_OFFSETS["FC-02-A09-DB-09"];
  }

  if (offsets) {
    const ring = offsets.map(([dLng, dLat]) => [
      +(centerLng + dLng).toFixed(6),
      +(centerLat + dLat).toFixed(6),
    ]);
    ring.push([ring[0][0], ring[0][1]]);
    return ring;
  }

  if (rawPolygon && rawPolygon.length >= 4) {
    const pts = rawPolygon.slice(0, -1);
    const avgLng = pts.reduce((acc, p) => acc + p[0], 0) / pts.length;
    const avgLat = pts.reduce((acc, p) => acc + p[1], 0) / pts.length;
    const ring = pts.map(([pLng, pLat]) => [
      +(centerLng + (pLng - avgLng)).toFixed(6),
      +(centerLat + (pLat - avgLat)).toFixed(6),
    ]);
    ring.push([ring[0][0], ring[0][1]]);
    return ring;
  }

  const seed = cleanCode
    .split("")
    .reduce((acc, ch, i) => acc + ch.charCodeAt(0) * (i + 1), 0);
  const numVertices = 5 + (seed % 4);
  const ring: number[][] = [];
  for (let i = 0; i < numVertices; i++) {
    const angle = (i / numVertices) * Math.PI * 2;
    const radiusLng = 0.00018 + ((seed + i * 37) % 10) * 0.000015;
    const radiusLat = 0.00016 + ((seed + i * 53) % 10) * 0.000015;
    ring.push([
      +(centerLng + Math.cos(angle) * radiusLng).toFixed(6),
      +(centerLat + Math.sin(angle) * radiusLat).toFixed(6),
    ]);
  }
  ring.push([ring[0][0], ring[0][1]]);
  return ring;
}

export const PostcodeMap: React.FC<PostcodeMapProps> = ({
  lat,
  lng,
  centerLat,
  centerLng,
  postcode,
  postcodeLabel,
  addressLabel,
  source,
  resolutionSource,
  resolvedSource: explicitSource,
  buildingPolygon,
  riders = [],
  emergencies = [],
  selectedRiderId = null,
  heightClass = "h-[440px]",
  title,
  theme = "dark",
}) => {
  const resolvedLat = centerLat ?? lat ?? ABUJA_DEFAULT.lat;
  const resolvedLng = centerLng ?? lng ?? ABUJA_DEFAULT.lng;
  const resolvedPostcode = postcodeLabel ?? postcode ?? "FC-02-A09-DB-09";
  const resolvedSource = explicitSource ?? resolutionSource ?? source ?? "POSTGIS_GIST_KNN";
  void resolvedSource;

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [mapStyleType, setMapStyleType] = useState<"satellite" | "streets">(
    "satellite",
  );
  const [viewMode, setViewMode] = useState<"route" | "rooftop">("rooftop");
  const [cameraTick, setCameraTick] = useState<number>(0);
  const [hoveredVertex, setHoveredVertex] = useState<{
    label: string;
    lng: number;
    lat: number;
  } | null>(null);

  const activePolygonRing = useMemo(
    () =>
      buildPostcodePolygon(
        resolvedPostcode,
        resolvedLng,
        resolvedLat,
        buildingPolygon,
      ),
    [resolvedPostcode, resolvedLng, resolvedLat, buildingPolygon],
  );

  const uniqueVertices = useMemo(
    () => activePolygonRing.slice(0, -1),
    [activePolygonRing],
  );

  const primaryRider = useMemo(
    () =>
      riders.find((r) => r.id === selectedRiderId) ||
      (riders.length > 0 ? riders[0] : null),
    [riders, selectedRiderId],
  );

  const primaryEmergency = emergencies.length > 0 ? emergencies[0] : null;

  const handleFocusRooftop = useCallback(() => {
    setViewMode("rooftop");
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [resolvedLng, resolvedLat],
      zoom: 18.2,
      pitch: 0,
      bearing: 0,
      duration: 800,
    });
  }, [resolvedLng, resolvedLat]);

  const handleFitRiderRoute = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    setViewMode("route");
    if (!primaryRider) {
      map.flyTo({
        center: [resolvedLng, resolvedLat],
        zoom: 18.2,
        pitch: 0,
        bearing: 0,
        duration: 800,
      });
      return;
    }
    const bounds = new maplibregl.LngLatBounds();
    bounds.extend([resolvedLng, resolvedLat]);
    bounds.extend([primaryRider.lng, primaryRider.lat]);
    activePolygonRing.forEach((pt) => bounds.extend([pt[0], pt[1]]));
    map.fitBounds(bounds, {
      padding: { top: 70, bottom: 70, left: 70, right: 70 },
      maxZoom: 17.2,
      pitch: 0,
      duration: 850,
    });
  }, [primaryRider, resolvedLng, resolvedLat, activePolygonRing]);

  // 1. Initialize MapLibre GL with Esri World Imagery Satellite & OSM Streets
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: {
        version: 8,
        sources: {
          "esri-satellite": {
            type: "raster",
            tiles: [
              "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution:
              "Tiles © Esri — Esri, Maxar, Earthstar Geographics",
          },
          "osm-raster": {
            type: "raster",
            tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
            tileSize: 256,
            maxzoom: 19,
            attribution: "© OpenStreetMap contributors",
          },
        },
        layers: [
          {
            id: "esri-satellite-layer",
            type: "raster",
            source: "esri-satellite",
            minzoom: 0,
            maxzoom: 19,
            layout: { visibility: "visible" },
            paint: {
              "raster-contrast": 0.12,
              "raster-brightness-max": 0.92,
            },
          },
          {
            id: "osm-raster-layer",
            type: "raster",
            source: "osm-raster",
            minzoom: 0,
            maxzoom: 19,
            layout: { visibility: "none" },
            paint: {
              "raster-brightness-max": 0.82,
              "raster-contrast": 0.18,
              "raster-saturation": -0.35,
            },
          },
        ],
      },
      center: [resolvedLng, resolvedLat],
      zoom: 18.2,
      pitch: 0,
      bearing: 0,
    });

    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true }),
      "top-right",
    );

    const syncCameraOverlay = () => {
      setCameraTick((t) => t + 1);
    };

    map.on("load", syncCameraOverlay);
    map.on("move", syncCameraOverlay);
    map.on("zoom", syncCameraOverlay);
    map.on("pitch", syncCameraOverlay);
    map.on("rotate", syncCameraOverlay);
    map.on("resize", syncCameraOverlay);

    mapRef.current = map;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // 2. Toggle Satellite vs Street Map layer visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const applyVisibility = () => {
      if (
        map.getLayer("esri-satellite-layer") &&
        map.getLayer("osm-raster-layer")
      ) {
        map.setLayoutProperty(
          "esri-satellite-layer",
          "visibility",
          mapStyleType === "satellite" ? "visible" : "none",
        );
        map.setLayoutProperty(
          "osm-raster-layer",
          "visibility",
          mapStyleType === "streets" ? "visible" : "none",
        );
      }
    };

    if (map.getLayer("esri-satellite-layer")) {
      applyVisibility();
    } else {
      map.once("load", applyVisibility);
    }
  }, [mapStyleType]);

  // 3. Automatically frame both the Building Polygon AND Nearest Rider so the connection line is immediately visible
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (viewMode === "route" && primaryRider) {
      const bounds = new maplibregl.LngLatBounds();
      bounds.extend([resolvedLng, resolvedLat]);
      bounds.extend([primaryRider.lng, primaryRider.lat]);
      activePolygonRing.forEach((pt) => bounds.extend([pt[0], pt[1]]));
      map.fitBounds(bounds, {
        padding: { top: 70, bottom: 70, left: 70, right: 70 },
        maxZoom: 17.2,
        pitch: 0,
        duration: 850,
      });
    } else {
      map.flyTo({
        center: [resolvedLng, resolvedLat],
        zoom: 18.2,
        pitch: 0,
        duration: 800,
      });
    }
  }, [
    resolvedLat,
    resolvedLng,
    resolvedPostcode,
    primaryRider?.id,
    primaryRider?.lat,
    primaryRider?.lng,
  ]);

  // 4. Sync HTML Markers for Rider & Emergency Pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Primary Building Centroid Badge
    const primaryEl = document.createElement("div");
    primaryEl.className =
      "px-2.5 py-0.5 rounded-full border-2 border-white bg-emerald-500 text-[10px] font-mono font-bold text-zinc-950 shadow-[0_0_16px_rgba(16,185,129,0.9)] whitespace-nowrap";
    primaryEl.textContent = resolvedPostcode;

    const primaryPopup = new maplibregl.Popup({ offset: 18 }).setHTML(
      `<div style="color:#09090b;font-family:monospace;font-size:11px;padding:2px 4px;">
        <strong>${resolvedPostcode} (${uniqueVertices.length} Vertices)</strong><br/>
        <span>${addressLabel || `${resolvedLat.toFixed(4)}, ${resolvedLng.toFixed(4)}`}</span>
      </div>`,
    );

    markersRef.current.push(
      new maplibregl.Marker({ element: primaryEl })
        .setLngLat([resolvedLng, resolvedLat])
        .setPopup(primaryPopup)
        .addTo(map),
    );

    // Rider GPS Markers
    riders.forEach((rider, idx) => {
      const el = document.createElement("div");
      el.className =
        idx === 0
          ? "px-2.5 py-1 rounded-full border-2 border-white bg-cyan-400 text-[10px] font-mono font-bold text-zinc-950 shadow-[0_0_16px_rgba(6,182,212,0.95)] whitespace-nowrap"
          : "px-2 py-0.5 rounded-full border border-white bg-cyan-500/90 text-[10px] font-mono font-semibold text-zinc-950 shadow-md whitespace-nowrap";
      el.textContent = `🛵 ${rider.name.split(" ")[0]} (${Math.round(rider.distance_meters)}m)`;

      const popup = new maplibregl.Popup({ offset: 14 }).setHTML(
        `<div style="color:#09090b;font-family:monospace;font-size:11px;padding:2px 4px;">
          <strong>${rider.name}</strong><br/>
          <span>${Math.round(rider.distance_meters)}m away • ${rider.category_or_status}</span>
        </div>`,
      );

      markersRef.current.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([rider.lng, rider.lat])
          .setPopup(popup)
          .addTo(map),
      );
    });

    // Emergency Facility Markers (Pin on map without connecting line)
    emergencies.forEach((emg) => {
      const el = document.createElement("div");
      el.className =
        "px-2.5 py-1 rounded-full border border-white/80 bg-rose-600/90 text-[10px] font-mono font-bold text-white shadow-lg backdrop-blur-sm whitespace-nowrap flex items-center gap-1.5 cursor-pointer transform hover:scale-105 transition";
      const icon = emg.category_or_status?.includes("POLICE")
        ? "🚓"
        : emg.category_or_status?.includes("FIRE")
          ? "🚒"
          : "🏥";
      el.textContent = `${icon} ${emg.name || emg.category_or_status} (${Math.round(emg.distance_meters)}m)`;

      markersRef.current.push(
        new maplibregl.Marker({ element: el })
          .setLngLat([emg.lng, emg.lat])
          .addTo(map),
      );
    });
  }, [
    resolvedLat,
    resolvedLng,
    resolvedPostcode,
    addressLabel,
    uniqueVertices.length,
    riders,
    emergencies,
  ]);

  // 5. Compute Exact Screen-Space Coordinates via map.project([lng, lat])
  const screenVectors = useMemo(() => {
    const map = mapRef.current;
    const container = mapContainerRef.current;
    const w = container?.clientWidth || 720;
    const h = container?.clientHeight || 440;

    if (!map) {
      // Initial pre-mount fallback centered in viewport
      const cx = w / 2;
      const cy = h / 2;
      const pts = uniqueVertices.map(([vLng, vLat], i) => {
        const dx = (vLng - resolvedLng) * 220000;
        const dy = (resolvedLat - vLat) * 220000;
        return {
          x: cx + dx,
          y: cy + dy,
          lng: vLng,
          lat: vLat,
          label: `V${i + 1}`,
        };
      });
      return {
        center: { x: cx, y: cy },
        vertices: pts,
        polygonPointsAttr: pts
          .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
          .join(" "),
        riderPt: null as { x: number; y: number } | null,
        emergencyPt: null as { x: number; y: number } | null,
      };
    }

    const centerPx = map.project([resolvedLng, resolvedLat]);
    const rawVertexPxs = uniqueVertices.map(([vLng, vLat]) =>
      map.project([vLng, vLat]),
    );

    // Calculate average pixel radius of the polygon at the current zoom level
    const avgRadiusPx =
      rawVertexPxs.reduce(
        (sum, pt) => sum + Math.hypot(pt.x - centerPx.x, pt.y - centerPx.y),
        0,
      ) / (rawVertexPxs.length || 1);

    // Enforce a minimum 48px visual radius when zoomed out (e.g. viewing a 2km rider route)
    // so the polygon lines and V1..Vn vertices never collapse into a tiny dot!
    const minRadiusPx = 48;
    const scaleFactor =
      avgRadiusPx > 0.0001 && avgRadiusPx < minRadiusPx
        ? minRadiusPx / avgRadiusPx
        : 1;

    const vertices = rawVertexPxs.map((pt, i) => ({
      x: centerPx.x + (pt.x - centerPx.x) * scaleFactor,
      y: centerPx.y + (pt.y - centerPx.y) * scaleFactor,
      lng: uniqueVertices[i][0],
      lat: uniqueVertices[i][1],
      label: `V${i + 1}`,
    }));

    const polygonPointsAttr = vertices
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(" ");

    const riderPt = primaryRider
      ? map.project([primaryRider.lng, primaryRider.lat])
      : null;

    const emergencyPt = primaryEmergency
      ? map.project([primaryEmergency.lng, primaryEmergency.lat])
      : null;

    return {
      center: { x: centerPx.x, y: centerPx.y },
      vertices,
      polygonPointsAttr,
      riderPt: riderPt ? { x: riderPt.x, y: riderPt.y } : null,
      emergencyPt: emergencyPt ? { x: emergencyPt.x, y: emergencyPt.y } : null,
    };
  }, [
    cameraTick,
    resolvedLng,
    resolvedLat,
    uniqueVertices,
    primaryRider,
    primaryEmergency,
  ]);

  const isLight = theme === "light";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border shadow-xl ${
        isLight
          ? "border-slate-200 bg-white shadow-[0_20px_50px_-20px_rgba(15,23,42,0.12)] text-slate-800"
          : "border-zinc-800 bg-zinc-950 text-white"
      }`}
    >
      {/* Top Telemetry & View Controls Bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b px-3.5 py-2 text-xs ${
          isLight
            ? "border-slate-200 bg-slate-50/95"
            : "border-zinc-800/80 bg-[#111116]/95"
        }`}
      >
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold ${
              isLight
                ? "border-emerald-500/30 bg-emerald-50 text-emerald-700"
                : "border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
            }`}
          >
            <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
            PostGIS EPSG:4326
          </span>
          <span
            className={`truncate font-mono text-xs font-bold ${
              isLight ? "text-slate-900" : "text-white"
            }`}
          >
            {title || resolvedPostcode}
          </span>
          <span
            className={`rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold ${
              isLight
                ? "border-emerald-500/30 bg-emerald-50 text-emerald-700"
                : "border-emerald-500/30 bg-emerald-500/20 text-emerald-300"
            }`}
          >
            {uniqueVertices.length} Vertices
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
          {primaryRider && (
            <button
              type="button"
              onClick={
                viewMode === "rooftop" ? handleFitRiderRoute : handleFocusRooftop
              }
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 font-mono text-[10px] font-semibold transition ${
                viewMode === "route"
                  ? isLight
                    ? "border-cyan-600 bg-cyan-600 text-white"
                    : "border-cyan-400 bg-cyan-400 text-zinc-950"
                  : isLight
                    ? "border-cyan-500/40 bg-cyan-50 text-cyan-700 hover:bg-cyan-100"
                    : "border-cyan-500/40 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25"
              }`}
              title="Toggle between full Rider-to-Building route and Rooftop Polygon zoom"
            >
              <Maximize2 className="h-3 w-3" />
              <span>
                {viewMode === "rooftop" ? "Show Partner Route" : "Rooftop View"}
              </span>
            </button>
          )}

          <div
            className={`flex items-center rounded-lg border p-0.5 ${
              isLight
                ? "border-slate-300 bg-slate-100"
                : "border-zinc-700 bg-[#08080A]"
            }`}
          >
            <button
              type="button"
              onClick={() => setMapStyleType("satellite")}
              className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                mapStyleType === "satellite"
                  ? "bg-emerald-500 text-zinc-950 font-bold"
                  : isLight
                    ? "text-slate-600 hover:text-slate-900"
                    : "text-zinc-400 hover:text-white"
              }`}
            >
              <Satellite className="h-3 w-3" />
              <span>Satellite</span>
            </button>
            <button
              type="button"
              onClick={() => setMapStyleType("streets")}
              className={`rounded px-2 py-0.5 text-[10px] font-semibold transition ${
                mapStyleType === "streets"
                  ? "bg-emerald-500 text-zinc-950 font-bold"
                  : isLight
                    ? "text-slate-600 hover:text-slate-900"
                    : "text-zinc-400 hover:text-white"
              }`}
            >
              Streets
            </button>
          </div>
        </div>
      </div>

      {/* Map Canvas + Camera-Locked SVG Vector Overlay */}
      <div className="relative overflow-hidden">
        <div ref={mapContainerRef} className={`w-full ${heightClass}`} />

        {/* Synchronized SVG Layer for Building Polygon Edges (V1..Vn) & Rider/Emergency Connection Lines */}
        <svg className="pointer-events-none absolute inset-0 z-[5] h-full w-full overflow-hidden">
          <defs>
            <filter id="glow-emerald" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-cyan" x="-25%" y="-25%" width="150%" height="150%">
              <feGaussianBlur stdDeviation="3.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Emergency center pins are shown directly on the map canvas; connection line removed as per requirement */}

          {/* 2. Nearest Rider to Postcode Location Connection Line (Glowing Dashed Cyan Vector) */}
          {screenVectors.riderPt && primaryRider && (
            <g>
              {/* Outer Cyan Glow */}
              <line
                x1={screenVectors.riderPt.x}
                y1={screenVectors.riderPt.y}
                x2={screenVectors.center.x}
                y2={screenVectors.center.y}
                stroke="#06b6d4"
                strokeWidth={8}
                strokeOpacity={0.3}
                strokeLinecap="round"
              />
              {/* Crisp Dashed Cyan Core Line */}
              <line
                x1={screenVectors.riderPt.x}
                y1={screenVectors.riderPt.y}
                x2={screenVectors.center.x}
                y2={screenVectors.center.y}
                stroke="#22d3ee"
                strokeWidth={3.2}
                strokeDasharray="9 6"
                strokeLinecap="round"
                filter="url(#glow-cyan)"
              />
              {/* Pulsing Radar Ring Around Nearest Rider */}
              <circle
                cx={screenVectors.riderPt.x}
                cy={screenVectors.riderPt.y}
                r={18}
                fill="rgba(6, 182, 212, 0.18)"
                stroke="#22d3ee"
                strokeWidth={1.5}
              />
              {/* Midpoint Distance Pill on the Vector Line */}
              <g
                transform={`translate(${(screenVectors.riderPt.x + screenVectors.center.x) / 2}, ${(screenVectors.riderPt.y + screenVectors.center.y) / 2})`}
              >
                <rect
                  x={-64}
                  y={-11}
                  width={128}
                  height={22}
                  rx={6}
                  fill="#08080A"
                  fillOpacity={0.92}
                  stroke="#22d3ee"
                  strokeWidth={1.5}
                />
                <text
                  x={0}
                  y={4}
                  textAnchor="middle"
                  fill="#67e8f9"
                  fontSize={10}
                  fontWeight="bold"
                  fontFamily="monospace"
                >
                  ⇄ {primaryRider.name.split(" ")[0]} •{" "}
                  {Math.round(primaryRider.distance_meters)}m
                </text>
              </g>
            </g>
          )}

          {/* 3. Building Footprint Polygon & Vertex Connection Lines (V1 -> V2 -> ... -> Vn) */}
          {screenVectors.polygonPointsAttr && (
            <g>
              {/* Outer Polygon Halo */}
              <polygon
                points={screenVectors.polygonPointsAttr}
                fill="none"
                stroke="#10b981"
                strokeWidth={9}
                strokeOpacity={0.28}
                strokeLinejoin="round"
              />
              {/* Main Emerald Building Polygon Fill + Connecting Perimeter Lines */}
              <polygon
                points={screenVectors.polygonPointsAttr}
                fill="rgba(16, 185, 129, 0.24)"
                stroke="#10b981"
                strokeWidth={2.5}
                strokeLinejoin="round"
                filter="url(#glow-emerald)"
              />

              {/* Vertex Corner Dots (Edges kept, bulky V1..Vn labels replaced with clean dots) */}
              {screenVectors.vertices.map((v, idx) => (
                <circle
                  key={`v-dot-${idx}`}
                  cx={v.x}
                  cy={v.y}
                  r={4.5}
                  fill="#10b981"
                  stroke="#ffffff"
                  strokeWidth={1.5}
                  className="pointer-events-auto cursor-pointer transition-transform hover:scale-150"
                  onMouseEnter={() =>
                    setHoveredVertex({
                      label: `Corner ${idx + 1}`,
                      lng: v.lng,
                      lat: v.lat,
                    })
                  }
                  onMouseLeave={() => setHoveredVertex(null)}
                />
              ))}
            </g>
          )}
        </svg>

        {/* Floating Address & Active Rider Vector Card */}
        <div
          className={`pointer-events-none absolute left-3 top-3 z-10 max-w-xs space-y-1 rounded-xl border px-3 py-2 backdrop-blur-md ${
            isLight
              ? "border-slate-200/90 bg-white/95 text-slate-800 shadow-md"
              : "border-zinc-800/90 bg-zinc-950/90 text-zinc-200 shadow-xl"
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-200">
            <Compass className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span className="truncate">
              {addressLabel || "Abuja FCT Spatial Grid"}
            </span>
          </div>
          {primaryRider ? (
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-cyan-300">
              <Navigation className="h-3 w-3 shrink-0 text-cyan-400" />
              <span className="truncate">
                Connected: {primaryRider.name.split(" ")[0]} (
                {Math.round(primaryRider.distance_meters)}m dashed cyan vector)
              </span>
            </div>
          ) : (
            <p className="font-mono text-[10px] text-zinc-400">
              Hover corner nodes to inspect coordinates
            </p>
          )}
        </div>

        {/* Hovered Vertex Coordinate HUD */}
        {hoveredVertex && (
          <div
            className={`pointer-events-none absolute bottom-3 left-3 z-10 rounded-lg border px-3 py-1.5 font-mono text-[11px] shadow-lg ${
              isLight
                ? "border-emerald-500/40 bg-white/95 text-emerald-800"
                : "border-emerald-500/40 bg-[#08080A]/95 text-emerald-300"
            }`}
          >
            Corner: [{hoveredVertex.lng.toFixed(5)}, {hoveredVertex.lat.toFixed(5)}]
          </div>
        )}

        {/* Re-center on Building Footprint Button */}
        <button
          type="button"
          onClick={handleFocusRooftop}
          title="Zoom in to Building Rooftop Footprint"
          className="absolute bottom-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/20 text-emerald-300 shadow-lg backdrop-blur-md transition hover:bg-emerald-500/30"
        >
          <Crosshair className="h-4 w-4" />
        </button>
      </div>

      {/* Bottom Legend Bar */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-t px-3.5 py-2 text-[11px] ${
          isLight
            ? "border-slate-200 bg-slate-50/95 text-slate-600"
            : "border-zinc-800/80 bg-zinc-900/90 text-zinc-400"
        }`}
      >
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm border border-emerald-400 bg-emerald-500/40" />
            <span>Building Footprint ({uniqueVertices.length} vertices)</span>
          </span>
          <span className="flex items-center gap-1.5 text-cyan-300">
            <Navigation className="h-3 w-3 text-cyan-400" />
            <span>
              Rider Vector ({riders.length}
              {primaryRider
                ? ` • Closest ${Math.round(primaryRider.distance_meters)}m`
                : ""}
              )
            </span>
          </span>
          {emergencies.length > 0 && (
            <span className="flex items-center gap-1.5 text-rose-300">
              <ShieldAlert className="h-3 w-3" />
              <span>Emergency Services ({emergencies.length})</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 font-mono text-[10px] text-zinc-500">
          <Layers className="h-3 w-3" />
          <span>
            {mapStyleType === "satellite" ? "Esri Satellite" : "OSM Streets"} • [
            {resolvedLng.toFixed(4)}°E, {resolvedLat.toFixed(4)}°N]
          </span>
        </div>
      </div>
    </div>
  );
};
