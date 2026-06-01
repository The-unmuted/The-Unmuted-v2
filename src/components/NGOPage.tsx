/**
 * NGO Directory page.
 * Two inner tabs:
 *   Browse — category chips + location text filter → NGO cards
 *   Apply  — form to apply for directory listing
 *
 * Also exports NGOSuggestionSheet — shown after "I'm Safe" SOS flow.
 */

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HeartHandshake, Phone, Globe, Search, ChevronRight,
  Loader2, CheckCircle2, X, Send,
} from "lucide-react";
import { copyFor } from "@/lib/locale";
import {
  fetchNgos, submitNgoApplication,
  type NgoOrg, type ServiceType, type NgoApplication,
  SEED_NGOS,
} from "@/lib/ngoService";
import type { AppLanguage } from "@/lib/locale";

// ── Service type config ────────────────────────────────────────────────────────

type CategoryChip = {
  id: ServiceType | "all";
  en: string;
  zh: string;
  emoji: string;
};

const CATEGORIES: CategoryChip[] = [
  { id: "all",     en: "All",           zh: "全部",     emoji: "🔍" },
  { id: "legal",   en: "Legal",         zh: "法律援助", emoji: "⚖️" },
  { id: "psych",   en: "Mental Health", zh: "心理支持", emoji: "💬" },
  { id: "shelter", en: "Shelter",       zh: "庇护所",   emoji: "🏠" },
  { id: "hotline", en: "Hotline",       zh: "热线",     emoji: "📞" },
];

function serviceLabel(type: ServiceType, language: AppLanguage) {
  const cat = CATEGORIES.find((c) => c.id === type);
  return cat ? copyFor(language, cat.en, cat.zh) : type;
}

// ── NGO Card ───────────────────────────────────────────────────────────────────

