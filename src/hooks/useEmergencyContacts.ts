/**
 * Emergency contacts — localStorage-based management + SMS URI builder.
 *
 * Contacts are stored locally only. On SOS trigger the app opens the
 * native SMS app pre-filled with a bilingual help message.
 */

import { useState, useCallback } from "react";

export interface EmergencyContact {
  id: string;
  name: string;
  phone: string;
}

const STORAGE_KEY = "unmuted_emergency_contacts";

function loadContacts(): EmergencyContact[] {
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

/** Build the bilingual SMS body (≤320 chars) */
export function buildSmsBody(lat: number, lng: number): string {
  const mapLink =
    lat !== 0 || lng !== 0
      ? `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`
      : "https://maps.google.com";

  return (
    `我需要帮助。位置：${mapLink}\n` +
    `请回电确认我安全。如5分钟无回应，请代我报警。\n` +
    `I need help. Location: ${mapLink}. Call me back. If no answer in 5 min, call police for me.`
  );
}

/** Build an sms: URI that opens the native SMS app */
export function buildSmsUri(contact: EmergencyContact, lat: number, lng: number): string {
  const body = encodeURIComponent(buildSmsBody(lat, lng));
  // iOS uses &body=, Android uses ?body= — the ?body= form works on both
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
