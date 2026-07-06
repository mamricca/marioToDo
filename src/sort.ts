import type { Task, FeedItem } from "./types";

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

/**
 * Round-robins items across feeds instead of a flat recency sort — a
 * high-volume feed (e.g. ESPN posting many times a day) would otherwise
 * dominate the top of the list and bury slower feeds in runs of the same
 * source. Each feed's own items stay in their original relative order
 * (already sorted by recency by the query in feedsApi.ts); this just
 * interleaves across feeds, one at a time, in order of whichever feed's
 * most recent item appears first.
 */
export function interleaveByFeed(items: FeedItem[]): FeedItem[] {
  const byFeed = new Map<string, FeedItem[]>();
  for (const item of items) {
    const queue = byFeed.get(item.feedId);
    if (queue) queue.push(item);
    else byFeed.set(item.feedId, [item]);
  }

  const queues = [...byFeed.values()];
  const result: FeedItem[] = [];
  let i = 0;
  while (result.length < items.length) {
    const queue = queues[i % queues.length];
    const next = queue.shift();
    if (next) result.push(next);
    i++;
  }
  return result;
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
