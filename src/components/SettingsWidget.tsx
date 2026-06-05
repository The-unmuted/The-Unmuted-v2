import { useState, useEffect } from "react";
import { Settings, X, LogOut, User, Check, Loader2 } from "lucide-react";
import { copyFor } from "@/lib/locale";
import { getLocalUsername, saveUsername } from "@/lib/userCredentials";

interface SettingsWidgetProps {
  language: "en" | "zh";
  email: string;
  onLogout: () => void;
}

export default function SettingsWidget({ language, email, onLogout }: SettingsWidgetProps) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(() => getLocalUsername());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setUsername(getLocalUsername());
  }, [open]);

  const handleSaveUsername = async () => {
    if (!username.trim()) return;
    setSaving(true);
    await saveUsername(email, username.trim());
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Settings"
        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card/90 text-primary transition-colors hover:bg-accent"
      >
        <Settings className="h-3 w-3" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {open && (
        <div className="fixed left-1/2 top-1/2 z-50 w-[min(90vw,340px)] -translate-x-1/2 -translate-y-1/2 rounded-3xl border border-border bg-card p-5 shadow-2xl">
          {/* Header */}
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm font-bold text-foreground">
              {copyFor(language, "Settings", "设置")}
            </p>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full p-1 text-muted-foreground hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Username */}
          <div className="mb-4">
            <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <User className="h-3.5 w-3.5" />
              {copyFor(language, "Display name", "显示名称")}
            </label>
            <div className="flex gap-2">
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={copyFor(language, "Your name (visible to others)", "你的名字（他人可见）")}
                className="flex-1 rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
              <button
                onClick={handleSaveUsername}
                disabled={!username.trim() || saving}
                className="flex items-center justify-center rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : saved ? (
                  <Check className="h-4 w-4" />
                ) : (
                  copyFor(language, "Save", "保存")
                )}
              </button>
            </div>
          </div>

          {/* Divider */}
          <div className="my-4 h-px bg-border" />

          {/* Logout */}
          <button
            onClick={() => { setOpen(false); onLogout(); }}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-border py-3 text-sm font-semibold text-muted-foreground transition-colors hover:border-red-500/50 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            {copyFor(language, "Sign out", "退出登录")}
          </button>
          <p className="mt-2 text-center text-[11px] text-muted-foreground">
            {copyFor(
              language,
              "Sign out to switch email or wallet.",
              "退出后可重新选择登录方式或更换邮箱。"
            )}
          </p>
        </div>
      )}
    </>
  );
}
