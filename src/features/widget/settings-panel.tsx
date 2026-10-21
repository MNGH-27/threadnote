import { quitAfterSaving } from "@/services/workspace-lifecycle";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { LogOut, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { GoogleAuthStatus } from "@/types/widget";
import { GoogleAccountSettings } from "./google-account";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export function SettingsPanel({
  status,
  onStatus,
  onClose,
}: {
  status: GoogleAuthStatus | null;
  onStatus: (value: GoogleAuthStatus) => void;
  onClose: () => void;
}) {
  const [autoStart, setAutoStart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    const event = listen<boolean>("settings:startup-changed", ({ payload }) => {
      if (active) {
        setAutoStart(payload);
        localStorage.setItem("threadnote.autostart.configured", "true");
      }
    });
    void event
      .then(() => isEnabled())
      .then((value) => {
        if (active) setAutoStart(value);
      })
      .catch(() => {
        if (active) setError("Could not read the Windows startup setting.");
      });
    return () => {
      active = false;
      void event.then((stop) => stop()).catch(() => {});
    };
  }, []);
  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const next = !autoStart;
      if (next) await enable();
      else await disable();
      localStorage.setItem("threadnote.autostart.configured", "true");
      setAutoStart(next);
      await invoke("tray_sync_startup");
    } catch {
      setError("Could not update the Windows startup setting.");
    } finally {
      setBusy(false);
    }
  };
  const quit = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await quitAfterSaving();
    } catch {
      setError(
        "Could not save all notes. The app will stay open. Please check your notes and retry.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="settings-panel" dir="ltr">
      <div className="settings-panel-heading">
        <strong>Settings</strong>
        <button className="icon-button" title="Close settings" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <div className="settings-panel-content">
        <div className="settings-card">
          <div>
            <p>Launch at startup</p>
            <span>Show your notes when you sign in to Windows</span>
          </div>
          <button
            className={`toggle ${autoStart ? "on" : ""}`}
            role="switch"
            aria-label="Launch at Windows startup"
            aria-checked={autoStart}
            disabled={busy}
            onClick={() => void toggle()}
          >
            <span />
          </button>
        </div>
        {status && <GoogleAccountSettings status={status} onStatus={onStatus} />}
        {error && (
          <p className="error-box" role="alert">
            {error}
          </p>
        )}
        <button className="quit-app-button" disabled={busy} onClick={() => void quit()}>
          <LogOut size={14} />
          Quit app
        </button>
      </div>
    </div>
  );
}
