import { getNativeDatabase } from "@/database/client";
import { readSectionConfig, createSectionConfig } from "@/lib/section-config";
import type { NoteSection, NoteSectionType } from "@/types/widget";

type SectionRow = Omit<NoteSection, "type" | "config"> & {
  sectionType: NoteSectionType;
  configJson: string;
};

function sectionFromRow(row: SectionRow): NoteSection {
  const config = readSectionConfig(row.configJson);
  const { sectionType, configJson: _configJson, ...rest } = row;
  return { ...rest, type: sectionType, config };
}

export const sectionRepository = {
  async list(noteId: string) {
    const database = await getNativeDatabase();
    const rows = await database.select<SectionRow[]>(
      `SELECT id, note_id AS noteId, section_type AS sectionType,
      position, config_json AS configJson, created_at AS createdAt, updated_at AS updatedAt
      FROM note_sections WHERE note_id=$1 ORDER BY position ASC, created_at ASC`,
      [noteId],
    );
    return rows.map(sectionFromRow);
  },
  async create(
    noteId: string,
    type: NoteSectionType,
    layout?: { x: number; y: number; width: number; height: number },
  ) {
    const database = await getNativeDatabase();
    const [{ nextPosition }] = await database.select<{ nextPosition: number }[]>(
      "SELECT COALESCE(MAX(position), -1) + 1 AS nextPosition FROM note_sections WHERE note_id=$1",
      [noteId],
    );
    const now = Date.now();
    const section: NoteSection = {
      id: crypto.randomUUID(),
      noteId,
      type,
      position: nextPosition,
      config: { ...createSectionConfig(type), ...(layout ? { layout } : {}) },
      createdAt: now,
      updatedAt: now,
    };
    await database.execute(
      `INSERT INTO note_sections
      (id,note_id,section_type,position,config_json,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [section.id, noteId, type, section.position, JSON.stringify(section.config), now, now],
    );
    return section;
  },
  async updateConfig(section: NoteSection) {
    const database = await getNativeDatabase();
    await database.execute("UPDATE note_sections SET config_json=$1, updated_at=$2 WHERE id=$3", [
      JSON.stringify(section.config),
      Date.now(),
      section.id,
    ]);
  },
  async remove(id: string) {
    const database = await getNativeDatabase();
    await database.execute("DELETE FROM note_sections WHERE id=$1", [id]);
  },
};
