export interface Task {
  id: string;
  /** Full line as typed, e.g. "(A) Terminar informe +trabajo @compu https://ejemplo.com" */
  raw: string;
  /** raw without the leading "(A) " priority marker */
  text: string;
  priority: string | null;
  projects: string[];
  contexts: string[];
  urls: string[];
  /** ISO date (YYYY-MM-DD), resolved from a relative-date phrase like "el sábado". */
  dueDate: string | null;
  done: boolean;
  createdAt: number;
  completedAt: number | null;
}

/** Which of the two mutually-exclusive tabs is showing. */
export type View = "active" | "archived";

/** Optional tag chip filtering within the current view. */
export interface TagFilter {
  type: "project" | "context";
  value: string;
}
