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
  location: string;
  locationEn: string;
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
    name: "全国统一心理援助热线",
    nameEn: "National Mental Health Hotline",
    phone: "12356",
    location: "全国统一接入",
    locationEn: "Nationwide unified access",
    hours: "24小时",
    hoursEn: "24 / 7",
    coverage: "全国",
    coverageEn: "Nationwide",
    description: "国家卫生健康委统一号码。2025年起全国推广，用于心理咨询、疏导与危机干预",
    descriptionEn: "National Health Commission unified hotline for mental health consultation, support, and crisis intervention",
  },
  {
    id: "h2",
    name: "北京市心理援助热线",
    nameEn: "Beijing Psychological Assistance Hotline",
    phone: "010-82951332",
    location: "北京回龙观医院 / 北京",
    locationEn: "Beijing Huilongguan Hospital / Beijing",
    hours: "24小时",
    hoursEn: "24 / 7",
    coverage: "北京",
    coverageEn: "Beijing",
    description: "由北京心理危机研究与干预中心、北京回龙观医院运营的官方心理援助热线",
    descriptionEn: "Official hotline run by the Beijing Psychological Crisis Research and Intervention Center and Beijing Huilongguan Hospital",
  },
  {
    id: "h3",
    name: "上海市心理热线",
    nameEn: "Shanghai Mental Health Hotline",
    phone: "962525",
    location: "上海市精神卫生中心 / 上海",
    locationEn: "Shanghai Mental Health Center / Shanghai",
    hours: "24小时",
    hoursEn: "24 / 7",
    coverage: "上海",
    coverageEn: "Shanghai",
    description: "上海市官方心理热线，7×24小时接听；自2025年起同步接入全国12356",
    descriptionEn: "Official Shanghai hotline, staffed 24/7; connected to the national 12356 system since 2025",
  },
  {
    id: "h4",
    name: "广州心理援助热线",
    nameEn: "Guangzhou Mental Health Hotline",
    phone: "020-81899120",
    location: "广州市 / 广州",
    locationEn: "Guangzhou / Guangzhou",
    hours: "24小时",
    hoursEn: "24 / 7",
    coverage: "广州",
    coverageEn: "Guangzhou",
    description: "广州市官方心理援助热线，24小时免费；自2025年起与全国12356并轨运行",
    descriptionEn: "Official Guangzhou hotline, free 24/7; merged with the national 12356 system in 2025",
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
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    <span>{copyFor(language, h.locationEn, h.location)}</span>
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <a
                  href={`tel:${h.phone}`}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary/10 py-2.5 text-sm font-bold text-primary transition-transform active:scale-95"
                >
                  <Phone className="h-4 w-4" />
                  {h.phone}
                </a>
              </div>
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
