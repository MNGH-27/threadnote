import { Image as ImageIcon } from "lucide-react";
import { useRef, useState } from "react";
import type { NoteSection } from "@/types/widget";

export function ImageSection({
  section,
  onChange,
}: {
  section: NoteSection;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const src = typeof section.config.src === "string" ? section.config.src : "";
  const caption = typeof section.config.caption === "string" ? section.config.caption : "";
  const [error, setError] = useState("");
  const choose = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Images must be 5 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setError("");
      onChange({ src: String(reader.result), caption });
    };
    reader.onerror = () => setError("Could not read this image. Please choose it again.");
    reader.readAsDataURL(file);
  };
  return (
    <div className="image-section" dir="ltr">
      <input
        dir="auto"
        ref={input}
        hidden
        type="file"
        accept="image/*"
        onChange={(event) => choose(event.target.files?.[0])}
      />
      {src ? (
        <>
          <img src={src} alt={caption || "Note image"} />
          <div className="mt-2 flex gap-2">
            <input
              dir="auto"
              className="field !h-9"
              placeholder="Image caption…"
              value={caption}
              onChange={(event) => onChange({ src, caption: event.target.value })}
            />
            <button className="soft-button" onClick={() => input.current?.click()}>
              Replace
            </button>
          </div>
        </>
      ) : (
        <button className="image-drop" onClick={() => input.current?.click()}>
          <ImageIcon size={22} />
          <strong>Choose image</strong>
          <small>Stored only in this note · Up to 5 MB</small>
        </button>
      )}
      {error && <p className="error-box mt-2">{error}</p>}
    </div>
  );
}
