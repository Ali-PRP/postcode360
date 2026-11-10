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
  category: string;
  title: string;
  subtitle: string;
  metricBadge: string;
  startSec: number;
  endSec: number;
}

export const DEMO_STAGES: DemoStage[] = [
  {
    id: 0,
    number: "01",
    shortName: "Checkout",
    category: "1-Click Saved Postcodes",
    title: "Plug-and-Play Customer Checkout (1-Click Saved Postcodes)",
    subtitle:
      "Shoppers never memorize 11-character codes. Entering their email unlocks bookmarked postcodes in 1 click and frames the exact rooftop building polygon on satellite imagery.",
    metricBadge: "GET /v1/bookmarks • GET /v1/lookup",
    startSec: 0,
    endSec: 18,
  },
  {
    id: 1,
    number: "02",
    shortName: "Zero-PII",
    category: "Zero-PII Hashing & Idempotency",
    title: "Zero-PII HMAC-SHA256 Security & Idempotent Double-Tap Protection",
    subtitle:
      "Raw emails and NINs are never stored (raw_pii_retained: false). Strict idempotency_key locks ensure mobile network retries never double-charge merchants or duplicate orders.",
    metricBadge: "POST /v1/widget/session • POST /orders (idempotent_replay: true)",
    startSec: 18,
    endSec: 36,
  },
  {
    id: 2,
    number: "03",
    shortName: "Storefront",
    category: "Social Commerce Catalog",
    title: "Social Commerce Storefront (Bio Catalog Link + Direct Payment Links)",
    subtitle:
      "Empowers Instagram, TikTok, and WhatsApp vendors without websites to share a product catalog and route buyers directly into Postcode360’s spatial checkout.",
    metricBadge: "GET /v1/social-stores • Catalog → Checkout Bridge",
    startSec: 36,
    endSec: 52,
  },
  {
    id: 3,
    number: "04",
    shortName: "PostGIS Admin",
    category: "PostGIS GiST KNN Routing",
    title: "Live Order Ledger & PostGIS GiST KNN Proximity Routing",
    subtitle:
      "Matches resolved rooftop polygons to the closest available 3PL courier and emergency responder in milliseconds using PostGIS ST_DWithin and <-> KNN operators.",
    metricBadge: "GET /orders • GET /riders/nearest (<25ms)",
    startSec: 52,
    endSec: 68,
  },
  {
    id: 4,
    number: "05",
    shortName: "Rider POD",
    category: "3PL Navigation & Proof of Delivery",
    title: "3PL Partner Plugin (@postcode360/enumerator-sdk) & GPS Proof of Delivery",
    subtitle:
      "Postcode360 owns zero motorcycles. External logistics fleets embed our plugin for rooftop gate navigation and polygon-verified Proof of Delivery.",
    metricBadge: "POST /v1/orders/{id}/pod • <5m Gate GPS Accuracy",
    startSec: 68,
    endSec: 84,
  },
  {
    id: 5,
    number: "06",
    shortName: "Vertex Minting",
    category: "Crowdsourced TP-Code Minting",
    title: "Crowdsourced TP-Code Minting & Self-Healing 3-Delivery Maintenance",
    subtitle:
      "Partner riders mint 90-day Temporary Postcodes (TP-ABJ-XXXX) at unmapped buildings. Every verified delivery increments trust (+1), auto-promoting the code at 3/3 deliveries to feed ground-truth data back to NIPOST.",
    metricBadge: "POST /v1/alias/mint (90d TTL) → POST /v1/verify (3/3 Auto-Promoted)",
    startSec: 84,
    endSec: 102,
  },
  {
    id: 6,
    number: "07",
    shortName: "USSD Rescue",
    category: "2G GSM USSD *347# & Triage",
    title: "Offline Feature-Phone Inclusion (*347# USSD) & 2G Emergency Triage",
    subtitle:
      "Citizens without smartphones or mobile data dial *347*postcode# over 2G GSM to resolve addresses or route 112 trauma responders via Termii SMS.",
    metricBadge: "POST /v1/ussd • POST /v1/emergency/sos",
    startSec: 102,
    endSec: 112,
  },
  {
    id: 7,
    number: "08",
    shortName: "Plugins",
    category: "Drop-In E-Commerce & 3PL SDKs",
    title: "5-Minute Drop-In Integration for WooCommerce, Shopify & 3PL Apps",
    subtitle:
      "Built on Nigeria’s National Postcode. Ready for immediate pilot deployment across e-commerce merchants, social sellers, and logistics fleets.",
    metricBadge: "@postcode360/checkout-js • @postcode360/enumerator-sdk",
    startSec: 112,
    endSec: 120,
  },
];

