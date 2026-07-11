import bcrypt from "bcryptjs";

// Password stored in localStorage only (no server round-trip, no RLS issues)
const PASS_KEY_PREFIX = "unmuted_pwd_";

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

