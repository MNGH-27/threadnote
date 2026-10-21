// Synthetic data only. No native IPC, credentials, user database or Google requests.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { TaskList, type TaskItem } from "../../src/features/widget/sections/task-list";
import "../../src/styles.css";

function Fixture() {
  const [compact, setCompact] = useState(false);
  const [fail, setFail] = useState(false);
  const [tasks, setTasks] = useState<TaskItem[]>([
    {
      id: "one",
      title: "Prepare release",
      description: "Review installer and capture the demo.\nKeep these full details readable.",
      dueDate: "2026-10-21",
      completed: false,
    },
    {
      id: "two",
      title: "Design review",
      description: "Review compact layouts.",
      dueDate: "2026-10-21",
      completed: true,
    },
    {
      id: "three",
      title: "Write documentation",
      description: "Include the new task controls.",
      dueDate: "2026-10-22",
      completed: false,
    },
    {
      id: "four",
      title: "ایده‌های بعدی",
      description: "یادداشت نمونه",
      dueDate: "",
      completed: false,
    },
  ]);
  return (
    <main style={{ background: "#121318", minHeight: "100vh", padding: 24, color: "#ddd" }}>
      <button style={{ padding: 10 }} onClick={() => setCompact((value) => !value)}>
        Toggle compact / wide
      </button>
      <label style={{ marginLeft: 20 }}>
        <input type="checkbox" checked={fail} onChange={(event) => setFail(event.target.checked)} />{" "}
        Simulate save failure
      </label>
      <div
        style={{
          marginTop: 16,
          width: compact ? 280 : 500,
          maxWidth: "100%",
          background: "#202126",
          border: "1px solid #444",
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        <TaskList
          remote
          tasks={tasks}
          busy={false}
          onSave={async (task, values) => {
            if (fail) throw new Error("Simulated failure");
            setTasks((items) =>
              items.map((item) => (item.id === task.id ? { ...item, ...values } : item)),
            );
          }}
          onToggle={async (task) =>
            setTasks((items) =>
              items.map((item) =>
                item.id === task.id ? { ...item, completed: !item.completed } : item,
              ),
            )
          }
          onDelete={async (task) =>
            setTasks((items) => items.filter((item) => item.id !== task.id))
          }
        />
      </div>
      <output style={{ display: "block", marginTop: 16 }}>Tasks: {tasks.length}</output>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
