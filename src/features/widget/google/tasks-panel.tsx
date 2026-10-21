import { Check, LoaderCircle, Plus, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { google, googleError } from "@/services/google";
import type { GoogleTask, GoogleTaskList } from "@/types/widget";
import { TaskList, type TaskItem, type TaskValues } from "../sections/task-list";
import { Gate, ErrorMessage, EmptyMessage, useRefresh, type AccountProps } from "./panel-shared";

export function GoogleTasksSection(props: AccountProps) {
  return (
    <Gate {...props} service="tasks">
      <RemoteTasks
        key={props.status?.accountId ?? "disconnected"}
        email={props.status?.email ?? ""}
        accountId={props.status?.accountId ?? ""}
      />
    </Gate>
  );
}
export function RemoteTasks({ email, accountId }: { email: string; accountId: string }) {
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
      .taskLists(accountId)
      .then((items) => {
        if (live) {
          setLists(items);
          setListId((previous) =>
            items.some((item) => item.id === previous) ? previous : (items[0]?.id ?? ""),
          );
          if (!items.length) {
            setTasks([]);
            setBusy(false);
          }
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
  }, [revision, accountId]);
  useEffect(() => {
    if (!listId) return;
    let live = true;
    setBusy(true);
    setError("");
    void google
      .tasks(listId, accountId)
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
  }, [listId, revision, accountId]);
  const create = async () => {
    if (!title.trim() || saving || busy || !listId) return;
    setSaving(true);
    setError("");
    try {
      await google.addTask(listId, { title: title.trim(), description, dueDate }, accountId);
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
    if (saving || busy) return;
    setSaving(true);
    setError("");
    try {
      await google.completeRemoteTask(listId, task, accountId);
      refresh();
    } catch (reason) {
      setError(googleError(reason));
    } finally {
      setSaving(false);
    }
  };
  const mutate = async (operation: () => Promise<unknown>) => {
    if (saving || busy) throw new Error("Task operation already in progress");
    setSaving(true);
    setError("");
    try {
      await operation();
      refresh();
    } catch (reason) {
      setError(googleError(reason));
      throw reason;
    } finally {
      setSaving(false);
    }
  };
  const update = (item: TaskItem, values: TaskValues) =>
    mutate(async () => {
      const task = tasks.find((task) => task.id === item.id)!;
      const updated = await google.updateTask(listId, task, values, accountId);
      setTasks((items) => items.map((value) => (value.id === item.id ? updated : value)));
    });
  const remove = (item: TaskItem) =>
    mutate(async () => {
      await google.deleteTask(listId, item.id, accountId);
      // Hide the confirmed deletion and known descendants; retain other rows if refresh fails.
      setTasks((items) => {
        const removed = new Set([item.id]);
        let changed = true;
        while (changed) {
          changed = false;
          for (const task of items) {
            if (task.parent && removed.has(task.parent) && !removed.has(task.id)) {
              removed.add(task.id);
              changed = true;
            }
          }
        }
        return items.filter((task) => !removed.has(task.id));
      });
    });
  return (
    <div className="google-data-panel" dir="ltr">
      <div className="google-panel-heading">
        <select
          aria-label="Choose Google Tasks list"
          value={listId}
          disabled={saving || busy}
          onChange={(event) => {
            setTasks([]);
            setListId(event.target.value);
          }}
        >
          {lists.map((list) => (
            <option key={list.id} value={list.id}>
              {list.title}
            </option>
          ))}
        </select>
        <button
          className="section-action"
          title="Refresh tasks"
          disabled={saving || busy}
          onClick={refresh}
        >
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
            maxLength={1024}
            onFocus={() => setExpanded(true)}
            onChange={(event) => setTitle(event.target.value)}
          />
          <button
            className="icon-button accent"
            type="submit"
            disabled={saving || busy || !title.trim() || !listId}
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
              aria-label="New task details"
              maxLength={8192}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <input
              dir="auto"
              className="field"
              aria-label="Due date"
              type="date"
              value={dueDate}
              onInput={(event) => setDueDate(event.currentTarget.value)}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </>
        )}
      </form>
      <TaskList
        key={listId}
        remote
        busy={saving || busy}
        tasks={tasks.map((task) => ({
          id: task.id,
          title: task.title ?? "Untitled",
          description: task.notes ?? "",
          dueDate: task.due ?? "",
          completed: task.status === "completed",
          updated: task.updated,
          assigned: Boolean(task.assignmentInfo),
          notesReadOnly: task.assignmentInfo?.surfaceType === "DOCUMENT",
        }))}
        onSave={update}
        onDelete={remove}
        onToggle={async (item) => {
          const task = tasks.find((value) => value.id === item.id);
          if (task) await toggle(task);
        }}
      />
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
