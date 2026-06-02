/**
 * Emergency contacts — localStorage-based management + SMS URI builder.
 *
 * Contacts are stored locally only. On SOS trigger the app opens the
 * native SMS app pre-filled with a bilingual help message that includes:
 *   - GPS coordinates + accuracy radius
 *   - A tappable Gaode navigation link
 *   - Battery level + network type (for rescue team to estimate connectivity)
 */

import { useState, useCallback } from "react";

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

/** Extra device context included in the SOS message */
export interface LocationExtras {
  accuracy?: number;   // GPS accuracy radius in metres
  battery?: number;    // 0–100 %
  network?: string;    // "4g" | "3g" | "wifi" | "2g" | etc.
}

const STORAGE_KEY = "unmuted_emergency_contacts";

/** Exported so SOSButton can read fresh contacts at trigger time, bypassing stale React state */
export function loadContacts(): EmergencyContact[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as EmergencyContact[]) : [];
  } catch {
    return [];
  }
}

function saveContacts(contacts: EmergencyContact[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts));
}

// ── WGS-84 → GCJ-02 conversion (火星坐标系) ────────────────────────────────
// GPS hardware (and navigator.geolocation) always outputs WGS-84.
// All Chinese maps (Gaode/Amap, etc.) use GCJ-02 ("Mars coordinates").
// Without this conversion, the marker on Gaode is offset by ~100-500 m.
// Algorithm: public domain, widely used in China mapping libraries.

const GCJ_A  = 6378245.0;
const GCJ_EE = 0.00669342162296594323;

function _gcjTransformLat(x: number, y: number): number {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin((y / 3) * Math.PI)) * 2 / 3;
  r += (160 * Math.sin((y / 12) * Math.PI) + 320 * Math.sin((y / 30) * Math.PI)) * 2 / 3;
  return r;
}

function _gcjTransformLng(x: number, y: number): number {
  let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin((x / 3) * Math.PI)) * 2 / 3;
  r += (150 * Math.sin((x / 12) * Math.PI) + 300 * Math.sin((x / 30) * Math.PI)) * 2 / 3;
  return r;
}

/** Convert WGS-84 GPS coordinates to GCJ-02 (required for Gaode map URLs). */
function wgs84ToGcj02(lat: number, lng: number): { lat: number; lng: number } {
  // Outside mainland China — no offset needed
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) {
    return { lat, lng };
  }
  let dLat = _gcjTransformLat(lng - 105, lat - 35);
  let dLng = _gcjTransformLng(lng - 105, lat - 35);
  const radLat = (lat / 180) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / (((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic)) * Math.PI);
  dLng = (dLng * 180) / ((GCJ_A / sqrtMagic) * Math.cos(radLat) * Math.PI);
  return { lat: lat + dLat, lng: lng + dLng };
}

/**
 * Build a rich location block that replaces `{位置}` in the SOS template.
 *
 * - Raw GPS text uses WGS-84 (precise, copy-pasteable into any app)
 * - Gaode navigation URL uses GCJ-02 (corrected for Chinese map offset)
 */
export function buildLocationBlock(lat: number, lng: number, extras?: LocationExtras): string {
  if (lat === 0 && lng === 0) return "位置获取失败 / Location unavailable";

  // GPS coordinates + accuracy (WGS-84 — raw hardware value, maximum precision)
  const accuracy = extras?.accuracy != null ? ` (±${Math.round(extras.accuracy)}m)` : "";
  const coordLine = `GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}${accuracy}`;

  // Gaode navigation link — convert to GCJ-02 so the pin lands on the right spot
  const gcj = wgs84ToGcj02(lat, lng);
  const navUrl =
    `https://uri.amap.com/marker?position=${gcj.lng.toFixed(6)},${gcj.lat.toFixed(6)}&name=求救位置`;
  const navLine = `导航: ${navUrl}`;

  // Device status (battery + network) — helps rescuers estimate connectivity
  const statusParts: string[] = [];
  if (extras?.battery != null) statusParts.push(`电量${extras.battery}%`);
  if (extras?.network)         statusParts.push(extras.network.toUpperCase());

  const lines = [coordLine, navLine];
  if (statusParts.length) lines.push(statusParts.join(" · "));

  return lines.join("\n");
}

/**
 * Build the SMS body from a template string.
 * The placeholder `{位置}` is replaced with the full location block.
 * Falls back to a default bilingual message if no template provided.
 */
export function buildSmsBody(
  lat: number,
  lng: number,
  template?: string,
  extras?: LocationExtras
): string {
  const locationBlock = buildLocationBlock(lat, lng, extras);

  if (template && template.trim()) {
    return template.replace(/\{位置\}/g, locationBlock);
  }

  // Default fallback (no template set)
  return (
    `我需要帮助，现在处境不安全。\n` +
    `${locationBlock}\n` +
    `请立即联系我，5分钟内无回应请代我报警。\n` +
    `I need help and I am not safe. ${locationBlock}. Call me back. If no answer in 5 min, call police for me.`
  );
}

/** Build an sms: URI that opens the native SMS app */
export function buildSmsUri(
  contact: EmergencyContact,
  lat: number,
  lng: number,
  template?: string,
  extras?: LocationExtras
): string {
  const body = encodeURIComponent(buildSmsBody(lat, lng, template, extras));
  return `sms:${contact.phone}?body=${body}`;
}

export function useEmergencyContacts() {
  const [contacts, setContacts] = useState<EmergencyContact[]>(() => loadContacts());

  const addContact = useCallback((name: string, phone: string): EmergencyContact => {
    const contact: EmergencyContact = {
      id: crypto.randomUUID(),
      name: name.trim(),
      phone: phone.trim(),
    };
    setContacts((prev) => {
      const next = [...prev, contact];
      saveContacts(next);
      return next;
    });
    return contact;
  }, []);

  const removeContact = useCallback((id: string) => {
    setContacts((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveContacts(next);
      return next;
    });
  }, []);

  return { contacts, addContact, removeContact };
}
