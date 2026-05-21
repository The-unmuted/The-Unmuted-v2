import { createClient } from "@supabase/supabase-js";
import bcrypt from "bcryptjs";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const db = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const USERNAME_KEY = "unmuted_username";

/** Check if an email already has a password set */
export async function hasPassword(email: string): Promise<boolean> {
  if (!db) return false;
  const { data } = await db
    .from("user_credentials")
    .select("email")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  return Boolean(data);
}

/** Verify email + password. Returns true if correct. */
export async function verifyPassword(email: string, password: string): Promise<boolean> {
  if (!db) return false;
  const { data } = await db
    .from("user_credentials")
    .select("password_hash")
    .eq("email", email.toLowerCase())
    .maybeSingle();
  if (!data?.password_hash) return false;
  return bcrypt.compare(password, data.password_hash);
}

/** Save a new password for this email (first-time setup). */
export async function savePassword(email: string, password: string): Promise<void> {
  if (!db) throw new Error("Supabase not configured");
  const hash = await bcrypt.hash(password, 10);
  await db.from("user_credentials").upsert({
    email: email.toLowerCase(),
    password_hash: hash,
    updated_at: new Date().toISOString(),
  });
}

/** Get username from Supabase (or fall back to localStorage). */
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

/** Save username to Supabase + localStorage. */
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
