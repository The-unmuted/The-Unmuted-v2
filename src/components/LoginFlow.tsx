/**
 * Login + key vault flow (D-017/D-018).
 *
 * Two independent layers:
 *   Account (can you log in?)  → email OTP code, enforced by Supabase.
 *   Data (can you decrypt?)    → password / paper recovery code, on-device only.
 *
 * Stages:
 *   checking → email → code → unlock (returning)           — daily path
 *                    ↘ set-password → show-recovery → confirm-recovery (first time)
 *   unlock → recovery-unlock (forgot password)
 *
 * When Supabase is unavailable (offline dev / no env) the legacy local
 * bcrypt path is used so the app still works — same pattern as D-013.
 */

import { useEffect, useState } from "react";
import { copyFor, type AppLanguage } from "@/lib/locale";
import { Eye, EyeOff, KeyRound, Loader2, Mail, PencilLine, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  isCloudAuthAvailable,
  requestLoginCode,
  verifyLoginCode,
  getSession,
  signOut,
} from "@/lib/authService";
import {
  createVault,
  hasVault,
  unlockWithPassword,
  unlockWithRecoveryCode,
} from "@/lib/keyVaultService";
import { normalizeRecoveryCode, isValidRecoveryCodeFormat } from "@/lib/keyVault";
import { hasPassword, verifyPassword, savePassword } from "@/lib/userCredentials";
import UnlockSOSEntry from "./UnlockSOSEntry";

const LOGO_SRC = "/the-unmuted-mark.png";

type Stage =
  | "checking"
  | "email"
  | "code"
  | "set-password"
  | "show-recovery"
  | "confirm-recovery"
  | "unlock"
  | "recovery-unlock"
  // legacy local-only fallback (no cloud):
  | "local-login"
  | "local-set-password";

