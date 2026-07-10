/**
 * Evidence pipeline hook (production track, D-016/D-017).
 *
 * Encrypt on device → ciphertext to the private cloud vault, record into the
 * encrypted cloud index. No key files for the user to babysit: per-file keys
 * are wrapped by the session master key (password / paper recovery code).
 *
 * Legacy demo records (localStorage + user-held JSON key bundles) remain
 * readable via `legacyHistory` but nothing new is written to that path.
 */

import { useState, useEffect, useCallback } from 'react';
import { encryptFile, type EncryptionResult } from '@/lib/evidenceCrypto';
import {
  saveEvidence,
  listEvidence,
  openEvidenceFile,
  syncPendingEvidence,
  deleteEvidence,
  purgeExpiredEvidence,
  type EvidenceRecord,
  type SaveEvidenceOptions,
} from '@/lib/evidenceVaultService';
import { getSessionMasterKey } from '@/lib/keyVaultService';
import { getCurrentUser } from '@/lib/authService';
import { loadVaultRecords, type VaultRecord } from '@/lib/localStorage';
import { AppLanguage, copyFor } from '@/lib/locale';

export type VaultStep = 'idle' | 'encrypting' | 'saving' | 'done' | 'error';

export interface VaultStepStatus {
  encrypting: 'pending' | 'running' | 'done' | 'error';
  saving: 'pending' | 'running' | 'done' | 'error';
}

export interface VaultResult {
  record: EvidenceRecord;
  encryptionResult: EncryptionResult;
}

export function useEvidenceVault(language: AppLanguage = 'en') {
  const [step, setStep] = useState<VaultStep>('idle');
  const [steps, setSteps] = useState<VaultStepStatus>({ encrypting: 'pending', saving: 'pending' });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VaultResult | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [history, setHistory] = useState<EvidenceRecord[]>([]);
  const [legacyHistory] = useState<VaultRecord[]>(() => loadVaultRecords());

  const canUseVault = Boolean(userId && getSessionMasterKey());

  useEffect(() => {
    getCurrentUser().then((u) => setUserId(u?.id ?? null));
  }, []);

  const refreshHistory = useCallback(async () => {
    if (!userId || !getSessionMasterKey()) return;
    void purgeExpiredEvidence(userId);
    try {
      setHistory(await listEvidence(userId));
    } catch {
      // vault locked or offline with no mirror — leave the list as-is
    }
  }, [userId]);

  // Flush the pending queue whenever the network comes back
  useEffect(() => {
    if (!userId) return;
    const retry = () => void syncPendingEvidence(userId).then(() => refreshHistory());
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [userId, refreshHistory]);

  const processFile = useCallback(
    async (blob: Blob, mimeType: string, opts: SaveEvidenceOptions = {}) => {
      setStep('encrypting');
      setError(null);
      setResult(null);
      setSteps({ encrypting: 'running', saving: 'pending' });

      if (!userId || !getSessionMasterKey()) {
        setSteps({ encrypting: 'error', saving: 'pending' });
        setError(
          copyFor(
            language,
            'Please sign in with your cloud account first — evidence is stored in your encrypted cloud vault.',
            '请先登录云端账号——证据会存入你的加密云端保险柜。'
          )
        );
        setStep('error');
        return;
      }

      let enc: EncryptionResult;
      try {
        enc = await encryptFile(blob, mimeType);
        setSteps({ encrypting: 'done', saving: 'running' });
        setStep('saving');
      } catch (e) {
        setSteps({ encrypting: 'error', saving: 'pending' });
        setError(copyFor(language, 'Encryption failed: ', '加密失败：') + (e instanceof Error ? e.message : String(e)));
        setStep('error');
        return;
      }

      try {
        const record = await saveEvidence(userId, enc, opts);
        setSteps({ encrypting: 'done', saving: 'done' });
        setResult({ record, encryptionResult: enc });
        setHistory((prev) => [record, ...prev]);
        setStep('done');
      } catch (e) {
        setSteps({ encrypting: 'done', saving: 'error' });
        setError(copyFor(language, 'Could not save: ', '保存失败：') + (e instanceof Error ? e.message : String(e)));
        setStep('error');
      }
    },
    [language, userId]
  );

  /** Decrypt one record back to the original file (cache or cloud) */
  const openFile = useCallback(
    async (record: EvidenceRecord): Promise<Blob | null> => {
      if (!userId) return null;
      try {
        return await openEvidenceFile(userId, record);
      } catch {
        return null;
      }
    },
    [userId]
  );

  /** Soft delete — record vanishes from the list; no recovery hints here (D-022) */
  const deleteRecord = useCallback(
    async (record: EvidenceRecord): Promise<boolean> => {
      if (!userId) return false;
      try {
        await deleteEvidence(userId, record);
        setHistory((prev) => prev.filter((r) => r.txId !== record.txId));
        return true;
      } catch {
        return false;
      }
    },
    [userId]
  );

  /** Retry pending uploads; refresh statuses afterwards */
  const syncNow = useCallback(async () => {
    if (!userId) return;
    await syncPendingEvidence(userId);
    await refreshHistory();
  }, [userId, refreshHistory]);

  const reset = useCallback(() => {
    setStep('idle');
    setSteps({ encrypting: 'pending', saving: 'pending' });
    setError(null);
    setResult(null);
  }, []);

  return {
    step,
    steps,
    error,
    result,
    history,
    legacyHistory,
    userId,
    canUseVault,
    processFile,
    openFile,
    deleteRecord,
    refreshHistory,
    syncNow,
    reset,
  };
}
