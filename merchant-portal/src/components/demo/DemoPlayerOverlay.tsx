import React, { useEffect, useRef, useState, useCallback } from "react";
import gsap from "gsap";
import confetti from "canvas-confetti";
import {
  Play,
  Pause,
  RotateCcw,
  Square,
  Eye,
  EyeOff,
} from "lucide-react";

export interface DemoStage {
  id: number;
  number: string;
  shortName: string;
  layer: string;
  title: string;
  subtitle: string;
  metricBadge: string;
  durationSec: number;
  archLayerIndex: number; // 0: Shopper/Vendor, 1: Zero-PII, 2: PostGIS, 3: 3PL & Dispatch
}

export const ARCHITECTURE_LAYERS = [
  { id: 0, label: "1. Shopper / Vendor" },
  { id: 1, label: "2. Zero-PII Gateway" },
  { id: 2, label: "3. NIPOST + PostGIS Engine" },
  { id: 3, label: "4. 3PL & Emergency Dispatch" },
];

export const DEMO_STAGES: DemoStage[] = [
  {
    id: 0,
    number: "01",
    shortName: "Checkout",
    layer: "1-CLICK EMAIL BOOKMARKS & ROOFTOP RESOLUTION",
    title: "Plug-and-Play Customer Checkout (1-Click Saved Postcodes)",
    subtitle:
      "Shoppers never memorize 11-character codes. Entering their email unlocks bookmarked postcodes in 1 click and frames the exact rooftop building polygon on satellite imagery.",
    metricBadge: "GET /v1/bookmarks • GET /v1/lookup",
    durationSec: 20,
    archLayerIndex: 0,
  },
  {
    id: 1,
    number: "02",
    shortName: "Zero-PII",
    layer: "ZERO-PII HASHING & IDEMPOTENT DISPATCH",
    title: "Zero-PII HMAC-SHA256 Security & Idempotent Double-Tap Protection",
    subtitle:
      "Raw emails and NINs are never stored (raw_pii_retained: false). Strict idempotency_key locks ensure mobile network retries never double-charge merchants or duplicate orders.",
    metricBadge: "POST /v1/widget/session • POST /orders (idempotent_replay: true)",
    durationSec: 18,
    archLayerIndex: 1,
  },
  {
    id: 2,
    number: "03",
    shortName: "Storefront",
    layer: "TWO-LINK SOCIAL STOREFRONT & DIRECT DM PAYMENTS",
    title: "Social Commerce Storefront (Bio Catalog Link + Direct Payment Links)",
    subtitle:
      "Empowers Instagram, TikTok, and WhatsApp vendors without websites to share a product catalog and route buyers directly into Postcode360’s spatial checkout.",
    metricBadge: "GET /v1/social-stores • Catalog → Checkout Bridge",
    durationSec: 16,
    archLayerIndex: 0,
  },
  {
    id: 3,
    number: "04",
    shortName: "PostGIS Admin",
    layer: "LIVE ORDER LEDGER & POSTGIS GiST KNN ROUTING",
    title: "Live Order Ledger & PostGIS GiST KNN Proximity Routing",
    subtitle:
      "Matches resolved rooftop polygons to the closest available 3PL courier and emergency responder in milliseconds using PostGIS ST_DWithin and <-> KNN operators.",
    metricBadge: "GET /orders • GET /riders/nearest (<25ms)",
    durationSec: 14,
    archLayerIndex: 2,
  },
  {
    id: 4,
    number: "05",
    shortName: "Rider POD",
    layer: "3PL COURIER NAVIGATION & SUB-METER PROOF OF DELIVERY",
    title: "3PL Partner Plugin (@postcode360/enumerator-sdk) & GPS Proof of Delivery",
    subtitle:
      "Postcode360 owns zero motorcycles. External logistics fleets embed our plugin for rooftop gate navigation and polygon-verified Proof of Delivery.",
    metricBadge: "POST /v1/orders/{id}/pod • <5m Gate GPS Accuracy",
    durationSec: 16,
    archLayerIndex: 3,
  },
  {
    id: 5,
    number: "06",
    shortName: "Vertex Minting",
    layer: "CROWDSOURCED TP-CODE MINTING & 3-DELIVERY MAINTENANCE",
    title: "Crowdsourced TP-Code Minting & Self-Healing 3-Delivery Maintenance",
    subtitle:
      "Partner riders mint 90-day Temporary Postcodes (TP-ABJ-XXXX) at unmapped buildings. Every verified delivery increments trust (+1), auto-promoting the code at 3/3 deliveries to feed ground-truth data back to NIPOST.",
    metricBadge: "POST /v1/alias/mint (90d TTL) → POST /v1/verify (3/3 Auto-Promoted)",
    durationSec: 18,
    archLayerIndex: 3,
  },
  {
    id: 6,
    number: "07",
    shortName: "USSD Rescue",
    layer: "2G GSM OFFLINE USSD *347# & EMERGENCY TRIAGE",
    title: "Offline Feature-Phone Inclusion (*347# USSD) & 2G Emergency Triage",
    subtitle:
      "Citizens without smartphones or mobile data dial *347*postcode# over 2G GSM to resolve addresses or route 112 trauma responders via Termii SMS.",
    metricBadge: "POST /v1/ussd • POST /v1/emergency/sos",
    durationSec: 10,
    archLayerIndex: 3,
  },
  {
    id: 7,
    number: "08",
    shortName: "Plugins",
    layer: "5-MINUTE DROP-IN E-COMMERCE & 3PL SDKs",
    title: "5-Minute Drop-In Integration for WooCommerce, Shopify & 3PL Apps",
    subtitle:
      "Built on Nigeria’s National Postcode. Ready for immediate pilot deployment across e-commerce merchants, social sellers, and logistics fleets.",
    metricBadge: "@postcode360/checkout-js • @postcode360/enumerator-sdk",
    durationSec: 8,
    archLayerIndex: 3,
  },
];

