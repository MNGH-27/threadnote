export { googleError } from "./google/errors";
import { createTasksApi } from "./google/tasks-api";
import { plainMail, header, type GmailDetail, type GmailList } from "./google/mail-parser";
import { invoke } from "@tauri-apps/api/core";
import { createSingleFlight } from "@/lib/single-flight";
import type { CalendarItem, GoogleAuthStatus, GoogleCalendar, MailMessage } from "@/types/widget";

let activeAccountId: string | null = null;
const reads = createSingleFlight();
export const disconnectedGoogleStatus: GoogleAuthStatus = {
  configured: false,
  connected: false,
  email: null,
  accountId: null,
  permissions: { gmail: false, calendar: false, tasks: false },
  loginPending: false,
};

export function acceptGoogleStatus(status: GoogleAuthStatus) {
  if (activeAccountId !== status.accountId || !status.connected) reads.clear();
  activeAccountId = status.accountId;
  return status;
}

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
  accountId = activeAccountId,
) {
  if (!accountId) throw new Error("GOOGLE_RECONNECT_REQUIRED");
  const send = () =>
    invoke<T>("google_api_request", { method, url, body: body ?? null, accountId });
  if (method === "GET") return reads.run(JSON.stringify([accountId, url]), send);
  // A refresh after a mutation must not join a read started before that mutation.
  reads.clear();
  try {
    return await send();
  } finally {
    reads.clear();
  }
}

export const google = {
  openServiceSetup: (service: "gmail" | "calendar" | "tasks") =>
    invoke<void>("google_open_service_setup", { service }),
  async checkConnection() {
    const status = await google.status();
    const checks = [
      {
        service: "gmail" as const,
        url: "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=1&fields=resultSizeEstimate",
      },
      {
        service: "calendar" as const,
        url: "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1&fields=kind",
      },
      {
        service: "tasks" as const,
        url: "https://tasks.googleapis.com/tasks/v1/users/@me/lists?maxResults=1&fields=kind",
      },
    ];
    return Promise.all(
      checks.map(async ({ service, url }) => {
        if (!status.connected || !status.accountId)
          return { service, ready: false, code: "GOOGLE_RECONNECT_REQUIRED" };
        if (!status.permissions[service])
          return { service, ready: false, code: "GOOGLE_PERMISSION_REQUIRED" };
        try {
          await request("GET", url, undefined, status.accountId);
          return { service, ready: true, code: "" };
        } catch (reason) {
          return { service, ready: false, code: String(reason) };
        }
      }),
    );
  },
  status: () => invoke<GoogleAuthStatus>("google_auth_status").then(acceptGoogleStatus),
  connect: () => invoke<GoogleAuthStatus>("google_connect").then(acceptGoogleStatus),
  cancelConnect: () => invoke<void>("google_cancel_connect"),
  disconnect: () => invoke<GoogleAuthStatus>("google_disconnect").then(acceptGoogleStatus),
  open: (url: string) => invoke<void>("open_external", { url }),

  async mail(search = "in:inbox", owner = activeAccountId): Promise<MailMessage[]> {
    const query = new URLSearchParams({ maxResults: "15", q: search });
    const list = await request<GmailList>(
      "GET",
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${query}`,
      undefined,
      owner,
    );
    const details = await Promise.all(
      (list.messages ?? []).map(({ id }) => {
        const params = new URLSearchParams({
          format: "metadata",
          fields: "id,threadId,snippet,internalDate,labelIds,payload/headers",
        });
        ["Subject", "From", "Date"].forEach((value) => params.append("metadataHeaders", value));
        return request<GmailDetail>(
          "GET",
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?${params}`,
          undefined,
          owner,
        );
      }),
    );
    if (owner !== activeAccountId) throw new Error("GOOGLE_ACCOUNT_CHANGED");
    return details.map((message) => ({
      id: message.id,
      threadId: message.threadId,
      subject: header(message, "Subject") || "(No subject)",
      from: header(message, "From") || "Unknown sender",
      snippet: message.snippet ?? "",
      receivedAt: Number(message.internalDate ?? Date.now()),
      unread: message.labelIds?.includes("UNREAD") ?? false,
    }));
  },

  async message(id: string, accountId = activeAccountId) {
    const detail = await request<GmailDetail>(
      "GET",
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=full`,
      undefined,
      accountId,
    );
    return { body: plainMail(detail.payload), snippet: detail.snippet ?? "" };
  },

  ...createTasksApi(request, () => activeAccountId),

  async calendars(accountId = activeAccountId): Promise<GoogleCalendar[]> {
    const result = await request<{
      items?: Array<{ id: string; summary?: string; backgroundColor?: string; primary?: boolean }>;
    }>(
      "GET",
      "https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=100",
      undefined,
      accountId,
    );
    return (result.items ?? []).map((item) => ({
      id: item.id,
      title: item.summary ?? item.id,
      color: item.backgroundColor ?? "#a78bfa",
      primary: Boolean(item.primary),
    }));
  },

  async calendar(calendarId = "primary", accountId = activeAccountId): Promise<CalendarItem[]> {
    const params = new URLSearchParams({
      timeMin: new Date().toISOString(),
      timeMax: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: "20",
    });
    const result = await request<{
      items?: Array<{
        id: string;
        summary?: string;
        htmlLink?: string;
        start?: { dateTime?: string; date?: string };
        end?: { dateTime?: string; date?: string };
      }>;
    }>(
      "GET",
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      undefined,
      accountId,
    );
    return (result.items ?? []).map((item) => ({
      id: item.id,
      title: item.summary ?? "Untitled event",
      start: item.start?.dateTime ?? item.start?.date ?? "",
      end: item.end?.dateTime ?? item.end?.date ?? "",
      htmlLink: item.htmlLink ?? "https://calendar.google.com",
    }));
  },
};
