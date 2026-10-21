import { getNativeDatabase } from "@/database/client";
import type { WidgetNote } from "@/types/widget";

type NoteRow = WidgetNote;

export const noteRepository = {
  async getOrCreate(id: string) {
    const database = await getNativeDatabase();
    const rows = await database.select<NoteRow[]>(
      "SELECT id, title, body, color, created_at AS createdAt, updated_at AS updatedAt FROM widget_notes WHERE id = $1",
      [id],
    );
    if (rows[0]) return rows[0];
    const note: WidgetNote = {
      id,
      title: "",
      body: "",
      color: "amber",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await database.execute(
      "INSERT OR IGNORE INTO widget_notes (id, title, body, color, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [note.id, note.title, note.body, note.color, note.createdAt, note.updatedAt],
    );
    return note;
  },
  async list() {
    const database = await getNativeDatabase();
    return database.select<NoteRow[]>(
      "SELECT id, title, body, color, created_at AS createdAt, updated_at AS updatedAt FROM widget_notes ORDER BY updated_at DESC",
    );
  },
  async create() {
    const database = await getNativeDatabase();
    const note: WidgetNote = {
      id: crypto.randomUUID(),
      title: "",
      body: "",
      color: "amber",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await database.execute(
      "INSERT INTO widget_notes (id, title, body, color, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6)",
      [note.id, note.title, note.body, note.color, note.createdAt, note.updatedAt],
    );
    return note;
  },
  async update(note: WidgetNote) {
    const database = await getNativeDatabase();
    await database.execute(
      "UPDATE widget_notes SET title = $1, body = $2, color = $3, updated_at = $4 WHERE id = $5",
      [note.title, note.body, note.color, note.updatedAt, note.id],
    );
  },
  async remove(id: string) {
    const database = await getNativeDatabase();
    await database.execute("DELETE FROM widget_notes WHERE id = $1", [id]);
  },
};
