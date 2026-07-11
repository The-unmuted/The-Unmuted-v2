import { useState, useEffect } from "react";
import { Settings, X, LogOut, Loader2, KeyRound } from "lucide-react";
import { copyFor } from "@/lib/locale";
import { getCurrentUser } from "@/lib/authService";
import { unlockWithPassword, changePassword } from "@/lib/keyVaultService";

interface SettingsWidgetProps {
  language: "en" | "zh";
  onLogout: () => void;
}

export default function SettingsWidget({ language, onLogout }: SettingsWidgetProps) {
  const [open, setOpen] = useState(false);
  const [userId, setUserId] = useState("");
  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);
  const [pwdDone, setPwdDone] = useState(false);

  useEffect(() => {
    setCurrentPwd("");
    setNewPwd("");
    setPwdError(null);
    setPwdDone(false);
    if (open) void getCurrentUser().then((u) => setUserId(u?.id ?? ""));
  }, [open]);

  const handleChangePassword = async () => {
    const trimmedNew = newPwd.trim();
    setPwdError(null);
    setPwdDone(false);
    if (trimmedNew.length < 8) {
      setPwdError(copyFor(language, "New password needs at least 8 characters.", "新密码至少需要 8 个字符。"));
      return;
    }
    setPwdBusy(true);
    const res = await unlockWithPassword(userId, currentPwd);
    if (!res.ok) {
      setPwdBusy(false);
      setPwdError(
        res.reason === "vault-unavailable"
          ? copyFor(language, "Couldn't open your vault right now. Check your connection and try again.", "暂时打不开你的保险柜。请检查网络后再试。")
          : copyFor(language, "Current password is incorrect.", "当前密码不正确。")
      );
      return;
    }
    const ok = await changePassword(userId, trimmedNew);
    setPwdBusy(false);
    if (!ok) {
      setPwdError(copyFor(language, "Could not update the password. Try again.", "密码修改失败，请稍后再试。"));
      return;
    }
    setCurrentPwd("");
    setNewPwd("");
    setPwdDone(true);
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

          {/* Change vault password (cloud accounts only) */}
          {userId && (
            <>
              <div className="mb-1">
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5" />
                  {copyFor(language, "Change password", "修改密码")}
                </label>
                <div className="space-y-2">
                  <input
                    type="password"
                    value={currentPwd}
                    onChange={(e) => setCurrentPwd(e.target.value)}
                    placeholder={copyFor(language, "Current password", "当前密码")}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                  <input
                    type="password"
                    value={newPwd}
                    onChange={(e) => setNewPwd(e.target.value)}
                    placeholder={copyFor(language, "New password (at least 8 characters)", "新密码（至少 8 个字符）")}
                    className="w-full rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
                  />
                  {pwdError && <p className="text-xs leading-5 text-destructive">{pwdError}</p>}
                  {pwdDone && (
                    <p className="text-xs leading-5 text-primary">
                      {copyFor(language, "Password updated. Use the new one from now on.", "密码已修改，下次解锁请用新密码。")}
                    </p>
                  )}
                  <button
                    onClick={handleChangePassword}
                    disabled={!currentPwd || newPwd.trim().length < 8 || pwdBusy}
                    className="flex w-full items-center justify-center rounded-2xl bg-primary py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50"
                  >
                    {pwdBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      copyFor(language, "Update password", "确认修改")
                    )}
                  </button>
                  <p className="text-[11px] leading-4 text-muted-foreground">
                    {copyFor(
                      language,
                      "Your paper recovery key keeps working after the change.",
                      "修改后，你纸上的恢复钥匙仍然有效。"
                    )}
                  </p>
                </div>
              </div>
            </>
          )}

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
