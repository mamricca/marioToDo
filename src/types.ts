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
  /** Id of the parent task, if this is a sub-task ("> algo"). One level deep only. */
  parentId: string | null;
  done: boolean;
  createdAt: number;
  completedAt: number | null;
}

/** Which of the mutually-exclusive tabs is showing. */
export type View = "active" | "links" | "archived";

/** Optional tag chip filtering within the current view. */
export interface TagFilter {
  type: "project" | "context";
  value: string;
}

/** Top-level section of the app — persisted in localStorage. */
export type Mode = "agenda" | "noticias";

export interface Feed {
  id: string;
  name: string;
  url: string;
}

export interface FeedItem {
  id: string;
  feedId: string;
  feedName: string;
  title: string;
  link: string;
  /** ms epoch, null if the feed didn't provide a publish date. */
  publishedAt: number | null;
  read: boolean;
  /** ms epoch — when our own ingestion first saved this item. */
  fetchedAt: number;
}

/** Mutually-exclusive tabs in modo Noticias. */
export type NewsView = "unread" | "all";
