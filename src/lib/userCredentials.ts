import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

// Password stored in localStorage only (no server round-trip, no RLS issues)
const PASS_KEY_PREFIX = "unmuted_pwd_";
const USERNAME_KEY = "unmuted_username";

// Supabase used for username sync only
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const db = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/** Check if an email already has a password set (localStorage) */
export async function hasPassword(email: string): Promise<boolean> {
  return Boolean(localStorage.getItem(PASS_KEY_PREFIX + email.toLowerCase()));
}

/** Verify email + password against locally stored bcrypt hash */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  const hash = localStorage.getItem(PASS_KEY_PREFIX + email.toLowerCase());
  if (!hash) return false;
  return bcrypt.compare(password, hash);
}

/** Hash and save password to localStorage */
export async function savePassword(email: string, password: string): Promise<void> {
  const hash = await bcrypt.hash(password, 10);
  localStorage.setItem(PASS_KEY_PREFIX + email.toLowerCase(), hash);
}

/** Get username from Supabase (or fall back to localStorage) */
export async function getUsername(email: string): Promise<string> {
  const local = localStorage.getItem(USERNAME_KEY) ?? "";
  if (!db || !email) return local;
  const { data } = await db
    .from("user_credentials")
    .select("username")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return data?.username ?? local;
}

/** Save username to localStorage + Supabase if available */
export async function saveUsername(email: string, username: string): Promise<void> {
  localStorage.setItem(USERNAME_KEY, username);
  if (!db || !email) return;
  await db.from("user_credentials").upsert({
    email: email.toLowerCase(),
    username,
    updated_at: new Date().toISOString(),
  });
}

export function getLocalUsername(): string {
  return localStorage.getItem(USERNAME_KEY) ?? "";
}
