// src/components/checkout/PiiSessionCard.tsx
import React, { useEffect, useState } from "react";
import {
  ShieldCheck,
  Lock,
  KeyRound,
  Mail,
  AlertCircle,
  Globe,
} from "lucide-react";
import { postcode360Api, DEFAULT_PUBLISHABLE_KEY } from "../../services/api";
import type { WidgetSessionResponse } from "../../types/postcode360";

interface PiiSessionCardProps {
  session: WidgetSessionResponse | null;
  onSessionCreated: (session: WidgetSessionResponse) => void;
}

export const PiiSessionCard: React.FC<PiiSessionCardProps> = ({
  session,
  onSessionCreated,
}) => {
  const [mode, setMode] = useState<"nin" | "email">("nin");
  const [nin, setNin] = useState("12345678901");
  const [email, setEmail] = useState("customer@postcode360.ng");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runHandshake = async (selectedMode: "nin" | "email") => {
    setLoading(true);
    setError(null);
    try {
      const res = await postcode360Api.createWidgetSession({
        publishable_key: DEFAULT_PUBLISHABLE_KEY,
        nin: selectedMode === "nin" ? nin : null,
        email: selectedMode === "email" ? email : null,
      });
      onSessionCreated(res);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Widget session handshake failed",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!session) {
      runHandshake("nin");
    }
  }, []);

  const handleHandshake = async (e: React.FormEvent) => {
    e.preventDefault();
    await runHandshake(mode);
  };

  return (
    <section className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0c1017] p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span className="flex h-6 w-6 items-center justify-center rounded-full border border-violet-500/40 bg-violet-500/20 font-mono text-xs font-bold text-violet-300">
            1
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              Zero-PII Widget Session Handshake
            </h2>
            <p className="font-mono text-[11px] text-zinc-400">
              POST /v1/widget/session • Origin-bound JWT
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[11px] text-emerald-300">
          <ShieldCheck className="h-3.5 w-3.5" /> Zero Raw PII
        </span>
      </div>

      {/* Mode Switcher: NIN vs Email */}
      <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] p-1">
        <button
          type="button"
          onClick={() => setMode("nin")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
            mode === "nin"
              ? "border border-violet-500/40 bg-violet-500/25 text-violet-200"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <KeyRound className="h-3.5 w-3.5 text-violet-400" />
          11-Digit NIN Verification
        </button>
        <button
          type="button"
          onClick={() => setMode("email")}
          className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-medium transition ${
            mode === "email"
              ? "border border-violet-500/40 bg-violet-500/25 text-violet-200"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Mail className="h-3.5 w-3.5 text-cyan-400" />
          Shopper Email Address
        </button>
      </div>

      <form onSubmit={handleHandshake} className="space-y-2.5">
        <label className="block text-xs font-medium text-slate-700 dark:text-zinc-300">
          {mode === "nin"
            ? "Enter 11-Digit NIMC National Identification Number (NIN)"
            : "Enter Shopper Email Address"}
        </label>
        <div className="flex gap-2">
          {mode === "nin" ? (
            <input
              type="text"
              maxLength={11}
              value={nin}
              onChange={(e) => setNin(e.target.value.replace(/\D/g, ""))}
              placeholder="12345678901"
              className="flex-1 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#111625] px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus:border-violet-400 focus:outline-none"
              required
            />
          ) : (
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@postcode360.ng"
              className="flex-1 rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-[#111625] px-3.5 py-2.5 font-mono text-sm text-slate-900 dark:text-white focus:border-violet-400 focus:outline-none"
              required
            />
          )}

          <button
            type="submit"
            data-demo="dev-verify-session"
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-violet-600/25 transition hover:bg-violet-500 disabled:opacity-50"
          >
            <KeyRound className="h-3.5 w-3.5" />
            <span>{loading ? "Hashing..." : "Verify & Unlock"}</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-zinc-500">
          <span className="rounded border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#111625] px-2 py-0.5 text-zinc-400">
            {DEFAULT_PUBLISHABLE_KEY}
          </span>
          <span className="flex items-center gap-1">
            <Globe className="h-3 w-3 text-cyan-400" />
            Origin: {window.location.origin}
          </span>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </form>

      {/* Security Verification Telemetry Badge */}
      {session && (
        <div className="space-y-2 rounded-xl border border-emerald-500/30 bg-[#08080A] p-3.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
              <Lock className="h-3.5 w-3.5" />
              Origin-Bound Session Active ({session.identity_type.toUpperCase()}
              )
            </span>
            <span className="rounded border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] text-emerald-300">
              {session.session_token.slice(0, 18)}... • JWT
            </span>
          </div>

          <div className="space-y-1 font-mono text-[11px]">
            <div className="flex items-center justify-between text-zinc-400">
              <span>HMAC-SHA256 subject_hash:</span>
              <span className="text-cyan-300">raw_pii_retained: false</span>
            </div>
            <div className="select-all break-all rounded border border-white/5 bg-[#111116] p-2 text-emerald-300">
              {session.subject_hash}
            </div>
            <div className="flex items-center justify-between pt-1 text-[10px] text-zinc-400">
              <span>Bound Origin: {session.bound_origin}</span>
              <span>TTL: {session.expires_in}s</span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
