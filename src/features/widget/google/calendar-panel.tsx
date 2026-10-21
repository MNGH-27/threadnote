import { CalendarDays, ExternalLink, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { google, googleError } from "@/services/google";
import type { CalendarItem, GoogleCalendar } from "@/types/widget";
import {
  Gate,
  ErrorMessage,
  EmptyMessage,
  useRefresh,
  dateLabel,
  type AccountProps,
} from "./panel-shared";

export function CalendarSection(props: AccountProps) {
  return (
    <Gate {...props} service="calendar">
      <CalendarEvents
        key={props.status?.accountId ?? "disconnected"}
        email={props.status?.email ?? ""}
      />
    </Gate>
  );
}
function CalendarEvents({ email }: { email: string }) {
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [calendarId, setCalendarId] = useState("");
  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const { revision, refresh } = useRefresh();
  useEffect(() => {
    let live = true;
    void google
      .calendars()
      .then((items) => {
        if (live) {
          setCalendars(items);
          setCalendarId((previous) =>
            items.some((item) => item.id === previous)
              ? previous
              : (items.find((item) => item.primary)?.id ?? items[0]?.id ?? ""),
          );
          if (!items.length) setBusy(false);
        }
      })
      .catch((reason) => {
        if (live) {
          setError(googleError(reason));
          setBusy(false);
        }
      });
    return () => {
      live = false;
    };
  }, [revision]);
  useEffect(() => {
    if (!calendarId) return;
    let live = true;
    setBusy(true);
    setError("");
    setEvents([]);
    void google
      .calendar(calendarId)
      .then((value) => {
        if (live) setEvents(value);
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
  }, [calendarId, revision]);
  return (
    <div className="google-data-panel" dir="ltr">
      <div className="google-panel-heading">
        <select
          aria-label="Choose Google calendar"
          value={calendarId}
          onChange={(event) => setCalendarId(event.target.value)}
        >
          {calendars.map((calendar) => (
            <option key={calendar.id} value={calendar.id}>
              {calendar.title}
            </option>
          ))}
        </select>
        <button className="section-action" title="Refresh calendar" onClick={refresh}>
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
        </button>
      </div>
      <p className="google-panel-caption" dir="ltr">
        {email} · Next 30 days
      </p>
      <ErrorMessage error={error} />
      {events.map((event) => (
        <button
          key={event.id}
          className="google-calendar-event"
          onClick={() => void google.open(event.htmlLink)}
        >
          <span className="google-event-icon">
            <CalendarDays size={16} />
          </span>
          <span>
            <strong dir="auto">{event.title}</strong>
            <time>
              {dateLabel(event.start, event.start.includes("T"))}
              {!event.start.includes("T") && " · All day"}
            </time>
          </span>
          <ExternalLink size={12} />
        </button>
      ))}
      {!events.length &&
        (busy ? (
          <div className="google-loading">
            <LoaderCircle className="animate-spin" size={18} />
          </div>
        ) : (
          !error && (
            <EmptyMessage>
              <CalendarDays size={20} />
              No upcoming events in this period.
            </EmptyMessage>
          )
        ))}
    </div>
  );
}
