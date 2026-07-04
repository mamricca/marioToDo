import type { Task } from "./types";

export type SortMode = "priority" | "date";

export function sortTasks(tasks: Task[], mode: SortMode): Task[] {
  if (mode === "date") {
    return [...tasks].sort((a, b) => {
      if (a.dueDate !== b.dueDate) {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return a.dueDate.localeCompare(b.dueDate);
      }
      return a.createdAt - b.createdAt;
    });
  }

  return [...tasks].sort((a, b) => {
    if (a.priority !== b.priority) {
      if (!a.priority) return 1;
      if (!b.priority) return -1;
      return a.priority.localeCompare(b.priority);
    }
    return a.createdAt - b.createdAt;
  });
}

/** A task with no priority, no +project, no @context, but at least one link. */
export function isLinkOnly(task: Task): boolean {
  return (
    !task.priority &&
    task.projects.length === 0 &&
    task.contexts.length === 0 &&
    task.urls.length > 0
  );
}