export const DemoPlayerOverlay: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(0);
  const [isBarHidden, setIsBarHidden] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 500,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 300,
  });
  const [cursorVisible, setCursorVisible] = useState<boolean>(false);
  const [cursorLabel, setCursorLabel] = useState<string>("");
  const [isClicking, setIsClicking] = useState<boolean>(false);
  const [demoComplete, setDemoComplete] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // References
  const cursorRef = useRef<{ x: number; y: number }>({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 500,
    y: typeof window !== "undefined" ? window.innerHeight / 2 : 300,
  });
  const isPlayingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const abortRef = useRef<boolean>(false);
  const speedRef = useRef<number>(1);
  const timelineIdRef = useRef<number>(0);
  const highlightedElRef = useRef<HTMLElement | null>(null);

  isPlayingRef.current = isPlaying;
  isPausedRef.current = isPaused;
  speedRef.current = playbackSpeed;

  const currentStage = DEMO_STAGES[currentStageIdx] || DEMO_STAGES[0];

  // Helper: wait respecting pause, speed, and cancel
  const wait = useCallback(async (ms: number): Promise<void> => {
    const step = 50;
    let accumulated = 0;
    while (accumulated < ms) {
      if (abortRef.current) return;
      if (!isPausedRef.current) {
        accumulated += step * speedRef.current;
      }
      await new Promise((r) => setTimeout(r, step));
    }
  }, []);

  // Helper: smooth cursor movement via GSAP
  const moveCursor = useCallback(
    async (targetX: number, targetY: number, durationSec = 0.65): Promise<void> => {
      if (abortRef.current) return;
      const effectiveDuration = Math.max(0.15, durationSec / speedRef.current);

      return new Promise<void>((resolve) => {
        gsap.to(cursorRef.current, {
          x: targetX,
          y: targetY,
          duration: effectiveDuration,
          ease: "power2.out",
          onUpdate: () => {
            setCursorPos({ x: cursorRef.current.x, y: cursorRef.current.y });
          },
          onComplete: () => resolve(),
        });
      });
    },
    [],
  );

  // Helper: find element by data-demo, CSS selector, or visible text
  const findElement = useCallback((textOrSelector: string): HTMLElement | null => {
    // 1. Try exact [data-demo="..."]
    let el = document.querySelector(`[data-demo="${textOrSelector}"]`) as HTMLElement;
    if (el) return el;

    // 2. Try raw selector
    try {
      el = document.querySelector(textOrSelector) as HTMLElement;
      if (el) return el;
    } catch {}

    // 3. Search visible interactive buttons, inputs, links, pills by text
    const lower = textOrSelector.toLowerCase();
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>("button, a, input, [role='button'], h3, p, span"),
    );
    for (const cand of candidates) {
      if (cand.offsetParent === null) continue;
      const text = cand.textContent?.trim().toLowerCase() || "";
      if (text === lower || text.includes(lower)) {
        return cand;
      }
    }

    return null;
  }, []);

  // Helper: find, highlight, glide cursor, click, and trigger DOM action
  const findAndClick = useCallback(
    async (
      textOrSelector: string,
      label: string,
      postDelayMs = 800,
      options?: { customOffset?: { x: number; y: number } },
    ): Promise<void> => {
      if (abortRef.current) return;

      setCursorLabel(label);
      setCursorVisible(true);

      // Clean up any existing highlight
      if (highlightedElRef.current) {
        highlightedElRef.current.classList.remove("demo-target-highlight");
        highlightedElRef.current = null;
      }

      // Wait up to 1.5 seconds for element to be present in DOM
      let el: HTMLElement | null = null;
      for (let i = 0; i < 15; i++) {
        el = findElement(textOrSelector);
        if (el) break;
        await wait(100);
        if (abortRef.current) return;
      }

      if (!el) {
        console.warn(`[DemoPlayer] Element matching "${textOrSelector}" not found.`);
        return;
      }

      // Smooth scroll target into view
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {}

      await wait(300);
      if (abortRef.current) return;

      // Highlight target element with glowing emerald ring
      el.classList.add("demo-target-highlight");
      highlightedElRef.current = el;

      const rect = el.getBoundingClientRect();
      const targetX = options?.customOffset
        ? rect.left + options.customOffset.x
        : rect.left + rect.width / 2;
      const targetY = options?.customOffset
        ? rect.top + options.customOffset.y
        : rect.top + rect.height / 2;

      await moveCursor(targetX, targetY, 0.65);
      if (abortRef.current) return;

      // Click ripple effect
      setIsClicking(true);
      await wait(120);
      setIsClicking(false);

      // Trigger native click
      try {
        el.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window }),
        );
        el.dispatchEvent(
          new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window }),
        );
        el.click();
      } catch (err) {
        console.error(`Click failed on "${textOrSelector}"`, err);
      }

      // Remove highlight after brief delay
      await wait(Math.min(300, postDelayMs));
      if (highlightedElRef.current) {
        highlightedElRef.current.classList.remove("demo-target-highlight");
        highlightedElRef.current = null;
      }

      await wait(Math.max(0, postDelayMs - 300));
    },
    [wait, moveCursor, findElement],
  );

  // Clean up highlights on unmount
  useEffect(() => {
    return () => {
      if (highlightedElRef.current) {
        highlightedElRef.current.classList.remove("demo-target-highlight");
      }
    };
  }, []);

  // STAGE 1 (0:00 – 0:20): Customer Checkout: 1-Click Saved Postcodes
  const runStage1 = useCallback(async () => {
    setCurrentStageIdx(0);
    await findAndClick("tab-checkout", "Opening Spatial Checkout...", 500);
    await findAndClick("mode-customer", "Activating Crisp White Customer Checkout...", 500);
    await findAndClick("customer-sync-email", "Syncing Saved Postcodes for buyer@gmail.com...", 800);
    await findAndClick("bookmark-office", "Resolving Office (CBD) Postcode & Rooftop Polygon...", 1000);
    await findAndClick("bookmark-home", "Resolving Home (Wuse II) Postcode & Rooftop Polygon...", 1000);
    await findAndClick("customer-search-toggle", "Inspecting Preloaded Directory...", 800);
    await findAndClick("customer-search-toggle", "Closing Preloaded Directory...", 600);
    await findAndClick("customer-confirm-order", "Submitting Order & Discarding PII...", 1200);

    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#10b981", "#06b6d4", "#3b82f6", "#f59e0b"],
      });
    } catch {}

    await wait(1400);
    await findAndClick("customer-close-receipt", "Closing Order Confirmation Receipt...", 500);
  }, [findAndClick, wait]);

  // STAGE 2 (0:20 – 0:38): Developer Mode: Zero-PII Hashing & Idempotency
  const runStage2 = useCallback(async () => {
    setCurrentStageIdx(1);
    await findAndClick("mode-developer", "Switching to Developer Mode Inspector...", 600);
    await findAndClick("dev-verify-session", "Verifying HMAC-SHA256 Cryptographic Session...", 900);
    await findAndClick("dev-open-drawer", "Inspecting 5-Segment NIPOST Hierarchy...", 1000);
    await findAndClick("dev-close-drawer", "Closing Directory Drawer...", 600);
    await findAndClick("dev-create-order", "Dispatching Idempotent Spatial Order...", 1200);
    await findAndClick("dev-retry-order", "Simulating Network Double-Tap (Idempotent Replay)...", 1400);
  }, [findAndClick]);

  // STAGE 3 (0:38 – 0:54): Storefront: Two-Link Catalog for Social Sellers
  const runStage3 = useCallback(async () => {
    setCurrentStageIdx(2);
    await findAndClick("tab-storefront", "Opening Social Media Vendor Storefront...", 600);
    await findAndClick("store-share-link", "Copying Storefront Bio Link (postcode360.ng/store/luxe-abuja)...", 900);
    await findAndClick("store-product-link-0", "Copying Direct Product Link (Bone Straight Wig)...", 900);
    await findAndClick("store-payment-link-0", "Copying Direct WhatsApp Payment Link...", 900);
    await findAndClick("store-open-checkout-0", "Bridging Buyer from Social Link to Checkout...", 1200);
  }, [findAndClick]);

  // STAGE 4 (0:54 – 1:08): Admin: Live Order Ledger & PostGIS GiST KNN
  const runStage4 = useCallback(async () => {
    setCurrentStageIdx(3);
    await findAndClick("tab-admin", "Navigating to Back-Office Admin...", 600);
    await findAndClick("admin-order-row-0", "Inspecting Incoming Spatial Order...", 1000);
    await findAndClick("admin-assign-rider", "Executing PostGIS GiST KNN Rider Match...", 1200);
  }, [findAndClick]);

  // STAGE 5 (1:08 – 1:24): Dispatch Hub: 3PL Courier Navigation & POD
  const runStage5 = useCallback(async () => {
    setCurrentStageIdx(4);
    await findAndClick("tab-dispatch", "Entering 3PL Dispatch Hub & Rider Fleet...", 600);
    await findAndClick("dispatch-subtab-rider", "Activating Courier & Field Enumerator Mode...", 600);
    await findAndClick("rider-ping-gps", "Sending Live High-Precision GPS Heartbeat...", 900);
    await findAndClick("rider-complete-pod", "Capturing Gate Proof of Delivery (4.99m offset)...", 1400);
  }, [findAndClick]);

  // STAGE 6 (1:24 – 1:42): Crowdsourced TP-Code Minting & 3-Delivery Promotion
  const runStage6 = useCallback(async () => {
    setCurrentStageIdx(5);

    await findAndClick("rider-trace-vertices", "Tracing 4 Rooftop Corners (V1–V4)...", 400);

    // Smooth rooftop polygon cursor tracing across satellite canvas
    const mapSurface = document.querySelector('[data-demo="postcode-map-surface"]');
    if (mapSurface) {
      const mapRect = mapSurface.getBoundingClientRect();
      const centerX = mapRect.left + mapRect.width / 2;
      const centerY = mapRect.top + mapRect.height / 2;
      const radius = Math.min(mapRect.width, mapRect.height) * 0.2;

      setCursorLabel("Marking Rooftop Vertex V1...");
      await moveCursor(centerX - radius, centerY - radius, 0.4);
      setIsClicking(true);
      await wait(90);
      setIsClicking(false);

      setCursorLabel("Marking Rooftop Vertex V2...");
      await moveCursor(centerX + radius, centerY - radius * 0.8, 0.4);
      setIsClicking(true);
      await wait(90);
      setIsClicking(false);

      setCursorLabel("Marking Rooftop Vertex V3...");
      await moveCursor(centerX + radius * 0.9, centerY + radius, 0.4);
      setIsClicking(true);
      await wait(90);
      setIsClicking(false);

      setCursorLabel("Marking Rooftop Vertex V4...");
      await moveCursor(centerX - radius * 0.85, centerY + radius * 0.75, 0.4);
      setIsClicking(true);
      await wait(90);
      setIsClicking(false);
    }

    await findAndClick("rider-mint-tp", "Minting Temporary Postcode (TP-ABJ-XXXX)...", 1200);

    // 3 verified deliveries to promote
    await findAndClick("rider-verify-tp-0", "Logging 1st Verified Delivery (1/3)...", 900);
    await findAndClick("rider-verify-tp-0", "Logging 2nd Verified Delivery (2/3)...", 900);
    await findAndClick("rider-verify-tp-0", "Logging 3rd Verified Delivery (3/3 - Auto-Promote!)...", 1200);

    try {
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.5 },
        colors: ["#10b981", "#34d399", "#6ee7b7", "#059669"],
      });
    } catch {}

    await wait(800);
  }, [findAndClick, moveCursor, wait]);

  // STAGE 7 (1:42 – 1:52): Emergency SOS & Offline USSD *347#
  const runStage7 = useCallback(async () => {
    setCurrentStageIdx(6);
    await findAndClick("dispatch-subtab-rescue", "Opening Offline USSD & Emergency Rescue Dispatch...", 600);
    await findAndClick("rescue-trigger-sos", "Triggering 2G SMS SOS to FRSC & Police Units...", 1100);
    await findAndClick("rescue-dial-ussd", "Simulating Offline USSD *347# Session...", 1100);
    await findAndClick("rescue-resolve-incident", "Resolving Incident & Incrementing Trust Score...", 1000);
  }, [findAndClick]);

  // STAGE 8 (1:52 – 2:00): Drop-In Plugins (WooCommerce & Shopify)
  const runStage8 = useCallback(async () => {
    setCurrentStageIdx(7);
    await findAndClick("tab-plugins", "Opening Drop-In Plugins & Integrations...", 600);
    await findAndClick("plugin-tab-woo", "Inspecting WooCommerce PHP Plugin...", 800);
    await findAndClick("plugin-tab-shopify", "Inspecting Shopify Liquid Checkout Integration...", 800);
    await findAndClick("plugin-tab-enumerator", "Inspecting 3PL Courier Mobile Enumerator SDK...", 900);
    await findAndClick("tab-checkout", "Returning to Customer Checkout for Final Closing Frame...", 1000);
    await findAndClick("mode-customer", "Ready for E-Commerce Customers...", 600);
  }, [findAndClick]);

  // Master demo orchestrator
  const startDemoFromStage = useCallback(
    async (startIdx: number) => {
      abortRef.current = false;
      const currentId = Date.now();
      timelineIdRef.current = currentId;

      setIsPlaying(true);
      setIsPaused(false);
      setDemoComplete(false);
      setCursorVisible(true);

      const stageRunners = [
        runStage1,
        runStage2,
        runStage3,
        runStage4,
        runStage5,
        runStage6,
        runStage7,
        runStage8,
      ];

      for (let i = startIdx; i < stageRunners.length; i++) {
        if (abortRef.current || timelineIdRef.current !== currentId) break;
        setCurrentStageIdx(i);
        await stageRunners[i]();
        if (abortRef.current || timelineIdRef.current !== currentId) break;
      }

      if (!abortRef.current && timelineIdRef.current === currentId) {
        setDemoComplete(true);
        setIsPlaying(false);
        setCursorVisible(false);
        setCursorLabel("");

        try {
          confetti({
            particleCount: 100,
            spread: 100,
            origin: { y: 0.5 },
          });
        } catch {}
      }
    },
    [runStage1, runStage2, runStage3, runStage4, runStage5, runStage6, runStage7, runStage8],
  );

  const handleStart = () => {
    setElapsedSeconds(0);
    startDemoFromStage(0);
  };

  const handlePauseResume = () => {
    setIsPaused((prev) => !prev);
  };

  const handleStop = () => {
    abortRef.current = true;
    timelineIdRef.current = 0;
    if (highlightedElRef.current) {
      highlightedElRef.current.classList.remove("demo-target-highlight");
      highlightedElRef.current = null;
    }
    setIsPlaying(false);
    setIsPaused(false);
    setCursorVisible(false);
    setCursorLabel("");
    setElapsedSeconds(0);
  };

  const handleRestart = () => {
    handleStop();
    setTimeout(() => {
      handleStart();
    }, 150);
  };

  const handleJumpStage = (stageIdx: number) => {
    handleStop();
    setTimeout(() => {
      startDemoFromStage(stageIdx);
    }, 150);
  };

  // Keyboard shortcut listeners: Space, R, H
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (isPlaying) {
          handlePauseResume();
        } else {
          handleStart();
        }
      } else if (e.code === "KeyR") {
        e.preventDefault();
        handleRestart();
      } else if (e.code === "KeyH") {
        e.preventDefault();
        setIsBarHidden((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, isPaused]);

  // Master 120s timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isPlaying && !isPaused) {
      timer = setInterval(() => {
        setElapsedSeconds((prev) => {
          if (prev >= 120) {
            return 120;
          }
          return prev + 1;
        });
      }, 1000 / playbackSpeed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, isPaused, playbackSpeed]);

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <>
      {/* Global CSS for targeted element glowing outline */}
      <style>{`
        .demo-target-highlight {
          outline: 2px solid #10b981 !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.45) !important;
          transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1) !important;
        }
      `}</style>

      {/* Layer A — High-Visibility Virtual Cursor & Click Ripple */}
      {cursorVisible && (
        <div
          className="pointer-events-none fixed z-[9999] transition-transform duration-75"
          style={{
            left: `${cursorPos.x}px`,
            top: `${cursorPos.y}px`,
            transform: `translate(-3px, -3px) scale(${isClicking ? 0.8 : 1})`,
          }}
        >
          {/* Custom SVG Cursor with Emerald/Cyan Outer Glow */}
          <svg
            className="h-8 w-8 drop-shadow-[0_4px_14px_rgba(16,185,129,0.7)]"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M3 3L10.07 19.97L12.58 13.58L19.97 10.07L3 3Z"
              fill="#10B981"
              stroke="#FFFFFF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="4" cy="4" r="2" fill="#06B6D4" />
          </svg>

          {/* Click Ripple Expanding Ping */}
          {isClicking && (
            <div className="absolute -left-3 -top-3 h-12 w-12 animate-ping rounded-full border-2 border-emerald-400 bg-emerald-400/30 pointer-events-none" />
          )}

          {/* Action Tooltip Beside Cursor */}
          {cursorLabel && (
            <div className="absolute left-7 top-1 pointer-events-none whitespace-nowrap rounded-lg border border-emerald-500/40 bg-[#08080A]/95 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 shadow-2xl backdrop-blur-md">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {cursorLabel}
            </div>
          )}
        </div>
      )}

      {/* Layer C — Animated Architecture Flow Pill (Top-Center HUD) */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9985] hidden md:flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-[#08080A]/95 px-4 py-2 shadow-2xl backdrop-blur-xl text-xs font-semibold text-zinc-300">
        {ARCHITECTURE_LAYERS.map((layer, idx) => {
          const isActive = currentStage.archLayerIndex === idx && isPlaying;

          return (
            <React.Fragment key={layer.id}>
              <div
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition-all duration-300 ${
                  isActive
                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)] ring-1 ring-emerald-400"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    isActive ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
                  }`}
                />
                <span>{layer.label}</span>
              </div>
              {idx < ARCHITECTURE_LAYERS.length - 1 && (
                <span className="text-zinc-600 font-mono text-xs">➔</span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Layer B — Cinema Lower-Third Motion Graphic Banner */}
      {(isPlaying || demoComplete) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9990] w-[92%] max-w-4xl px-2 pointer-events-none transition-all duration-300">
          <div className="pointer-events-auto overflow-hidden rounded-2xl border border-emerald-500/35 bg-[#08080A]/92 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.75)] backdrop-blur-xl text-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-400 border border-emerald-500/30">
                  STAGE {currentStage.number} / 08
                </span>
                <span className="text-[11px] font-bold tracking-wider text-zinc-300 uppercase">
                  {currentStage.layer}
                </span>
              </div>

              <div className="flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-950/50 px-2.5 py-0.5 font-mono text-[10px] text-cyan-300">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />
                {currentStage.metricBadge}
              </div>
            </div>

            <div className="mt-2.5">
              <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-2">
                {currentStage.title}
              </h3>
              <p className="mt-1 text-xs text-zinc-300 leading-relaxed font-normal">
                {currentStage.subtitle}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 pt-2 border-t border-white/10">
              <div className="flex items-center gap-2 truncate font-mono text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span className="truncate">{cursorLabel || "Executing choreographed sequence..."}</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="font-mono text-zinc-300">
                  {formatTime(elapsedSeconds)} / 02:00
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Layer D — 120-Second Timeline Progress Bar Along Bottom Edge */}
      <div className="fixed bottom-0 left-0 right-0 h-[3px] bg-slate-900/60 z-[10000] overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 transition-all duration-150 ease-linear shadow-[0_0_8px_rgba(16,185,129,0.8)]"
          style={{ width: `${(elapsedSeconds / 120) * 100}%` }}
        />
        {/* Proportional Chapter Markers */}
        {DEMO_STAGES.map((st, idx) => {
          let accumSec = 0;
          for (let i = 0; i < idx; i++) accumSec += DEMO_STAGES[i].durationSec;
          const leftPercent = (accumSec / 120) * 100;

          return (
            <div
              key={st.id}
              title={`Jump to Stage ${st.number}: ${st.shortName}`}
              onClick={() => handleJumpStage(idx)}
              className="absolute top-0 bottom-0 w-[2px] bg-white/20 hover:bg-emerald-400 cursor-pointer pointer-events-auto transition-colors"
              style={{ left: `${leftPercent}%` }}
            />
          );
        })}
      </div>

      {/* Discrete Trigger & Floating Controller (Bottom-Left) */}
      <div className="fixed bottom-6 left-6 z-[9995]">
        {isBarHidden ? (
          <button
            type="button"
            onClick={() => setIsBarHidden(false)}
            className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-[#08080A]/95 px-3 py-1.5 text-xs font-semibold text-emerald-400 shadow-xl backdrop-blur-md transition hover:bg-slate-900"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Show Demo Controls [H]</span>
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#08080A]/95 p-3 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2">
              {!isPlaying ? (
                <button
                  type="button"
                  onClick={handleStart}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:from-emerald-500 hover:to-teal-500"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>🎬 2-Min Auto Demo</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handlePauseResume}
                    className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 px-3 py-2 text-xs font-bold text-slate-800 dark:text-white transition hover:bg-slate-200 dark:hover:bg-white/15"
                  >
                    {isPaused ? <Play className="h-3.5 w-3.5 fill-current" /> : <Pause className="h-3.5 w-3.5" />}
                    <span>{isPaused ? "Resume" : "Pause"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStop}
                    title="Stop Demo"
                    className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 p-2 text-xs font-bold text-slate-800 dark:text-white transition hover:bg-rose-500 hover:text-white"
                  >
                    <Square className="h-3.5 w-3.5 fill-current" />
                  </button>

                  <button
                    type="button"
                    onClick={handleRestart}
                    title="Restart Demo"
                    className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 p-2 text-xs font-bold text-slate-800 dark:text-white transition hover:bg-slate-200 dark:hover:bg-white/15"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </>
              )}

              {/* Playback Speed Controller */}
              <div className="flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 p-0.5 text-[11px] font-semibold">
                {[1, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`rounded-lg px-2 py-1 transition ${
                      playbackSpeed === spd
                        ? "bg-emerald-500 text-white shadow-sm"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>

              {/* Hide Controls Button */}
              <button
                type="button"
                onClick={() => setIsBarHidden(true)}
                title="Hide controls for screen recording (Press H to restore)"
                className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 p-2 text-slate-600 dark:text-zinc-400 transition hover:bg-slate-200 dark:hover:bg-white/15 hover:text-slate-900 dark:hover:text-white"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-zinc-400 px-1 pt-1 border-t border-slate-200 dark:border-white/10">
              <span>Shortcuts: Space (Play/Pause) • R (Restart) • H (Hide)</span>
              <span className="font-mono">{formatTime(elapsedSeconds)} / 02:00</span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DemoPlayerOverlay;
