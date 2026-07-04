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

const MONTHS: Record<string, number> = {
  enero: 0,
  febrero: 1,
  marzo: 2,
  abril: 3,
  mayo: 4,
  junio: 5,
  julio: 6,
  agosto: 7,
  septiembre: 8,
  setiembre: 8,
  octubre: 9,
  noviembre: 10,
  diciembre: 11,
};

const WEEKDAY_RE =
  /\b(?:el\s+)?(pr[oó]ximo\s+)?(domingo|lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado)\b/i;
const RELATIVE_DAY_RE = /\b(hoy|pasado\s+ma[ñn]ana|ma[ñn]ana)\b/i;
const RELATIVE_DAYS_COUNT_RE = /\ben\s+(\d+)\s+d[ií]as?\b/i;
const RELATIVE_WEEKS_RE = /\ben\s+(una|\d+)\s+semanas?\b/i;
const MONTH_DAY_RE =
  /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i;
// DD/MM(/YYYY) — día primero, como se usa en español rioplatense.
const SLASH_DATE_RE = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/;
const ISO_DATE_RE = /\b(\d{4})-(\d{2})-(\d{2})\b/;

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

function startOfDay(d: Date): Date {
  const result = new Date(d);
  result.setHours(0, 0, 0, 0);
  return result;
}

const INVALID_DATE = new Date(NaN);

interface DateMatcher {
  regex: RegExp;
  resolve: (match: RegExpMatchArray, now: Date) => Date;
}

/**
 * Each entry tries its regex against the text and, if matched, resolves a
 * concrete Date from it. Order = priority when multiple phrases could
 * theoretically match; checked top to bottom, first match wins.
 */
const DATE_MATCHERS: DateMatcher[] = [
  {
    // hoy / mañana / pasado mañana
    regex: RELATIVE_DAY_RE,
    resolve: (match, now) => {
      const word = stripAccents(match[0].toLowerCase()).replace(/\s+/g, " ");
      if (word.startsWith("pasado")) return addDays(now, 2);
      if (word === "manana") return addDays(now, 1);
      return now;
    },
  },
  {
    // en 3 días
    regex: RELATIVE_DAYS_COUNT_RE,
    resolve: (match, now) => addDays(now, parseInt(match[1], 10)),
  },
  {
    // en una semana / en 2 semanas
    regex: RELATIVE_WEEKS_RE,
    resolve: (match, now) => {
      const n = match[1].toLowerCase() === "una" ? 1 : parseInt(match[1], 10);
      return addDays(now, n * 7);
    },
  },
  {
    // el sábado / el próximo sábado
    regex: WEEKDAY_RE,
    resolve: (match, now) => {
      const hasProximo = Boolean(match[1]);
      const dayName = stripAccents(match[2].toLowerCase());
      const targetDow = WEEKDAYS[dayName];
      const diff = (targetDow - now.getDay() + 7) % 7;
      return addDays(now, diff + (hasProximo ? 7 : 0));
    },
  },
  {
    // 2026-07-15
    regex: ISO_DATE_RE,
    resolve: (match) =>
      new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  },
  {
    // 4 de julio — sin año: este año, o el que viene si ya pasó.
    regex: MONTH_DAY_RE,
    resolve: (match, now) => {
      const day = parseInt(match[1], 10);
      const month = MONTHS[stripAccents(match[2].toLowerCase())];
      let date = new Date(now.getFullYear(), month, day);
      if (date.getMonth() !== month) return INVALID_DATE;
      if (date.getTime() < startOfDay(now).getTime()) {
        date = new Date(now.getFullYear() + 1, month, day);
      }
      return date;
    },
  },
  {
    // 15/8 o 15/8/2026 (día/mes, no mes/día)
    regex: SLASH_DATE_RE,
    resolve: (match, now) => {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      let year = match[3] ? parseInt(match[3], 10) : now.getFullYear();
      if (year < 100) year += 2000;
      let date = new Date(year, month, day);
      if (date.getMonth() !== month) return INVALID_DATE;
      if (!match[3] && date.getTime() < startOfDay(now).getTime()) {
        date = new Date(year + 1, month, day);
      }
      return date;
    },
  },
];

function findDateMatch(text: string): RegExpMatchArray | null {
  for (const matcher of DATE_MATCHERS) {
    const match = text.match(matcher.regex);
    if (match) return match;
  }
  return null;
}

export interface DueDateMatch {
  dueDate: string;
  matchText: string;
}

/**
 * Detects a date phrase — relative ("el sábado", "el próximo sábado", "hoy",
 * "mañana", "pasado mañana", "en 3 días", "en una semana") or absolute
 * ("4 de julio", "15/8", "2026-07-15") — and resolves it to a concrete ISO
 * date relative to `now`. Weekday names without "próximo" resolve to the
 * nearest occurrence (today counts if it matches); with "próximo" it skips
 * ahead a full extra week. Absolute dates without a year roll forward to
 * next year if that date already passed this year.
 */
export function extractDueDate(text: string, now: Date = new Date()): DueDateMatch | null {
  for (const matcher of DATE_MATCHERS) {
    const match = text.match(matcher.regex);
    if (!match) continue;
    const date = matcher.resolve(match, now);
    if (isNaN(date.getTime())) continue;
    return { dueDate: isoDate(date), matchText: match[0] };
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
  const match = findDateMatch(token.text);
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
