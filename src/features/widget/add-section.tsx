import { Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { NoteSectionType } from "@/types/widget";
import { sectionMeta } from "./section-catalog";

export function AddSection({
  onAdd,
  onOpenChange,
}: {
  onAdd: (type: NoteSectionType) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  const changeOpen = (value: boolean) => {
    setOpen(value);
    onOpenChange(value);
  };
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!menu.current?.contains(event.target as Node)) {
        setOpen(false);
        onOpenChange(false);
      }
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        onOpenChange(false);
        event.stopPropagation();
      }
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape, true);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape, true);
    };
  }, [open, onOpenChange]);
  return (
    <div ref={menu} className="relative">
      <button
        className="add-section-button"
        aria-label="Add section"
        title="Add section"
        aria-expanded={open}
        onClick={() => changeOpen(!open)}
      >
        <Plus size={16} />
        <span>Add</span>
      </button>
      {open && (
        <div className="section-picker" dir="ltr">
          {(Object.keys(sectionMeta) as NoteSectionType[]).map((type) => {
            const item = sectionMeta[type];
            const Icon = item.icon;
            return (
              <button
                key={type}
                onClick={() => {
                  onAdd(type);
                  changeOpen(false);
                }}
              >
                <span className={`section-type-icon ${item.tone}`}>
                  <Icon size={15} />
                </span>
                <span>
                  <strong>{item.title}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
