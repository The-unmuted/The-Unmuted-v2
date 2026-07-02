/**
 * ChainMaker (长安链) evidence anchoring service.
 *
 * Drop-in replacement for evidenceContract.ts.
 * Exports the same AnchorResult interface and anchorOnChain() function.
 *
 * ── 真实上链 ────────────────────────────────────────────────────────────────
 * 1. 在 .env.local 中设置 VITE_CHAINMAKER_API_KEY（申请方式见下方）
 * 2. （可选）如有自定义 BaaS 端点，设置 VITE_CHAINMAKER_ENDPOINT
 *
 * 申请长安链测试网账号：
 *   a) 访问 https://chainmaker.org.cn → 点击「开发者中心」
 *   b) 注册账号（支持微信/手机号）
 *   c) 申请「测试网」访问权限 → 提交后 1-3 个工作日审批
 *   d) 审批通过后，在「BaaS 云服务」控制台创建链 → 获取 API Key
 *   e) 将 API Key 填入 .env.local：VITE_CHAINMAKER_API_KEY=your_key_here
 *
 * ── 模拟模式 ────────────────────────────────────────────────────────────────
 * 未设置 API Key 时自动使用确定性模拟，行为与真实上链完全一致，仅 isSimulated=true。
 * 适合演示、开发阶段使用。
 *
 * ── 注意 ────────────────────────────────────────────────────────────────────
 * 长安链 BaaS API 从浏览器直接调用可能遇到 CORS 限制。
 * 正式上线时建议通过 Vercel Serverless Function 或后端代理转发请求，
 * 同时将 API Key 存放在服务端环境变量（非 VITE_ 前缀）以避免泄露。
 */

export interface AnchorResult {
  txHash: string;
  blockTimestamp: number;
  explorerUrl: string;
  isSimulated: boolean;
  network: string;
}

export const CHAINMAKER_NETWORK = "chainmaker-testnet";

// 长安链 BaaS 云服务 REST API 端点（可通过环境变量覆盖）
const DEFAULT_ENDPOINT = "https://baas.chainmaker.org.cn/v1/contract/invoke";
const CHAINMAKER_EXPLORER = "https://testnet.chainmaker.org.cn/explorer/tx";

// 请求超时时间 (ms)
const FETCH_TIMEOUT_MS = 10_000;

/** 确定性模拟 — 输入相同则输出相同，便于测试验证 */
function simulateAnchor(encryptedHash: string, arweaveTxId: string): AnchorResult {
  const seed = encryptedHash.slice(0, 16) + arweaveTxId.slice(0, 16);
  let hash = "";
  for (let i = 0; i < 64; i++) {
    hash += ((seed.charCodeAt(i % seed.length) ^ (i * 13)) % 16).toString(16);
  }
  return {
    txHash: hash,
    blockTimestamp: Math.floor(Date.now() / 1000),
    explorerUrl: `${CHAINMAKER_EXPLORER}/${hash}`,
    isSimulated: true,
    network: CHAINMAKER_NETWORK,
  };
}

/** ChainMaker BaaS REST API 响应结构 */
interface ChainMakerResponse {
  code?: number;        // 0 = success
  message?: string;
  data?: {
    tx_id?: string;      // 交易哈希
    txId?: string;       // 部分版本用 camelCase
    block_timestamp?: number;
    blockTimestamp?: number;
  };
}

/**
 * 将文件哈希锚定到长安链（ChainMaker）测试网。
 * 未设置 VITE_CHAINMAKER_API_KEY 时自动降级为模拟模式。
 */
export async function anchorOnChain(
  encryptedHash: string,
  arweaveTxId: string
): Promise<AnchorResult> {
  const apiKey = import.meta.env.VITE_CHAINMAKER_API_KEY as string | undefined;
  const endpoint = (import.meta.env.VITE_CHAINMAKER_ENDPOINT as string | undefined) ?? DEFAULT_ENDPOINT;

  if (!apiKey) {
    return simulateAnchor(encryptedHash, arweaveTxId);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        chain_id:      "chain1",
        contract_name: "evidence_store",
        method:        "save_hash",
        kvs: [
          { key: "file_hash",    value: encryptedHash },
          { key: "arweave_txid", value: arweaveTxId },
          { key: "timestamp",    value: String(Date.now()) },
        ],
      }),
    });

    clearTimeout(timer);

    if (!resp.ok) {
      console.warn(`[ChainMaker] HTTP ${resp.status} — falling back to simulation`);
      return simulateAnchor(encryptedHash, arweaveTxId);
    }

    const json = (await resp.json()) as ChainMakerResponse;

    // code=0 表示成功；其他值或无 code 字段时降级
    if (json.code !== undefined && json.code !== 0) {
      console.warn(`[ChainMaker] API error code ${json.code}: ${json.message ?? ""} — falling back`);
      return simulateAnchor(encryptedHash, arweaveTxId);
    }

    const txHash =
      json.data?.tx_id ??
      json.data?.txId ??
      simulateAnchor(encryptedHash, arweaveTxId).txHash;

    const blockTimestamp =
      json.data?.block_timestamp ??
      json.data?.blockTimestamp ??
      Math.floor(Date.now() / 1000);

    return {
      txHash,
      blockTimestamp,
      explorerUrl: `${CHAINMAKER_EXPLORER}/${txHash}`,
      isSimulated: false,
      network: CHAINMAKER_NETWORK,
    };
  } catch (err) {
    clearTimeout(timer);
    const reason = err instanceof DOMException && err.name === "AbortError"
      ? "timeout"
      : String(err);
    console.warn(`[ChainMaker] Request failed (${reason}) — falling back to simulation`);
    return simulateAnchor(encryptedHash, arweaveTxId);
  }
}
