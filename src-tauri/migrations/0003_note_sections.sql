CREATE TABLE IF NOT EXISTS note_sections (
  id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL REFERENCES widget_notes(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL CHECK(section_type IN ('email', 'tasks', 'mindmap', 'image', 'site')),
  position INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS note_sections_note_position_idx ON note_sections(note_id, position);
