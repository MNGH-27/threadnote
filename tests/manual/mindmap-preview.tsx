// Synthetic standalone fixture: never connects to native IPC, Google or a user database.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { MindmapSection } from "../../src/features/widget/sections/mindmap-section";
import type { NoteSection } from "../../src/types/widget";
import "../../src/styles.css";

function Fixture() {
  const [compact, setCompact] = useState(false);
  const [section, setSection] = useState<NoteSection>({
    id: "demo",
    noteId: "demo",
    type: "mindmap",
    position: 0,
    createdAt: 1,
    updatedAt: 1,
    config: {
      center: "Product launch",
      nodes: [
        { id: "design", text: "Design" },
        { id: "build", text: "Build" },
        { id: "share", text: "Share" },
        { id: "learn", text: "یادگیری" },
        { id: "layout", text: "Layout", parentId: "design" },
        { id: "colors", text: "Colors", parentId: "design" },
        { id: "test", text: "Regression tests", parentId: "build" },
        { id: "release", text: "Publish release", parentId: "share" },
      ],
    },
  });
  return (
    <div
      style={{
        padding: 24,
        height: "100vh",
        overflow: "auto",
        color: "#eee",
        background: "#121318",
      }}
    >
      <button
        onClick={() => setCompact((value) => !value)}
        style={{ padding: 10, marginBottom: 16 }}
      >
        Toggle compact / wide
      </button>
      <div
        style={{
          width: compact ? 310 : 850,
          maxWidth: "100%",
          height: compact ? 300 : 480,
          border: "1px solid #444",
          borderRadius: 16,
          overflow: "hidden",
          background: "#202126",
        }}
      >
        <MindmapSection
          section={section}
          onChange={(config) => setSection((value) => ({ ...value, config }))}
        />
      </div>
      <output style={{ display: "block", marginTop: 12 }}>
        Topics: {Array.isArray(section.config.nodes) ? section.config.nodes.length : 0}
      </output>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Fixture />);
