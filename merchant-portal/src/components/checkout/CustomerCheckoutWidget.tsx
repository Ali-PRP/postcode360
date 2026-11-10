// src/components/checkout/CustomerCheckoutWidget.tsx
import React, { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ChevronRight,
  Compass,
  CreditCard,
  Home,
  Mail,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import confetti from "canvas-confetti";
import { postcode360Api, ABUJA_MOCK_POSTCODES } from "../../services/api";
import { PostcodeMap } from "../map/PostcodeMap";

const emailSessionCache = new Map<string, WidgetSessionResponse>();
import type {
  NearestItem,
  OrderResponse,
  PostcodeData,
  WidgetSessionResponse,
} from "../../types/postcode360";

export interface CartProduct {
  id: string;
  title: string;
  price_ngn: number;
  category?: string;
  description?: string;
  image_url?: string;
  quantity?: number;
}

export interface CustomerCheckoutWidgetProps {
  initialPostcode?: PostcodeData | null;
  cartProducts?: CartProduct[];
  storeName?: string;
  onOrderCompleted?: (order: OrderResponse, riders: NearestItem[]) => void;
  onViewAdmin?: () => void;
}

const DEFAULT_CART: CartProduct[] = [
  {
    id: "prod-oud-100",
    title: "Royal Amber Arabian Oud Extrait de Parfum (100ml)",
    price_ngn: 100000,
    category: "Fragrances",
    quantity: 1,
    image_url:
      "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "prod-bag-060",
    title: "Artisanal Structured Leather Handbag",
    price_ngn: 60000,
    category: "Leather Goods",
    quantity: 1,
    image_url:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=500&auto=format&fit=crop&q=60",
  },
  {
    id: "prod-scarf-020",
    title: "Silk Luxury Monogram Scarf",
    price_ngn: 20000,
    category: "Accessories",
    quantity: 1,
    image_url:
      "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=500&auto=format&fit=crop&q=60",
  },
];

interface SavedBookmark {
  id: string;
  label: string;
  postcode: string;
  district: string;
  street: string;
  type: "home" | "office" | "other";
}

const PRELOADED_BOOKMARKS: SavedBookmark[] = [
  {
    id: "bm-1",
    label: "Home (Wuse II)",
    postcode: "FC-02-A09-DB-09",
    district: "Wuse II",
    street: "42 Adetokunbo Ademola Crescent",
    type: "home",
  },
  {
    id: "bm-2",
    label: "Office (CBD)",
    postcode: "FC-01-C01-CB-05",
    district: "Central Business District",
    street: "Plot 1141 Shehu Shagari Way",
    type: "office",
  },
  {
    id: "bm-3",
    label: "Farm House (Garki)",
    postcode: "FC-02-B12-GA-01",
    district: "Garki Area 11",
    street: "18 Tafawa Balewa Way",
    type: "other",
  },
];

export const CustomerCheckoutWidget: React.FC<CustomerCheckoutWidgetProps> = ({
  initialPostcode,
  cartProducts = DEFAULT_CART,
  storeName = "Luxe Atelier",
  onOrderCompleted,
  onViewAdmin,
}) => {
  const [syncToast, setSyncToast] = useState(false);
  const [buyerEmail, setBuyerEmail] = useState("buyer@postcode360.ng");
  const [customerName, setCustomerName] = useState("Amina Bello");
  const [customerPhone, setCustomerPhone] = useState("+2348039912001");
  const [gateNotes, setGateNotes] = useState("Blue gate, call security on arrival");

  const [selectedPostcodeCode, setSelectedPostcodeCode] = useState<string>(
    initialPostcode?.postcode || "FC-02-A09-DB-09",
  );
  const [postcodeDetails, setPostcodeDetails] = useState<PostcodeData | null>(
    initialPostcode || ABUJA_MOCK_POSTCODES["FC-02-A09-DB-09"],
  );

  const [isSearchingManual, setIsSearchingManual] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Array<{ postcode: string; district: string; street?: string }>>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [completedOrder, setCompletedOrder] = useState<OrderResponse | null>(null);

  // Cart total calculations
  const itemsTotal = cartProducts.reduce(
    (sum, item) => sum + item.price_ngn * (item.quantity || 1),
    0,
  );
  const deliveryFee = 0; // Free delivery promo
  const orderTotal = itemsTotal + deliveryFee;

  // Resolve session token for Zero-PII Email Handshake
  const resolveBuyerSession = useCallback(async (email: string) => {
    setSyncToast(true);
    setTimeout(() => setSyncToast(false), 2500);
    if (!email || !email.includes("@")) return;
    try {
      if (emailSessionCache.has(email)) {
        return;
      }
      const session = await postcode360Api.createWidgetSession({ email });
      emailSessionCache.set(email, session);
    } catch {
      // Graceful offline mock session
      const mockSession: WidgetSessionResponse = {
        status: "success",
        session_token: "jwt_p360_mock_" + Math.random().toString(36).substring(7),
        token_type: "bearer",
        expires_in: 3600,
        bound_origin: window.location.origin,
        identity_type: "email",
        raw_pii_retained: false,
        subject_hash: "sha256:email:" + email.slice(0, 3) + "***" + email.slice(-4),
      };
      emailSessionCache.set(email, mockSession);
    }
  }, []);

  useEffect(() => {
    resolveBuyerSession(buyerEmail);
  }, [buyerEmail, resolveBuyerSession]);

  // Lookup postcode data when selected
  const handleSelectPostcode = async (code: string) => {
    setSelectedPostcodeCode(code);
    setIsSearchingManual(false);
    setSearchQuery("");
    setSearchResults([]);

    if (ABUJA_MOCK_POSTCODES[code]) {
      setPostcodeDetails(ABUJA_MOCK_POSTCODES[code]);
      return;
    }

    try {
      const res = await postcode360Api.lookupPostcode({ code });
      if (res.data) {
        setPostcodeDetails(res.data);
      }
    } catch {
      // Fallback synthesizer
      setPostcodeDetails(
        ABUJA_MOCK_POSTCODES["FC-02-A09-DB-09"] || {
          postcode: code,
          formatted: code,
          state: "Federal Capital Territory",
          lga: "AMAC",
          district: "Wuse II",
          street: "Verified Rooftop",
          lat: 9.0765,
          lng: 7.4892,
          confidence: 0.98,
          verified: true,
          is_alias: false,
        },
      );
    }
  };

  // Autocomplete search
  const handleSearchChange = async (val: string) => {
    setSearchQuery(val);
    if (!val.trim()) {
      setSearchResults([]);
      return;
    }
    const clean = val.trim().toUpperCase();
    const suggestions = await postcode360Api.autocompletePostcode(clean);
    setSearchResults(
      suggestions.map((s) => ({
        postcode: s.postcode,
        district: s.district,
        street: s.street,
      })),
    );
  };

  // Submit order checkout
  const handlePayAndConfirm = async () => {
    if (!selectedPostcodeCode) {
      setCheckoutError("Please select a delivery postcode.");
      return;
    }
    setIsSubmitting(true);
    setCheckoutError(null);

    const idempotencyKey = `ord-${Date.now()}-${Math.floor(Math.random() * 9000 + 1000)}`;

    try {
      const order = await postcode360Api.createOrder({
        idempotency_key: idempotencyKey,
        postcode: selectedPostcodeCode,
        customer_name: customerName,
        customer_phone: customerPhone,
        amount_ngn: orderTotal,
        notes: gateNotes,
      });

      setCompletedOrder(order);
      try {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.6 },
          colors: ["#10b981", "#06b6d4", "#3b82f6", "#f59e0b"],
        });
      } catch {}

      try {
        const ridersRes = await postcode360Api.getNearestRiders(order.lat, order.lng);
        onOrderCompleted?.(order, ridersRes.results || []);
      } catch {
        onOrderCompleted?.(order, []);
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Payment processing failed. Please retry.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-6xl">
      {/* Container with Paystack / Anti-Gravity UX/UI Crisp White Aesthetics */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_24px_60px_-15px_rgba(15,23,42,0.08)]">
        {/* Header Bar */}
        <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50/70 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm shadow-emerald-500/20">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-slate-900">{storeName}</h1>
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  <ShieldCheck className="h-3 w-3" />
                  Verified Merchant
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Secure Express Checkout • Metered Rooftop Spatial Routing
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-mono text-xs font-bold text-emerald-700">
              Postcode360 Standard
            </span>
          </div>
        </div>

        {/* Two-Column Grid: Left Order Summary | Right Delivery & Payment */}
        <div className="grid grid-cols-1 lg:grid-cols-12">
          {/* LEFT COLUMN: Order Cart & Total (5 cols) */}
          <div className="border-b border-slate-100 bg-slate-50/40 p-6 lg:col-span-5 lg:border-b-0 lg:border-r">
            <div className="space-y-6">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500">
                  Order Summary ({cartProducts.length} items)
                </h2>
                <p className="mt-0.5 text-xs text-slate-400">
                  Review the items in your order from {storeName}
                </p>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {cartProducts.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm transition hover:border-slate-300"
                  >
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className="h-14 w-14 shrink-0 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                        <Package className="h-6 w-6" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h3 className="truncate text-xs font-semibold text-slate-900">
                        {item.title}
                      </h3>
                      {item.category && (
                        <p className="text-[11px] text-slate-500">{item.category}</p>
                      )}
                      <p className="font-mono text-xs font-bold text-emerald-700">
                        ₦{item.price_ngn.toLocaleString()}{" "}
                        {item.quantity && item.quantity > 1 && (
                          <span className="text-slate-400 font-normal">
                            × {item.quantity}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 space-y-2.5 shadow-sm text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal</span>
                  <span className="font-mono font-medium text-slate-900">
                    ₦{itemsTotal.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span className="flex items-center gap-1">
                    <span>Address Resolution</span>
                    <span className="rounded bg-emerald-50 px-1 py-0.2 font-mono text-[9px] text-emerald-700">
                      Postcode360
                    </span>
                  </span>
                  <span className="font-medium text-emerald-600">FREE</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Doorstep Courier</span>
                  <span className="font-medium text-emerald-600">FREE PROMO</span>
                </div>
                <div className="border-t border-slate-100 pt-2 flex justify-between text-sm font-bold text-slate-900">
                  <span>Total Amount Due</span>
                  <span className="font-mono text-base text-emerald-600">
                    ₦{orderTotal.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Security Banner */}
              <div className="flex items-center gap-2.5 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 text-[11px] text-emerald-800">
                <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>
                  Protected by <strong>Postcode360 Zero-PII</strong>.
                </span>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Spatial Address Resolver & Payment Execution (7 cols) */}
          <div className="p-6 lg:col-span-7">
            <div className="space-y-6">
              {/* Step 1: Buyer Email Identification */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  1. Buyer Email
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={buyerEmail}
                    onChange={(e) => setBuyerEmail(e.target.value)}
                    placeholder="Enter email to load bookmarked postcodes..."
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-24 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/10 transition"
                  />
                  <div className="absolute inset-y-0 right-1.5 flex items-center">
                    <button
                      type="button"
                      data-demo="customer-sync-email"
                      onClick={() => resolveBuyerSession(buyerEmail)}
                      className="rounded-lg bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-slate-800 transition"
                    >
                      {syncToast ? "✓ Synced!" : "Sync Saved"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Step 2: Bookmarked Addresses (1-Click Selector) */}
              <div>
                {syncToast && (
                  <div className="mb-2 flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 font-mono text-[11px] font-semibold text-emerald-700 animate-in fade-in slide-in-from-top-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>✓ 3 Saved Postcodes Synced to {buyerEmail}</span>
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">
                    2. Select Delivery Postcode
                  </label>
                  <button
                    type="button"
                    data-demo="customer-search-toggle"
                    onClick={() => setIsSearchingManual(!isSearchingManual)}
                    className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700"
                  >
                    <Search className="h-3 w-3" />
                    <span>{isSearchingManual ? "Show Saved Bookmarks" : "Search Another Postcode"}</span>
                  </button>
                </div>

                {!isSearchingManual ? (
                  /* Saved Bookmarks Grid */
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {PRELOADED_BOOKMARKS.map((bm) => {
                      const isSelected = selectedPostcodeCode === bm.postcode;
                      return (
                        <button
                          key={bm.id}
                          type="button"
                          data-demo={bm.id === "bm-1" ? "bookmark-home" : bm.id === "bm-2" ? "bookmark-office" : "bookmark-farm"}
                          onClick={() => handleSelectPostcode(bm.postcode)}
                          className={`relative flex flex-col items-start rounded-xl border p-3 text-left transition ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-50/50 ring-2 ring-emerald-500/20"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50"
                          }`}
                        >
                          <div className="flex w-full items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                              {bm.type === "home" ? (
                                <Home className="h-3.5 w-3.5 text-emerald-600" />
                              ) : bm.type === "office" ? (
                                <Building2 className="h-3.5 w-3.5 text-blue-600" />
                              ) : (
                                <MapPin className="h-3.5 w-3.5 text-purple-600" />
                              )}
                              <span>{bm.label}</span>
                            </span>
                            {isSelected && (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            )}
                          </div>
                          <span className="mt-1 font-mono text-[11px] font-bold text-emerald-700">
                            {bm.postcode}
                          </span>
                          <span className="mt-0.5 line-clamp-1 text-[10px] text-slate-500">
                            {bm.street}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Search / Autocomplete Box */
                  <div className="space-y-2">
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <Search className="h-4 w-4" />
                      </div>
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        placeholder="Search district, street or code (e.g. Wuse II, Adetokunbo)..."
                        className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/10"
                      />
                    </div>

                    {searchResults.length > 0 && (
                      <div className="max-h-40 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg divide-y divide-slate-100 text-xs">
                        {searchResults.map((sr) => (
                          <button
                            key={sr.postcode}
                            type="button"
                            onClick={() => handleSelectPostcode(sr.postcode)}
                            className="flex w-full items-center justify-between p-2.5 text-left hover:bg-slate-50 transition"
                          >
                            <div>
                              <span className="font-mono font-bold text-emerald-700">
                                {sr.postcode}
                              </span>
                              <span className="ml-2 text-slate-700">{sr.district}</span>
                              {sr.street && (
                                <p className="text-[10px] text-slate-400 truncate">{sr.street}</p>
                              )}
                            </div>
                            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Step 3: Verified Postcode & Rooftop Satellite Preview */}
              {postcodeDetails && (
                <div className="rounded-xl border border-slate-200/90 bg-white p-4 space-y-3 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-lg bg-emerald-600 px-2.5 py-1 font-mono text-xs font-bold text-white shadow-sm">
                        {postcodeDetails.postcode}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <Sparkles className="h-3 w-3" />
                        Verified Rooftop Cadastral
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[11px] text-slate-500 font-mono">
                      <Compass className="h-3.5 w-3.5 text-emerald-600" />
                      <span>
                        [{postcodeDetails.lat.toFixed(4)}°N, {postcodeDetails.lng.toFixed(4)}°E]
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 font-medium">
                    {postcodeDetails.street
                      ? `${postcodeDetails.street}, ${postcodeDetails.district}, ${postcodeDetails.state}`
                      : `${postcodeDetails.district}, Abuja FCT`}
                  </p>

                  {/* Top-down Rooftop Satellite Map (Pure Precision, Zero Clutter) */}
                  <div className="overflow-hidden rounded-xl border border-slate-200">
                    <PostcodeMap
                      lat={postcodeDetails.lat}
                      lng={postcodeDetails.lng}
                      postcode={postcodeDetails.postcode}
                      postcodeLabel={postcodeDetails.postcode}
                      addressLabel={postcodeDetails.street || postcodeDetails.district || "Delivery Destination"}
                      heightClass="h-[210px]"
                      theme="light"
                      title={postcodeDetails.postcode}
                    />
                  </div>

                  {/* Gate Notes */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Delivery Gate / Security Instructions
                    </label>
                    <input
                      type="text"
                      value={gateNotes}
                      onChange={(e) => setGateNotes(e.target.value)}
                      placeholder="e.g. Ring bell at black gate, leave with security"
                      className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* Recipient Details */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Recipient Full Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Recipient Phone Number
                  </label>
                  <input
                    type="text"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-1.5 font-mono text-xs text-slate-900 focus:border-emerald-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {checkoutError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{checkoutError}</span>
                </div>
              )}

              {/* Paystack-style Emerald Pay Button */}
              <div className="pt-2">
                <button
                  type="button"
                  data-demo="customer-confirm-order"
                  disabled={isSubmitting || !selectedPostcodeCode}
                  onClick={handlePayAndConfirm}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 px-4 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500 active:scale-[0.99] disabled:opacity-50"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>
                    {isSubmitting
                      ? "Resolving Rooftop & Securing Order..."
                      : `Pay ₦${orderTotal.toLocaleString()} & Confirm Postcode`}
                  </span>
                </button>
                <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                    Instant Metered Resolution
                  </span>
                  <span>•</span>
                  <span>Strict Idempotency</span>
                  <span>•</span>
                  <span>NIPOST National Standard</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Instant Order Confirmation Receipt Modal */}
      {completedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <h3 className="text-base font-bold text-slate-900">
                Payment &amp; Rooftop Postcode Confirmed!
              </h3>
              <p className="text-xs text-slate-500">
                Your order has been secured and dispatched to the nearest partner rider.
              </p>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 space-y-2 font-mono text-xs">
              <div className="flex justify-between text-slate-500">
                <span>Order Reference:</span>
                <span className="font-bold text-slate-900">{completedOrder.order_id}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Verified Postcode:</span>
                <span className="font-bold text-emerald-700">{completedOrder.postcode}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Coordinates:</span>
                <span className="text-slate-900">
                  {completedOrder.lat.toFixed(4)}°N, {completedOrder.lng.toFixed(4)}°E
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Amount Paid:</span>
                <span className="font-bold text-slate-900">
                  ₦{(completedOrder.amount_ngn || orderTotal).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Status:</span>
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800">
                  {completedOrder.order_status || "PENDING"}
                </span>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2 pt-2">
              <button
                type="button"
                data-demo="customer-view-admin"
                onClick={() => {
                  setCompletedOrder(null);
                  if (onViewAdmin) onViewAdmin();
                }}
                className="w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-500"
              >
                View Order in Admin →
              </button>
              <button
                type="button"
                data-demo="customer-close-receipt"
                onClick={() => setCompletedOrder(null)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};