import type { NoteSection } from "@/types/widget";

export function TextNoteSection({
  section,
  onChange,
}: {
  section: NoteSection;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const title = typeof section.config.title === "string" ? section.config.title : "";
  const body = typeof section.config.body === "string" ? section.config.body : "";
  return (
    <div className="text-note-section" dir="ltr">
      <input
        dir="auto"
        placeholder="Note title"
        value={title}
        onChange={(event) => onChange({ title: event.target.value, body })}
      />
      <textarea
        dir="auto"
        placeholder="Write your note…"
        value={body}
        onChange={(event) => onChange({ title, body: event.target.value })}
      />
    </div>
  );
}
