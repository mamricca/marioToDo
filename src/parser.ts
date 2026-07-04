const PRIORITY_RE = /^\(([A-Z])\)\s+/;
const URL_RE = /https?:\/\/[^\s]+/g;
const PROJECT_RE = /\+(\S+)/g;
const CONTEXT_RE = /@(\S+)/g;

const WEEKDAYS: Record<string, number> = {
  domingo: 0,
  lunes: 1,
  martes: 2,
  miercoles: 3,
  jueves: 4,
  viernes: 5,
  sabado: 6,
};

const WEEKDAY_RE =
  /\b(?:el\s+)?(pr[oó]ximo\s+)?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)\b/i;
const RELATIVE_DAY_RE = /\b(hoy|pasado\s+ma[ñn]ana|ma[ñn]ana)\b/i;

export interface ParsedLine {
  priority: string | null;
  text: string;
  projects: string[];
  contexts: string[];
  urls: string[];
  dueDate: string | null;
}

function stripAccents(s: string): string {
  return s
    .replace(/á/g, "a")
    .replace(/é/g, "e")
    .replace(/í/g, "i")
    .replace(/ó/g, "o")
    .replace(/ú/g, "u")
    .replace(/ñ/g, "n");
}

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

export interface DueDateMatch {
  dueDate: string;
  matchText: string;
}

/**
 * Detects a Spanish relative-date phrase ("el sábado", "el próximo sábado",
 * "hoy", "mañana", "pasado mañana") and resolves it to a concrete ISO date
 * relative to `now`. Weekday names without "próximo" resolve to the nearest
 * occurrence (today counts if it matches); with "próximo" it skips ahead a
 * full extra week.
 */
export function extractDueDate(text: string, now: Date = new Date()): DueDateMatch | null {
  const relMatch = text.match(RELATIVE_DAY_RE);
  if (relMatch) {
    const word = stripAccents(relMatch[0].toLowerCase()).replace(/\s+/g, " ");
    let date = now;
    if (word.startsWith("pasado")) date = addDays(now, 2);
    else if (word === "manana") date = addDays(now, 1);
    return { dueDate: isoDate(date), matchText: relMatch[0] };
  }

  const wdMatch = text.match(WEEKDAY_RE);
  if (wdMatch) {
    const hasProximo = Boolean(wdMatch[1]);
    const dayName = stripAccents(wdMatch[2].toLowerCase());
    const targetDow = WEEKDAYS[dayName];
    const diff = (targetDow - now.getDay() + 7) % 7;
    const date = addDays(now, diff + (hasProximo ? 7 : 0));
    return { dueDate: isoDate(date), matchText: wdMatch[0] };
  }

  return null;
}

/**
 * Parses a single todo.txt-style line.
 * Priority "(A)" must be at the start. Projects (+x), contexts (@x), URLs
 * and a Spanish relative-date phrase are detected anywhere in the remaining
 * text. URL contents are masked before scanning for +/@ tags so query
 * strings / emails inside a URL don't get picked up as tags.
 */
export function parseLine(raw: string, now: Date = new Date()): ParsedLine {
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
  const dueDate = extractDueDate(masked, now)?.dueDate ?? null;

  return { priority, text, projects, contexts, urls, dueDate };
}

/**
 * Strips +project/@context tags, URLs and a relative-date phrase out of a
 * task's text, leaving just the prose description — used to render the
 * clean task-body line while tags/links/date are shown separately as meta
 * badges.
 */
export function stripTags(text: string): string {
  let result = text.replace(URL_RE, "").replace(PROJECT_RE, "").replace(CONTEXT_RE, "");
  const dueMatch = extractDueDate(result);
  if (dueMatch) result = result.replace(dueMatch.matchText, "");
  return result.replace(/\s+/g, " ").trim();
}

export type HighlightToken = {
  text: string;
  type: "plain" | "priority" | "project" | "context" | "url" | "date" | "money";
};

/** $45000, $45.000, $1,234.56 — must end on a digit so trailing punctuation
 * ("Pagar $500.") isn't swallowed into the match. */
export const MONEY_RE = /\$\d(?:[\d.,]*\d)?/g;

const TOKEN_RE = /(https?:\/\/\S+)|(\+\S+)|(@\S+)|(\$\d(?:[\d.,]*\d)?)/g;

function splitOutDate(token: HighlightToken): HighlightToken[] {
  if (token.type !== "plain") return [token];
  const match = token.text.match(RELATIVE_DAY_RE) ?? token.text.match(WEEKDAY_RE);
  if (!match || match.index === undefined) return [token];

  const before = token.text.slice(0, match.index);
  const dateText = match[0];
  const after = token.text.slice(match.index + dateText.length);
  const parts: HighlightToken[] = [];
  if (before) parts.push({ text: before, type: "plain" });
  parts.push({ text: dateText, type: "date" });
  if (after) parts.push({ text: after, type: "plain" });
  return parts;
}

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
    const [full, url, project, context, money] = m;
    if (url) tokens.push({ text: full, type: "url" });
    else if (project) tokens.push({ text: full, type: "project" });
    else if (context) tokens.push({ text: full, type: "context" });
    else if (money) tokens.push({ text: full, type: "money" });
    lastIndex = m.index + full.length;
  }
  if (lastIndex < rest.length) {
    tokens.push({ text: rest.slice(lastIndex), type: "plain" });
  }

  return tokens.flatMap(splitOutDate);
}
