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

export function priorityClause(n: number): string {
  if (n === 0) return "";
  if (n === 1) return ", una con prioridad";
  return `, ${spanishNumber(n)} con prioridad`;
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
