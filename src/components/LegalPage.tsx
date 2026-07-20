/**
 * 法律援助 — Legal Aid & Women's Rights
 * Org directory lives in src/data/aidDirectory.json (city-filterable,
 * every entry human-verified; weekly CI re-checks sources).
 */
import { Scale } from "lucide-react";
import { AppLanguage, copyFor } from "@/lib/locale";
import AidResourceList from "@/components/AidResourceList";

interface LegalPageProps {
  language: AppLanguage;
}

export default function LegalPage({ language }: LegalPageProps) {
  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {/* Header */}
      <div className="text-center pt-2">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Scale className="h-6 w-6 text-primary" />
        </div>
        <h1 className="text-xl font-black text-foreground">
          {copyFor(language, "Legal Aid", "法律援助")}
        </h1>
        <p className="mt-2 text-sm leading-5 text-muted-foreground">
          {copyFor(
            language,
            "Verified non-profit organizations and legal aid centers. Covers domestic violence, sexual assault, harassment, and women's rights.",
            "经核实的公益机构与法律援助中心，覆盖家庭暴力、性侵害、骚扰与妇女维权。"
          )}
        </p>
      </div>

      {/* Org cards with city filter */}
      <div className="pb-2">
        <AidResourceList category="legal" language={language} />
      </div>

      {/* Disclaimer */}
      <div className="rounded-2xl border border-border/60 bg-card/40 px-4 py-3 text-xs leading-5 text-muted-foreground pb-4">
        <span className="font-semibold text-foreground/60">
          {copyFor(language, "Note · 提示", "提示")}
        </span>
        {"  "}
        {copyFor(
          language,
          "Contact information is verified at the time of listing and updated periodically. If a number is unreachable, try the national hotlines (12338 or 12348) first.",
          "联系方式在收录时经过核实，并定期更新。若某号码无法接通，请优先拨打全国热线 12338 或 12348。"
        )}
      </div>
    </div>
  );
}
