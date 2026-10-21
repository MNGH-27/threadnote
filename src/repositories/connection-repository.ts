import { getNativeDatabase } from "@/database/client";
import type { NoteConnection } from "@/types/widget";

export const connectionRepository = {
  async list(noteId: string) {
    const database = await getNativeDatabase();
    return database.select<NoteConnection[]>(
      `SELECT id, note_id AS noteId, from_node AS fromNode,
      to_node AS toNode, created_at AS createdAt FROM note_connections WHERE note_id=$1 ORDER BY created_at`,
      [noteId],
    );
  },
  async create(noteId: string, fromNode: string, toNode: string) {
    const database = await getNativeDatabase();
    const connection: NoteConnection = {
      id: crypto.randomUUID(),
      noteId,
      fromNode,
      toNode,
      createdAt: Date.now(),
    };
    await database.execute(
      "INSERT INTO note_connections (id,note_id,from_node,to_node,created_at) VALUES ($1,$2,$3,$4,$5)",
      [connection.id, noteId, fromNode, toNode, connection.createdAt],
    );
    return connection;
  },
  async remove(id: string) {
    const database = await getNativeDatabase();
    await database.execute("DELETE FROM note_connections WHERE id=$1", [id]);
  },
  async removeForNode(nodeId: string) {
    const database = await getNativeDatabase();
    await database.execute("DELETE FROM note_connections WHERE from_node=$1 OR to_node=$1", [
      nodeId,
    ]);
  },
};
