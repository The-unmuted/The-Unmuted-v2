/**
 * Evidence file storage service.
 *
 * 当前实现：将加密文件上传至 Supabase Storage（真实存储，永久保留）。
 * 文件在上传前已经过 AES-256-GCM 加密，服务器端无法读取内容。
 *
 * 为保持向后兼容，接口名称保留 "Arweave" 前缀（未来可换成真实 Arweave/IPFS）。
 *
 * 降级逻辑：Supabase 上传失败时，自动存入浏览器 IndexedDB（仅限本设备）。
 */

import { createClient } from "@supabase/supabase-js";

// ── Supabase 客户端 ────────────────────────────────────────────────────────────
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const BUCKET = "evidence-vault";

// ── IndexedDB 降级存储 ─────────────────────────────────────────────────────────
const DB_NAME = "the_unmuted_vault";
const DB_VERSION = 1;
const STORE_NAME = "encrypted_files";

async function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: "txId" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function storeInIndexedDB(
  txId: string,
  encryptedBlob: Blob,
  meta: { originalHash: string; mimeType: string; timestamp: string }
): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({ txId, encryptedBlob, meta });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // IndexedDB 失败时忽略 — 文件仍在内存
  }
}

// ── 生成唯一文件 ID ───────────────────────────────────────────────────────────
function generateFileId(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const random = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(random)
    .map((b) => chars[b % chars.length])
    .join("");
}

export interface ArweaveUploadResult {
  txId: string;       // 文件唯一 ID（用于检索）
  arweaveUrl: string; // 文件访问 URL
  isDemoMode: boolean;
}

/**
 * 上传加密文件到 Supabase Storage。
 * Supabase 不可用时降级到 IndexedDB（仅本设备可访问）。
 */
export async function uploadToArweave(
  encryptedBlob: Blob,
  originalHash: string,
  mimeType: string
): Promise<ArweaveUploadResult> {
  const txId = generateFileId();
  const timestamp = new Date().toISOString();

  // ── 优先：Supabase Storage（跨设备永久保存）──────────────────────────────
  if (supabase) {
    try {
      const filePath = `vault/${txId}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, encryptedBlob, {
          contentType: "application/octet-stream",
          upsert: false,
        });

      if (!error) {
        const {
          data: { publicUrl },
        } = supabase.storage.from(BUCKET).getPublicUrl(filePath);

        return {
          txId,
          arweaveUrl: publicUrl,
          isDemoMode: false,
        };
      }
      console.warn("[Storage] Supabase upload failed:", error.message);
    } catch (e) {
      console.warn("[Storage] Supabase error:", e);
    }
  }

  // ── 降级：IndexedDB（仅本设备，清除浏览器数据后丢失）────────────────────
  await storeInIndexedDB(txId, encryptedBlob, {
    originalHash,
    mimeType,
    timestamp,
  });

  return {
    txId,
    arweaveUrl: "", // 无远程 URL
    isDemoMode: true,
  };
}

/** 从 IndexedDB 取回加密文件（供本地验证） */
export async function retrieveEncryptedFile(txId: string): Promise<Blob | null> {
  try {
    const db = await openDB();
    const result = await new Promise<{ encryptedBlob?: Blob } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(txId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      }
    );
    return result?.encryptedBlob ?? null;
  } catch {
    return null;
  }
}
