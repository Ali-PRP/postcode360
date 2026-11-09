// src/components/storefront/SocialStorefront.tsx
import React, { useState } from "react";
import {
  Link as LinkIcon,
  Check,
  Share2,
  Plus,
  MapPin,
  Bookmark,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Store,
  CreditCard,
  Mail,
} from "lucide-react";
import { postcode360Api } from "../../services/api";
import type {
  NearestItem,
  OrderResponse,
  StorefrontProduct,
} from "../../types/postcode360";

interface SocialStorefrontProps {
  onOrderCreated?: (order: OrderResponse, riders: NearestItem[]) => void;
  onOpenAdmin?: () => void;
}

const INITIAL_PRODUCTS: StorefrontProduct[] = [
  {
    id: "prd-wig-01",
    title: '30" Bone Straight Raw Vietnamese Double Drawn',
    price_ngn: 600000,
    category: "Hair & Luxury Wigs",
    description: "Grade 13A bone straight hair, heat-resistant, silky sheen with natural luster. Ethically sourced Vietnamese double drawn.",
    image_url: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&auto=format&fit=crop&q=80",
    stock_count: 8,
    vendor_name: "Luxe Atelier",
    vendor_handle: "@luxeatelier.ng",
    vendor_phone: "+2348039912001",
  },
  {
    id: "prd-bag-02",
    title: "Artisanal Structured Leather Handbag",
    price_ngn: 60000,
    category: "Leather Goods",
    description: "Handcrafted Italian calf leather with brushed gold hardware, protective metal feet, and adjustable shoulder strap.",
    image_url: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=600&auto=format&fit=crop&q=80",
    stock_count: 14,
    vendor_name: "Luxe Atelier",
    vendor_handle: "@luxeatelier.ng",
    vendor_phone: "+2348039912001",
  },
  {
    id: "prd-oud-03",
    title: "Royal Amber Arabian Oud Extrait de Parfum (100ml)",
    price_ngn: 100000,
    category: "Fragrances",
    description: "Smoky Cambodian agarwood infused with taif rose, frankincense, and warm amber crystal. Exceptional 24-hour longevity.",
    image_url: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&auto=format&fit=crop&q=80",
    stock_count: 22,
    vendor_name: "Luxe Atelier",
    vendor_handle: "@luxeatelier.ng",
    vendor_phone: "+2348039912001",
  },
  {
    id: "prd-scarf-04",
    title: "Silk Luxury Monogram Scarf",
    price_ngn: 20000,
    category: "Accessories",
    description: "100% pure mulberry silk twill with hand-rolled edges and subtle monogram motif.",
    image_url: "https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=600&auto=format&fit=crop&q=80",
    stock_count: 30,
    vendor_name: "Luxe Atelier",
    vendor_handle: "@luxeatelier.ng",
    vendor_phone: "+2348039912001",
  },
];

