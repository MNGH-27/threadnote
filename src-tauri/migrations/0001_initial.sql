PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  icon TEXT NOT NULL DEFAULT 'hash',
  viewport_x REAL NOT NULL DEFAULT 0,
  viewport_y REAL NOT NULL DEFAULT 0,
  viewport_zoom REAL NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS blocks (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('note', 'task')),
  title TEXT NOT NULL,
  position_x REAL NOT NULL,
  position_y REAL NOT NULL,
  width REAL NOT NULL,
  height REAL NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS blocks_workspace_idx ON blocks(workspace_id);
CREATE INDEX IF NOT EXISTS blocks_workspace_updated_idx ON blocks(workspace_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS notes (
  block_id TEXT PRIMARY KEY NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  text TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'amber',
  pinned INTEGER NOT NULL DEFAULT 0 CHECK(pinned IN (0, 1))
);

CREATE TABLE IF NOT EXISTS tasks (
  block_id TEXT PRIMARY KEY NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('backlog', 'todo', 'in_progress', 'blocked', 'done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'urgent')),
  start_date TEXT,
  due_date TEXT,
  estimated_duration INTEGER,
  actual_duration INTEGER,
  completed_at INTEGER
);

CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date);

CREATE TABLE IF NOT EXISTS connections (
  id TEXT PRIMARY KEY NOT NULL,
  workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source_block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  target_block_id TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL DEFAULT 'related_to' CHECK(relationship_type IN ('related_to', 'depends_on', 'blocks', 'part_of', 'created_from', 'supports')),
  label TEXT,
  created_at INTEGER NOT NULL,
  CHECK(source_block_id <> target_block_id),
  UNIQUE(workspace_id, source_block_id, target_block_id)
);

CREATE INDEX IF NOT EXISTS connections_workspace_idx ON connections(workspace_id);
CREATE INDEX IF NOT EXISTS connections_source_idx ON connections(source_block_id);
CREATE INDEX IF NOT EXISTS connections_target_idx ON connections(target_block_id);
