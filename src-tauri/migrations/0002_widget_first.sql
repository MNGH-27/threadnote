PRAGMA foreign_keys = OFF;

CREATE TABLE IF NOT EXISTS widget_notes (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'amber',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO widget_notes (id, title, body, color, created_at, updated_at)
SELECT blocks.id, blocks.title, notes.text, notes.color, blocks.created_at, blocks.updated_at
FROM blocks INNER JOIN notes ON notes.block_id = blocks.id;

CREATE TABLE IF NOT EXISTS widget_tasks (
  id TEXT PRIMARY KEY NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority TEXT NOT NULL DEFAULT 'medium',
  due_date TEXT,
  due_time TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  completed INTEGER NOT NULL DEFAULT 0,
  google_task_list_id TEXT,
  google_task_id TEXT,
  google_calendar_event_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT OR IGNORE INTO widget_tasks (
  id, title, description, priority, due_date, duration_minutes, completed,
  sync_status, created_at, updated_at
)
SELECT blocks.id, blocks.title, tasks.description, tasks.priority, tasks.due_date,
       COALESCE(tasks.estimated_duration, 30),
       CASE WHEN tasks.status = 'done' THEN 1 ELSE 0 END,
       'pending', blocks.created_at, blocks.updated_at
FROM blocks INNER JOIN tasks ON tasks.block_id = blocks.id;

CREATE INDEX IF NOT EXISTS widget_notes_updated_idx ON widget_notes(updated_at DESC);
CREATE INDEX IF NOT EXISTS widget_tasks_due_idx ON widget_tasks(completed, due_date, due_time);

DROP TABLE IF EXISTS connections;
DROP TABLE IF EXISTS notes;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS blocks;
DROP TABLE IF EXISTS workspaces;

PRAGMA foreign_keys = ON;
