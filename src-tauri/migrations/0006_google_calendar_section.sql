CREATE TABLE note_sections_v6 (
  id TEXT PRIMARY KEY NOT NULL,
  note_id TEXT NOT NULL REFERENCES widget_notes(id) ON DELETE CASCADE,
  section_type TEXT NOT NULL CHECK(section_type IN ('note', 'email', 'calendar', 'tasks', 'mindmap', 'image', 'site')),
  position INTEGER NOT NULL DEFAULT 0,
  config_json TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
INSERT INTO note_sections_v6 SELECT * FROM note_sections;
DROP TABLE note_sections;
ALTER TABLE note_sections_v6 RENAME TO note_sections;
CREATE INDEX note_sections_note_position_idx ON note_sections(note_id, position);
CREATE TRIGGER remove_section_connections
AFTER DELETE ON note_sections
BEGIN
  DELETE FROM note_connections
  WHERE note_id = OLD.note_id AND (from_node = OLD.id OR to_node = OLD.id);
END;
