import directoryData from "@/data/aidDirectory.json";
import { AppLanguage, copyFor } from "@/lib/locale";

// "What happened to me" tags — one resource can serve several situations (D-021:
// the app serves all gender-based harm, not only DV).
export type AidTag =
  | "dv"
  | "sexual-assault"
  | "harassment"
  | "family-law"
  | "psych"
  | "general-rights";

export type AidKind = "hotline" | "legal" | "shelter" | "rights";
export type AidCategory = "psych" | "legal";

export interface AidResource {
  id: string;
  category: AidCategory;
  kind: AidKind;
  tags: AidTag[];
  country: string;
  city: string | null;
  cityEn: string | null;
  name: string;
  nameEn: string;
  phone: string | null;
  hours: string;
  hoursEn: string;
  description: string;
  descriptionEn: string;
  location: string | null;
  locationEn: string | null;
  websiteUrl: string | null;
  sourceUrl: string | null;
  verifiedAt: string; // YYYY-MM of last human verification
}

export const AID_RESOURCES: AidResource[] = (
  directoryData as { resources: AidResource[] }
).resources;

export const TAG_LABEL: Record<AidTag, { zh: string; en: string }> = {
  dv: { zh: "家庭暴力", en: "Domestic violence" },
  "sexual-assault": { zh: "性侵害", en: "Sexual assault" },
  harassment: { zh: "骚扰/职场", en: "Harassment / workplace" },
  "family-law": { zh: "婚姻家事", en: "Family law" },
  psych: { zh: "心理支持", en: "Mental health" },
  "general-rights": { zh: "综合维权", en: "General rights" },
};

export const KIND_LABEL: Record<AidKind, { zh: string; en: string; color: string }> = {
  hotline: { zh: "热线", en: "Hotline", color: "bg-red-500/10 text-red-400" },
  legal: { zh: "法援", en: "Legal Aid", color: "bg-blue-500/10 text-blue-400" },
  shelter: { zh: "庇护", en: "Shelter", color: "bg-amber-500/10 text-amber-400" },
  rights: { zh: "维权", en: "Rights", color: "bg-purple-500/10 text-purple-400" },
};

export function resourcesFor(category: AidCategory): AidResource[] {
  return AID_RESOURCES.filter((r) => r.category === category);
}

/** Distinct cities that actually have entries in this category — the picker only
 * offers cities with data, so a selection can never produce an empty list. */
export function citiesFor(category: AidCategory): { city: string; cityEn: string }[] {
  const seen = new Map<string, string>();
  for (const r of resourcesFor(category)) {
    if (r.city && r.cityEn && !seen.has(r.city)) seen.set(r.city, r.cityEn);
  }
  return Array.from(seen, ([city, cityEn]) => ({ city, cityEn }));
}

/** National entries always show; picking a city adds that city's entries on top. */
export function filterByCity(resources: AidResource[], city: string | null): AidResource[] {
  if (!city) return resources;
  return resources.filter((r) => r.city === null || r.city === city);
}

const STALE_MONTHS = 12;

export function isStale(resource: AidResource, now = new Date()): boolean {
  const [y, m] = resource.verifiedAt.split("-").map(Number);
  const ageMonths = (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m);
  return ageMonths >= STALE_MONTHS;
}

export function verifiedLabel(resource: AidResource, language: AppLanguage): string {
  const [y, m] = resource.verifiedAt.split("-");
  return copyFor(language, `Verified ${y}-${m}`, `核实于 ${y}年${Number(m)}月`);
}
