import { useState } from "react";
import { Phone, Globe, MapPin, Clock, ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react";
import { AppLanguage, copyFor } from "@/lib/locale";
import {
  AidCategory,
  AidResource,
  KIND_LABEL,
  TAG_LABEL,
  citiesFor,
  filterByCity,
  isStale,
  resourcesFor,
  verifiedLabel,
} from "@/lib/aidDirectory";

export default function AidResourceList({
  category,
  language,
}: {
  category: AidCategory;
  language: AppLanguage;
}) {
  const [city, setCity] = useState<string | null>(null);
  const cities = citiesFor(category);
  const resources = filterByCity(resourcesFor(category), city);

  return (
    <div className="space-y-3">
      {/* City filter — only cities that have entries are offered */}
      {cities.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <CityChip
            label={copyFor(language, "All", "全部")}
            active={city === null}
            onClick={() => setCity(null)}
          />
          {cities.map((c) => (
            <CityChip
              key={c.city}
              label={copyFor(language, c.cityEn, c.city)}
              active={city === c.city}
              onClick={() => setCity(c.city)}
            />
          ))}
        </div>
      )}
      {city && (
        <p className="text-[11px] leading-4 text-muted-foreground">
          {copyFor(
            language,
            "Nationwide hotlines are always shown alongside your city.",
            "全国热线始终显示，不受城市筛选影响。"
          )}
        </p>
      )}

      {resources.map((r) => (
        <ResourceCard key={r.id} resource={r} category={category} language={language} />
      ))}
    </div>
  );
}

function CityChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "bg-primary text-primary-foreground"
          : "border border-border bg-card text-muted-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function ResourceCard({
  resource: r,
  category,
  language,
}: {
  resource: AidResource;
  category: AidCategory;
  language: AppLanguage;
}) {
  const kind = KIND_LABEL[r.kind];
  const stale = isStale(r);
  // The tag matching the page itself carries no information there.
  const tags = r.tags.filter((t) => t !== category);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-sm font-bold leading-snug text-foreground">
          {copyFor(language, r.nameEn, r.name)}
        </span>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${kind.color}`}>
          {copyFor(language, kind.en, kind.zh)}
        </span>
        <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
          {r.city ? copyFor(language, r.cityEn!, r.city) : copyFor(language, "Nationwide", "全国")}
        </span>
      </div>

      {tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-primary/5 px-2 py-0.5 text-[10px] text-primary/80"
            >
              {copyFor(language, TAG_LABEL[t].en, TAG_LABEL[t].zh)}
            </span>
          ))}
        </div>
      )}

      <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
        {copyFor(language, r.descriptionEn, r.description)}
      </p>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3 shrink-0" />
          {copyFor(language, r.hoursEn, r.hours)}
        </span>
        {r.location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            {copyFor(language, r.locationEn ?? r.location, r.location)}
          </span>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {r.phone && (
          <a
            href={`tel:${r.phone}`}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary/10 py-2.5 text-xs font-bold text-primary transition-transform active:scale-95"
          >
            <Phone className="h-3.5 w-3.5" />
            {r.phone}
          </a>
        )}
        {r.websiteUrl && (
          <a
            href={r.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-border bg-card py-2.5 text-xs font-bold text-foreground/70 transition-transform active:scale-95"
          >
            <Globe className="h-3.5 w-3.5" />
            {copyFor(language, "Website", "官网")}
            <ExternalLink className="h-3 w-3 opacity-50" />
          </a>
        )}
      </div>

      <div
        className={`mt-2 flex items-center gap-1 text-[10px] ${
          stale ? "text-amber-400" : "text-muted-foreground/60"
        }`}
      >
        {stale ? (
          <>
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {copyFor(
              language,
              `${verifiedLabel(r, language)} — may be outdated; if unreachable call 12338 / 12348.`,
              `${verifiedLabel(r, language)} — 信息可能过期，若打不通请优先拨 12338 / 12348。`
            )}
          </>
        ) : (
          <>
            <ShieldCheck className="h-3 w-3 shrink-0" />
            {verifiedLabel(r, language)}
          </>
        )}
      </div>
    </div>
  );
}
