/**
 * 心理援助 — Mental Health Support
 * Hotline directory lives in src/data/aidDirectory.json (city-filterable,
 * every entry human-verified; weekly CI re-checks sources).
 */
import { Brain, ShieldCheck } from "lucide-react";
import { AppLanguage, copyFor } from "@/lib/locale";
import AidResourceList from "@/components/AidResourceList";

interface PsychPageProps {
  language: AppLanguage;
}

export default function PsychPage({ language }: PsychPageProps) {
  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {/* Header */}
      <div className="text-center pt-2">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Brain className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-black text-foreground">
          {copyFor(language, "Mental Health Support", "心理援助")}
        </h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {copyFor(
            language,
            "Free, confidential support. Every hotline is verified before listing.",
            "以下热线均经人工核实后收录，免费保密，拨打无需预约。"
          )}
        </p>
      </div>

      {/* Crisis Hotlines */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {copyFor(language, "Crisis Hotlines", "紧急援助热线")}
        </h2>
        <AidResourceList category="psych" language={language} />
      </section>

      {/* Vetted Counselors — coming soon */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {copyFor(language, "Vetted Counselors", "经认证心理咨询师")}
        </h2>
        <div className="rounded-2xl border border-border/60 bg-card/50 p-5 text-center">
          <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-primary/40" />
          <p className="text-sm font-semibold text-foreground/70">
            {copyFor(language, "Coming soon", "即将上线")}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            {copyFor(
              language,
              "We are screening licensed counselors who specialize in trauma, domestic violence, and gender-based violence. Each will be individually verified before listing.",
              "我们正在审核具备执业资质的心理咨询师，她们专注于创伤、家庭暴力及性别暴力领域，每位入驻咨询师均经独立核实。"
            )}
          </p>
        </div>
      </section>

      {/* Self-help resources */}
      <section className="pb-2">
        <div className="rounded-2xl border border-border/60 bg-card/40 px-4 py-3 text-xs leading-5 text-muted-foreground">
          <span className="font-semibold text-foreground/60">
            {copyFor(language, "Note · 提示", "提示")}
          </span>
          {"  "}
          {copyFor(
            language,
            "If you are in immediate danger, call 110 (Police) or 120 (Emergency Medical) first.",
            "如处于紧急危险中，请先拨打 110（警察）或 120（急救）。"
          )}
        </div>
      </section>
    </div>
  );
}
