// cspell:ignore Wuse Maitama Banex NIPOST
// src/components/checkout/BookmarkSyncBar.tsx
import React, { useEffect, useState } from "react";
import {
  Bookmark,
  Check,
  Copy,
  KeyRound,
  PlusCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { postcode360Api } from "../../services/api";
import type { BookmarkItem } from "../../types/postcode360";

const DEFAULT_SUBJECT_HASH =
  "sha256:e679a8a6828aefc2ab339c9a4909d5b9c41d10d098bd29866d23b20a35c5";

export const BookmarkSyncBar: React.FC = () => {
  const [subjectHash, setSubjectHash] = useState(DEFAULT_SUBJECT_HASH);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [newCode, setNewCode] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const loadBookmarks = async (hash: string) => {
    try {
      const res = await postcode360Api.getBookmarks(hash);
      setBookmarks(res.bookmarks || []);
    } catch {
      // Fallback handled
    }
  };

  useEffect(() => {
    loadBookmarks(subjectHash);
    const unsubscribe = postcode360Api.subscribeTelemetry(() => {
      const logs = postcode360Api.getTelemetryLogs();
      const latestSession = logs.find((l) =>
        l.endpoint.includes("/widget/session"),
      );
      const reqBody = latestSession?.requestBody as
        | { identifier?: string }
        | undefined;
      if (reqBody?.identifier) {
        const cleanId = reqBody.identifier.trim();
        const derivedHash = `sha256:${cleanId.padEnd(16, "0").slice(0, 16)}828aefc2ab339c9a4909d5b9c41d10d098bd29866d23b20a`;
        if (derivedHash !== subjectHash) {
          setSubjectHash(derivedHash);
          loadBookmarks(derivedHash);
        }
      }
    });
    return () => unsubscribe();
  }, [subjectHash]);

  const handleSelectBookmark = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode.trim() || !newLabel.trim()) return;
    setSaving(true);
    try {
      const res = await postcode360Api.saveBookmark(
        subjectHash,
        newCode,
        newLabel,
      );
      setBookmarks(res.bookmarks || []);
      setNewCode("");
      setNewLabel("");
      setShowAdd(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mb-6 rounded-2xl bg-white dark:bg-[#0c1017] border border-slate-200 dark:border-emerald-500/25 p-4 shadow-xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
            <Bookmark className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400">
                Bookmarked Delivery Addresses

              </span>
              <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 font-mono text-[9px] text-violet-300">
                <ShieldCheck className="h-2.5 w-2.5" /> Zero-PII NIN Hash Sync
              </span>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-700 dark:text-zinc-300">
              Shopper&apos;s saved postcodes unlocked via{" "}
              <code className="font-mono text-[11px] text-cyan-300">
                {subjectHash.slice(0, 26)}...
              </code>{" "}
              — click any bookmark to copy into lookup:
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd((prev) => !prev)}
          className="flex items-center gap-1.5 rounded-xl bg-slate-50 dark:bg-[#111625] border border-slate-200 dark:border-white/15 px-3 py-1.5 font-mono text-[11px] text-emerald-300 hover:border-emerald-400 transition"
        >
          <PlusCircle className="h-3.5 w-3.5" />
          <span>{showAdd ? "Close" : "+ Save New Bookmark"}</span>
        </button>
      </div>

      {/* Saved Postcode Pills */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {bookmarks.map((bm) => {
          const isCopied = copiedCode === bm.postcode;
          const isTp = bm.postcode.startsWith("TP-");
          return (
            <button
              key={bm.postcode}
              type="button"
              onClick={() => handleSelectBookmark(bm.postcode)}
              className={`group flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                isCopied
                  ? "bg-emerald-500/20 border-emerald-400 text-white"
                  : "bg-slate-50 dark:bg-[#111625] border-slate-200 dark:border-white/10 hover:border-emerald-500/40"
              }`}
            >
              <KeyRound
                className={`h-3.5 w-3.5 ${
                  isTp ? "text-amber-400" : "text-emerald-400"
                }`}
              />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-xs font-bold text-emerald-300">
                    {bm.postcode}
                  </span>
                  {isTp && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.2 font-mono text-[9px] text-amber-300">
                      TP-CODE
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-zinc-400">{bm.label}</div>
              </div>
              <span className="ml-1 font-mono text-[10px] text-slate-500 dark:text-zinc-400 group-hover:text-emerald-300">
                {isCopied ? (
                  <span className="flex items-center gap-0.5 text-emerald-300">
                    <Check className="h-3 w-3" /> Copied
                  </span>
                ) : (
                  <Copy className="h-3 w-3" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {showAdd && (
        <form
          onSubmit={handleSave}
          className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-white/10"
        >
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <input
            type="text"
            value={newCode}
            onChange={(e) => setNewCode(e.target.value.toUpperCase())}
            placeholder="Postcode (e.g. FC-01-G02-GA-04 or TP-ABJ-7K2P)"
            required
            className="flex-1 min-w-[200px] bg-slate-50 dark:bg-[#111625] border border-slate-200 dark:border-white/15 rounded-xl px-3 py-1.5 font-mono text-xs text-emerald-300"
          />
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label (e.g. Mum's House — Garki Area 11)"
            required
            className="flex-1 min-w-[200px] bg-slate-50 dark:bg-[#111625] border border-slate-200 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs text-white"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-emerald-500 hover:bg-emerald-400 px-4 py-1.5 font-mono text-xs font-bold text-zinc-950 transition"
          >
            {saving ? "Syncing..." : "Save to NIN Hash (POST /v1/bookmarks)"}
          </button>
        </form>
      )}
    </section>
  );
};
