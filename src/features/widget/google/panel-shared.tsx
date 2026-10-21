import { LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import type { GoogleAuthStatus } from "@/types/widget";
import { GoogleConnect, GoogleServiceSetup } from "../google-account";
import { listen } from "@tauri-apps/api/event";

export interface AccountProps {
  status: GoogleAuthStatus | null;
  onStatus: (status: GoogleAuthStatus) => void;
}

export function Gate({
  status,
  onStatus,
  service,
  children,
}: AccountProps & { service: "gmail" | "calendar" | "tasks"; children: ReactNode }) {
  if (!status)
    return (
      <div className="google-loading">
        <LoaderCircle className="animate-spin" size={18} />
      </div>
    );
  if (!status.connected || !status.permissions[service])
    return <GoogleConnect status={status} onConnected={onStatus} />;
  return <>{children}</>;
}
export function ErrorMessage({ error }: { error: string }) {
  const service = error.includes("API is disabled")
    ? error.includes("Gmail")
      ? "gmail"
      : error.includes("Calendar")
        ? "calendar"
        : error.includes("Tasks")
          ? "tasks"
          : null
    : null;
  return error ? (
    <div className="error-box m-3" role="alert">
      <p>{error}</p>
      {service && <GoogleServiceSetup service={service} />}
    </div>
  ) : null;
}
export function EmptyMessage({ children }: { children: ReactNode }) {
  return <div className="google-empty">{children}</div>;
}
export function useRefresh() {
  const [revision, setRevision] = useState(0);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastRefresh = Date.now();
    let pending = false;
    const schedule = () => {
      clearTimeout(timer);
      if (!document.hidden) timer = setTimeout(update, 90_000);
    };
    const update = () => {
      if (document.hidden) {
        pending = true;
        return;
      }
      pending = false;
      lastRefresh = Date.now();
      refresh();
      schedule();
    };
    const visibility = () => {
      if (!document.hidden && (pending || Date.now() - lastRefresh >= 90_000)) update();
      else schedule();
    };
    schedule();
    document.addEventListener("visibilitychange", visibility);
    const event = listen("workspace:changed", update);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visibility);
      void event.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [refresh]);
  return { revision, refresh };
}
export function dateLabel(value: string | number, time = true) {
  const date = new Date(
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value,
  );
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(time ? ({ hour: "2-digit", minute: "2-digit" } as const) : {}),
  }).format(date);
}
