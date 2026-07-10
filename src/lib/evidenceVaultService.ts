/**
 * Production evidence pipeline (D-016/D-017).
 *
 * Everything the cloud sees is ciphertext: the encrypted file goes to the
 * private `evidence-vault` bucket under {userId}/{txId}; the record index
 * (wrapped per-file key + sealed metadata + hashes) goes to `evidence_records`.
 * Decryption requires the session master key — see keyVaultService.
 *
 * Offline resilience: the encrypted blob is always kept in IndexedDB as a
 * local cache, and records created while offline sit in a pending queue that
 * `syncPendingEvidence` flushes on the next opportunity.
 */

import { supabase } from "./supabaseClient";
import { getSessionMasterKey } from "./keyVaultService";
import { sealJson, openJson } from "./keyVault";
import { decryptFile, type EncryptionResult } from "./evidenceCrypto";
import type { CaptureLocation } from "./captureMetadata";

const BUCKET = "evidence-vault";
const PENDING_PREFIX = "unmuted_evidence_pending_";
const INDEX_PREFIX = "unmuted_evidence_index_";

export interface EvidenceMeta {
  fileName?: string;
  mimeType: string;
  originalSize: number;
  note?: string;
  // Capture-instant metadata (Phase 2 取证). Sealed client-side — precise
  // coordinates are allowed here precisely because the cloud never sees them.
  // Kept alongside originalHash + clientTime/serverTime so records can be
  // retroactively anchored to a TSA (补锚定) once the entity exists.
  capturedAt?: string;
  location?: CaptureLocation;
  deviceInfo?: string;
}

export type SyncStatus = "synced" | "pending";

/** A record as stored (all sensitive fields are ciphertext strings) */
interface StoredRecord {
  txId: string;
  wrappedFileKey: string; // sealed {key: JWK, iv: hex}
  encryptedMeta: string;  // sealed EvidenceMeta
  originalHash: string;
  encryptedHash: string;
  captureGrade: 1 | 2;
  clientTime: string;
  serverTime?: string;
}

/** A record as shown to the UI (meta decrypted for this session) */
export interface EvidenceRecord extends StoredRecord {
  meta: EvidenceMeta;
  syncStatus: SyncStatus;
}

// ── IndexedDB blob cache (same DB as the legacy demo path) ────────────────────

const DB_NAME = "the_unmuted_vault";
const DB_VERSION = 1;
const STORE_NAME = "encrypted_files";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "txId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function cacheBlob(txId: string, encryptedBlob: Blob): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ txId, encryptedBlob });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // cache is best-effort; the cloud copy (or pending queue) is authoritative
  }
}

async function readCachedBlob(txId: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    const row = await new Promise<{ encryptedBlob?: Blob } | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(txId);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return row?.encryptedBlob ?? null;
  } catch {
    return null;
  }
}

async function removeCachedBlob(txId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(txId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

// ── Local record lists (ciphertext only — safe in localStorage) ───────────────

function readList(key: string): StoredRecord[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as StoredRecord[]) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, records: StoredRecord[]): void {
  localStorage.setItem(key, JSON.stringify(records));
}

const pendingKey = (userId: string) => PENDING_PREFIX + userId;
const indexKey = (userId: string) => INDEX_PREFIX + userId;

// ── Cloud helpers ──────────────────────────────────────────────────────────────

function storagePath(userId: string, txId: string): string {
  return `${userId}/${txId}`;
}

async function pushRecord(userId: string, rec: StoredRecord, blob: Blob): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error: upErr } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath(userId, rec.txId), blob, {
        contentType: "application/octet-stream",
        upsert: true, // retry-safe: same txId always carries the same ciphertext
      });
    if (upErr) return false;
    const { error: insErr } = await supabase.from("evidence_records").upsert(
      {
        user_id: userId,
        tx_id: rec.txId,
        wrapped_file_key: rec.wrappedFileKey,
        encrypted_meta: rec.encryptedMeta,
        original_hash: rec.originalHash,
        encrypted_hash: rec.encryptedHash,
        capture_grade: rec.captureGrade,
        client_time: rec.clientTime,
      },
      { onConflict: "tx_id" }
    );
    return !insErr;
  } catch {
    return false;
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function generateTxId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const random = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(random)
    .map((b) => chars[b % chars.length])
    .join("");
}

/**
 * Save one encrypted file: blob → private bucket, record → cloud index.
 * Falls back to the local pending queue when the cloud is unreachable.
 */
