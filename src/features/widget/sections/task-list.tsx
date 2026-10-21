import { Check, ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { groupTasksByDay, taskDay, taskDayLabel } from "@/lib/task-days";

export interface TaskValues {
  title: string;
  description: string;
  dueDate: string;
}
export interface TaskItem extends TaskValues {
  id: string;
  completed: boolean;
  updated?: string;
  notesReadOnly?: boolean;
  assigned?: boolean;
}

/** Shared local/Google list: editing stays inline so it works in small canvas cards. */
export function TaskList({
  tasks,
  busy,
  remote = false,
  onSave,
  onToggle,
  onDelete,
}: {
  tasks: TaskItem[];
  busy: boolean;
  remote?: boolean;
  onSave: (task: TaskItem, values: TaskValues) => Promise<void>;
  onToggle: (task: TaskItem) => Promise<void>;
  onDelete: (task: TaskItem) => Promise<void>;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  // Refresh labels at local midnight even when the list has not changed.
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="task-day-list">
      {groupTasksByDay(tasks).map((group) => (
        <section
          key={group.day}
          className="task-day-group"
          aria-label={taskDayLabel(group.day, today)}
        >
          <h4>
            {taskDayLabel(group.day, today)}
            <span>{group.tasks.length}</span>
          </h4>
          {group.tasks.map((task) => (
            <div key={task.id} className="task-entry">
              <div className="compact-task">
                <button
                  type="button"
                  className={`task-check ${task.completed ? "done" : ""}`}
                  aria-label={`${task.completed ? "Mark incomplete" : "Mark complete"}: ${task.title}`}
                  disabled={busy}
                  onClick={() => void onToggle(task)}
                >
                  {task.completed && <Check size={11} />}
                </button>
                <button
                  type="button"
                  className="task-summary"
                  aria-expanded={selected === task.id}
                  aria-label={`Task details: ${task.title}`}
                  onClick={() => setSelected(selected === task.id ? null : task.id)}
                  disabled={busy}
                >
                  <span
                    className={task.completed ? "line-through text-zinc-500" : "text-zinc-200"}
                    dir="auto"
                  >
                    {task.title || "Untitled"}
                  </span>
                  {task.description && <small dir="auto">{task.description}</small>}
                </button>
                <button
                  type="button"
                  className="section-action"
                  aria-label={`Open details: ${task.title}`}
                  aria-expanded={selected === task.id}
                  disabled={busy}
                  onClick={() => setSelected(selected === task.id ? null : task.id)}
                >
                  {selected === task.id ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </button>
              </div>
              {selected === task.id && (
                <TaskEditor
                  task={task}
                  busy={busy}
                  remote={remote}
                  onSave={async (values) => {
                    await onSave(task, values);
                    setSelected(null);
                  }}
                  onDelete={async () => {
                    await onDelete(task);
                    setSelected(null);
                  }}
                  onClose={() => setSelected(null)}
                />
              )}
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function TaskEditor({
  task,
  busy,
  remote,
  onSave,
  onDelete,
  onClose,
}: {
  task: TaskItem;
  busy: boolean;
  remote: boolean;
  onSave: (values: TaskValues) => Promise<void>;
  onDelete: () => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [dueDate, setDueDate] = useState(taskDay(task.dueDate));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const run = async (operation: () => Promise<void>) => {
    setError("");
    try {
      await operation();
    } catch {
      setError("Could not apply changes. Your edits are still here; try again.");
    }
  };
  return (
    <form
      className="task-detail-editor"
      aria-label="Task details"
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || confirmDelete || !title.trim()) return;
        void run(() => onSave({ title: title.trim(), description, dueDate }));
      }}
    >
      <p className="task-detail-status">
        {task.completed ? "Completed" : "Not completed"} ·{" "}
        {remote ? "Google Tasks" : "On this device"}
      </p>
      <label>
        Title
        <input
          className="field"
          dir="auto"
          value={title}
          maxLength={1024}
          required
          disabled={busy}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label>
        Details
        <textarea
          className="field"
          dir="auto"
          value={description}
          maxLength={8192}
          disabled={busy || task.notesReadOnly}
          onChange={(event) => setDescription(event.target.value)}
        />
      </label>
      {task.notesReadOnly && (
        <p className="task-detail-status">
          Google Docs assigned-task details cannot be edited here.
        </p>
      )}
      <label>
        Date
        <input
          className="field"
          type="date"
          value={dueDate}
          disabled={busy}
          onInput={(event) => setDueDate(event.currentTarget.value)}
          onChange={(event) => setDueDate(event.target.value)}
        />
      </label>
      <p className="task-detail-status">{dueDate ? taskDayLabel(dueDate) : "No date assigned"}</p>
      {error && (
        <p role="alert" className="task-inline-error">
          {error}
        </p>
      )}
      {confirmDelete ? (
        <div className="task-delete-confirm" role="alert">
          <p>
            {remote
              ? "Delete from your Google account? This is not just hiding the task."
              : "Delete this local task? This cannot be undone."}{" "}
            {task.assigned && "This also deletes the original task in Google Docs or Chat."}{" "}
            {remote && "Subtasks may also be removed."}
          </p>
          <div className="task-editor-actions">
            <button
              type="button"
              className="task-danger"
              disabled={busy}
              onClick={() => void run(onDelete)}
            >
              Delete task
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)}>
              Keep task
            </button>
          </div>
        </div>
      ) : (
        <div className="task-editor-actions">
          <button type="submit" className="task-save" disabled={busy || !title.trim()}>
            Save changes
          </button>
          <button type="button" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="task-danger"
            aria-label="Delete task"
            disabled={busy}
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      )}
    </form>
  );
}
