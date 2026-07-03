/**
 * Reads the payload Android's share sheet sends to /share-target (per the
 * `share_target` entry in the manifest), builds a draft todo.txt line from
 * it, and cleans the URL so a refresh doesn't re-trigger it.
 */
export function consumeShareTarget(): string | null {
  if (window.location.pathname !== "/share-target") return null;

  const params = new URLSearchParams(window.location.search);
  const title = params.get("title")?.trim() ?? "";
  const text = params.get("text")?.trim() ?? "";
  const url = params.get("url")?.trim() ?? "";

  window.history.replaceState({}, "", "/");

  const parts = [...new Set([title, text, url].filter(Boolean))];
  return parts.length > 0 ? parts.join(" ") : null;
}