function NgoCard({ org, language }: { org: NgoOrg; language: AppLanguage }) {
  const name = language === "zh" && org.name_zh ? org.name_zh : org.name;
  const desc =
    language === "zh" && org.description_zh ? org.description_zh : org.description;

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-foreground leading-snug">{name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{org.coverage_area}</p>
        </div>
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary uppercase tracking-wide">
          {serviceLabel(org.service_type, language)}
        </span>
      </div>

      {desc && (
        <p className="text-xs leading-5 text-muted-foreground">{desc}</p>
      )}

      <div className="flex gap-2">
        {org.phone && (
          <a
            href={`tel:${org.phone}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-xs font-semibold text-foreground active:scale-95 transition-transform"
          >
            <Phone className="h-3.5 w-3.5 text-primary" />
            {org.phone}
          </a>
        )}
        {org.website && (
          <a
            href={org.website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-background py-2.5 text-xs font-semibold text-foreground active:scale-95 transition-transform"
          >
            <Globe className="h-3.5 w-3.5 text-primary" />
            {copyFor(language, "Website", "官网")}
          </a>
        )}
      </div>
    </div>
  );
}

// ── Browse tab ─────────────────────────────────────────────────────────────────

function BrowseTab({ language }: { language: AppLanguage }) {
  const [orgs, setOrgs] = useState<NgoOrg[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ServiceType | "all">("all");
  const [locationFilter, setLocationFilter] = useState("");

  useEffect(() => {
    setLoading(true);
    const type = category === "all" ? undefined : category;
    fetchNgos(type)
      .then(setOrgs)
      .finally(() => setLoading(false));
  }, [category]);

  const filtered = orgs.filter((o) => {
    if (!locationFilter.trim()) return true;
    const q = locationFilter.toLowerCase();
    return (
      o.coverage_area.toLowerCase().includes(q) ||
      (o.name_zh ?? "").toLowerCase().includes(q) ||
      o.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      {/* Category chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              category === cat.id
                ? "bg-primary text-primary-foreground"
                : "border border-border bg-card text-muted-foreground hover:border-primary/50"
            }`}
          >
            {cat.emoji} {copyFor(language, cat.en, cat.zh)}
          </button>
        ))}
      </div>

      {/* Location filter */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
          placeholder={copyFor(language, "Filter by city or area…", "按城市或区域筛选…")}
          className="w-full rounded-2xl border border-border bg-background pl-9 pr-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {copyFor(language, "No organizations found.", "未找到相关机构。")}
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((org) => (
            <NgoCard key={org.id} org={org} language={language} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Apply tab ──────────────────────────────────────────────────────────────────

function ApplyTab({ language }: { language: AppLanguage }) {
  const [form, setForm] = useState<NgoApplication>({
    org_name: "",
    contact_name: "",
    service_type: "legal",
    coverage_area: "",
    phone: "",
    website: "",
    credential_description: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  const set = (key: keyof NgoApplication, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!form.org_name.trim() || !form.contact_name.trim() || !form.coverage_area.trim()) return;
    setStatus("sending");
    const result = await submitNgoApplication(form);
    setStatus(result.ok ? "done" : "error");
  };

  if (status === "done") {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <CheckCircle2 className="h-12 w-12 text-green-500" />
        <p className="text-base font-bold text-foreground">
          {copyFor(language, "Application submitted!", "申请已提交！")}
        </p>
        <p className="text-center text-sm text-muted-foreground">
          {copyFor(
            language,
            "We will review your application and reach out within 3–5 business days.",
            "我们将审核你的申请，并在3-5个工作日内与你联系。"
          )}
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-2 rounded-2xl border border-border px-6 py-2.5 text-sm font-semibold text-muted-foreground"
        >
          {copyFor(language, "Submit another", "再次申请")}
        </button>
      </div>
    );
  }

  const fieldClass =
    "w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary";

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground leading-5">
        {copyFor(
          language,
          "Are you a registered NGO or support organization? Apply to be listed in the directory.",
          "你是已注册的非营利机构或支持组织吗？申请加入目录。"
        )}
      </p>

      <div className="space-y-3">
        <input
          value={form.org_name}
          onChange={(e) => set("org_name", e.target.value)}
          placeholder={copyFor(language, "Organization name *", "机构名称 *")}
          className={fieldClass}
        />
        <input
          value={form.contact_name}
          onChange={(e) => set("contact_name", e.target.value)}
          placeholder={copyFor(language, "Contact person *", "联系人姓名 *")}
          className={fieldClass}
        />

        {/* Service type selector */}
        <div className="flex gap-2 flex-wrap">
          {(["legal", "psych", "shelter", "hotline"] as ServiceType[]).map((t) => {
            const cat = CATEGORIES.find((c) => c.id === t)!;
            return (
              <button
                key={t}
                onClick={() => set("service_type", t)}
                className={`rounded-2xl border px-3 py-2 text-xs font-semibold transition-colors ${
                  form.service_type === t
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {cat.emoji} {copyFor(language, cat.en, cat.zh)}
              </button>
            );
          })}
        </div>

        <input
          value={form.coverage_area}
          onChange={(e) => set("coverage_area", e.target.value)}
          placeholder={copyFor(language, "Coverage area (city / province) *", "服务覆盖地区（城市/省份）*")}
          className={fieldClass}
        />
        <input
          value={form.phone}
          onChange={(e) => set("phone", e.target.value)}
          placeholder={copyFor(language, "Phone number", "联系电话")}
          className={fieldClass}
        />
        <input
          value={form.website}
          onChange={(e) => set("website", e.target.value)}
          placeholder={copyFor(language, "Website (optional)", "官网（选填）")}
          className={fieldClass}
        />
        <textarea
          value={form.credential_description}
          onChange={(e) => set("credential_description", e.target.value)}
          placeholder={copyFor(
            language,
            "Registration number, credentials, or brief description of services…",
            "登记号、资质证明，或服务简介…"
          )}
          rows={3}
          className={`${fieldClass} resize-none`}
        />
      </div>

      {status === "error" && (
        <p className="text-xs text-red-400">
          {copyFor(language, "Submission failed. Please try again.", "提交失败，请重试。")}
        </p>
      )}

      <button
        onClick={handleSubmit}
        disabled={
          !form.org_name.trim() ||
          !form.contact_name.trim() ||
          !form.coverage_area.trim() ||
          status === "sending"
        }
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        {status === "sending" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {copyFor(language, "Submit application", "提交申请")}
      </button>
    </div>
  );
}

// ── NGO Suggestion Sheet (post-SOS) ───────────────────────────────────────────

export function NGOSuggestionSheet({
  language,
  onClose,
}: {
  language: AppLanguage;
  onClose: () => void;
}) {
  const suggestions = SEED_NGOS.slice(0, 3);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 260 }}
        className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-border bg-card px-5 pb-8 pt-5 shadow-2xl"
      >
        {/* Handle */}
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-primary" />
            <p className="text-sm font-bold text-foreground">
              {copyFor(language, "Nearby Support", "附近支持机构")}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-accent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-xs text-muted-foreground leading-5">
          {copyFor(
            language,
            "You're safe now. These organizations can provide follow-up support.",
            "你现在安全了。以下机构可以提供后续支持。"
          )}
        </p>

        <div className="space-y-3">
          {suggestions.map((org) => {
            const name = language === "zh" && org.name_zh ? org.name_zh : org.name;
            return (
              <div
                key={org.id}
                className="flex items-center justify-between rounded-2xl border border-border bg-background px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{name}</p>
                  <p className="text-xs text-muted-foreground">
                    {serviceLabel(org.service_type, language)} · {org.coverage_area}
                  </p>
                </div>
                {org.phone && (
                  <a
                    href={`tel:${org.phone}`}
                    className="ml-3 shrink-0 flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-2 text-xs font-bold text-primary active:scale-95 transition-transform"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {copyFor(language, "Call", "拨打")}
                  </a>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-2xl border border-border py-3 text-sm font-semibold text-muted-foreground"
        >
          {copyFor(language, "Close", "关闭")}
        </button>
      </motion.div>
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type TabId = "browse" | "apply";

export default function NGOPage({ language }: { language: AppLanguage }) {
  const [tab, setTab] = useState<TabId>("browse");

  return (
    <div className="flex flex-1 flex-col px-4 pb-4">
      {/* Header */}
      <div className="flex items-center gap-3 py-4">
        <HeartHandshake className="h-6 w-6 text-primary shrink-0" />
        <div>
          <h2 className="text-base font-bold text-foreground leading-snug">
            {copyFor(language, "NGO Directory", "机构目录")}
          </h2>
          <p className="text-xs text-muted-foreground">
            {copyFor(language, "Find legal, psychological and shelter support.", "查找法律、心理与庇护支持机构。")}
          </p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="mb-4 flex rounded-2xl border border-border bg-card p-1">
        {(["browse", "apply"] as TabId[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2 text-xs font-bold transition-colors ${
              tab === t
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "browse"
              ? copyFor(language, "Browse", "找机构")
              : copyFor(language, "Apply", "申请入驻")}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -12 }}
          transition={{ duration: 0.18 }}
          className="flex-1"
        >
          {tab === "browse" ? (
            <BrowseTab language={language} />
          ) : (
            <ApplyTab language={language} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
