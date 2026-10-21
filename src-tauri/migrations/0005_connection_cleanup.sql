-- Keep section deletion and removal of its connections atomic in SQLite.
CREATE TRIGGER IF NOT EXISTS remove_section_connections
AFTER DELETE ON note_sections
BEGIN
  DELETE FROM note_connections
  WHERE note_id = OLD.note_id AND (from_node = OLD.id OR to_node = OLD.id);
END;
