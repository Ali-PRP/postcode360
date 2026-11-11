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

export const TOTAL_DURATION_SECONDS = 193;

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
    endSec: 31,
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
    startSec: 31,
    endSec: 62,
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
    startSec: 62,
    endSec: 87,
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
    startSec: 87,
    endSec: 110,
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
    startSec: 110,
    endSec: 130,
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
    startSec: 130,
    endSec: 157,
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
    startSec: 157,
    endSec: 174,
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
    startSec: 174,
    endSec: 193,
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const vertexTimelineRef = useRef<gsap.core.Timeline | null>(null);
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

  // Keep audio playbackRate & timeline speed synchronized
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
    if (vertexTimelineRef.current) {
      vertexTimelineRef.current.timeScale(playbackSpeed);
    }
  }, [playbackSpeed]);

  // Pause/resume GSAP sweep timeline when demo pauses/resumes
  useEffect(() => {
    if (vertexTimelineRef.current) {
      if (isPaused) {
        vertexTimelineRef.current.pause();
      } else {
        vertexTimelineRef.current.play();
      }
    }
  }, [isPaused]);

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

  // Sweep cursor across 4 rooftop corners on the map canvas (~5.0s staggered pace)
  const sweepRooftopVertices = useCallback(() => {
    const mapSurface = document.querySelector('[data-demo="postcode-map-surface"]');
    if (!mapSurface) return;

    if (vertexTimelineRef.current) {
      vertexTimelineRef.current.kill();
    }

    const mapRect = mapSurface.getBoundingClientRect();
    const cx = mapRect.left + mapRect.width / 2;
    const cy = mapRect.top + mapRect.height / 2;
    const r = Math.min(mapRect.width, mapRect.height) * 0.18;

    const tl = gsap.timeline();
    vertexTimelineRef.current = tl;
    tl.timeScale(speedRef.current);

    tl.to(cursorRef.current, {
      x: cx - r,
      y: cy - r,
      duration: 1.25,
      ease: "power2.inOut",
      onStart: () => setCursorLabel("Tapping Rooftop Corner V1 (Northwest)..."),
      onUpdate: () => setCursorPos({ ...cursorRef.current }),
    })
      .to(cursorRef.current, {
        x: cx + r,
        y: cy - r * 0.8,
        duration: 1.25,
        ease: "power2.inOut",
        onStart: () => setCursorLabel("Tapping Rooftop Corner V2 (Northeast)..."),
        onUpdate: () => setCursorPos({ ...cursorRef.current }),
      })
      .to(cursorRef.current, {
        x: cx + r * 0.9,
        y: cy + r,
        duration: 1.25,
        ease: "power2.inOut",
        onStart: () => setCursorLabel("Tapping Rooftop Corner V3 (Southeast)..."),
        onUpdate: () => setCursorPos({ ...cursorRef.current }),
      })
      .to(cursorRef.current, {
        x: cx - r * 0.8,
        y: cy + r * 0.7,
        duration: 1.25,
        ease: "power2.inOut",
        onStart: () => setCursorLabel("Tapping Rooftop Corner V4 (Southwest) • Capturing Gate GPS..."),
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

  // 193-Second (03:13) Voiceover-Locked Timestamp Schedule Table
  const SCHEDULE_CUES: ScheduleCue[] = [
    // Stage 1 (0s – 31s) | Intro & Customer Checkout
    {
      atSeconds: 0.1,
      label: "Opening Customer Checkout...",
      run: (h) => {
        h.performCueClick("tab-checkout", "Postcode360 — The Paystack for Addressing...", {
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
      atSeconds: 6.5,
      label: "Highlighting Plug-and-Play Checkout...",
      run: (h) => {
        setCursorLabel("Built for Nigerian Small Businesses...");
        h.moveCursorToElement("customer-confirm-order", 1.2);
      },
    },
    {
      atSeconds: 14.0,
      label: "Focusing Email Bookmark Lookup...",
      run: (h) => {
        setCursorLabel("Shoppers enter email — no 11-char memorization needed...");
        h.moveCursorToElement("customer-sync-email", 1.2);
      },
    },
    {
      atSeconds: 18.5,
      label: "Syncing Saved Bookmarks...",
      run: (h) => {
        h.performCueClick("customer-sync-email", "Unlocking Saved Postcodes via Buyer Email...");
      },
    },
    {
      atSeconds: 21.2,
      label: "Resolving Office (CBD)...",
      run: (h) => {
        h.performCueClick("bookmark-office", "1-Click Unlock: Office (CBD) Postcode...");
      },
    },
    {
      atSeconds: 24.0,
      label: "Resolving Home (Wuse II)...",
      run: (h) => {
        h.performCueClick("bookmark-home", "Resolving Exact Building Rooftop Polygon on Satellite...");
      },
    },
    {
      atSeconds: 27.5,
      label: "Confirming Order...",
      run: (h) => {
        h.performCueClick("customer-confirm-order", "Confirming Delivery Address in Seconds...", {
          extraAction: () => {
            h.triggerConfetti(55);
            setTimeout(() => {
              const closeBtn = findElement("customer-close-receipt");
              if (closeBtn) closeBtn.click();
            }, 2200);
          },
        });
      },
    },

    // Stage 2 (31s – 62s) | Zero-PII Hashing, 5-Segment NIPOST & Idempotency
    {
      atSeconds: 31.05,
      label: "Switching to Developer Mode...",
      run: (h) => {
        if (!findElement("mode-developer")) {
          const checkoutTab = findElement("tab-checkout");
          if (checkoutTab) checkoutTab.click();
        }
        setTimeout(() => {
          h.performCueClick("mode-developer", "Under the Hood: Zero-PII Architecture Inspector...");
        }, 120);
      },
    },
    {
      atSeconds: 36.0,
      label: "Verifying Session Token...",
      run: (h) => {
        h.performCueClick("dev-verify-session", "Hashing Emails & NINs via HMAC-SHA256 (0 Raw PII)...");
      },
    },
    {
      atSeconds: 41.5,
      label: "Inspecting Zero-PII Payload...",
      run: (h) => {
        setCursorLabel("Merchants never store raw personal data...");
        h.moveCursorToElement("dev-open-drawer", 1.2);
      },
    },
    {
      atSeconds: 46.0,
      label: "Inspecting 5-Segment Hierarchy...",
      run: (h) => {
        h.performCueClick("dev-open-drawer", "Resolving All 5 NIPOST Postcode Segments Nationwide...");
      },
    },
    {
      atSeconds: 50.0,
      label: "Closing Directory Drawer...",
      run: (h) => {
        h.performCueClick("dev-close-drawer", "Closing NIPOST Segment Directory...");
      },
    },
    {
      atSeconds: 53.0,
      label: "Dispatching Spatial Order...",
      run: (h) => {
        h.performCueClick("dev-create-order", "Executing Idempotent Spatial Order (₦180,000)...");
      },
    },
    {
      atSeconds: 57.0,
      label: "Simulating Idempotent Double-Tap...",
      run: (h) => {
        h.performCueClick(
          "dev-retry-order",
          "Idempotency Lock: Intercepting Double-Tap (₦0 Duplicate Charge)..."
        );
      },
    },

    // Stage 3 (62s – 87s) | Plug-and-Play Social Storefront
    {
      atSeconds: 62.05,
      label: "Opening Social Storefront...",
      run: (h) => {
        h.performCueClick("tab-storefront", "Plug-and-Play Storefront for Instagram & WhatsApp...");
      },
    },
    {
      atSeconds: 67.5,
      label: "Showcasing Social Merchant Catalog...",
      run: (h) => {
        setCursorLabel("No Website Needed — Instant Spatial Storefront...");
        h.moveCursorToElement("store-share-link", 1.3);
      },
    },
    {
      atSeconds: 72.5,
      label: "Copying Store Bio Link...",
      run: (h) => {
        h.performCueClick(
          "store-share-link",
          "Sharing Catalog Bio Link (postcode360.ng/store/luxe-abuja)..."
        );
      },
    },
    {
      atSeconds: 76.5,
      label: "Copying Product Catalog Link...",
      run: (h) => {
        h.performCueClick("store-product-link-0", "Sharing Direct Product Link in Social Bio...");
      },
    },
    {
      atSeconds: 79.5,
      label: "Copying WhatsApp Payment Link...",
      run: (h) => {
        h.performCueClick("store-payment-link-0", "Direct DM Payment Link Ready...");
      },
    },
    {
      atSeconds: 82.5,
      label: "Bridging to Spatial Checkout...",
      run: (h) => {
        h.performCueClick("store-open-checkout-0", "Bringing Social Buyers Straight into Spatial Checkout...");
      },
    },

    // Stage 4 (87s – 110s) | Admin Ledger & PostGIS KNN Query
    {
      atSeconds: 87.05,
      label: "Navigating to Back-Office Admin...",
      run: (h) => {
        h.performCueClick("tab-admin", "Every Verified Checkout Flows into Admin Ledger...");
      },
    },
    {
      atSeconds: 92.5,
      label: "Inspecting Live Spatial Order...",
      run: (h) => {
        h.performCueClick("admin-order-row-0", "PostGIS Spatial Engine Inspecting Rooftop Polygon...");
      },
    },
    {
      atSeconds: 97.0,
      label: "Running Sub-25ms KNN Proximity Query...",
      run: (h) => {
        setCursorLabel("Running Sub-25ms PostGIS <-> KNN Courier Match...");
        h.moveCursorToElement("postcode-map-surface", 1.3);
      },
    },
    {
      atSeconds: 102.0,
      label: "Assigning PostGIS KNN Rider...",
      run: (h) => {
        h.performCueClick("admin-assign-rider", "Informing Closest Partner Courier in Proximity...");
      },
    },

    // Stage 5 (110s – 130s) | 3PL Enumerator SDK & Gate Proof of Delivery
    {
      atSeconds: 110.05,
      label: "Entering 3PL Dispatch Hub...",
      run: (h) => {
        h.performCueClick("tab-dispatch", "Zero Motorcycles Owned — Drop-In 3PL Enumerator SDK...", {
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
      atSeconds: 116.5,
      label: "Syncing 3PL Fleet...",
      run: (h) => {
        h.performCueClick("rider-sync-fleet", "Plugging SDK into Partner Courier Rider Apps...");
      },
    },
    {
      atSeconds: 120.5,
      label: "Broadcasting Live GPS Heartbeat...",
      run: (h) => {
        h.performCueClick("rider-ping-gps", "Couriers Broadcasting Live GPS Heartbeats...");
      },
    },
    {
      atSeconds: 124.5,
      label: "Verifying Proof of Delivery (<5m)...",
      run: (h) => {
        h.performCueClick("rider-complete-pod", "Navigating to Roof & Verifying POD Within 5m of Gate...");
      },
    },

    // Stage 6 (130s – 157s) | Unmapped Rooftop Vertex Tapping, TP-Code Minting & 3/3 Promotion
    {
      atSeconds: 130.05,
      label: "Tracing 4 Rooftop Corners (V1–V4)...",
      run: (h) => {
        const triggerTrace = () => {
          h.performCueClick("rider-trace-vertices", "Tapping 4 Rooftop Corners on Unmapped Building...", {
            extraAction: () => {
              setTimeout(() => {
                h.sweepRooftopVertices();
              }, 350);
            },
          });
        };
        if (!findElement("rider-trace-vertices")) {
          const dispTab = findElement("tab-dispatch");
          if (dispTab) dispTab.click();
          setTimeout(() => {
            const riderSub = findElement("dispatch-subtab-rider");
            if (riderSub) riderSub.click();
            setTimeout(triggerTrace, 200);
          }, 200);
        } else {
          triggerTrace();
        }
      },
    },
    {
      atSeconds: 138.0,
      label: "Capturing Gate GPS & POD Photo...",
      run: (h) => {
        setCursorLabel("Capturing Gate GPS, Gate Photo & Proof of Delivery...");
        h.moveCursorToElement("rider-mint-tp", 1.2);
      },
    },
    {
      atSeconds: 142.5,
      label: "Minting 90-Day Temporary Postcode...",
      run: (h) => {
        h.performCueClick("rider-mint-tp", "Minting 90-Day Temporary Postcode (TP-ABJ-XXXX)...");
      },
    },
    {
      atSeconds: 147.0,
      label: "Logging Verified Delivery 1/3...",
      run: (h) => {
        h.performCueClick("rider-verify-tp-0", "Verified Delivery 1/3...");
      },
    },
    {
      atSeconds: 149.8,
      label: "Logging Verified Delivery 2/3...",
      run: (h) => {
        h.performCueClick("rider-verify-tp-0", "Verified Delivery 2/3...");
      },
    },
    {
      atSeconds: 152.5,
      label: "Auto-Promoting to VERIFIED ALIAS (3/3)...",
      run: (h) => {
        h.performCueClick(
          "rider-verify-tp-0",
          "3/3 Deliveries — Auto-Promoted to Permanent Alias (NIPOST Sync)!",
          {
            extraAction: () => {
              h.triggerConfetti(85);
            },
          }
        );
      },
    },

    // Stage 7 (157s – 174s) | Offline USSD *347# & 2G Emergency Alert
    {
      atSeconds: 157.05,
      label: "Opening Offline USSD & Emergency Rescue...",
      run: (h) => {
        const triggerRescue = () => {
          h.performCueClick(
            "dispatch-subtab-rescue",
            "Offline Inclusion & 1-Tap 112 Emergency Response..."
          );
        };
        if (!findElement("dispatch-subtab-rescue")) {
          const dispTab = findElement("tab-dispatch");
          if (dispTab) dispTab.click();
          setTimeout(triggerRescue, 200);
        } else {
          triggerRescue();
        }
      },
    },
    {
      atSeconds: 161.5,
      label: "Triggering Termii 2G SMS Alert...",
      run: (h) => {
        h.performCueClick(
          "rescue-trigger-sos",
          "Triggering 1-Tap Termii 2G SMS Alert to 112 Units..."
        );
      },
    },
    {
      atSeconds: 166.0,
      label: "Dialing USSD *347# on Feature Phone...",
      run: (h) => {
        h.performCueClick("rescue-dial-ussd", "Dialing *347# on Any Feature Phone Without Internet...");
      },
    },
    {
      atSeconds: 170.5,
      label: "Resolving Emergency Incident...",
      run: (h) => {
        h.performCueClick("rescue-resolve-incident", "Resolving Emergency Dispatch & Trust Score +1...");
      },
    },

    // Stage 8 (174s – 193s) | 5-Min Plugins & Hero Closing
    {
      atSeconds: 174.05,
      label: "Opening 5-Minute Drop-In Plugins...",
      run: (h) => {
        h.performCueClick("tab-plugins", "5-Minute Plugins for WooCommerce...");
      },
    },
    {
      atSeconds: 177.5,
      label: "Inspecting Shopify Integration...",
      run: (h) => {
        h.performCueClick("plugin-tab-shopify", "Drop-In Shopify App Block Integration...");
      },
    },
    {
      atSeconds: 181.5,
      label: "Inspecting 3PL & Existing IT Infrastructure SDK...",
      run: (h) => {
        h.performCueClick("plugin-tab-enumerator", "3PL Fleets & Existing Business IT Infrastructure SDK...");
      },
    },
    {
      atSeconds: 186.5,
      label: "Returning to Customer Checkout...",
      run: (h) => {
        h.performCueClick("tab-checkout", "Postcode360 — Nigeria's National Postcode, Plug & Play from Day 1!", {
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

  // Continuous Master Clock via requestAnimationFrame synced directly to <audio> (0.0 to 193.0s)
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

      let newElapsed: number;
      const audio = audioRef.current;
      if (audio && !audio.paused && audio.readyState >= 1) {
        // Lock animation clock directly to hardware audio playback (zero drift)
        newElapsed = audio.currentTime;
      } else {
        const deltaSec = (now - lastTimestampRef.current) / 1000;
        newElapsed = elapsedSecondsRef.current + deltaSec * speedRef.current;
      }
      lastTimestampRef.current = now;

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

      // Check if full 193.0 seconds (03:13) completed
      if (newElapsed >= TOTAL_DURATION_SECONDS || audio?.ended) {
        elapsedSecondsRef.current = TOTAL_DURATION_SECONDS;
        setElapsedSeconds(TOTAL_DURATION_SECONDS);
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

    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
      audio.playbackRate = speedRef.current;
      audio.play().catch((err) => {
        console.warn("[DemoPlayer] Audio playback unavailable:", err);
      });
    }
  };

  const handlePauseResume = () => {
    setIsPaused((prev) => {
      const nextPaused = !prev;
      const audio = audioRef.current;
      if (audio) {
        if (nextPaused) {
          audio.pause();
        } else {
          audio.playbackRate = speedRef.current;
          audio.play().catch(() => {});
        }
      }
      return nextPaused;
    });
  };

  const handleStop = () => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (vertexTimelineRef.current) {
      vertexTimelineRef.current.kill();
      vertexTimelineRef.current = null;
    }

    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
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

  const seekToSeconds = (targetSec: number) => {
    const clampedSec = Math.min(TOTAL_DURATION_SECONDS, Math.max(0, targetSec));
    elapsedSecondsRef.current = clampedSec;
    setElapsedSeconds(clampedSec);

    const activeStage =
      DEMO_STAGES.find((st) => clampedSec >= st.startSec && clampedSec < st.endSec) ||
      DEMO_STAGES[DEMO_STAGES.length - 1];
    setCurrentStageIdx(activeStage.id);

    // Mark previous cues as fired, and remaining cues as unfired
    const nextFired = new Set<number>();
    for (let i = 0; i < SCHEDULE_CUES.length; i++) {
      if (SCHEDULE_CUES[i].atSeconds < clampedSec) {
        nextFired.add(i);
      }
    }
    firedCuesRef.current = nextFired;

    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = clampedSec;
      if (!isPausedRef.current) {
        audio.playbackRate = speedRef.current;
        audio.play().catch(() => {});
      }
    }

    if (!isPlayingRef.current) {
      setDemoComplete(false);
      setIsPlaying(true);
      setIsPaused(false);
      setCursorVisible(true);
    }
  };

  const handleJumpStage = (stageIdx: number) => {
    const targetStage = DEMO_STAGES[stageIdx];
    if (!targetStage) return;
    seekToSeconds(targetStage.startSec);
  };

  const handleProgressBarScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    seekToSeconds(ratio * TOTAL_DURATION_SECONDS);
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
    const clamped = Math.min(TOTAL_DURATION_SECONDS, Math.max(0, totalSec));
    const mins = Math.floor(clamped / 60);
    const secs = Math.floor(clamped % 60);
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <>
      {/* Synchronized Voiceover Audio Track (3:13 / 193s) */}
      <audio ref={audioRef} src="/demo-voiceover.mp3" preload="auto" />

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
              {formatTime(elapsedSeconds)} / 03:13
            </span>
          </div>
        </div>
      )}

      {/* Layer D — 193-Second (03:13) Timeline Progress Bar Along Bottom Edge */}
      <div
        onClick={handleProgressBarScrub}
        className="fixed bottom-0 left-0 right-0 h-[3px] bg-slate-900/80 z-[10001] overflow-hidden pointer-events-auto cursor-pointer"
      >
        <div
          className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-500 transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(16,185,129,0.8)]"
          style={{
            width: `${(Math.min(TOTAL_DURATION_SECONDS, elapsedSeconds) / TOTAL_DURATION_SECONDS) * 100}%`,
          }}
        />
        {/* Chapter Markers for All 8 Stages */}
        {DEMO_STAGES.map((st, idx) => {
          const leftPercent = (st.startSec / TOTAL_DURATION_SECONDS) * 100;

          return (
            <div
              key={st.id}
              title={`Jump to Stage ${st.number}: ${st.shortName}`}
              onClick={(e) => {
                e.stopPropagation();
                handleJumpStage(idx);
              }}
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
                {formatTime(elapsedSeconds)} / 03:13
              </span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default DemoPlayerOverlay;