export interface SaveEvidenceOptions {
  fileName?: string;
  note?: string;
  captureGrade?: 1 | 2;
  capturedAt?: string;
  location?: CaptureLocation;
  deviceInfo?: string;
}

export async function saveEvidence(
  userId: string,
  enc: EncryptionResult,
  opts: SaveEvidenceOptions = {}
): Promise<EvidenceRecord> {
  const masterKey = getSessionMasterKey();
  if (!masterKey) throw new Error("vault-locked");

  const meta: EvidenceMeta = {
    fileName: opts.fileName,
    mimeType: enc.mimeType,
    originalSize: enc.originalSize,
    note: opts.note,
    capturedAt: opts.capturedAt,
    location: opts.location,
    deviceInfo: opts.deviceInfo,
  };

  const [wrappedFileKey, encryptedMeta] = await Promise.all([
    sealJson(masterKey, { key: enc.exportedKey, iv: enc.ivHex }),
    sealJson(masterKey, meta),
  ]);

  const rec: StoredRecord = {
    txId: generateTxId(),
    wrappedFileKey,
    encryptedMeta,
    originalHash: enc.originalHash,
    encryptedHash: enc.encryptedHash,
    captureGrade: opts.captureGrade ?? 2,
    clientTime: new Date().toISOString(),
  };

  await cacheBlob(rec.txId, enc.encryptedBlob);

  const synced = await pushRecord(userId, rec, enc.encryptedBlob);
  if (synced) {
    writeList(indexKey(userId), [rec, ...readList(indexKey(userId))]);
  } else {
    writeList(pendingKey(userId), [rec, ...readList(pendingKey(userId))]);
  }

  return { ...rec, meta, syncStatus: synced ? "synced" : "pending" };
}

/** Retry everything in the pending queue. Returns how many are still pending. */
export async function syncPendingEvidence(userId: string): Promise<number> {
  const pending = readList(pendingKey(userId));
  if (pending.length === 0) return 0;
  const stillPending: StoredRecord[] = [];
  for (const rec of pending) {
    const blob = await readCachedBlob(rec.txId);
    if (blob && (await pushRecord(userId, rec, blob))) {
      writeList(indexKey(userId), [rec, ...readList(indexKey(userId))]);
    } else {
      stillPending.push(rec);
    }
  }
  writeList(pendingKey(userId), stillPending);
  return stillPending.length;
}

/**
 * List records: cloud index first (kept mirrored locally for offline),
 * plus anything still waiting in the pending queue.
 */
export async function listEvidence(userId: string): Promise<EvidenceRecord[]> {
  const masterKey = getSessionMasterKey();
  if (!masterKey) throw new Error("vault-locked");

  let synced = readList(indexKey(userId));
  if (supabase) {
    const { data, error } = await supabase
      .from("evidence_records")
      .select(
        "tx_id, wrapped_file_key, encrypted_meta, original_hash, encrypted_hash, capture_grade, client_time, created_at"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!error && data) {
      synced = data.map((r) => ({
        txId: r.tx_id as string,
        wrappedFileKey: r.wrapped_file_key as string,
        encryptedMeta: r.encrypted_meta as string,
        originalHash: r.original_hash as string,
        encryptedHash: r.encrypted_hash as string,
        captureGrade: (r.capture_grade as 1 | 2) ?? 2,
        clientTime: r.client_time as string,
        serverTime: r.created_at as string,
      }));
      writeList(indexKey(userId), synced);
    }
  }

  const pending = readList(pendingKey(userId));
  const decrypt = async (rec: StoredRecord, syncStatus: SyncStatus): Promise<EvidenceRecord | null> => {
    try {
      return { ...rec, meta: await openJson<EvidenceMeta>(masterKey, rec.encryptedMeta), syncStatus };
    } catch {
      return null; // sealed with a different master key (should not happen) — hide rather than crash
    }
  };

  const all = await Promise.all([
    ...pending.map((r) => decrypt(r, "pending")),
    ...synced.map((r) => decrypt(r, "synced")),
  ]);
  return all.filter((r): r is EvidenceRecord => r !== null);
}

/**
 * Fetch + verify + decrypt one file. Local cache first, then the private
 * bucket. The ciphertext hash is checked before decryption.
 */
