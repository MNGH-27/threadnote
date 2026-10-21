import { getNativeDatabase } from "@/database/client";
import type { TaskPriority, WidgetTask } from "@/types/widget";

type TaskRow = Omit<WidgetTask, "completed"> & { completed: number };

export interface NewTask {
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  durationMinutes: number;
}

function normalizeTask(row: TaskRow): WidgetTask {
  return { ...row, completed: Boolean(row.completed) };
}

export const taskRepository = {
  async list() {
    const database = await getNativeDatabase();
    const rows = await database.select<TaskRow[]>(`SELECT id, title, description, priority,
      due_date AS dueDate, due_time AS dueTime, duration_minutes AS durationMinutes,
      completed, google_task_list_id AS googleTaskListId, google_task_id AS googleTaskId,
      google_calendar_event_id AS googleCalendarEventId, sync_status AS syncStatus,
      created_at AS createdAt, updated_at AS updatedAt
      FROM widget_tasks ORDER BY completed ASC, COALESCE(due_date, '9999-12-31') ASC, updated_at DESC`);
    return rows.map(normalizeTask);
  },
  async create(values: NewTask) {
    const database = await getNativeDatabase();
    const task: WidgetTask = {
      id: crypto.randomUUID(),
      ...values,
      completed: false,
      googleTaskListId: null,
      googleTaskId: null,
      googleCalendarEventId: null,
      syncStatus: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await database.execute(
      `INSERT INTO widget_tasks
      (id, title, description, priority, due_date, due_time, duration_minutes, completed, sync_status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,0,'pending',$8,$9)`,
      [
        task.id,
        task.title,
        task.description,
        task.priority,
        task.dueDate,
        task.dueTime,
        task.durationMinutes,
        task.createdAt,
        task.updatedAt,
      ],
    );
    return task;
  },
  async setRemoteIds(id: string, listId: string, taskId: string, calendarEventId: string | null) {
    const database = await getNativeDatabase();
    await database.execute(
      `UPDATE widget_tasks SET google_task_list_id=$1, google_task_id=$2,
      google_calendar_event_id=$3, sync_status='synced', updated_at=$4 WHERE id=$5`,
      [listId, taskId, calendarEventId, Date.now(), id],
    );
  },
  async setCompleted(
    id: string,
    completed: boolean,
    syncStatus: WidgetTask["syncStatus"] = "pending",
  ) {
    const database = await getNativeDatabase();
    await database.execute(
      "UPDATE widget_tasks SET completed=$1, sync_status=$2, updated_at=$3 WHERE id=$4",
      [completed ? 1 : 0, syncStatus, Date.now(), id],
    );
  },
  async markError(id: string) {
    const database = await getNativeDatabase();
    await database.execute(
      "UPDATE widget_tasks SET sync_status='error', updated_at=$1 WHERE id=$2",
      [Date.now(), id],
    );
  },
  async remove(id: string) {
    const database = await getNativeDatabase();
    await database.execute("DELETE FROM widget_tasks WHERE id=$1", [id]);
  },
  async upsertGoogle(
    listId: string,
    remote: {
      id: string;
      title?: string;
      notes?: string;
      due?: string;
      status?: string;
      updated?: string;
    },
  ) {
    const database = await getNativeDatabase();
    const existing = await database.select<{ id: string }[]>(
      "SELECT id FROM widget_tasks WHERE google_task_id=$1",
      [remote.id],
    );
    if (existing.length) {
      await database.execute(
        `UPDATE widget_tasks SET title=$1, description=$2, due_date=$3, completed=$4,
        sync_status='synced', updated_at=$5 WHERE google_task_id=$6`,
        [
          remote.title ?? "Untitled task",
          remote.notes ?? "",
          remote.due?.slice(0, 10) ?? null,
          remote.status === "completed" ? 1 : 0,
          Date.now(),
          remote.id,
        ],
      );
      return;
    }
    const now = Date.now();
    await database.execute(
      `INSERT INTO widget_tasks
      (id,title,description,priority,due_date,due_time,duration_minutes,completed,google_task_list_id,google_task_id,sync_status,created_at,updated_at)
      VALUES ($1,$2,$3,'medium',$4,NULL,30,$5,$6,$7,'synced',$8,$9)`,
      [
        crypto.randomUUID(),
        remote.title ?? "Untitled task",
        remote.notes ?? "",
        remote.due?.slice(0, 10) ?? null,
        remote.status === "completed" ? 1 : 0,
        listId,
        remote.id,
        now,
        now,
      ],
    );
  },
};
