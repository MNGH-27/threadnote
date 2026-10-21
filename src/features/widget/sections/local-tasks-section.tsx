import { listen } from "@tauri-apps/api/event";
import { Plus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { taskRepository } from "@/repositories/widget-repository";
import type { WidgetTask } from "@/types/widget";
import { TaskList } from "./task-list";

export function LocalTasksSection() {
  const [tasks, setTasks] = useState<WidgetTask[]>([]);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setTasks((await taskRepository.list()).filter((task) => !task.googleTaskId));
  }, []);
  useEffect(() => {
    void load().catch(() => setError("Could not load local tasks."));
  }, [load]);
  useEffect(() => {
    const event = listen(
      "workspace:changed",
      () => void load().catch(() => setError("Could not load local tasks.")),
    );
    return () => {
      void event.then((unlisten) => unlisten());
    };
  }, [load]);
  const mutate = async (operation: () => Promise<unknown>) => {
    if (busy) throw new Error("Task operation already in progress");
    setBusy(true);
    setError("");
    try {
      await operation();
      await load();
    } catch (reason) {
      setError("Could not update local tasks. Please try again.");
      throw reason;
    } finally {
      setBusy(false);
    }
  };
  const create = async () => {
    if (!title.trim() || busy) return;
    await mutate(async () => {
      await taskRepository.create({
        title: title.trim(),
        description: "",
        priority: "medium",
        dueDate: null,
        dueTime: null,
        durationMinutes: 30,
      });
      setTitle("");
    });
  };
  return (
    <div className="local-tasks" dir="ltr">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void create().catch(() => {});
        }}
      >
        <input
          dir="auto"
          className="field"
          placeholder="New local task…"
          value={title}
          aria-label="New local task title"
          maxLength={1024}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button
          className="icon-button accent"
          aria-label="Add local task"
          type="submit"
          disabled={busy || !title.trim()}
        >
          <Plus size={15} />
        </button>
      </form>
      {error && (
        <p className="task-inline-error" role="alert">
          {error}
        </p>
      )}
      <TaskList
        tasks={tasks.map((task) => ({ ...task, dueDate: task.dueDate ?? "" }))}
        busy={busy}
        onSave={(task, values) => mutate(() => taskRepository.updateDetails(task.id, values))}
        onDelete={(task) => mutate(() => taskRepository.remove(task.id))}
        onToggle={async (task) => {
          try {
            await mutate(() => taskRepository.setCompleted(task.id, !task.completed));
          } catch {
            /* The inline error keeps the failure visible. */
          }
        }}
      />
      {!tasks.length && !error && <p className="task-detail-status">No local tasks yet.</p>}
    </div>
  );
}
