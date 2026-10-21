import { listen } from "@tauri-apps/api/event";
import { Check, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { taskRepository } from "@/repositories/widget-repository";
import type { WidgetTask } from "@/types/widget";

export function LocalTasksSection() {
  const [tasks, setTasks] = useState<WidgetTask[]>([]);
  const [title, setTitle] = useState("");
  const load = useCallback(async () => {
    setTasks((await taskRepository.list()).filter((task) => !task.googleTaskId));
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    const event = listen("workspace:changed", () => void load());
    return () => {
      void event.then((unlisten) => unlisten());
    };
  }, [load]);
  const create = async () => {
    if (!title.trim()) return;
    await taskRepository.create({
      title: title.trim(),
      description: "",
      priority: "medium",
      dueDate: null,
      dueTime: null,
      durationMinutes: 30,
    });
    setTitle("");
    await load();
  };
  return (
    <div className="local-tasks" dir="ltr">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void create();
        }}
      >
        <input
          dir="auto"
          className="field"
          placeholder="New local task…"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button className="icon-button accent" type="submit" disabled={!title.trim()}>
          <Plus size={15} />
        </button>
      </form>
      {tasks.map((task) => (
        <div className="compact-task" key={task.id}>
          <button
            className={`task-check ${task.completed ? "done" : ""}`}
            onClick={() => void taskRepository.setCompleted(task.id, !task.completed).then(load)}
          >
            {task.completed && <Check size={11} />}
          </button>
          <div className="min-w-0 flex-1">
            <p className={task.completed ? "line-through text-zinc-600" : "text-zinc-300"}>
              {task.title}
            </p>
            {task.description && <small>{task.description}</small>}
          </div>
          <button
            className="section-action"
            title="Delete local task"
            onClick={() => void taskRepository.remove(task.id).then(load)}
          >
            <Trash2 size={11} />
          </button>
        </div>
      ))}
    </div>
  );
}
