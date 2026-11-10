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
  CheckCircle2,
} from "lucide-react";

export interface DemoStage {
  id: number;
  number: string;
  shortName: string;
  layer: string;
  title: string;
  description: string;
  metricBadge: string;
  durationSec: number;
}

export const DEMO_STAGES: DemoStage[] = [
  {
    id: 0,
    number: "01",
    shortName: "Checkout",
    layer: "LAYER 1: CLIENT CHECKOUT SDK & BOOKMARKS",
    title: "Paystack for Addressing — 1-Click Saved Postcode Checkout",
    description:
      "Buyers enter their email once. Postcode360 instantly resolves bookmarked delivery addresses with sub-meter building polygons, eliminating unaddressed cart abandonments.",
    metricBadge: "GET /v1/bookmarks • 200 OK • 18ms",
    durationSec: 18,
  },
  {
    id: 1,
    number: "02",
    shortName: "Zero-PII",
    layer: "LAYER 2: ZERO-PII SESSION & NIPOST ENGINE",
    title: "Cryptographic PII Hashing & Idempotent Spatial Orders",
    description:
      "Raw phone numbers and emails are never stored. The widget creates HMAC-SHA256 tokens and resolves the official 5-segment NIPOST spatial hierarchy with idempotent network guarantees.",
    metricBadge: "POST /v1/orders • X-Idempotency-Key • 0 PII Retained",
    durationSec: 18,
  },
  {
    id: 2,
    number: "03",
    shortName: "Storefront",
    layer: "LAYER 3: SOCIAL COMMERCE LINK ENGINE",
    title: "No-Code Bio Link & Direct DM Checkout Links",
    description:
      "Social sellers receive a bio catalog link (postcode360.ng/store/{vendor}) and direct WhatsApp payment links (postcode360.ng/pay/{product}) that bridge buyers straight into Postcode360 addressing.",
    metricBadge: "GET /store/luxe-abuja • 3 Products • Direct DM Checkout",
    durationSec: 16,
  },
  {
    id: 3,
    number: "04",
    shortName: "PostGIS Admin",
    layer: "LAYER 4: POSTGIS SPATIAL DISPATCH & KNN ROUTING",
    title: "Rooftop Order Ledger & Sub-Millisecond Rider Matching",
    description:
      "Back-office operators visualize incoming orders on an interactive spatial ledger, executing sub-second PostGIS <-> GiST KNN queries to assign the optimal 3PL delivery fleet rider.",
    metricBadge: "ST_DWithin + ST_Distance_Sphere • 2.4ms • GiST Index",
    durationSec: 14,
  },
  {
    id: 4,
    number: "05",
    shortName: "Rider POD",
    layer: "LAYER 5: 3PL LOGISTICS & FIELD ENUMERATOR PLUGIN",
    title: "Turn-by-Turn Rooftop Routing & Sub-Meter Proof of Delivery",
    description:
      "Couriers receive high-precision rooftop gate coordinates. Upon arrival, the rider logs a GPS heartbeat and captures photographic Proof of Delivery verified against the building threshold.",
    metricBadge: "POST /v1/rider/pod • 0.8m Gate Offset • Verified Delivery",
    durationSec: 16,
  },
  {
    id: 5,
    number: "06",
    shortName: "Vertex Minting",
    layer: "LAYER 6: CROWDSOURCED POLYGON ENUMERATION & TP-CODE MAINTENANCE",
    title: "Interactive 4-Corner Vertex Marking & Temporary Postcode Minting",
    description:
      "When a 3PL rider arrives at an unmapped location, they mark 4 rooftop corners (V1–V4) on the satellite map, record gate GPS, and mint a 90-day Temporary Postcode (TP-ABJ-XXXX) that auto-promotes after 3 deliveries.",
    metricBadge: "POST /v1/alias/mint • ST_MakePolygon • 4 Vertices • 90d TTL",
    durationSec: 22,
  },
  {
    id: 6,
    number: "07",
    shortName: "USSD Rescue",
    layer: "LAYER 7: TELECOM RESCUE ENGINE & OFFLINE USSD",
    title: "Offline USSD *347# Resolution & Rapid 2G SOS Dispatch",
    description:
      "In low-connectivity zones, couriers and citizens dial *347# to resolve addresses offline. In emergencies, 1-click SOS broadcasts location telemetry to FRSC, Police, and Hospital units.",
    metricBadge: "USSD *347*POSTCODE# • Termii 2G SMS Gateway • 100% Offline",
    durationSec: 9,
  },
  {
    id: 7,
    number: "08",
    shortName: "Plugins",
    layer: "LAYER 8: DROP-IN E-COMMERCE & LOGISTICS SDKs",
    title: "Zero-Code WooCommerce, Shopify & 3PL Mobile Integration",
    description:
      "Postcode360 drops seamlessly into existing e-commerce stores via WordPress and Shopify plugins, and empowers 3PL courier fleets via the drop-in Enumerator SDK.",
    metricBadge: "@postcode360/checkout-js • npm i @postcode360/enumerator-sdk",
    durationSec: 7,
  },
];

