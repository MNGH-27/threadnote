import type { NoteSectionType } from "@/types/widget";

const defaults: Record<NoteSectionType, Record<string, unknown>> = {
  note: { title: "", body: "" },
  email: {},
  calendar: {},
  tasks: {},
  mindmap: { center: "Main topic", nodes: [] },
  image: { src: "", caption: "" },
  site: { url: "" },
};

/** SQLite contains JSON from older versions too; never trust it as an object. */
export function readSectionConfig(json: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(json);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

export function createSectionConfig(type: NoteSectionType) {
  // Each section owns its arrays and nested values, including mind-map branches.
  return structuredClone(defaults[type]);
}
