export type NoteColor = "amber" | "rose" | "blue" | "green" | "violet";

export interface WidgetNote {
  id: string;
  title: string;
  body: string;
  color: NoteColor;
  createdAt: number;
  updatedAt: number;
}

export type NoteSectionType =
  "note" | "email" | "calendar" | "tasks" | "mindmap" | "image" | "site";

export interface NoteSection {
  id: string;
  noteId: string;
  type: NoteSectionType;
  position: number;
  config: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
}

export interface NoteConnection {
  id: string;
  noteId: string;
  fromNode: string;
  toNode: string;
  createdAt: number;
}

export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface WidgetTask {
  id: string;
  title: string;
  description: string;
  priority: TaskPriority;
  dueDate: string | null;
  dueTime: string | null;
  durationMinutes: number;
  completed: boolean;
  googleTaskListId: string | null;
  googleTaskId: string | null;
  googleCalendarEventId: string | null;
  syncStatus: "pending" | "synced" | "error";
  createdAt: number;
  updatedAt: number;
}

export interface GoogleAuthStatus {
  configured: boolean;
  connected: boolean;
  email: string | null;
  accountId: string | null;
  permissions: { gmail: boolean; calendar: boolean; tasks: boolean };
  loginPending: boolean;
}

export interface GoogleTaskList {
  id: string;
  title: string;
}
export interface GoogleTask {
  id: string;
  title?: string;
  notes?: string;
  due?: string;
  status?: string;
  updated?: string;
  deleted?: boolean;
  parent?: string;
  assignmentInfo?: { surfaceType?: string };
}
export interface GoogleCalendar {
  id: string;
  title: string;
  color: string;
  primary: boolean;
}

export interface MailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  snippet: string;
  receivedAt: number;
  unread: boolean;
}

export interface CalendarItem {
  id: string;
  title: string;
  start: string;
  end: string;
  htmlLink: string;
}