interface ScheduleCue {
  atSeconds: number;
  label: string;
  run: (helpers: CueHelpers) => void;
}

interface CueHelpers {
  performCueClick: (
    selectorOrText: string,
    actionLabel: string,
    options?: { customOffset?: { x: number; y: number }; extraAction?: () => void }
  ) => Promise<void>;
  moveCursorToElement: (
    selectorOrText: string,
    durationSec?: number
  ) => Promise<void>;
  sweepRooftopVertices: () => void;
  triggerConfetti: (count?: number) => void;
}

export const DemoPlayerOverlay: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentStageIdx, setCurrentStageIdx] = useState<number>(0);
  const [isBarHidden, setIsBarHidden] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // Default to 1x
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
  const speedRef = useRef<number>(1);
  const elapsedSecondsRef = useRef<number>(0);
  const lastTimestampRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const firedCuesRef = useRef<Set<number>>(new Set());
  const highlightedElRef = useRef<HTMLElement | null>(null);

  isPlayingRef.current = isPlaying;
  isPausedRef.current = isPaused;
  speedRef.current = playbackSpeed;

  const currentStage = DEMO_STAGES[currentStageIdx] || DEMO_STAGES[0];

  // Helper: find element by data-demo, CSS selector, or visible text
  const findElement = useCallback((textOrSelector: string): HTMLElement | null => {
    // 1. Exact [data-demo="..."]
    let el = document.querySelector(`[data-demo="${textOrSelector}"]`) as HTMLElement;
    if (el) return el;

    // 2. Raw selector
    try {
      el = document.querySelector(textOrSelector) as HTMLElement;
      if (el) return el;
    } catch {}

    // 3. Search visible interactive buttons, inputs, links, pills by text
    const lower = textOrSelector.toLowerCase();
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>("button, a, input, [role='button'], h3, p, span")
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

  // Move cursor with GSAP tween
  const moveCursorToElement = useCallback(
    async (selectorOrText: string, durationSec = 0.55): Promise<void> => {
      const el = findElement(selectorOrText);
      if (!el) return;

      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {}

      const rect = el.getBoundingClientRect();
      const targetX = rect.left + rect.width / 2;
      const targetY = rect.top + rect.height / 2;

      return new Promise<void>((resolve) => {
        gsap.to(cursorRef.current, {
          x: targetX,
          y: targetY,
          duration: Math.max(0.12, durationSec / speedRef.current),
          ease: "power2.out",
          onUpdate: () => {
            setCursorPos({ x: cursorRef.current.x, y: cursorRef.current.y });
          },
          onComplete: () => resolve(),
        });
      });
    },
    [findElement]
  );

  // Perform cue click: glide cursor, highlight element, ripple, and dispatch click
  const performCueClick = useCallback(
    async (
      selectorOrText: string,
      actionLabel: string,
      options?: { customOffset?: { x: number; y: number }; extraAction?: () => void }
    ): Promise<void> => {
      setCursorLabel(actionLabel);
      setCursorVisible(true);

      // Clean up previous highlight
      if (highlightedElRef.current) {
        highlightedElRef.current.classList.remove("demo-target-highlight");
        highlightedElRef.current = null;
      }

      const el = findElement(selectorOrText);
      if (!el) {
        console.warn(`[DemoPlayer] Element "${selectorOrText}" not found for cue.`);
        if (options?.extraAction) options.extraAction();
        return;
      }

      try {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      } catch {}

      const rect = el.getBoundingClientRect();
      const targetX = options?.customOffset
        ? rect.left + options.customOffset.x
        : rect.left + rect.width / 2;
      const targetY = options?.customOffset
        ? rect.top + options.customOffset.y
        : rect.top + rect.height / 2;

      await new Promise<void>((resolve) => {
        gsap.to(cursorRef.current, {
          x: targetX,
          y: targetY,
          duration: Math.max(0.12, 0.55 / speedRef.current),
          ease: "power2.out",
          onUpdate: () => {
            setCursorPos({ x: cursorRef.current.x, y: cursorRef.current.y });
          },
          onComplete: () => resolve(),
        });
      });

      // Highlight target element with glowing emerald ring
      el.classList.add("demo-target-highlight");
      highlightedElRef.current = el;

      // Click ripple effect
      setIsClicking(true);
      setTimeout(() => setIsClicking(false), 120);

      // Trigger native click events
      try {
        el.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, cancelable: true, view: window })
        );
        el.dispatchEvent(
          new MouseEvent("mouseup", { bubbles: true, cancelable: true, view: window })
        );
        el.click();
      } catch (err) {
        console.error("Click error:", err);
      }

      if (options?.extraAction) {
        options.extraAction();
      }

      // Remove highlight after brief delay
      setTimeout(() => {
        if (highlightedElRef.current === el) {
          el.classList.remove("demo-target-highlight");
          highlightedElRef.current = null;
        }
      }, 450);
    },
    [findElement]
  );

  // Sweep cursor across 4 rooftop corners on the map canvas
  const sweepRooftopVertices = useCallback(() => {
    const mapSurface = document.querySelector('[data-demo="postcode-map-surface"]');
    if (!mapSurface) return;

    const mapRect = mapSurface.getBoundingClientRect();
    const cx = mapRect.left + mapRect.width / 2;
    const cy = mapRect.top + mapRect.height / 2;
    const r = Math.min(mapRect.width, mapRect.height) * 0.18;

    const tl = gsap.timeline();
    tl.to(cursorRef.current, {
      x: cx - r,
      y: cy - r,
      duration: 0.35 / speedRef.current,
      onUpdate: () => setCursorPos({ ...cursorRef.current }),
    })
      .to(cursorRef.current, {
        x: cx + r,
        y: cy - r * 0.8,
        duration: 0.35 / speedRef.current,
        onUpdate: () => setCursorPos({ ...cursorRef.current }),
      })
      .to(cursorRef.current, {
        x: cx + r * 0.9,
        y: cy + r,
        duration: 0.35 / speedRef.current,
        onUpdate: () => setCursorPos({ ...cursorRef.current }),
      })
      .to(cursorRef.current, {
        x: cx - r * 0.8,
        y: cy + r * 0.7,
        duration: 0.35 / speedRef.current,
        onUpdate: () => setCursorPos({ ...cursorRef.current }),
      });
  }, []);

  const triggerConfetti = useCallback((count = 60) => {
    try {
      confetti({
        particleCount: count,
        spread: 70,
        origin: { y: 0.55 },
        colors: ["#10b981", "#06b6d4", "#3b82f6", "#f59e0b"],
      });
    } catch {}
  }, []);

  // 120-Second Timestamp Schedule Table (Section 4)
  const SCHEDULE_CUES: ScheduleCue[] = [
    // Stage 1 (0s – 18s)
    {
      atSeconds: 0.5,
      label: "Opening Customer Checkout...",
      run: (h) => {
        h.performCueClick("tab-checkout", "Opening Spatial Checkout...", {
          extraAction: () => {
            setTimeout(() => {
              const custMode = findElement("mode-customer");
              if (custMode) custMode.click();
            }, 200);
          },
        });
      },
    },
    {
      atSeconds: 3.0,
      label: "Syncing Saved Bookmarks...",
      run: (h) => {
        h.performCueClick("customer-sync-email", "Syncing Saved Postcodes for buyer@gmail.com...");
      },
    },
    {
      atSeconds: 6.5,
      label: "Resolving Office (CBD)...",
      run: (h) => {
        h.performCueClick("bookmark-office", "Resolving Office (CBD) Postcode & Rooftop Polygon...");
      },
    },
    {
      atSeconds: 10.5,
      label: "Resolving Home (Wuse II)...",
      run: (h) => {
        h.performCueClick("bookmark-home", "Resolving Home (Wuse II) Postcode & Rooftop Polygon...");
      },
    },
    {
      atSeconds: 14.5,
      label: "Confirming Order...",
      run: (h) => {
        h.performCueClick("customer-confirm-order", "Submitting Order & Discarding PII...", {
          extraAction: () => {
            h.triggerConfetti(55);
            setTimeout(() => {
              const closeBtn = findElement("customer-close-receipt");
              if (closeBtn) closeBtn.click();
            }, 1800);
          },
        });
      },
    },

    // Stage 2 (18s – 36s)
    {
      atSeconds: 18.5,
      label: "Switching to Developer Mode...",
      run: (h) => {
        h.performCueClick("mode-developer", "Switching to Developer Mode Inspector...");
      },
    },
    {
      atSeconds: 22.0,
      label: "Verifying Session Token...",
      run: (h) => {
        h.performCueClick("dev-verify-session", "Verifying HMAC-SHA256 Cryptographic Session...");
      },
    },
    {
      atSeconds: 26.0,
      label: "Inspecting 5-Segment Hierarchy...",
      run: (h) => {
        h.performCueClick("dev-open-drawer", "Inspecting Preloaded 5-Segment Postcodes...");
      },
    },
    {
      atSeconds: 29.0,
      label: "Closing Directory Drawer...",
      run: (h) => {
        h.performCueClick("dev-close-drawer", "Closing Directory Drawer...");
      },
    },
    {
      atSeconds: 31.0,
      label: "Dispatching Spatial Order...",
      run: (h) => {
        h.performCueClick("dev-create-order", "Dispatching Idempotent Spatial Order (₦180,000)...");
      },
    },
    {
      atSeconds: 33.5,
      label: "Simulating Idempotent Double-Tap...",
      run: (h) => {
        h.performCueClick(
          "dev-retry-order",
          "Simulating Network Retry / Double-Tap Pay (₦0 Extra Charged)..."
        );
      },
    },

    // Stage 3 (36s – 52s)
    {
      atSeconds: 36.5,
      label: "Opening Social Storefront...",
      run: (h) => {
        h.performCueClick("tab-storefront", "Opening Social Media Vendor Storefront...");
      },
    },
    {
      atSeconds: 40.0,
      label: "Copying Store Bio Link...",
      run: (h) => {
        h.performCueClick(
          "store-share-link",
          "Copying Storefront Bio Link (postcode360.ng/store/luxe-abuja)..."
        );
      },
    },
    {
      atSeconds: 44.0,
      label: "Copying Product Catalog Link...",
      run: (h) => {
        h.performCueClick("store-product-link-0", "Copying Direct Product Link (Bone Straight Wig)...");
      },
    },
    {
      atSeconds: 47.5,
      label: "Copying WhatsApp Payment Link...",
      run: (h) => {
        h.performCueClick("store-payment-link-0", "Copying Direct WhatsApp Payment Link...");
      },
    },
    {
      atSeconds: 50.0,
      label: "Bridging to Spatial Checkout...",
      run: (h) => {
        h.performCueClick("store-open-checkout-0", "Bridging Buyer from Social Link to Checkout...");
      },
    },

    // Stage 4 (52s – 68s)
    {
      atSeconds: 52.5,
      label: "Navigating to Back-Office Admin...",
      run: (h) => {
        h.performCueClick("tab-admin", "Navigating to Back-Office Admin...");
      },
    },
    {
      atSeconds: 57.0,
      label: "Inspecting Live Spatial Order...",
      run: (h) => {
        h.performCueClick("admin-order-row-0", "Inspecting Incoming Spatial Order & Delivery Route...");
      },
    },
    {
      atSeconds: 63.0,
      label: "Assigning PostGIS KNN Rider...",
      run: (h) => {
        h.performCueClick("admin-assign-rider", "Executing PostGIS GiST KNN Rider Match (Musa Danjuma)...");
      },
    },

    // Stage 5 (68s – 84s)
    {
      atSeconds: 68.5,
      label: "Entering 3PL Dispatch Hub...",
      run: (h) => {
        h.performCueClick("tab-dispatch", "Entering 3PL Dispatch Hub & Rider Fleet...", {
          extraAction: () => {
            setTimeout(() => {
              const riderSub = findElement("dispatch-subtab-rider");
              if (riderSub) riderSub.click();
            }, 200);
          },
        });
      },
    },
    {
      atSeconds: 72.0,
      label: "Syncing 3PL Fleet...",
      run: (h) => {
        h.performCueClick("rider-sync-fleet", "Syncing 3PL Partner Courier Telemetry...");
      },
    },
    {
      atSeconds: 76.0,
      label: "Sending High-Precision GPS Heartbeat...",
      run: (h) => {
        h.performCueClick("rider-ping-gps", "Sending Live High-Precision GPS Heartbeat...");
      },
    },
    {
      atSeconds: 80.0,
      label: "Capturing Gate Proof of Delivery...",
      run: (h) => {
        h.performCueClick("rider-complete-pod", "Capturing Gate Proof of Delivery (4.99m Accuracy)...");
      },
    },

    // Stage 6 (84s – 102s)
    {
      atSeconds: 84.5,
      label: "Tracing 4 Rooftop Corners (V1–V4)...",
      run: (h) => {
        h.performCueClick("rider-trace-vertices", "Tracing 4 Rooftop Corners (V1–V4) on Satellite...", {
          extraAction: () => {
            setTimeout(() => {
              h.sweepRooftopVertices();
            }, 300);
          },
        });
      },
    },
    {
      atSeconds: 90.0,
      label: "Minting Temporary Postcode (TP-ABJ)...",
      run: (h) => {
        h.performCueClick("rider-mint-tp", "Minting Temporary Postcode (TP-ABJ-XXXX • 90d TTL)...");
      },
    },
    {
      atSeconds: 94.0,
      label: "Logging Verified Delivery 1/3...",
      run: (h) => {
        h.performCueClick("rider-verify-tp-0", "Logging Verified Delivery 1/3 (Trust +1)...");
      },
    },
    {
      atSeconds: 96.5,
      label: "Logging Verified Delivery 2/3...",
      run: (h) => {
        h.performCueClick("rider-verify-tp-0", "Logging Verified Delivery 2/3 (Trust +1)...");
      },
    },
    {
      atSeconds: 99.0,
      label: "Auto-Promoting to VERIFIED ALIAS (3/3)...",
      run: (h) => {
        h.performCueClick(
          "rider-verify-tp-0",
          "Logging Verified Delivery 3/3 — Auto-Promoted to VERIFIED ALIAS!",
          {
            extraAction: () => {
              h.triggerConfetti(85);
            },
          }
        );
      },
    },

    // Stage 7 (102s – 112s)
    {
      atSeconds: 102.5,
      label: "Opening Offline USSD & Emergency Rescue...",
      run: (h) => {
        h.performCueClick(
          "dispatch-subtab-rescue",
          "Opening Offline USSD *347# & Emergency Rescue Console..."
        );
      },
    },
    {
      atSeconds: 105.5,
      label: "Triggering 2G SMS SOS...",
      run: (h) => {
        h.performCueClick(
          "rescue-trigger-sos",
          "Triggering 1-Tap SOS & Broadcast Termii 2G SMS to 112 Units..."
        );
      },
    },
    {
      atSeconds: 108.0,
      label: "Dialing 2G GSM USSD *347#...",
      run: (h) => {
        h.performCueClick("rescue-dial-ussd", "Dialing Zero-Data USSD *347*postcode# Session...");
      },
    },
    {
      atSeconds: 110.5,
      label: "Resolving Emergency Incident...",
      run: (h) => {
        h.performCueClick("rescue-resolve-incident", "Resolving Incident & Incrementing Trust Score +1...");
      },
    },

    // Stage 8 (112s – 120s)
    {
      atSeconds: 112.5,
      label: "Opening Drop-In Plugins...",
      run: (h) => {
        h.performCueClick("tab-plugins", "Opening Drop-In Plugins & Integrations...");
      },
    },
    {
      atSeconds: 115.0,
      label: "Inspecting Shopify Integration...",
      run: (h) => {
        h.performCueClick("plugin-tab-shopify", "Inspecting Shopify Liquid Checkout App Block...");
      },
    },
    {
      atSeconds: 117.5,
      label: "Returning to Customer Checkout...",
      run: (h) => {
        h.performCueClick("tab-checkout", "Returning to Customer Checkout for Closing Hero Frame...", {
          extraAction: () => {
            setTimeout(() => {
              const custMode = findElement("mode-customer");
              if (custMode) custMode.click();
            }, 300);
          },
        });
      },
    },
  ];

  // Continuous Master Clock via requestAnimationFrame (0.0 to 120.0s)
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      lastTimestampRef.current = null;
      return;
    }

    const helpers: CueHelpers = {
      performCueClick,
      moveCursorToElement,
      sweepRooftopVertices,
      triggerConfetti,
    };

    const tick = (now: number) => {
      if (!isPlayingRef.current) return;

      if (isPausedRef.current) {
        lastTimestampRef.current = now;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (lastTimestampRef.current === null) {
        lastTimestampRef.current = now;
      }

      const deltaSec = (now - lastTimestampRef.current) / 1000;
      lastTimestampRef.current = now;

      const newElapsed = elapsedSecondsRef.current + deltaSec * speedRef.current;
      elapsedSecondsRef.current = newElapsed;
      setElapsedSeconds(newElapsed);

      // Dynamically resolve active stage from current elapsed time
      const activeStage =
        DEMO_STAGES.find((st) => newElapsed >= st.startSec && newElapsed < st.endSec) ||
        DEMO_STAGES[DEMO_STAGES.length - 1];
      setCurrentStageIdx(activeStage.id);

      // Check and fire timestamp schedule cues
      for (let i = 0; i < SCHEDULE_CUES.length; i++) {
        const cue = SCHEDULE_CUES[i];
        if (newElapsed >= cue.atSeconds && !firedCuesRef.current.has(i)) {
          firedCuesRef.current.add(i);
          cue.run(helpers);
        }
      }

      // Check if full 120.0 seconds completed
      if (newElapsed >= 120.0) {
        elapsedSecondsRef.current = 120.0;
        setElapsedSeconds(120.0);
        setIsPlaying(false);
        setDemoComplete(true);
        setCursorVisible(false);
        setCursorLabel("");
        triggerConfetti(100);
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [
    isPlaying,
    performCueClick,
    moveCursorToElement,
    sweepRooftopVertices,
    triggerConfetti,
  ]);

  const handleStart = () => {
    elapsedSecondsRef.current = 0;
    setElapsedSeconds(0);
    firedCuesRef.current.clear();
    setDemoComplete(false);
    setIsPaused(false);
    setIsPlaying(true);
    setCursorVisible(true);
  };

  const handlePauseResume = () => {
    setIsPaused((prev) => !prev);
  };

  const handleStop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    lastTimestampRef.current = null;
    elapsedSecondsRef.current = 0;
    setElapsedSeconds(0);
    firedCuesRef.current.clear();

    if (highlightedElRef.current) {
      highlightedElRef.current.classList.remove("demo-target-highlight");
      highlightedElRef.current = null;
    }

    setIsPlaying(false);
    setIsPaused(false);
    setCursorVisible(false);
    setCursorLabel("");
  };

  const handleRestart = () => {
    handleStop();
    setTimeout(() => {
      handleStart();
    }, 120);
  };

  const handleJumpStage = (stageIdx: number) => {
    const targetStage = DEMO_STAGES[stageIdx];
    if (!targetStage) return;

    const targetSec = targetStage.startSec;
    elapsedSecondsRef.current = targetSec;
    setElapsedSeconds(targetSec);
    setCurrentStageIdx(stageIdx);

    // Mark previous cues as fired, and remaining cues as unfired
    const nextFired = new Set<number>();
    for (let i = 0; i < SCHEDULE_CUES.length; i++) {
      if (SCHEDULE_CUES[i].atSeconds < targetSec) {
        nextFired.add(i);
      }
    }
    firedCuesRef.current = nextFired;

    if (!isPlaying) {
      setIsPlaying(true);
      setIsPaused(false);
      setCursorVisible(true);
    }
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
  }, [isPlaying]);

  const formatTime = (totalSec: number) => {
    const clamped = Math.min(120, Math.max(0, totalSec));
    const mins = Math.floor(clamped / 60);
    const secs = Math.floor(clamped % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <>
      {/* High-Contrast Target Glow Outline */}
      <style>{`
        .demo-target-highlight {
          outline: 2px solid #10b981 !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 20px rgba(16, 185, 129, 0.5) !important;
          transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1) !important;
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
          {/* Custom SVG Pointer */}
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
            <div className="absolute left-7 top-1 pointer-events-none whitespace-nowrap rounded-lg border border-emerald-500/40 bg-[#090A0F]/95 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 shadow-2xl backdrop-blur-md">
              <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {cursorLabel}
            </div>
          )}
        </div>
      )}

      {/* Layer B — Ultra-High-Contrast Cinema Lower-Third Subtitle Card */}
      {(isPlaying || demoComplete) && (
        <div className="fixed bottom-2.5 left-1/2 -translate-x-1/2 lg:left-[290px] lg:right-6 lg:translate-x-0 lg:w-auto max-w-3xl z-[9999] w-[90%] rounded-2xl bg-[#090A0F]/95 border-2 border-emerald-500/50 px-5 py-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-md pointer-events-none transition-all duration-300">
          {/* Top Row: Stage Pill, Category Label, Right API Badge */}
          <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-2">
            <span className="rounded-md bg-emerald-500 px-2 py-0.5 font-mono text-[10px] font-extrabold uppercase tracking-wider text-slate-950">
              STAGE {currentStage.number} / 08
            </span>

            <span className="font-mono text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
              {currentStage.category}
            </span>

            <span className="ml-auto rounded-md border border-emerald-500/40 bg-emerald-950/80 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-300">
              {currentStage.metricBadge}
            </span>
          </div>

          {/* Headline Title */}
          <h3 className="mt-1.5 text-base sm:text-lg font-extrabold tracking-tight text-white">
            {currentStage.title}
          </h3>

          {/* Subtitle Description */}
          <p className="mt-0.5 text-xs sm:text-sm leading-relaxed text-slate-200">
            {currentStage.subtitle}
          </p>

          {/* Bottom Status / Progress Row */}
          <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-emerald-400 border-t border-white/10 pt-1.5">
            <div className="flex items-center gap-2 truncate">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="truncate">
                {cursorLabel || "Executing choreographed sequence..."}
              </span>
            </div>

            <span className="ml-4 font-mono font-bold text-white">
              {formatTime(elapsedSeconds)} / 02:00
            </span>
          </div>
        </div>
      )}

      {/* Layer D — 120-Second Timeline Progress Bar Along Bottom Edge */}
      <div className="fixed bottom-0 left-0 right-0 h-[3px] bg-slate-900/80 z-[10001] overflow-hidden pointer-events-auto">
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(16,185,129,0.8)]"
          style={{ width: `${(Math.min(120, elapsedSeconds) / 120) * 100}%` }}
        />
        {/* Chapter Markers for All 8 Stages */}
        {DEMO_STAGES.map((st, idx) => {
          const leftPercent = (st.startSec / 120) * 100;

          return (
            <div
              key={st.id}
              title={`Jump to Stage ${st.number}: ${st.shortName}`}
              onClick={() => handleJumpStage(idx)}
              className="absolute top-0 bottom-0 w-[2px] bg-white/25 hover:bg-emerald-400 cursor-pointer pointer-events-auto transition-colors"
              style={{ left: `${leftPercent}%` }}
            />
          );
        })}
      </div>

      {/* Flush Bottom-Left Compact Control Widget */}
      <div className="fixed bottom-1.5 left-1.5 z-[10000] pointer-events-auto">
        {isBarHidden ? (
          <button
            type="button"
            onClick={() => setIsBarHidden(false)}
            className="flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-[#090A0F]/95 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 shadow-xl backdrop-blur-md transition hover:bg-slate-900"
          >
            <Eye className="h-3 w-3" />
            <span>Demo [H]</span>
          </button>
        ) : (
          <div className="flex flex-col gap-1 rounded-xl border border-white/15 bg-[#090A0F]/95 px-2.5 py-2 text-white shadow-2xl backdrop-blur-md">
            <div className="flex items-center gap-1.5">
              {!isPlaying ? (
                <button
                  type="button"
                  onClick={handleStart}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 px-3 py-1.5 text-xs font-bold text-white shadow-md shadow-emerald-600/30 transition hover:from-emerald-500 hover:to-teal-500"
                >
                  <Play className="h-3.5 w-3.5 fill-white" />
                  <span>🎬 2-Min Auto Demo</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={handlePauseResume}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/10 px-2 py-1 text-xs font-bold text-white transition hover:bg-white/15"
                  >
                    {isPaused ? <Play className="h-3 w-3 fill-current" /> : <Pause className="h-3 w-3" />}
                    <span>{isPaused ? "Resume" : "Pause"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleStop}
                    title="Stop Demo"
                    className="flex items-center justify-center rounded-lg border border-white/10 bg-white/10 p-1 text-xs font-bold text-white transition hover:bg-rose-500"
                  >
                    <Square className="h-3 w-3 fill-current" />
                  </button>

                  <button
                    type="button"
                    onClick={handleRestart}
                    title="Restart Demo"
                    className="flex items-center justify-center rounded-lg border border-white/10 bg-white/10 p-1 text-xs font-bold text-white transition hover:bg-white/15"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </button>
                </>
              )}

              {/* Playback Speed Controller */}
              <div className="flex items-center rounded-lg border border-white/10 bg-white/5 p-0.5 text-[10px] font-semibold">
                {[1, 1.5, 2].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => setPlaybackSpeed(spd)}
                    className={`rounded px-1.5 py-0.5 transition ${
                      playbackSpeed === spd
                        ? "bg-emerald-500 text-slate-950 font-bold"
                        : "text-zinc-400 hover:text-white"
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
                className="flex items-center justify-center rounded-lg border border-white/10 bg-white/10 p-1 text-zinc-400 transition hover:bg-white/15 hover:text-white"
              >
                <EyeOff className="h-3 w-3" />
              </button>
            </div>

            {/* Keyboard Shortcuts Hint */}
            <div className="flex items-center justify-between text-[10px] text-zinc-400 px-0.5 pt-0.5 border-t border-white/10">
              <span>Space (Play/Pause) • R (Restart) • H (Hide)</span>
              <span className="font-mono text-emerald-400 font-bold">
                {formatTime(elapsedSeconds)} / 02:00
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DemoPlayerOverlay;
