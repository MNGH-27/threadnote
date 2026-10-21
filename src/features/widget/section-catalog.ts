import {
  CalendarDays,
  Check,
  Globe2,
  Image as ImageIcon,
  Mail,
  Network,
  NotebookPen,
} from "lucide-react";
import type { NoteColor, NoteSectionType } from "@/types/widget";

export const accentColors: Record<NoteColor, string> = {
  amber: "#fbbf24",
  rose: "#fb7185",
  blue: "#38bdf8",
  green: "#34d399",
  violet: "#a78bfa",
};
export const noteColors = Object.keys(accentColors) as NoteColor[];
export const sectionMeta: Record<
  NoteSectionType,
  { title: string; description: string; icon: typeof Mail; tone: string }
> = {
  note: {
    title: "Note",
    description: "A new text note",
    icon: NotebookPen,
    tone: "text-amber-300 bg-amber-400/10",
  },
  email: {
    title: "Email",
    description: "Gmail inbox",
    icon: Mail,
    tone: "text-blue-300 bg-blue-400/10",
  },
  calendar: {
    title: "Calendar",
    description: "Google Calendar",
    icon: CalendarDays,
    tone: "text-violet-300 bg-violet-400/10",
  },
  tasks: {
    title: "Tasks",
    description: "Local tasks and Google Tasks",
    icon: Check,
    tone: "text-emerald-300 bg-emerald-400/10",
  },
  mindmap: {
    title: "Mind map",
    description: "Ideas and connections",
    icon: Network,
    tone: "text-violet-300 bg-violet-400/10",
  },
  image: {
    title: "Image",
    description: "An image from your device",
    icon: ImageIcon,
    tone: "text-rose-300 bg-rose-400/10",
  },
  site: {
    title: "Live website",
    description: "A live web page",
    icon: Globe2,
    tone: "text-cyan-300 bg-cyan-400/10",
  },
};
