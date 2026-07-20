import { describe, expect, it } from "vitest";
import {
  AID_RESOURCES,
  KIND_LABEL,
  TAG_LABEL,
  citiesFor,
  filterByCity,
  isStale,
  resourcesFor,
} from "./aidDirectory";

// Gate for the directory data: a survivor in crisis must never see a malformed
// or unverifiable entry. Every rule here is a listing requirement.
describe("aid directory data integrity", () => {
  it("has unique ids", () => {
    const ids = AID_RESOURCES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every entry has bilingual name, description, and hours", () => {
    for (const r of AID_RESOURCES) {
      expect(r.name, r.id).toBeTruthy();
      expect(r.nameEn, r.id).toBeTruthy();
      expect(r.description, r.id).toBeTruthy();
      expect(r.descriptionEn, r.id).toBeTruthy();
      expect(r.hours, r.id).toBeTruthy();
      expect(r.hoursEn, r.id).toBeTruthy();
    }
  });

  it("every entry has at least one contact channel", () => {
    for (const r of AID_RESOURCES) {
      expect(r.phone || r.websiteUrl, `${r.id} has no phone and no website`).toBeTruthy();
    }
  });

  it("category, kind, and tags are known values", () => {
    for (const r of AID_RESOURCES) {
      expect(["psych", "legal"], r.id).toContain(r.category);
      expect(Object.keys(KIND_LABEL), r.id).toContain(r.kind);
      expect(r.tags.length, `${r.id} has no tags`).toBeGreaterThan(0);
      for (const t of r.tags) expect(Object.keys(TAG_LABEL), r.id).toContain(t);
    }
  });

  it("city entries carry both zh and en city names; national entries carry neither", () => {
    for (const r of AID_RESOURCES) {
      if (r.city) expect(r.cityEn, r.id).toBeTruthy();
      else expect(r.cityEn, r.id).toBeNull();
    }
  });

  it("verifiedAt is a YYYY-MM date not in the future", () => {
    const now = new Date();
    for (const r of AID_RESOURCES) {
      expect(r.verifiedAt, r.id).toMatch(/^\d{4}-(0[1-9]|1[0-2])$/);
      const [y, m] = r.verifiedAt.split("-").map(Number);
      expect(
        y * 12 + m,
        `${r.id} verified in the future`
      ).toBeLessThanOrEqual(now.getFullYear() * 12 + now.getMonth() + 1);
    }
  });

  it("urls are https", () => {
    for (const r of AID_RESOURCES) {
      for (const url of [r.websiteUrl, r.sourceUrl]) {
        if (url) expect(url, r.id).toMatch(/^https:\/\//);
      }
    }
  });

  it("phones contain only digits and dashes (usable in tel: links)", () => {
    for (const r of AID_RESOURCES) {
      if (r.phone) expect(r.phone, r.id).toMatch(/^[\d-]+$/);
    }
  });
});

describe("filtering helpers", () => {
  it("citiesFor lists only cities that have entries, no duplicates", () => {
    for (const category of ["psych", "legal"] as const) {
      const cities = citiesFor(category);
      const names = cities.map((c) => c.city);
      expect(new Set(names).size).toBe(names.length);
      for (const { city } of cities) {
        expect(resourcesFor(category).some((r) => r.city === city)).toBe(true);
      }
    }
  });

  it("picking a city keeps national entries and drops other cities", () => {
    const legal = resourcesFor("legal");
    const filtered = filterByCity(legal, "上海");
    expect(filtered.every((r) => r.city === null || r.city === "上海")).toBe(true);
    const nationalCount = legal.filter((r) => r.city === null).length;
    expect(filtered.filter((r) => r.city === null).length).toBe(nationalCount);
  });

  it("no city filter returns everything", () => {
    const legal = resourcesFor("legal");
    expect(filterByCity(legal, null)).toEqual(legal);
  });

  it("isStale flags entries verified over 12 months ago", () => {
    const fresh = { ...AID_RESOURCES[0], verifiedAt: "2026-06" };
    expect(isStale(fresh, new Date(2026, 6, 18))).toBe(false);
    expect(isStale(fresh, new Date(2027, 5, 15))).toBe(true);
  });
});
