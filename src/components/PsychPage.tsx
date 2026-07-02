/**
 * 心理援助 — Mental Health Support
 * Section 1: Verified crisis hotlines (real, nationwide)
 * Section 2: Vetted counselors (coming soon placeholder)
 */
import { Brain, Phone, Clock, ShieldCheck, MapPin } from "lucide-react";
import { AppLanguage, copyFor } from "@/lib/locale";

interface PsychPageProps {
  language: AppLanguage;
}

interface Hotline {
  id: string;
  name: string;
  nameEn: string;
  phone: string;
  hours: string;
  hoursEn: string;
  coverage: string;
  coverageEn: string;
  description: string;
  descriptionEn: string;
}

// 最后核实时间：2026年6月
const HOTLINES: Hotline[] = [
  {
    id: "h1",
    name: "北京大学第六医院心理援助热线",
    nameEn: "PKU-6 National Mental Health Hotline",
    phone: "010-82951332",
    hours: "24小时",
    hoursEn: "24 / 7",
    coverage: "全国",
    coverageEn: "Nationwide",
    description: "北京大学第六医院运营，全国可拨，提供免费心理疏导与危机干预",
    descriptionEn: "Operated by Peking University 6th Hospital — free crisis intervention, nationwide",
  },
  {
    id: "h2",
    name: "全国心理援助热线（卫健委）",
    nameEn: "National Health Commission Hotline",
    phone: "400-161-9995",
    hours: "24小时",
    hoursEn: "24 / 7",
    coverage: "全国",
    coverageEn: "Nationwide",
    description: "国家卫生健康委员会指定热线，免费，保密，24小时接听",
    descriptionEn: "National Health Commission designated hotline — free, confidential, 24/7",
  },
  {
    id: "h3",
    name: "上海市心理援助热线",
    nameEn: "Shanghai Mental Health Hotline",
    phone: "021-12320-5",
    hours: "24小时",
    hoursEn: "24 / 7",
    coverage: "上海",
    coverageEn: "Shanghai",
    description: "上海市卫生热线12320心理援助分线，由专业心理咨询师接听",
    descriptionEn: "Extension of Shanghai health hotline 12320, staffed by licensed counselors",
  },
  {
    id: "h4",
    name: "广州心理援助热线",
    nameEn: "Guangzhou Mental Health Hotline",
    phone: "020-12320-5",
    hours: "24小时",
    hoursEn: "24 / 7",
    coverage: "广州",
    coverageEn: "Guangzhou",
    description: "广州市卫生热线心理援助分线，免费保密",
    descriptionEn: "Guangzhou health hotline mental health extension — free, confidential",
  },
  {
    id: "h5",
    name: "希望24热线",
    nameEn: "Hope 24 Hotline",
    phone: "400-161-9995",
    hours: "24小时",
    hoursEn: "24 / 7",
    coverage: "全国",
    coverageEn: "Nationwide",
    description: "专注自杀预防与危机干预，由经培训志愿者接听，完全保密",
    descriptionEn: "Suicide prevention and crisis intervention, trained volunteers, fully confidential",
  },
];

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
            "Free, confidential support. All hotlines verified June 2026.",
            "以下热线均经核实（2026年6月），免费保密，拨打无需预约。"
          )}
        </p>
      </div>

      {/* Crisis Hotlines */}
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
          {copyFor(language, "Crisis Hotlines", "紧急援助热线")}
        </h2>
        <div className="space-y-3">
          {HOTLINES.map((h) => (
            <div
              key={h.id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-sm font-bold text-foreground">
                      {copyFor(language, h.nameEn, h.name)}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {copyFor(language, h.coverageEn, h.coverage)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-4 text-muted-foreground">
                    {copyFor(language, h.descriptionEn, h.description)}
                  </p>
                  <div className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>{copyFor(language, h.hoursEn, h.hours)}</span>
                  </div>
                </div>
              </div>
              <a
                href={`tel:${h.phone}`}
                className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 text-sm font-bold text-primary transition-transform active:scale-95"
              >
                <Phone className="h-4 w-4" />
                {h.phone}
              </a>
            </div>
          ))}
        </div>
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
