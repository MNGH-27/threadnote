// Decode text parts only. Email HTML is untrusted and must never execute in the app.
export interface GmailList {
  messages?: Array<{ id: string; threadId: string }>;
}
export interface GmailDetail {
  id: string;
  threadId: string;
  snippet?: string;
  internalDate?: string;
  labelIds?: string[];
  payload?: GmailPart;
}

interface GmailPart {
  mimeType?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string };
  parts?: GmailPart[];
}

export function plainMail(part?: GmailPart): string {
  if (!part) return "";
  if (part.mimeType === "text/plain" && part.body?.data) {
    try {
      return new TextDecoder().decode(
        Uint8Array.from(atob(part.body.data.replace(/-/g, "+").replace(/_/g, "/")), (char) =>
          char.charCodeAt(0),
        ),
      );
    } catch {
      return "";
    }
  }
  return (part.parts ?? []).map(plainMail).filter(Boolean).join("\n\n");
}

export function header(message: GmailDetail, name: string) {
  return (
    message.payload?.headers?.find((item) => item.name.toLowerCase() === name.toLowerCase())
      ?.value ?? ""
  );
}
