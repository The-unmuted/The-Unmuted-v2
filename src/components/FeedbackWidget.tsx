import { useState } from "react";
import { Mail, X, Send, CheckCircle2, Loader2 } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { copyFor } from "@/lib/locale";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

type FeedbackType = "bug" | "suggestion" | "other";

interface FeedbackWidgetProps {
  language: "en" | "zh";
}

export default function FeedbackWidget({ language }: FeedbackWidgetProps) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("suggestion");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");

  const typeLabels: Record<FeedbackType, { en: string; zh: string }> = {
    bug:        { en: "Bug",        zh: "问题" },
    suggestion: { en: "Suggestion", zh: "建议" },
    other:      { en: "Other",      zh: "其他" },
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setStatus("sending");
    if (!supabase) { setStatus("error"); return; }
    const { error } = await supabase
      .from("unmuted_feedback")
      .insert({ type, message: message.trim(), language });

    if (error) {
      setStatus("error");
    } else {
      setStatus("done");
      setTimeout(() => {
        setOpen(false);
        setMessage("");
        setType("suggestion");
        setStatus("idle");
      }, 1800);
    }
  };

  return (
    <>
      {/* Trigger button — sits next to language toggle */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Feedback"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 text-primary transition-colors hover:bg-accent"
      >
        <Mail className="h-3 w-3" />
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Modal */}
      {open && (
        <div className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,360px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-card p-5 shadow-2xl">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">
              {copyFor(language, "Send feedback", "发送反馈")}
            </p>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {status === "done" ? (
            <div className="flex flex-col items-center gap-2 py-6">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <p className="text-sm font-semibold text-foreground">
                {copyFor(language, "Thank you!", "感谢你的反馈！")}
              </p>
            </div>
          ) : (
            <>
              {/* Type selector */}
              <div className="mb-3 flex gap-2">
                {(["bug", "suggestion", "other"] as FeedbackType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={`flex-1 rounded-2xl border py-2 text-xs font-semibold transition-colors ${
                      type === t
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {copyFor(language, typeLabels[t].en, typeLabels[t].zh)}
                  </button>
                ))}
              </div>

              {/* Message */}
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={copyFor(language, "Describe your feedback…", "请描述你的反馈…")}
                rows={4}
                className="w-full resize-none rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />

              {status === "error" && (
                <p className="mt-1 text-xs text-red-400">
                  {copyFor(language, "Failed to send. Please try again.", "发送失败，请重试。")}
                </p>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!message.trim() || status === "sending"}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {status === "sending"
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Send className="h-4 w-4" />}
                {copyFor(language, "Submit", "提交")}
              </button>
            </>
          )}
        </div>
      )}
    </>
  );
}
