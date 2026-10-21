import { ChevronLeft, ExternalLink, Inbox, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { google, googleError } from "@/services/google";
import type { MailMessage } from "@/types/widget";
import {
  Gate,
  ErrorMessage,
  EmptyMessage,
  useRefresh,
  dateLabel,
  type AccountProps,
} from "./panel-shared";

export function GmailSection(props: AccountProps) {
  return (
    <Gate {...props} service="gmail">
      <GmailInbox
        key={props.status?.accountId ?? "disconnected"}
        email={props.status?.email ?? ""}
      />
    </Gate>
  );
}
function GmailInbox({ email }: { email: string }) {
  const [items, setItems] = useState<MailMessage[]>([]);
  const [selected, setSelected] = useState<MailMessage | null>(null);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(true);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const { revision, refresh } = useRefresh();
  useEffect(() => {
    let live = true;
    setBusy(true);
    setError("");
    void google
      .mail()
      .then((value) => {
        if (live) setItems(value);
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
  }, [revision]);
  useEffect(() => {
    if (!selected) return;
    let live = true;
    setReading(true);
    setBody("");
    setError("");
    void google
      .message(selected.id)
      .then((value) => {
        if (live)
          setBody(
            value.body ||
              `${value.snippet}\n\nThis email uses HTML. Open it in Gmail to view the full message.`,
          );
      })
      .catch((reason) => {
        if (live) setError(googleError(reason));
      })
      .finally(() => {
        if (live) setReading(false);
      });
    return () => {
      live = false;
    };
  }, [selected]);
  const open = (message?: MailMessage) =>
    void google.open(
      `https://mail.google.com/mail/u/?authuser=${encodeURIComponent(email)}${message ? `#inbox/${encodeURIComponent(message.threadId)}` : "#inbox"}`,
    );
  return (
    <div className="google-data-panel" dir="ltr">
      <div className="google-panel-heading">
        <span className="google-panel-account" dir="ltr">
          {email}
        </span>
        <button className="section-action" title="Refresh inbox" onClick={refresh}>
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
        </button>
        <button
          className="section-action"
          title="Open Gmail"
          onClick={() => open(selected ?? undefined)}
        >
          <ExternalLink size={13} />
        </button>
      </div>
      <ErrorMessage error={error} />
      {selected ? (
        <div className="google-mail-reader">
          <button className="google-back" onClick={() => setSelected(null)}>
            <ChevronLeft size={14} />
            Inbox
          </button>
          <h3 dir="auto">{selected.subject}</h3>
          <p className="google-mail-from" dir="auto">
            {selected.from}
          </p>
          {reading ? (
            <div className="google-loading">
              <LoaderCircle className="animate-spin" size={18} />
            </div>
          ) : (
            <div className="google-mail-body" dir="auto">
              {body}
            </div>
          )}
        </div>
      ) : (
        <div>
          {items.map((item) => (
            <button key={item.id} className="google-mail-row" onClick={() => setSelected(item)}>
              <span className={`google-unread ${item.unread ? "is-unread" : ""}`} />
              <span className="google-mail-summary" dir="auto">
                <strong>{item.from}</strong>
                <span>{item.subject}</span>
                <small>{item.snippet}</small>
              </span>
              <time>{dateLabel(item.receivedAt, false)}</time>
            </button>
          ))}
          {!items.length &&
            (busy ? (
              <div className="google-loading">
                <LoaderCircle className="animate-spin" size={18} />
              </div>
            ) : (
              !error && (
                <EmptyMessage>
                  <Inbox size={20} />
                  Your inbox is empty.
                </EmptyMessage>
              )
            ))}
        </div>
      )}
    </div>
  );
}
