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

/**
 * Strips +project/@context tags and URLs out of a task's text, leaving just
 * the prose description — used to render the clean task-body line while
 * tags/links are shown separately as meta badges.
 */
export function stripTags(text: string): string {
  return text
    .replace(URL_RE, "")
    .replace(PROJECT_RE, "")
    .replace(CONTEXT_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type HighlightToken = {
  text: string;
  type: "plain" | "priority" | "project" | "context" | "url";
};

const TOKEN_RE = /(https?:\/\/\S+)|(\+\S+)|(@\S+)/g;

/**
 * Tokenizes a raw todo.txt line into typed spans, in order, for live syntax
 * highlighting in the capture input. Unlike parseLine, this preserves
 * position/order instead of extracting fields into separate arrays.
 */
export function tokenizeForHighlight(raw: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let rest = raw;

  const priorityMatch = raw.match(/^\([A-Z]\)(?=\s|$)/);
  if (priorityMatch) {
    tokens.push({ text: priorityMatch[0], type: "priority" });
    rest = raw.slice(priorityMatch[0].length);
  }

  let lastIndex = 0;
  let m: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((m = TOKEN_RE.exec(rest)) !== null) {
    if (m.index > lastIndex) {
      tokens.push({ text: rest.slice(lastIndex, m.index), type: "plain" });
    }
    const [full, url, project, context] = m;
    if (url) tokens.push({ text: full, type: "url" });
    else if (project) tokens.push({ text: full, type: "project" });
    else if (context) tokens.push({ text: full, type: "context" });
    lastIndex = m.index + full.length;
  }
  if (lastIndex < rest.length) {
    tokens.push({ text: rest.slice(lastIndex), type: "plain" });
  }

  return tokens;
}
