/**
 * Supabase/PostgREST errors are plain objects with a `.message` field, not
 * `Error` instances — `String(err)` on those gives "[object Object]".
 */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return String(err);
}

const NUMBERS_ES = [
  "cero",
  "uno",
  "dos",
  "tres",
  "cuatro",
  "cinco",
  "seis",
  "siete",
  "ocho",
  "nueve",
  "diez",
  "once",
  "doce",
  "trece",
  "catorce",
  "quince",
  "dieciséis",
  "diecisiete",
  "dieciocho",
  "diecinueve",
  "veinte",
];

function spanishNumber(n: number): string {
  return n >= 0 && n < NUMBERS_ES.length ? NUMBERS_ES[n] : String(n);
}

/** "3 pendientes" / "un pendiente" style count phrase. */
export function countPhrase(
  n: number,
  singular: string,
  plural: string,
  gender: "m" | "f" = "f"
): string {
  if (n === 1) return `${gender === "m" ? "un" : "una"} ${singular}`;
  return `${spanishNumber(n)} ${plural}`;
}

/** Bare clause, no leading punctuation — the caller glues it on. */
export function priorityClause(n: number): string {
  if (n === 0) return "";
  if (n === 1) return "una con prioridad";
  return `${spanishNumber(n)} con prioridad`;
}

export function colophonText(activeCount: number, completedThisWeek: number): string {
  const left = countPhrase(activeCount, "activa", "activas", "f");
  const right =
    completedThisWeek === 0
      ? "ninguna completada esta semana"
      : `${countPhrase(completedThisWeek, "completada", "completadas", "f")} esta semana`;
  return `${left} — ${right}`;
}

export function formatKicker(date: Date): string {
  const weekday = date.toLocaleDateString("es-AR", { weekday: "long" });
  const day = date.getDate();
  const month = date.toLocaleDateString("es-AR", { month: "long" });
  return `${weekday} · ${day} de ${month}`;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "sáb 4 jul" style short label for a due-date badge. */
export function formatDueDate(iso: string): string {
  const date = parseIsoDate(iso);
  const weekday = date.toLocaleDateString("es-AR", { weekday: "short" }).replace(/\.$/, "");
  const month = date.toLocaleDateString("es-AR", { month: "short" }).replace(/\.$/, "");
  return `${weekday} ${date.getDate()} ${month}`;
}

export function isOverdue(iso: string): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return parseIsoDate(iso).getTime() < today.getTime();
}

/** Splits the AI summary's "neutral|||highlighted" format from api/summary.ts. */
export function splitSummary(summary: string): { lead: string; accent: string | null } {
  const idx = summary.indexOf("|||");
  if (idx === -1) return { lead: summary, accent: null };
  return { lead: summary.slice(0, idx).trim(), accent: summary.slice(idx + 3).trim() };
}