export const DemoPlayerOverlay: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(0);
  const [isBarHidden, setIsBarHidden] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const [cursorVisible, setCursorVisible] = useState<boolean>(false);
  const [cursorLabel, setCursorLabel] = useState<string>("");
  const [isClicking, setIsClicking] = useState<boolean>(false);
  const [demoComplete, setDemoComplete] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // References to keep animation loops safe and cancellable
  const cursorRef = useRef<{ x: number; y: number }>({
    x: window.innerWidth / 2,
    y: window.innerHeight / 2,
  });
  const isPlayingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);
  const abortRef = useRef<boolean>(false);
  const speedRef = useRef<number>(1);
  const currentStageRef = useRef<number>(0);
  const timelineIdRef = useRef<number>(0);

  isPlayingRef.current = isPlaying;
  isPausedRef.current = isPaused;
  speedRef.current = playbackSpeed;
  currentStageRef.current = currentStageIdx;

  const currentStage = DEMO_STAGES[currentStageIdx] || DEMO_STAGES[0];

  // Helper: wait while respecting pause state, speed, and abort
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

  // Helper: move virtual cursor with GSAP tween
  const moveCursor = useCallback(
    async (targetX: number, targetY: number, durationSec = 0.6): Promise<void> => {
      if (abortRef.current) return;
      const speed = speedRef.current;
      const effectiveDuration = Math.max(0.15, durationSec / speed);

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

  // Helper: find element, scroll, glide cursor, click, and trigger DOM event
  const clickTarget = useCallback(
    async (
      selector: string,
      label: string,
      postDelayMs = 800,
      options?: { customOffset?: { x: number; y: number } },
    ): Promise<void> => {
      if (abortRef.current) return;

      setCursorLabel(label);
      setCursorVisible(true);

      // Wait up to 1.5 seconds for target to exist in DOM
      let el: HTMLElement | null = null;
      for (let i = 0; i < 15; i++) {
        el = document.querySelector(`[data-demo="${selector}"]`) as HTMLElement;
        if (el) break;
        await wait(100);
        if (abortRef.current) return;
      }

      if (!el) {
        console.warn(`[DemoPlayer] Selector [data-demo="${selector}"] not found.`);
        return;
      }

      // Smooth scroll target into view
      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {}

      await wait(300);
      if (abortRef.current) return;

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
        console.error(`Click failed on [data-demo="${selector}"]`, err);
      }

      await wait(postDelayMs);
    },
    [wait, moveCursor],
  );

  // Stage 1 Action Script
  const runStage1 = useCallback(async () => {
    setCurrentStageIdx(0);
    await clickTarget("tab-checkout", "Opening Spatial Checkout...", 500);
    await clickTarget("mode-customer", "Activating Crisp White Customer Checkout...", 500);
    await clickTarget("customer-sync-email", "Syncing Saved Postcodes for buyer@gmail.com...", 800);
    await clickTarget("bookmark-office", "Resolving Maitama Office Postcode & Rooftop Polygon...", 1000);
    await clickTarget("bookmark-home", "Resolving Wuse II Home Postcode & Rooftop Polygon...", 1000);
    await clickTarget("customer-confirm-order", "Submitting Order & Discarding PII...", 1200);

    // Subtle celebration confetti on order confirmation
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ["#10b981", "#06b6d4", "#3b82f6", "#f59e0b"],
      });
    } catch {}

    await wait(1400);
    await clickTarget("customer-close-receipt", "Closing Order Confirmation Receipt...", 500);
  }, [clickTarget, wait]);

  // Stage 2 Action Script
  const runStage2 = useCallback(async () => {
    setCurrentStageIdx(1);
    await clickTarget("mode-developer", "Switching to Developer Mode Inspector...", 600);
    await clickTarget("dev-verify-session", "Verifying HMAC-SHA256 Cryptographic Session...", 900);
    await clickTarget("dev-open-drawer", "Inspecting Preloaded 5-Segment Postcodes...", 1000);
    await clickTarget("dev-close-drawer", "Closing Directory Drawer...", 600);
    await clickTarget("dev-create-order", "Dispatching Idempotent Spatial Order...", 1200);
    await clickTarget("dev-retry-order", "Simulating Network Double-Tap (Idempotent Replay)...", 1400);
  }, [clickTarget]);

  // Stage 3 Action Script
  const runStage3 = useCallback(async () => {
    setCurrentStageIdx(2);
    await clickTarget("tab-storefront", "Opening Social Media Vendor Storefront...", 600);
    await clickTarget("store-share-link", "Copying Storefront Bio Link (postcode360.ng/store/luxe-abuja)...", 900);
    await clickTarget("store-product-link-0", "Copying Direct Product Link (Bone Straight Wig)...", 900);
    await clickTarget("store-payment-link-0", "Copying Direct WhatsApp Payment Link...", 900);
    await clickTarget("store-open-checkout-0", "Bridging Buyer from Social Link to Checkout...", 1200);
  }, [clickTarget]);

  // Stage 4 Action Script
  const runStage4 = useCallback(async () => {
    setCurrentStageIdx(3);
    await clickTarget("tab-admin", "Navigating to Back-Office Admin...", 600);
    await clickTarget("admin-order-row-0", "Inspecting Incoming Spatial Order...", 1000);
    await clickTarget("admin-assign-rider", "Executing PostGIS GiST KNN Rider Match...", 1200);
  }, [clickTarget]);

  // Stage 5 Action Script
  const runStage5 = useCallback(async () => {
    setCurrentStageIdx(4);
    await clickTarget("tab-dispatch", "Entering 3PL Dispatch Hub & Rider Fleet...", 600);
    await clickTarget("dispatch-subtab-rider", "Activating Courier & Field Enumerator Mode...", 600);
    await clickTarget("rider-ping-gps", "Sending Live High-Precision GPS Heartbeat...", 900);
    await clickTarget("rider-complete-pod", "Capturing Gate Proof of Delivery (0.8m offset)...", 1400);
  }, [clickTarget]);

  // Stage 6 Action Script (Interactive Vertex Marking & 3-Delivery Auto-Promotion)
  const runStage6 = useCallback(async () => {
    setCurrentStageIdx(5);

    // Click trace 4 rooftop corners button
    await clickTarget("rider-trace-vertices", "Tracing 4 Rooftop Corners (V1–V4)...", 400);

    // Animate virtual cursor gliding across rooftop corners on the map canvas
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

    // Mint Temporary Postcode
    await clickTarget("rider-mint-tp", "Minting Temporary Postcode (TP-ABJ-XXXX)...", 1200);

    // 3 verified deliveries to promote
    await clickTarget("rider-verify-tp-0", "Logging 1st Verified Delivery (1/3)...", 900);
    await clickTarget("rider-verify-tp-0", "Logging 2nd Verified Delivery (2/3)...", 900);
    await clickTarget("rider-verify-tp-0", "Logging 3rd Verified Delivery (3/3 - Auto-Promote!)...", 1200);

    // Celebratory confetti on TP-Code auto-promotion
    try {
      confetti({
        particleCount: 80,
        spread: 90,
        origin: { y: 0.5 },
        colors: ["#10b981", "#34d399", "#6ee7b7", "#059669"],
      });
    } catch {}

    await wait(800);
  }, [clickTarget, moveCursor, wait]);

  // Stage 7 Action Script
  const runStage7 = useCallback(async () => {
    setCurrentStageIdx(6);
    await clickTarget("dispatch-subtab-rescue", "Opening Offline USSD & Emergency Rescue Dispatch...", 600);
    await clickTarget("rescue-trigger-sos", "Triggering 2G SMS SOS to FRSC & Police Units...", 1100);
    await clickTarget("rescue-dial-ussd", "Simulating Offline USSD *347# Session...", 1100);
    await clickTarget("rescue-resolve-incident", "Resolving Incident & Incrementing Trust Score...", 1000);
  }, [clickTarget]);

  // Stage 8 Action Script
  const runStage8 = useCallback(async () => {
    setCurrentStageIdx(7);
    await clickTarget("tab-plugins", "Opening Drop-In Plugins & Integrations...", 600);
    await clickTarget("plugin-tab-woo", "Inspecting WooCommerce PHP Plugin...", 800);
    await clickTarget("plugin-tab-shopify", "Inspecting Shopify Liquid Checkout Integration...", 800);
    await clickTarget("plugin-tab-enumerator", "Inspecting 3PL Courier Mobile Enumerator SDK...", 900);
    await clickTarget("tab-checkout", "Returning to Customer Checkout for Hero Summary...", 1000);
    await clickTarget("mode-customer", "Checkout Ready for Customers...", 600);
  }, [clickTarget]);

  // Master demo runner
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
    if (isPaused) {
      setIsPaused(false);
    } else {
      setIsPaused(true);
    }
  };

  const handleStop = () => {
    abortRef.current = true;
    timelineIdRef.current = 0;
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
      // Ignore if user is typing in an input or textarea
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
      {/* 1. Glowing Animated Virtual Cursor & Click Ripple */}
      {cursorVisible && (
        <div
          className="pointer-events-none fixed z-[9999] transition-transform duration-75"
          style={{
            left: `${cursorPos.x}px`,
            top: `${cursorPos.y}px`,
            transform: `translate(-2px, -2px) scale(${isClicking ? 0.8 : 1})`,
          }}
        >
          {/* Custom SVG Cursor Arrow */}
          <svg
            className="h-7 w-7 drop-shadow-[0_4px_12px_rgba(16,185,129,0.6)]"
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
          </svg>

          {/* Click Ripple Ping */}
          {isClicking && (
            <div className="absolute -left-3 -top-3 h-10 w-10 animate-ping rounded-full border-2 border-emerald-400 bg-emerald-400/30 pointer-events-none" />
          )}

          {/* Action Tooltip Beside Cursor */}
          {cursorLabel && (
            <div className="absolute left-6 top-0 pointer-events-none whitespace-nowrap rounded-lg border border-emerald-500/40 bg-slate-950/90 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 shadow-2xl backdrop-blur-md">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {cursorLabel}
            </div>
          )}
        </div>
      )}

      {/* 2. Top-Center System Architecture Progress Stepper */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9985] hidden xl:flex items-center gap-1.5 rounded-full border border-slate-300/60 dark:border-white/10 bg-white/95 dark:bg-slate-900/95 px-3 py-1.5 shadow-2xl backdrop-blur-md transition-all">
        {DEMO_STAGES.map((st, idx) => {
          const isActive = idx === currentStageIdx && isPlaying;
          const isDone = idx < currentStageIdx;

          return (
            <button
              key={st.id}
              type="button"
              onClick={() => handleJumpStage(idx)}
              className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all ${
                isActive
                  ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 ring-2 ring-emerald-400/50"
                  : isDone
                  ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-200"
                  : "text-slate-500 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/5"
              }`}
            >
              <span className="font-mono text-[10px] opacity-80">{st.number}</span>
              <span>{st.shortName}</span>
              {isDone && <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />}
            </button>
          );
        })}
      </div>

      {/* 3. Cinema Lower-Third Motion Graphic Callout Card */}
      {(isPlaying || demoComplete) && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9990] w-full max-w-3xl px-4 pointer-events-none transition-all duration-300">
          <div className="pointer-events-auto overflow-hidden rounded-2xl border border-white/15 bg-slate-950/90 p-4 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)] backdrop-blur-xl text-white">
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
                {currentStage.description}
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

      {/* 4. Floating Demo Controller (Bottom-Left) */}
      <div className="fixed bottom-6 left-6 z-[9995]">
        {isBarHidden ? (
          <button
            type="button"
            onClick={() => setIsBarHidden(false)}
            className="flex items-center gap-2 rounded-full border border-emerald-500/40 bg-slate-950/90 px-3 py-1.5 text-xs font-semibold text-emerald-400 shadow-xl backdrop-blur-md transition hover:bg-slate-900"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Show Demo Controls [H]</span>
          </button>
        ) : (
          <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-2">
              {!isPlaying ? (
                <button
                  type="button"
                  onClick={handleStart}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 transition hover:from-emerald-500 hover:to-teal-500"
                >
                  <Play className="h-4 w-4 fill-white" />
                  <span>🎬 Start 2-Min Pitch Demo</span>
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

              {/* Speed Controller */}
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
                title="Hide bar for screen recording (Press H to restore)"
                className="flex items-center justify-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/10 p-2 text-slate-600 dark:text-zinc-400 transition hover:bg-slate-200 dark:hover:bg-white/15 hover:text-slate-900 dark:hover:text-white"
              >
                <EyeOff className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Helper Shortcut Hints */}
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
