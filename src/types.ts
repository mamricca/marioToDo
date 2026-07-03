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
  done: boolean;
  createdAt: number;
  completedAt: number | null;
}

export type FilterType = "all" | "project" | "context";

export interface Filter {
  type: FilterType;
  value: string | null;
}
