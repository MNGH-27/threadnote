import { listen } from "@tauri-apps/api/event";
import { Check, LoaderCircle, LogOut, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  acceptGoogleStatus,
  disconnectedGoogleStatus,
  google,
  googleError,
} from "@/services/google";
import type { GoogleAuthStatus } from "@/types/widget";

export function useGoogle() {
  const [status, setValue] = useState<GoogleAuthStatus | null>(null);
  const setStatus = useCallback((value: GoogleAuthStatus) => {
    acceptGoogleStatus(value);
    setValue(value);
  }, []);
  useEffect(() => {
    let active = true;
    const refresh = () => {
      void google
        .status()
        .then((value) => {
          if (active) setStatus(value);
        })
        .catch(() => {
          if (active) setStatus(disconnectedGoogleStatus);
        });
    };
    // Listen before reading, so completing sign-in in another window is not missed.
    const listener = listen<GoogleAuthStatus>("google:auth-changed", ({ payload }) => {
      if (active) setStatus(payload);
    });
    void listener.then(refresh).catch(refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.removeEventListener("focus", refresh);
      void listener.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [setStatus]);
  return { status, setStatus };
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.4 38.03 46.98 31.87 46.98 24.55Z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59A14.4 14.4 0 0 1 9.75 24c0-1.59.27-3.13.78-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.15 1.45-4.92 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
      />
    </svg>
  );
}

export function GoogleConnect({
  status,
  onConnected,
}: {
  status: GoogleAuthStatus;
  onConnected: (value: GoogleAuthStatus) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      onConnected(await google.connect());
    } catch (reason) {
      setError(googleError(reason));
    } finally {
      setBusy(false);
    }
  };
  const pending = busy || status.loginPending;
  return (
    <div className="google-connect" dir="ltr">
      <h3>{status.connected ? "Update Google permissions" : "Connect your Google account"}</h3>
      <p>See your email, calendar, and tasks here.</p>
      <div className="google-permission-summary">
        <span>Gmail · Read only</span>
        <span>Calendar · Read only</span>
        <span>Tasks · View and manage</span>
      </div>
      {!status.configured && (
        <p className="google-unavailable">Google sign-in is not configured in this build.</p>
      )}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <button
        className="google-button"
        disabled={pending || !status.configured}
        onClick={() => void connect()}
      >
        {pending ? <LoaderCircle className="animate-spin" size={17} /> : <GoogleMark />}
        {pending ? "Waiting for sign-in in your browser…" : "Sign in with Google"}
      </button>
      {pending && (
        <button className="google-cancel" onClick={() => void google.cancelConnect()}>
          Cancel sign-in
        </button>
      )}
      <small>
        Choose your account in your browser. Your password is never shared with this app.
      </small>
    </div>
  );
}

export function GoogleAccountSettings({
  status,
  onStatus,
}: {
  status: GoogleAuthStatus;
  onStatus: (value: GoogleAuthStatus) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!status.connected) return <GoogleConnect status={status} onConnected={onStatus} />;
  const act = async (action: "switch" | "disconnect") => {
    setBusy(true);
    setError("");
    try {
      onStatus(await (action === "disconnect" ? google.disconnect() : google.connect()));
    } catch (reason) {
      setError(googleError(reason));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="google-account-settings" dir="ltr">
      <strong>Google account</strong>
      <p className="google-account-email" dir="ltr">
        {status.email}
      </p>
      <div className="google-service-badges">
        {(["gmail", "calendar", "tasks"] as const).map((service) => (
          <span key={service} className={status.permissions[service] ? "is-connected" : ""}>
            {status.permissions[service] && <Check size={10} />}
            {service === "gmail" ? "Gmail" : service === "calendar" ? "Calendar" : "Tasks"}
          </span>
        ))}
      </div>
      <GoogleConnectionHealth accountId={status.accountId} />
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
      <div className="google-account-actions">
        <button
          className="soft-button"
          disabled={busy || status.loginPending}
          onClick={() => void act("switch")}
        >
          <RefreshCw size={12} />
          Change account / permissions
        </button>
        <button
          className="soft-button !text-red-300"
          disabled={busy || status.loginPending}
          onClick={() => void act("disconnect")}
        >
          <LogOut size={12} />
          Disconnect
        </button>
      </div>
      {status.loginPending && (
        <button className="google-cancel" onClick={() => void google.cancelConnect()}>
          Cancel sign-in
        </button>
      )}
      <small>
        Credentials are stored securely on this Windows device. Disconnecting also revokes access at
        Google.
      </small>
    </section>
  );
}

export function GoogleServiceSetup({ service }: { service: "gmail" | "calendar" | "tasks" }) {
  const [error, setError] = useState("");
  return (
    <div>
      <button
        className="soft-button mt-2"
        onClick={() => {
          setError("");
          void google.openServiceSetup(service).catch((reason) => setError(googleError(reason)));
        }}
      >
        Publisher: enable{" "}
        {service === "gmail" ? "Gmail" : service === "calendar" ? "Calendar" : "Tasks"} API ↗
      </button>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}

function GoogleConnectionHealth({ accountId }: { accountId: string | null }) {
  const [checks, setChecks] = useState<Awaited<ReturnType<typeof google.checkConnection>>>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");
    setChecks([]);
    void google
      .checkConnection()
      .then((value) => {
        if (live) setChecks(value);
      })
      .catch((reason) => {
        if (live) setError(googleError(reason));
      })
      .finally(() => {
        if (live) setBusy(false);
      });
    return () => {
      live = false;
    };
  }, [accountId, revision]);
  return (
    <div className="google-connection-health">
      <div className="flex items-center justify-between gap-2">
        <strong>Service connection</strong>
        <button
          className="soft-button"
          disabled={busy}
          onClick={() => setRevision((value) => value + 1)}
        >
          <RefreshCw size={12} className={busy ? "animate-spin" : ""} />
          {busy ? "Checking…" : "Check again"}
        </button>
      </div>
      <p>Signing in and enabling the publisher’s Google APIs are separate steps.</p>
      {checks.map((check) => (
        <div className="google-health-row" key={check.service}>
          <strong>
            {check.service === "gmail"
              ? "Gmail"
              : check.service === "calendar"
                ? "Calendar"
                : "Tasks"}
            :{" "}
            {check.ready
              ? "Ready"
              : check.code.endsWith("API_DISABLED")
                ? "Publisher setup required"
                : "Needs attention"}
          </strong>
          {!check.ready && <p>{googleError(check.code)}</p>}
          {check.code.endsWith("API_DISABLED") && <GoogleServiceSetup service={check.service} />}
        </div>
      ))}
      {error && (
        <p className="error-box" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
