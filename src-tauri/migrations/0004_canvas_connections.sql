CREATE TABLE note_sections_v4 (
  id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL REFERENCES widget_notes(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL CHECK(section_type IN ('note', 'email', 'tasks', 'mindmap', 'image', 'site')),
  position INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

INSERT INTO note_sections_v4 (id,note_id,section_type,position,config_json,created_at,updated_at)
SELECT id,note_id,section_type,position,config_json,created_at,updated_at FROM note_sections;

DROP TABLE note_sections;
ALTER TABLE note_sections_v4 RENAME TO note_sections;
CREATE INDEX note_sections_note_position_idx ON note_sections(note_id, position);

CREATE TABLE note_connections (
  id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL REFERENCES widget_notes(id) ON DELETE CASCADE,
  from_node TEXT NOT NULL,
  to_node TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX note_connections_note_idx ON note_connections(note_id);
