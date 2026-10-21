import { Plus, X } from "lucide-react";
import { useState } from "react";
import type { NoteSection } from "@/types/widget";

interface MindNode {
  id: string;
  text: string;
}
export function MindmapSection({
  section,
  onChange,
}: {
  section: NoteSection;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const center = typeof section.config.center === "string" ? section.config.center : "Main topic";
  const nodes: MindNode[] = Array.isArray(section.config.nodes)
    ? section.config.nodes.filter(
        (node): node is MindNode =>
          Boolean(node) &&
          typeof node === "object" &&
          typeof node.id === "string" &&
          typeof node.text === "string",
      )
    : [];
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    onChange({ center, nodes: [...nodes, { id: crypto.randomUUID(), text: draft.trim() }] });
    setDraft("");
  };
  return (
    <div className="mindmap" dir="ltr">
      <input
        dir="auto"
        className="mind-center"
        value={center}
        onChange={(event) => onChange({ center: event.target.value, nodes })}
      />
      <div className="mind-nodes">
        {nodes.map((node) => (
          <div className="mind-node" key={node.id}>
            <input
              dir="auto"
              value={node.text}
              onChange={(event) =>
                onChange({
                  center,
                  nodes: nodes.map((item) =>
                    item.id === node.id ? { ...item, text: event.target.value } : item,
                  ),
                })
              }
            />
            <button
              onClick={() =>
                onChange({ center, nodes: nodes.filter((item) => item.id !== node.id) })
              }
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          dir="auto"
          className="field !h-9"
          placeholder="New branch…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") add();
          }}
        />
        <button className="icon-button accent !size-9" onClick={add}>
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}
