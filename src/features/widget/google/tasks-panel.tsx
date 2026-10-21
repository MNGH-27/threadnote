import { Check, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { google, googleError } from "@/services/google";
import type { GoogleTask, GoogleTaskList } from "@/types/widget";
import {
  Gate,
  ErrorMessage,
  EmptyMessage,
  useRefresh,
  dateLabel,
  type AccountProps,
} from "./panel-shared";

export function GoogleTasksSection(props: AccountProps) {
  return (
    <Gate {...props} service="tasks">
      <RemoteTasks
        key={props.status?.accountId ?? "disconnected"}
        email={props.status?.email ?? ""}
      />
    </Gate>
  );
}
function RemoteTasks({ email }: { email: string }) {
  const [lists, setLists] = useState<GoogleTaskList[]>([]);
  const [listId, setListId] = useState("");
  const [tasks, setTasks] = useState<GoogleTask[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { revision, refresh } = useRefresh();
  useEffect(() => {
    let live = true;
    void google
      .taskLists()
      .then((items) => {
        if (live) {
          setLists(items);
          setListId((previous) =>
            items.some((item) => item.id === previous) ? previous : (items[0]?.id ?? ""),
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
    if (!listId) return;
    let live = true;
    setBusy(true);
    setError("");
    setTasks([]);
    void google
      .tasks(listId)
      .then((value) => {
        if (live) setTasks(value.items ?? []);
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
  }, [listId, revision]);
  const create = async () => {
    if (!title.trim() || saving || !listId) return;
    setSaving(true);
    setError("");
    try {
      await google.addTask(listId, { title: title.trim(), description, dueDate });
      setTitle("");
      setDescription("");
      setDueDate("");
      setExpanded(false);
      refresh();
    } catch (reason) {
      setError(googleError(reason));
    } finally {
      setSaving(false);
    }
  };
  const toggle = async (task: GoogleTask) => {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      await google.completeRemoteTask(listId, task);
      refresh();
    } catch (reason) {
      setError(googleError(reason));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="google-data-panel" dir="ltr">
      <div className="google-panel-heading">
        <select
          aria-label="Choose Google Tasks list"
          value={listId}
          onChange={(event) => setListId(event.target.value)}
        >
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.title}
            </option>
          ))}
        </select>
        <button className="section-action" title="Refresh tasks" onClick={refresh}>
          <RefreshCw size={13} className={busy ? "animate-spin" : ""} />
        </button>
      </div>
      <p className="google-panel-caption" dir="ltr">
        {email}
      </p>
      <ErrorMessage error={error} />
      <form
        className="google-task-composer"
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <div>
          <input
            dir="auto"
            className="field"
            aria-label="Google task title"
            placeholder="New Google task…"
            value={title}
            onFocus={() => setExpanded(true)}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button
            className="icon-button accent"
            type="submit"
            disabled={saving || !title.trim() || !listId}
          >
            {saving ? <LoaderCircle className="animate-spin" size={14} /> : <Plus size={15} />}
          </button>
        </div>
        {expanded && (
          <>
            <textarea
              dir="auto"
              className="field"
              placeholder="Task details"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <input
              dir="auto"
              className="field"
              aria-label="Due date"
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </>
        )}
      </form>
      {tasks.map((task) => (
        <div key={task.id} className="compact-task">
          <button
            aria-label={task.status === "completed" ? "Mark incomplete" : "Mark complete"}
            disabled={saving}
            className={`task-check ${task.status === "completed" ? "done" : ""}`}
            onClick={() => void toggle(task)}
          >
            {task.status === "completed" && <Check size={11} />}
          </button>
          <div className="min-w-0 flex-1">
            <p
              className={
                task.status === "completed" ? "line-through text-zinc-600" : "text-zinc-300"
              }
            >
              {task.title || "Untitled"}
            </p>
            {task.notes && <small>{task.notes}</small>}
            {task.due && <small>{dateLabel(task.due, false)}</small>}
          </div>
        </div>
      ))}
      {!tasks.length &&
        (busy ? (
          <div className="google-loading">
            <LoaderCircle className="animate-spin" size={18} />
          </div>
        ) : (
          !error && (
            <EmptyMessage>
              <Check size={20} />
              No tasks in this list.
            </EmptyMessage>
          )
        ))}
    </div>
  );
}