export const SocialStorefront: React.FC<SocialStorefrontProps> = ({
  onOrderCreated,
  onOpenAdmin,
}) => {
  // Vendor catalog state
  const [products, setProducts] = useState<StorefrontProduct[]>(INITIAL_PRODUCTS);
  const [vendorName] = useState("Luxe Atelier");
  const [vendorHandle] = useState("@luxeatelier.ng");
  const [copiedLink, setCopiedLink] = useState<string | null>(null);

  // New product form modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("Fashion");
  const [newDescription, setNewDescription] = useState("");

  // Customer Checkout Modal / Interactive Payment Flow
  const [checkoutProduct, setCheckoutProduct] = useState<StorefrontProduct | null>(null);
  const [customerEmail, setCustomerEmail] = useState("amira@postcode360.ng");
  const [customerName, setCustomerName] = useState("Amira Bello");
  const [customerPhone, setCustomerPhone] = useState("+2348031234567");
  const [selectedPostcode, setSelectedPostcode] = useState<string>("FC-02-A09-DB-09");
  const [postcodeMode, setPostcodeMode] = useState<"bookmarked" | "custom">("bookmarked");
  const [customPostcode, setCustomPostcode] = useState("");

  // Bookmarks for email
  const [bookmarkedList, setBookmarkedList] = useState<
    Array<{ postcode: string; label: string; address: string; district: string }>
  >([
    {
      postcode: "FC-02-A09-DB-09",
      label: "Home",
      address: "42 Adetokunbo Ademola Crescent",
      district: "Wuse II, Abuja",
    },
    {
      postcode: "FC-01-C01-CB-05",
      label: "Office / CBD",
      address: "Plot 1141 Shehu Shagari Way",
      district: "Central Business District, Abuja",
    },
    {
      postcode: "FC-01-M04-MA-03",
      label: "Family Villa",
      address: "9 Yedseram / Aguiyi Ironsi Street",
      district: "Maitama, Abuja",
    },
    {
      postcode: "FC-03-J07-JB-11",
      label: "Boutique Studio",
      address: "25 Bala Sokoto Way, Jabi Lakefront",
      district: "Jabi, Abuja",
    },
  ]);

  // Order submission
  const [isPaying, setIsPaying] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<OrderResponse | null>(null);
  const [assignedRider, setAssignedRider] = useState<NearestItem | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const handleCopyLink = (text: string, label: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedLink(label);
    setTimeout(() => setCopiedLink(null), 2200);
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newPrice.trim()) return;

    const product: StorefrontProduct = {
      id: `prd-${Date.now().toString(36)}`,
      title: newTitle.trim(),
      price_ngn: parseFloat(newPrice) || 5000,
      category: newCategory,
      description: newDescription.trim() || "Handcrafted premium item with spatial delivery.",
      image_url: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80",
      stock_count: 10,
      vendor_name: vendorName,
      vendor_handle: vendorHandle,
      vendor_phone: "+2348035550192",
    };

    setProducts([product, ...products]);
    setNewTitle("");
    setNewPrice("");
    setNewDescription("");
    setShowAddModal(false);
  };

  // When email changes, provide instant bookmarked postcodes
  const handleEmailChange = (val: string) => {
    setCustomerEmail(val);
    const clean = val.toLowerCase().trim();
    if (clean.includes("lagos") || clean.includes("ikeja")) {
      setBookmarkedList([
        {
          postcode: "LA-11-W06-TC-10",
          label: "Lagos Office",
          address: "10 TC Close, W06 District",
          district: "Victoria Island, Lagos",
        },
        {
          postcode: "LA-11-U34-ZR-63",
          label: "Residence",
          address: "63 ZR Avenue, U34 District",
          district: "Ikeja, Lagos",
        },
      ]);
      setSelectedPostcode("LA-11-W06-TC-10");
    } else if (clean.includes("kano")) {
      setBookmarkedList([
        {
          postcode: "KN-31-F82-WJ-80",
          label: "Kano Workshop",
          address: "80 WJ Road, F82 District",
          district: "Nassarawa, Kano",
        },
        {
          postcode: "FC-02-A09-DB-09",
          label: "Abuja Branch",
          address: "42 Adetokunbo Ademola Crescent",
          district: "Wuse II, Abuja",
        },
      ]);
      setSelectedPostcode("KN-31-F82-WJ-80");
    } else {
      setBookmarkedList([
        {
          postcode: "FC-02-A09-DB-09",
          label: "Home",
          address: "42 Adetokunbo Ademola Crescent",
          district: "Wuse II, Abuja",
        },
        {
          postcode: "FC-01-C01-CB-05",
          label: "Office / CBD",
          address: "Plot 1141 Shehu Shagari Way",
          district: "Central Business District, Abuja",
        },
        {
          postcode: "FC-01-M04-MA-03",
          label: "Family Villa",
          address: "9 Yedseram / Aguiyi Ironsi Street",
          district: "Maitama, Abuja",
        },
        {
          postcode: "FC-03-J07-JB-11",
          label: "Boutique Studio",
          address: "25 Bala Sokoto Way, Jabi Lakefront",
          district: "Jabi, Abuja",
        },
      ]);
      setSelectedPostcode("FC-02-A09-DB-09");
    }
  };

  const handleLaunchCheckout = (product: StorefrontProduct) => {
    setCheckoutProduct(product);
    setCompletedOrder(null);
    setAssignedRider(null);
    setCheckoutError(null);
  };

  const handleExecutePayment = async () => {
    if (!checkoutProduct) return;
    const finalCode = postcodeMode === "bookmarked" ? selectedPostcode : customPostcode.trim();
    if (!finalCode) {
      setCheckoutError("Please select or enter a valid Postcode360 delivery address.");
      return;
    }

    setIsPaying(true);
    setCheckoutError(null);

    try {
      const idempotencyKey = `storefront-${checkoutProduct.id.slice(4, 10)}-${Date.now().toString(36)}`;
      const order = await postcode360Api.createOrder({
        idempotency_key: idempotencyKey,
        postcode: finalCode,
        customer_name: customerName,
        customer_phone: customerPhone,
        amount_ngn: checkoutProduct.price_ngn, // Product + Delivery fee
        notes: `Social Storefront Order • ${checkoutProduct.title} • Customer Email: ${customerEmail}`,
      });

      setCompletedOrder(order);

      // Find nearest rider
      const nearestRes = await postcode360Api.getNearestRiders(order.lat, order.lng);
      if (nearestRes.results.length > 0) {
        setAssignedRider(nearestRes.results[0]);
      }

      if (onOrderCreated) {
        onOrderCreated(order, nearestRes.results);
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : "Payment submission failed");
    } finally {
      setIsPaying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Vendor Profile & No-Code Storefront Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] p-5 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
            <Store className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold text-slate-900 dark:text-white sm:text-lg">
                {vendorName}
              </h1>
              <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3 w-3" /> Postcode360 Verified
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {vendorHandle} • Vendor Catalog &amp; Instant Spatial Payment Links
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleCopyLink(`https://postcode360.ng/store/luxe-atelier-abj`, "store-link")}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] px-3 py-2 font-mono text-xs text-slate-700 dark:text-zinc-300 transition hover:bg-slate-100 dark:hover:bg-white/10"
          >
            {copiedLink === "store-link" ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                <span>Copied Store Link!</span>
              </>
            ) : (
              <>
                <Share2 className="h-3.5 w-3.5 text-slate-400" />
                <span>Share Store Link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-600"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {products.map((item) => {
          const productLink = `https://postcode360.ng/store/luxe-atelier-abj`;
          const paymentLink = `https://postcode360.ng/pay/luxe-atelier-abj/${item.id}`;
          const isCopiedProd = copiedLink === `prod-${item.id}`;
          const isCopiedPay = copiedLink === `pay-${item.id}`;

          return (
            <div
              key={item.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] shadow-sm transition hover:border-emerald-500/40 hover:shadow-md"
            >
              {/* Product Visual Banner */}
              <div className="relative h-44 w-full overflow-hidden bg-slate-100 dark:bg-zinc-900">
                <img
                  src={item.image_url}
                  alt={item.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute left-3 top-3">
                  <span className="rounded-full bg-slate-900/80 px-2.5 py-1 font-mono text-[10px] font-semibold text-white backdrop-blur-md">
                    {item.category}
                  </span>
                </div>
                <div className="absolute bottom-3 right-3">
                  <span className="rounded-lg bg-emerald-500 px-2 py-0.5 font-mono text-xs font-bold text-white shadow-md">
                    ₦{item.price_ngn.toLocaleString()}
                  </span>
                </div>
              </div>

              {/* Product Info */}
              <div className="flex flex-1 flex-col p-4">
                <h3 className="line-clamp-1 text-sm font-semibold text-slate-900 dark:text-white">
                  {item.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-zinc-400">
                  {item.description}
                </p>

                {/* Instant Link Generation Buttons */}
                <div className="mt-4 space-y-2 border-t border-slate-100 dark:border-white/5 pt-3">
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                    <button
                      type="button"
                      onClick={() => handleCopyLink(productLink, `prod-${item.id}`)}
                      className="flex items-center justify-center gap-1 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] py-1.5 text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-white/10"
                      title="Copy shareable product catalog link"
                    >
                      {isCopiedProd ? (
                        <>
                          <Check className="h-3 w-3 text-emerald-500" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <LinkIcon className="h-3 w-3 text-slate-400" />
                          <span>Product Link</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyLink(paymentLink, `pay-${item.id}`)}
                      className="flex items-center justify-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 py-1.5 font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                      title="Generate direct checkout payment link for bio / WhatsApp"
                    >
                      {isCopiedPay ? (
                        <>
                          <Check className="h-3 w-3" />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-3 w-3" />
                          <span>Payment Link</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Primary CTA: Launch Interactive Checkout */}
                  <button
                    type="button"
                    onClick={() => handleLaunchCheckout(item)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-slate-900 dark:bg-white py-2 text-xs font-semibold text-white dark:text-slate-950 transition hover:bg-slate-800 dark:hover:bg-zinc-200"
                  >
                    <span>Open Checkout View</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-emerald-500" />
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  Add Catalog Item
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddProduct} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                  Product Title
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="e.g. Royal Silk Abaya, Leather Mules..."
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                    Price (₦ NGN)
                  </label>
                  <input
                    type="number"
                    required
                    value={newPrice}
                    onChange={(e) => setNewPrice(e.target.value)}
                    placeholder="28500"
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] px-3 py-2 font-mono text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                    Category
                  </label>
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Fashion, Beauty..."
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Short description for social media buyers..."
                  className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-xl px-4 py-2 text-xs font-medium text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-600"
                >
                  Save &amp; Generate Links
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Customer Payment Link View / Postcode Checkout Modal */}
      {checkoutProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-md">
          <div className="relative my-8 w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 dark:border-white/15 bg-white dark:bg-[#0c1017] shadow-2xl">
            {/* Payment Header */}
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-[#111625] px-6 py-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-500">
                  <CreditCard className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400 font-semibold">
                      Direct Payment Link Checkout
                    </span>
                    <span className="rounded bg-violet-500/15 px-1.5 py-0.2 font-mono text-[9px] font-semibold text-violet-600 dark:text-violet-400">
                      Zero-PII
                    </span>
                  </div>
                  <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                    {checkoutProduct.vendor_name}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCheckoutProduct(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {/* Product Summary */}
              <div className="flex items-center justify-between rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625]/60 p-4">
                <div className="flex items-center gap-3">
                  <img
                    src={checkoutProduct.image_url}
                    alt={checkoutProduct.title}
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {checkoutProduct.title}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-zinc-400">
                      Standard Express Spatial Dispatch • Abuja FCT
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    ₦{checkoutProduct.price_ngn.toLocaleString()}
                  </div>
                  <div className="font-mono text-[11px] text-slate-400">
                    + ₦1,500 Delivery
                  </div>
                </div>
              </div>

              {/* Requirement 8 Core: Input email or postcode, display bookmarked postcodes */}
              <div className="space-y-3 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#111625] p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bookmark className="h-4 w-4 text-emerald-500" />
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                      Delivery Postcode &amp; Identity
                    </label>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-zinc-400">
                    NIPOST 3-Tier Spatial Resolution
                  </span>
                </div>

                {/* Customer Email Input */}
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                    Enter Customer Email (to retrieve saved bookmarks)
                  </label>
                  <div className="mt-1 relative">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="email"
                      value={customerEmail}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      placeholder="e.g. amira@postcode360.ng"
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0c1017] py-2 pl-9 pr-3 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                    All bookmarked delivery locations linked to this email appear below for 1-click selection:
                  </p>
                </div>

                {/* Postcode Mode Switcher */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPostcodeMode("bookmarked")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                      postcodeMode === "bookmarked"
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40"
                        : "border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Saved Postcodes ({bookmarkedList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPostcodeMode("custom")}
                    className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${
                      postcodeMode === "custom"
                        ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40"
                        : "border border-slate-200 dark:border-white/10 text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    Enter Custom Postcode
                  </button>
                </div>

                {/* Display Bookmarked Postcodes associated with email */}
                {postcodeMode === "bookmarked" ? (
                  <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                    {bookmarkedList.map((bm) => {
                      const isSelected = selectedPostcode === bm.postcode;
                      return (
                        <button
                          key={bm.postcode}
                          type="button"
                          onClick={() => setSelectedPostcode(bm.postcode)}
                          className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition ${
                            isSelected
                              ? "border-emerald-500 bg-emerald-500/10 text-slate-900 dark:text-white"
                              : "border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-[#0c1017]/70 text-slate-700 dark:text-zinc-300 hover:border-emerald-500/40"
                          }`}
                        >
                          <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                            isSelected ? "bg-emerald-500 text-white" : "bg-slate-200 dark:bg-white/10 text-slate-500 dark:text-zinc-400"
                          }`}>
                            <MapPin className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-xs text-slate-900 dark:text-white">
                                {bm.label}
                              </span>
                              {isSelected && (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                              )}
                            </div>
                            <div className="font-mono text-[11px] font-bold text-emerald-600 dark:text-emerald-400 truncate">
                              {bm.postcode}
                            </div>
                            <div className="truncate text-[10px] text-slate-500 dark:text-zinc-400">
                              {bm.district}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="pt-1">
                    <input
                      type="text"
                      value={customPostcode}
                      onChange={(e) => setCustomPostcode(e.target.value.toUpperCase())}
                      placeholder="e.g. FC-02-A09-DB-09"
                      className="w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#0c1017] px-3.5 py-2 font-mono text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Customer Contact Details */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                    Recipient Full Name
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] px-3 py-2 text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
                    Mobile Phone (Rider Dispatch SMS)
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] px-3 py-2 font-mono text-xs text-slate-900 dark:text-white focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Error Message */}
              {checkoutError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-400">
                  {checkoutError}
                </div>
              )}

              {/* Order Success Card */}
              {completedOrder && (
                <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Payment Confirmed &amp; Order Dispatched!</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 font-mono text-xs text-slate-700 dark:text-zinc-300">
                    <div>
                      Order ID: <span className="font-bold">{completedOrder.order_id.slice(0, 16)}...</span>
                    </div>
                    <div>
                      Postcode: <span className="font-bold text-emerald-600 dark:text-emerald-400">{completedOrder.postcode}</span>
                    </div>
                    <div>
                      Total Paid: ₦{(completedOrder.amount_ngn || 30000).toLocaleString()}
                    </div>
                    {assignedRider && (
                      <div className="text-cyan-600 dark:text-cyan-400 font-semibold">
                        Rider: {assignedRider.name} (~{Math.round(assignedRider.distance_meters)}m)
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 pt-2">
                    {onOpenAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setCheckoutProduct(null);
                          onOpenAdmin();
                        }}
                        className="rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-600"
                      >
                        Track in Admin Dashboard →
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setCompletedOrder(null)}
                      className="rounded-lg border border-slate-200 dark:border-white/10 px-3 py-1.5 text-xs text-slate-600 dark:text-zinc-400 hover:bg-slate-100 dark:hover:bg-white/5"
                    >
                      Make Another Order
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              {!completedOrder && (
                <div className="flex items-center justify-between border-t border-slate-100 dark:border-white/10 pt-4">
                  <div className="text-xs text-slate-500 dark:text-zinc-400">
                    Total Amount:{" "}
                    <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                      ₦{(checkoutProduct.price_ngn).toLocaleString()}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={isPaying}
                    onClick={handleExecutePayment}
                    className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-emerald-600 disabled:opacity-50"
                  >
                    <CreditCard className="h-4 w-4" />
                    <span>
                      {isPaying ? "Processing..." : `Pay ₦${(checkoutProduct.price_ngn).toLocaleString()}`}
                    </span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SocialStorefront;