export default function LoginFlow({
  language,
  onUnlocked,
}: {
  language: AppLanguage;
  onUnlocked: (email: string) => void;
}) {
  const [stage, setStage] = useState<Stage>("checking");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [busy, setBusy] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState("");
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const goTo = (next: Stage) => {
    setUnlockError(null);
    setStage(next);
  };

  const cloud = isCloudAuthAvailable();

  useEffect(() => {
    (async () => {
      if (!cloud) {
        setStage("email");
        return;
      }
      const session = await getSession();
      if (session?.user?.email) {
        setEmail(session.user.email);
        setUserId(session.user.id);
        setStage((await hasVault(session.user.id)) ? "unlock" : "set-password");
      } else {
        setStage("email");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEmail = async (value: string) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized.includes("@")) {
      toast.error(copyFor(language, "Enter a valid email address.", "请输入有效邮箱地址。"));
      return;
    }
    setEmail(normalized);
    if (!cloud) {
      setStage((await hasPassword(normalized)) ? "local-login" : "local-set-password");
      return;
    }
    setBusy(true);
    const { error } = await requestLoginCode(normalized);
    setBusy(false);
    if (error) {
      toast.error(
        copyFor(language, "Could not send the code. Try again.", "验证码发送失败，请稍后再试。")
      );
      return;
    }
    toast.success(copyFor(language, "Code sent to your email.", "验证码已发送到你的邮箱。"));
    setStage("code");
  };

  const handleCode = async (code: string) => {
    setBusy(true);
    const { user, error } = await verifyLoginCode(email, code);
    if (error || !user) {
      setBusy(false);
      toast.error(copyFor(language, "Wrong or expired code.", "验证码错误或已过期。"));
      return;
    }
    setUserId(user.id);
    const exists = await hasVault(user.id);
    setBusy(false);
    setStage(exists ? "unlock" : "set-password");
  };

  const handleSetPassword = async (rawPassword: string) => {
    // Trim so a pasted leading/trailing space never becomes part of the password
    const password = rawPassword.trim();
    if (password.length < 8) {
      toast.error(copyFor(language, "Use at least 8 characters.", "密码至少8位。"));
      return;
    }
    setBusy(true);
    try {
      const { recoveryCode: fresh } = await createVault(userId, password);
      setRecoveryCode(fresh);
      setStage("show-recovery");
    } catch {
      toast.error(copyFor(language, "Something went wrong. Try again.", "出错了，请重试。"));
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRecovery = (typed: string) => {
    if (normalizeRecoveryCode(typed) !== normalizeRecoveryCode(recoveryCode)) {
      toast.error(
        copyFor(
          language,
          "That doesn't match. Check your paper and try again.",
          "输入不一致。请对照纸上的内容再试一次。"
        )
      );
      return;
    }
    setRecoveryCode("");
    toast.success(copyFor(language, "All set. Welcome!", "设置完成，欢迎使用！"));
    onUnlocked(email);
  };

  const handleUnlock = async (password: string) => {
    setBusy(true);
    setUnlockError(null);
    const res = await unlockWithPassword(userId, password);
    setBusy(false);
    if (!res.ok) {
      setUnlockError(
        res.reason === "vault-unavailable"
          ? copyFor(
              language,
              "Couldn't open your vault right now. Check your connection and try again, or sign in again.",
              "暂时打不开你的保险柜。请检查网络后再试，或重新登录。"
            )
          : copyFor(language, "Incorrect password. Please try again.", "密码错误，请再试一次。")
      );
      return;
    }
    toast.success(copyFor(language, "Welcome back!", "欢迎回来！"));
    onUnlocked(email);
  };

  const handleRecoveryUnlock = async (code: string, rawNewPassword: string) => {
    const newPassword = rawNewPassword.trim();
    if (!isValidRecoveryCodeFormat(code)) {
      toast.error(
        copyFor(language, "That doesn't look like a recovery key.", "恢复钥匙格式不对，请检查。")
      );
      return;
    }
    if (newPassword.length < 8) {
      toast.error(copyFor(language, "New password: at least 8 characters.", "新密码至少8位。"));
      return;
    }
    setBusy(true);
    setUnlockError(null);
    const res = await unlockWithRecoveryCode(userId, code, newPassword);
    setBusy(false);
    if (!res.ok) {
      setUnlockError(
        res.reason === "vault-unavailable"
          ? copyFor(
              language,
              "Couldn't open your vault right now. Check your connection and try again, or sign in again.",
              "暂时打不开你的保险柜。请检查网络后再试，或重新登录。"
            )
          : copyFor(
              language,
              "Recovery key doesn't match. Check your paper copy character by character.",
              "恢复钥匙不正确，请逐个字符对照纸上的内容。"
            )
      );
      return;
    }
    toast.success(
      copyFor(
        language,
        "Evidence unlocked. Your new password is saved.",
        "证据已解锁，新密码已生效。"
      )
    );
    onUnlocked(email);
  };

  // Legacy local-only fallback
  const handleLocalLogin = async (password: string) => {
    setUnlockError(null);
    if (!(await verifyPassword(email, password))) {
      setUnlockError(copyFor(language, "Incorrect password. Please try again.", "密码错误，请再试一次。"));
      return;
    }
    onUnlocked(email);
  };
  const handleLocalSetPassword = async (password: string) => {
    if (password.length < 6) {
      toast.error(copyFor(language, "Password must be at least 6 characters.", "密码至少6位。"));
      return;
    }
    await savePassword(email, password);
    onUnlocked(email);
  };

  const switchAccount = async () => {
    await signOut();
    setEmail("");
    setUserId("");
    goTo("email");
  };

  return (
    <main className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <img
          src={LOGO_SRC}
          alt=""
          className="mx-auto mb-6 h-24 w-24 object-contain drop-shadow-[0_0_34px_hsl(var(--primary)/0.34)]"
        />

        {stage === "checking" && (
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
        )}

        {stage === "email" && (
          <EmailStep language={language} busy={busy} onSubmit={handleEmail} />
        )}

        {stage === "code" && (
          <CodeStep
            language={language}
            busy={busy}
            email={email}
            onSubmit={handleCode}
            onResend={() => handleEmail(email)}
            onBack={() => setStage("email")}
          />
        )}

        {stage === "set-password" && (
          <PasswordStep
            language={language}
            busy={busy}
            title={copyFor(language, "Set your password", "设置你的密码")}
            hint={copyFor(
              language,
              "This password protects your evidence. Don't use your birthday or anything others might guess. Never tell anyone — not even family.",
              "这个密码保护你的证据。不要用生日或别人猜得到的内容。不要告诉任何人——包括家人。"
            )}
            cta={copyFor(language, "Continue", "继续")}
            minLength={8}
            onSubmit={handleSetPassword}
          />
        )}

        {stage === "show-recovery" && (
          <ShowRecoveryStep
            language={language}
            recoveryCode={recoveryCode}
            onNext={() => setStage("confirm-recovery")}
          />
        )}

        {stage === "confirm-recovery" && (
          <ConfirmRecoveryStep
            language={language}
            onBack={() => setStage("show-recovery")}
            onSubmit={handleConfirmRecovery}
          />
        )}

        {stage === "unlock" && (
          <PasswordStep
            language={language}
            busy={busy}
            title={copyFor(language, `Welcome back`, "欢迎回来")}
            hint={email}
            cta={copyFor(language, "Unlock", "解锁")}
            minLength={1}
            error={unlockError}
            onSubmit={handleUnlock}
            footer={
              <div className="space-y-2">
                <button
                  onClick={() => goTo("recovery-unlock")}
                  className="w-full text-xs text-muted-foreground underline"
                >
                  {copyFor(language, "Forgot password? Use recovery key", "忘记密码？用纸上的恢复钥匙")}
                </button>
                <button onClick={switchAccount} className="w-full text-xs text-muted-foreground underline">
                  {copyFor(language, "Use a different email", "使用其他邮箱")}
                </button>
              </div>
            }
          />
        )}

        {stage === "recovery-unlock" && (
          <RecoveryUnlockStep
            language={language}
            busy={busy}
            error={unlockError}
            onBack={() => goTo("unlock")}
            onSubmit={handleRecoveryUnlock}
          />
        )}

        {stage === "local-login" && (
          <PasswordStep
            language={language}
            busy={busy}
            title={copyFor(language, `Welcome back`, "欢迎回来")}
            hint={email}
            cta={copyFor(language, "Sign in", "登录")}
            minLength={1}
            error={unlockError}
            onSubmit={handleLocalLogin}
          />
        )}

        {stage === "local-set-password" && (
          <PasswordStep
            language={language}
            busy={busy}
            title={copyFor(language, "Set a password", "设置密码")}
            hint={copyFor(language, "You'll use this to sign in next time.", "下次直接用密码登录。")}
            cta={copyFor(language, "Create account", "创建账号")}
            minLength={6}
            onSubmit={handleLocalSetPassword}
          />
        )}
      </div>

      <UnlockSOSEntry language={language} />
    </main>
  );
}

// ── Steps ──────────────────────────────────────────────────────────────────────

function EmailStep({
  language,
  busy,
  onSubmit,
}: {
  language: AppLanguage;
  busy: boolean;
  onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  return (
    <div className="rounded-[1.75rem] border border-border bg-card/80 p-4 text-left">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <Mail className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">
            {copyFor(language, "Continue with email", "使用邮箱继续")}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {copyFor(
              language,
              "We'll email you a 6-digit code to confirm it's you.",
              "我们会发送一个6位验证码到你的邮箱，确认是你本人。"
            )}
          </p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSubmit(email)}
          placeholder={copyFor(language, "Email address", "邮箱地址")}
          type="email"
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <button
          onClick={() => onSubmit(email)}
          disabled={busy || !email.includes("@")}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground active:scale-[0.98] disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          {copyFor(language, "Continue", "继续")}
        </button>
      </div>
    </div>
  );
}

function CodeStep({
  language,
  busy,
  email,
  onSubmit,
  onResend,
  onBack,
}: {
  language: AppLanguage;
  busy: boolean;
  email: string;
  onSubmit: (code: string) => void;
  onResend: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState("");
  return (
    <div className="rounded-[1.75rem] border border-border bg-card/80 p-4 text-left">
      <p className="text-sm font-bold text-foreground">
        {copyFor(language, "Enter the code from your email", "输入邮箱里的验证码")}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {copyFor(language, `Sent to ${email}`, `已发送至 ${email}`)}
      </p>
      <div className="mt-4 space-y-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          onKeyDown={(e) => e.key === "Enter" && code.length === 6 && onSubmit(code)}
          placeholder="000000"
          inputMode="numeric"
          autoComplete="one-time-code"
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-center text-xl tracking-[0.5em] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <button
          onClick={() => onSubmit(code)}
          disabled={busy || code.length !== 6}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {copyFor(language, "Confirm", "确认")}
        </button>
        <button onClick={onResend} className="w-full text-xs text-muted-foreground underline">
          {copyFor(language, "Resend code", "重新发送验证码")}
        </button>
        <button onClick={onBack} className="w-full text-xs text-muted-foreground underline">
          {copyFor(language, "Use a different email", "使用其他邮箱")}
        </button>
      </div>
    </div>
  );
}

function PasswordStep({
  language,
  busy,
  title,
  hint,
  cta,
  minLength,
  error,
  onSubmit,
  footer,
}: {
  language: AppLanguage;
  busy: boolean;
  title: string;
  hint: string;
  cta: string;
  minLength: number;
  error?: string | null;
  onSubmit: (password: string) => void;
  footer?: React.ReactNode;
}) {
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  return (
    <div className="rounded-[1.75rem] border border-border bg-card/80 p-4 text-left">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <KeyRound className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">{title}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{hint}</p>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        <div className="relative">
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && password.length >= minLength && onSubmit(password)}
            placeholder={copyFor(language, "Password", "密码")}
            type={showPwd ? "text" : "password"}
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 pr-11 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <button
            onClick={() => setShowPwd(!showPwd)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="text-xs leading-5 text-destructive">{error}</p>}
        <button
          onClick={() => onSubmit(password)}
          disabled={password.length < minLength || busy}
          className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : cta}
        </button>
        {footer}
      </div>
    </div>
  );
}

function ShowRecoveryStep({
  language,
  recoveryCode,
  onNext,
}: {
  language: AppLanguage;
  recoveryCode: string;
  onNext: () => void;
}) {
  return (
    <div className="rounded-[1.75rem] border border-primary/30 bg-primary/5 p-4 text-left">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-primary/10">
          <PencilLine className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-bold text-foreground">
            {copyFor(language, "Your recovery key — write it on paper", "你的恢复钥匙——请用笔抄在纸上")}
          </p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            {copyFor(
              language,
              "If you change phones or forget your password, this key gets your evidence back.",
              "换手机或忘记密码时，靠它找回你的全部证据。"
            )}
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-background px-4 py-5 text-center">
        <p className="select-all font-mono text-xl font-bold tracking-widest text-foreground">
          {recoveryCode}
        </p>
      </div>

      <ul className="mt-4 space-y-2 text-xs leading-5 text-muted-foreground">
        <li>
          {copyFor(
            language,
            "✍️ Copy it onto paper and keep it somewhere safe.",
            "✍️ 用笔抄在纸上，收在安全的地方。"
          )}
        </li>
        <li>
          {copyFor(
            language,
            "🚫 Don't screenshot it. Don't save it in WeChat. If someone reads your phone, they'd find it.",
            "🚫 不要截图，不要存进微信。手机被翻看时会被发现。"
          )}
        </li>
        <li>
          {copyFor(
            language,
            "🤐 Never tell anyone — not your partner, not family.",
            "🤐 不要告诉任何人——包括伴侣和家人。"
          )}
        </li>
        <li className="font-semibold text-foreground">
          {copyFor(
            language,
            "⚠️ If you lose BOTH your password and this paper, nobody can recover your evidence — not even us.",
            "⚠️ 如果密码和这张纸都丢了，证据将永远无法找回——我们也帮不了你。"
          )}
        </li>
      </ul>

      <button
        onClick={onNext}
        className="mt-4 w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground active:scale-[0.98]"
      >
        {copyFor(language, "I've written it down", "我已抄在纸上")}
      </button>
    </div>
  );
}

function ConfirmRecoveryStep({
  language,
  onBack,
  onSubmit,
}: {
  language: AppLanguage;
  onBack: () => void;
  onSubmit: (typed: string) => void;
}) {
  const [typed, setTyped] = useState("");
  return (
    <div className="rounded-[1.75rem] border border-border bg-card/80 p-4 text-left">
      <p className="text-sm font-bold text-foreground">
        {copyFor(language, "Check your copy", "核对你抄的内容")}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {copyFor(
          language,
          "Type the key from your paper, so we're sure it's copied correctly.",
          "请照着纸上抄好的内容输入一遍，确认没有抄错。"
        )}
      </p>
      <div className="mt-4 space-y-3">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX-XXXX"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-center font-mono text-base tracking-widest text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <button
          onClick={() => onSubmit(typed)}
          disabled={normalizeRecoveryCode(typed).length !== 12}
          className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {copyFor(language, "Confirm", "确认")}
        </button>
        <button onClick={onBack} className="w-full text-xs text-muted-foreground underline">
          {copyFor(language, "Show the key again", "再看一遍恢复钥匙")}
        </button>
      </div>
    </div>
  );
}

function RecoveryUnlockStep({
  language,
  busy,
  error,
  onBack,
  onSubmit,
}: {
  language: AppLanguage;
  busy: boolean;
  error?: string | null;
  onBack: () => void;
  onSubmit: (code: string, newPassword: string) => void;
}) {
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  return (
    <div className="rounded-[1.75rem] border border-border bg-card/80 p-4 text-left">
      <p className="text-sm font-bold text-foreground">
        {copyFor(language, "Unlock with your recovery key", "用纸上的恢复钥匙解锁")}
      </p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">
        {copyFor(
          language,
          "Type the key you wrote on paper, then choose a new password.",
          "输入你抄在纸上的恢复钥匙，然后设置一个新密码。"
        )}
      </p>
      <div className="mt-4 space-y-3">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="XXXX-XXXX-XXXX"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-center font-mono text-base tracking-widest text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
        <div className="relative">
          <input
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder={copyFor(language, "New password (min. 8 chars)", "新密码（至少8位）")}
            type={showPwd ? "text" : "password"}
            className="w-full rounded-2xl border border-border bg-background px-4 py-3 pr-11 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
          />
          <button
            onClick={() => setShowPwd(!showPwd)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p className="text-xs leading-5 text-destructive">{error}</p>}
        <button
          onClick={() => onSubmit(code, newPassword)}
          disabled={busy || normalizeRecoveryCode(code).length !== 12 || newPassword.trim().length < 8}
          className="w-full rounded-2xl bg-primary py-3 text-sm font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : copyFor(language, "Unlock evidence", "解锁证据")}
        </button>
        <button onClick={onBack} className="w-full text-xs text-muted-foreground underline">
          {copyFor(language, "Back", "返回")}
        </button>
      </div>
    </div>
  );
}
