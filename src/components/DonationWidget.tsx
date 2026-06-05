/**
 * DonationWidget — 捐款入口
 *
 * 使用方法：
 *   1. 将你的微信/支付宝收款二维码图片放到 public/ 目录：
 *      - public/donation-wechat.png   （微信收款码）
 *      - public/donation-alipay.png   （支付宝收款码）
 *   2. 如果只有一个收款方式，删掉另一个 tab 即可。
 */

import { useState } from "react";
import { Heart, X } from "lucide-react";
import { copyFor } from "@/lib/locale";

interface DonationWidgetProps {
  language: "en" | "zh";
}

type PayChannel = "wechat" | "alipay";

// ── 配置项：填入你的收款二维码图片路径 ─────────────────────────────────────
// 将图片放在 /public 目录，然后填写文件名（相对于 /public）
const WECHAT_QR_PATH  = "/donation-wechat.png";   // 微信收款码
const ALIPAY_QR_PATH  = "/donation-alipay.png";   // 支付宝收款码

// 若图片未配置时显示的占位说明
const QR_PLACEHOLDER = null; // 设为 null 则显示内置占位图

export default function DonationWidget({ language }: DonationWidgetProps) {
  const [open, setOpen]       = useState(false);
  const [channel, setChannel] = useState<PayChannel>("wechat");

  const qrSrc = channel === "wechat" ? WECHAT_QR_PATH : ALIPAY_QR_PATH;

  return (
    <>
      {/* 触发按钮 — 与 FeedbackWidget 样式一致 */}
      <button
        onClick={() => setOpen(true)}
        aria-label={copyFor(language, "Support us", "支持我们")}
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 text-primary transition-colors hover:bg-accent"
      >
        <Heart className="h-3 w-3" />
      </button>

      {/* 蒙层 */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* 弹窗 */}
      {open && (
        <div className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,340px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-card p-5 shadow-2xl">

          {/* 标题行 */}
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              <p className="text-sm font-bold text-foreground">
                {copyFor(language, "Support The Unmuted", "支持「非默」")}
              </p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* 说明文字 */}
          <p className="mb-4 text-xs leading-5 text-muted-foreground">
            {copyFor(
              language,
              "All donations go directly to on-chain evidence anchoring fees and platform maintenance. We are students building this for free.",
              "所有捐款将全部用于区块链存证上链费用及平台维护。我们是学生团队，免费构建这个平台。"
            )}
          </p>

          {/* 支付渠道选择 */}
          <div className="mb-4 flex gap-2">
            {(["wechat", "alipay"] as PayChannel[]).map((ch) => (
              <button
                key={ch}
                onClick={() => setChannel(ch)}
                className={`flex-1 rounded-2xl border py-2 text-xs font-semibold transition-colors ${
                  channel === ch
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {ch === "wechat"
                  ? copyFor(language, "WeChat Pay", "微信支付")
                  : copyFor(language, "Alipay", "支付宝")}
              </button>
            ))}
          </div>

          {/* 二维码区域 */}
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-background p-4">
            {QR_PLACEHOLDER === null ? (
              <QrCodeImage src={qrSrc} channel={channel} language={language} />
            ) : (
              <img src={QR_PLACEHOLDER} alt="donation QR" className="h-44 w-44 object-contain" />
            )}
            <p className="text-xs font-semibold text-muted-foreground">
              {copyFor(language, "Scan to donate", "扫码捐款，感谢你的支持 ❤️")}
            </p>
          </div>

          {/* 底部说明 */}
          <p className="mt-3 text-center text-[11px] leading-4 text-muted-foreground/70">
            {copyFor(
              language,
              "No fixed amount — any contribution helps. Thank you.",
              "金额随意，每一分都很有意义，谢谢你。"
            )}
          </p>
        </div>
      )}
    </>
  );
}

/**
 * 二维码图片组件：有图片时显示图片，图片缺失时显示内置占位符（提示开发者配置）
 */
function QrCodeImage({
  src,
  channel,
  language,
}: {
  src: string;
  channel: PayChannel;
  language: "en" | "zh";
}) {
  const [errored, setErrored] = useState(false);

  if (!errored) {
    return (
      <img
        src={src}
        alt={channel === "wechat" ? "WeChat QR" : "Alipay QR"}
        className="h-44 w-44 object-contain"
        onError={() => setErrored(true)}
      />
    );
  }

  // 图片未找到时的占位符（开发模式提示）
  return (
    <div className="flex h-44 w-44 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border bg-muted/30">
      {/* 简易 QR 图标 */}
      <svg viewBox="0 0 80 80" className="h-16 w-16 text-muted-foreground/40" fill="currentColor">
        <rect x="4"  y="4"  width="30" height="30" rx="3" fillOpacity="0.4"/>
        <rect x="9"  y="9"  width="20" height="20" rx="1" fill="none" stroke="currentColor" strokeWidth="3"/>
        <rect x="13" y="13" width="12" height="12" rx="1"/>
        <rect x="46" y="4"  width="30" height="30" rx="3" fillOpacity="0.4"/>
        <rect x="51" y="9"  width="20" height="20" rx="1" fill="none" stroke="currentColor" strokeWidth="3"/>
        <rect x="55" y="13" width="12" height="12" rx="1"/>
        <rect x="4"  y="46" width="30" height="30" rx="3" fillOpacity="0.4"/>
        <rect x="9"  y="51" width="20" height="20" rx="1" fill="none" stroke="currentColor" strokeWidth="3"/>
        <rect x="13" y="55" width="12" height="12" rx="1"/>
        <rect x="46" y="46" width="8"  height="8"  rx="1"/>
        <rect x="58" y="46" width="8"  height="8"  rx="1"/>
        <rect x="46" y="58" width="8"  height="8"  rx="1"/>
        <rect x="58" y="58" width="18" height="8"  rx="1"/>
        <rect x="68" y="46" width="8"  height="8"  rx="1"/>
      </svg>
      <p className="max-w-[120px] text-center text-[10px] leading-4 text-muted-foreground/60">
        {language === "zh"
          ? `请将${channel === "wechat" ? "微信" : "支付宝"}收款码\n放入 public/${channel === "wechat" ? "donation-wechat" : "donation-alipay"}.png`
          : `Add your ${channel === "wechat" ? "WeChat" : "Alipay"} QR to public/${channel === "wechat" ? "donation-wechat" : "donation-alipay"}.png`
        }
      </p>
    </div>
  );
}
