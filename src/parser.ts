const PRIORITY_RE = /^\(([A-Z])\)\s+/;
const URL_RE = /https?:\/\/[^\s]+/g;
const PROJECT_RE = /\+(\S+)/g;
const CONTEXT_RE = /@(\S+)/g;

export interface ParsedLine {
  priority: string | null;
  text: string;
  projects: string[];
  contexts: string[];
  urls: string[];
}

/**
 * Parses a single todo.txt-style line.
 * Priority "(A)" must be at the start. Projects (+x), contexts (@x) and URLs
 * are detected anywhere in the remaining text. URL contents are masked
 * before scanning for +/@ tags so query strings / emails inside a URL
 * don't get picked up as tags.
 */
export function parseLine(raw: string): ParsedLine {
  let text = raw.trim();

  let priority: string | null = null;
  const priorityMatch = text.match(PRIORITY_RE);
  if (priorityMatch) {
    priority = priorityMatch[1];
    text = text.slice(priorityMatch[0].length);
  }

  const urls = text.match(URL_RE) ?? [];

  const masked = text.replace(URL_RE, (m) => " ".repeat(m.length));
  const projects = [...masked.matchAll(PROJECT_RE)].map((m) => m[1]);
  const contexts = [...masked.matchAll(CONTEXT_RE)].map((m) => m[1]);

  return { priority, text, projects, contexts, urls };
}
