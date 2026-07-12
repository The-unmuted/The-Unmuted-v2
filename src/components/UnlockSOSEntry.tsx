/**
 * Discreet SOS entry on the unlock/login screen.
 *
 * SOS needs no account or vault: contacts + sound settings live in
 * localStorage. Only rendered when this device already has emergency
 * contacts, so a stranger's / fresh device shows a plain login wall
 * (disguise preserved). The trigger is a bare ‼️ icon by design — no
 * text that would reveal what this app is.
 */

import { useState } from "react";
import { X } from "lucide-react";
import SOSButton from "./SOSButton";
import { loadContacts } from "@/hooks/useEmergencyContacts";
import { useSilentMode } from "@/hooks/useSilentMode";
import { type AppLanguage } from "@/lib/locale";

export default function UnlockSOSEntry({ language }: { language: AppLanguage }) {
  const [open, setOpen] = useState(false);
  const [hasContacts] = useState(() => loadContacts().length > 0);
  const { isSilent, voiceDeterrent, customAudioUrl } = useSilentMode();

  if (!hasContacts) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="SOS"
        className="fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full text-xl opacity-55 transition-opacity hover:opacity-90"
      >
        ‼️
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background px-6">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
          <SOSButton
            isSilent={isSilent}
            voiceDeterrent={voiceDeterrent}
            customAudioUrl={customAudioUrl}
            language={language}
          />
        </div>
      )}
    </>
  );
}
