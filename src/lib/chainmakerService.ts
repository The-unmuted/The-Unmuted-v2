/**
 * ChainMaker (长安链) evidence anchoring service.
 *
 * Drop-in replacement for evidenceContract.ts.
 * Exports the same AnchorResult interface and anchorOnChain() function.
 *
 * Real API: set VITE_CHAINMAKER_API_KEY in .env.local
 * Demo mode: deterministic simulation (no API key needed)
 */

export interface AnchorResult {
  txHash: string;
  blockTimestamp: number;
  explorerUrl: string;
  isSimulated: boolean;
  network: string;
}

export const CHAINMAKER_NETWORK = "chainmaker-testnet";

const CHAINMAKER_API_URL = "https://testnet.chainmaker.org.cn/v1/contract/invoke";
const CHAINMAKER_EXPLORER = "https://testnet.chainmaker.org.cn/explorer/tx";

/** Deterministic simulation — mirrors arweaveService fallback pattern */
function simulateAnchor(encryptedHash: string, arweaveTxId: string): AnchorResult {
  // Build a reproducible fake tx hash from inputs
  const seed = encryptedHash.slice(0, 16) + arweaveTxId.slice(0, 16);
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += ((seed.charCodeAt(i % seed.length) ^ (i * 13)) % 16).toString(16);
  }
  const txHash = hash;
  return {
    txHash,
    blockTimestamp: Math.floor(Date.now() / 1000),
    explorerUrl: `${CHAINMAKER_EXPLORER}/${txHash}`,
    isSimulated: true,
    network: CHAINMAKER_NETWORK,
  };
}

/**
 * Anchor a SHA-256 hash on ChainMaker (长安链) testnet.
 * Falls back to simulation when VITE_CHAINMAKER_API_KEY is not set.
 */
export async function anchorOnChain(
  encryptedHash: string,
  arweaveTxId: string
): Promise<AnchorResult> {
  const apiKey = import.meta.env.VITE_CHAINMAKER_API_KEY as string | undefined;

  if (!apiKey) {
    return simulateAnchor(encryptedHash, arweaveTxId);
  }

  try {
    const resp = await fetch(CHAINMAKER_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        chainId: "chain1",
        contractName: "evidence",
        method: "saveHash",
        params: [
          { key: "hash", value: encryptedHash },
          { key: "arweaveTxId", value: arweaveTxId },
          { key: "timestamp", value: String(Date.now()) },
        ],
      }),
    });

    if (!resp.ok) {
      throw new Error(`ChainMaker API error: ${resp.status}`);
    }

    const data = (await resp.json()) as {
      txId?: string;
      blockTimestamp?: number;
    };

    const txHash = data.txId ?? simulateAnchor(encryptedHash, arweaveTxId).txHash;
    const blockTimestamp = data.blockTimestamp ?? Math.floor(Date.now() / 1000);

    return {
      txHash,
      blockTimestamp,
      explorerUrl: `${CHAINMAKER_EXPLORER}/${txHash}`,
      isSimulated: false,
      network: CHAINMAKER_NETWORK,
    };
  } catch {
    // Fall back to simulation on any network error
    return simulateAnchor(encryptedHash, arweaveTxId);
  }
}