export async function openEvidenceFile(
  userId: string,
  record: EvidenceRecord
): Promise<Blob> {
  const masterKey = getSessionMasterKey();
  if (!masterKey) throw new Error("vault-locked");

  let blob = await readCachedBlob(record.txId);
  if (!blob && supabase) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(storagePath(userId, record.txId));
    if (!error && data) {
      blob = data;
      void cacheBlob(record.txId, blob);
    }
  }
  if (!blob) throw new Error("file-unavailable");

  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex !== record.encryptedHash) throw new Error("integrity-check-failed");

  const { key, iv } = await openJson<{ key: JsonWebKey; iv: string }>(
    masterKey,
    record.wrappedFileKey
  );
  return decryptFile(blob, key, iv, record.meta.mimeType);
}

// ── 72h delete cooling-off (anti-coercion, D-022) ─────────────────────────────
// Deletion must LOOK final in the UI: a coerced deletion shows "已删除" and the
// record vanishes. Recovery lives behind an inconspicuous entry + password
// re-verification. Never surface recovery copy on the delete path itself.

export const DELETE_RETENTION_MS = 72 * 60 * 60 * 1000;

export interface DeletedEvidenceRecord extends EvidenceRecord {
  deletedAt: string;
}

/** Permanently remove records whose 72h cooling-off has expired. Best-effort. */
export async function purgeExpiredEvidence(userId: string): Promise<void> {
  if (!supabase) return;
  try {
    const { data, error } = await supabase
      .from("evidence_records")
      .select("tx_id, deleted_at")
      .not("deleted_at", "is", null);
    if (error || !data) return;
    const expired = data.filter(
      (r) => Date.now() - new Date(r.deleted_at as string).getTime() >= DELETE_RETENTION_MS
    );
    if (expired.length === 0) return;
    const txIds = expired.map((r) => r.tx_id as string);
    await supabase.storage.from(BUCKET).remove(txIds.map((t) => storagePath(userId, t)));
    await supabase.from("evidence_records").delete().in("tx_id", txIds);
  } catch {
    // purge retries on the next records view open
  }
}

/** Records still inside the 72h window, oldest deletion last. */
export async function listDeletedEvidence(userId: string): Promise<DeletedEvidenceRecord[]> {
  const masterKey = getSessionMasterKey();
  if (!masterKey) throw new Error("vault-locked");
  if (!supabase) return [];

  await purgeExpiredEvidence(userId);

  const { data, error } = await supabase
    .from("evidence_records")
    .select(
      "tx_id, wrapped_file_key, encrypted_meta, original_hash, encrypted_hash, capture_grade, client_time, created_at, deleted_at"
    )
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });
  if (error || !data) return [];

  const out = await Promise.all(
    data.map(async (r): Promise<DeletedEvidenceRecord | null> => {
      try {
        const encryptedMeta = r.encrypted_meta as string;
        return {
          txId: r.tx_id as string,
          wrappedFileKey: r.wrapped_file_key as string,
          encryptedMeta,
          originalHash: r.original_hash as string,
          encryptedHash: r.encrypted_hash as string,
          captureGrade: (r.capture_grade as 1 | 2) ?? 2,
          clientTime: r.client_time as string,
          serverTime: r.created_at as string,
          deletedAt: r.deleted_at as string,
          meta: await openJson<EvidenceMeta>(masterKey, encryptedMeta),
          syncStatus: "synced",
        };
      } catch {
        return null;
      }
    })
  );
  return out.filter((r): r is DeletedEvidenceRecord => r !== null);
}

/** Undo a soft delete within the 72h window. */
export async function restoreEvidence(txId: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase
    .from("evidence_records")
    .update({ deleted_at: null })
    .eq("tx_id", txId);
  return !error;
}

/**
 * Soft delete: the record disappears from every list immediately, but the
 * ciphertext stays in the cloud for 72h (see purgeExpiredEvidence).
 * Pending (never-uploaded) records are removed outright — there is no cloud
 * copy to recover.
 */
export async function deleteEvidence(userId: string, record: EvidenceRecord): Promise<void> {
  if (record.syncStatus === "pending") {
    writeList(
      pendingKey(userId),
      readList(pendingKey(userId)).filter((r) => r.txId !== record.txId)
    );
  } else {
    if (supabase) {
      await supabase
        .from("evidence_records")
        .update({ deleted_at: new Date().toISOString() })
        .eq("tx_id", record.txId);
    }
    writeList(
      indexKey(userId),
      readList(indexKey(userId)).filter((r) => r.txId !== record.txId)
    );
  }
  await removeCachedBlob(record.txId);
}
