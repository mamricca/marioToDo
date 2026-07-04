import { createClient } from "@supabase/supabase-js";

// Self-contained on purpose: no imports from ../src. This function runs in
// Vercel's Node runtime, not Vite's — relative imports crossing into src/
// (which is built/resolved by Vite for the browser bundle) were causing
// FUNCTION_INVOCATION_FAILED at cold start. Duplicating this handful of
// small pure helpers is cheaper than debugging cross-directory module
// resolution across two different build pipelines.

// Minimal local request/response types instead of depending on
// @vercel/node at runtime (it's a devDependency).
interface MinimalRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface MinimalResponse {
  status(code: number): MinimalResponse;
  json(body: unknown): void;
}

const GEMINI_MODEL = "gemini-2.5-flash-lite";

const URL_RE = /https?:\/\/[^\s]+/g;
const PROJECT_RE = /\+(\S+)/g;
const CONTEXT_RE = /@(\S+)/g;

interface SummaryTask {
  priority: string | null;
  text: string;
  projects: string[];
  contexts: string[];
  urls: string[];
  dueDate: string | null;
}

interface TaskRow {
  text: string;
  priority: string | null;
  projects: string[];
  contexts: string[];
  urls: string[];
  due_date: string | null;
}

function rowToSummaryTask(row: TaskRow): SummaryTask {
  return {
    priority: row.priority,
    text: row.text,
    projects: row.projects,
    contexts: row.contexts,
    urls: row.urls,
    dueDate: row.due_date,
  };
}

/** Same idea as parser.stripTags — URLs never reach the prompt. */
function cleanBody(text: string): string {
  return text
    .replace(URL_RE, "")
    .replace(PROJECT_RE, "")
    .replace(CONTEXT_RE, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Same rule as sort.isLinkOnly — saved links don't count as "pending work". */
function isLinkOnly(t: SummaryTask): boolean {
  return !t.priority && t.projects.length === 0 && t.contexts.length === 0 && t.urls.length > 0;
}

// Montevideo, Uruguay. Open-Meteo is free and needs no API key/signup.
const WEATHER_LAT = -34.9011;
const WEATHER_LON = -56.1645;

const WEATHER_CODES: Record<number, string> = {
  0: "despejado",
  1: "mayormente despejado",
  2: "parcialmente nublado",
  3: "nublado",
  45: "con niebla",
  48: "con niebla escarchada",
  51: "con llovizna leve",
  53: "con llovizna",
  55: "con llovizna intensa",
  56: "con llovizna helada",
  57: "con llovizna helada intensa",
  61: "con lluvia leve",
  63: "con lluvia",
  65: "con lluvia intensa",
  66: "con lluvia helada",
  67: "con lluvia helada intensa",
  71: "con nevadas leves",
  73: "con nevadas",
  75: "con nevadas intensas",
  77: "con nieve granulada",
  80: "con chaparrones leves",
  81: "con chaparrones",
  82: "con chaparrones intensos",
  85: "con chaparrones de nieve leves",
  86: "con chaparrones de nieve intensos",
  95: "con tormenta",
  96: "con tormenta y granizo leve",
  99: "con tormenta y granizo intenso",
};

/** Best-effort — returns null on any failure, prompt just skips weather. */
async function fetchWeather(): Promise<string | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max` +
      `&timezone=America%2FMontevideo&forecast_days=1`;
    const res = await fetch(url);
    if (!res.ok) return null;

    const json = await res.json();
    const daily = json?.daily;
    if (!daily) return null;

    const code = daily.weathercode?.[0];
    const tmax = daily.temperature_2m_max?.[0];
    const tmin = daily.temperature_2m_min?.[0];
    const rainChance = daily.precipitation_probability_max?.[0];
    const wind = daily.windspeed_10m_max?.[0];

    const bits: string[] = [];
    if (typeof tmin === "number" && typeof tmax === "number") {
      bits.push(`${Math.round(tmin)}°C a ${Math.round(tmax)}°C`);
    }
    if (typeof code === "number" && WEATHER_CODES[code]) bits.push(WEATHER_CODES[code]);
    if (typeof rainChance === "number" && rainChance >= 30) {
      bits.push(`${Math.round(rainChance)}% de probabilidad de lluvia`);
    }
    if (typeof wind === "number" && wind >= 30) {
      bits.push(`viento fuerte (${Math.round(wind)} km/h)`);
    }

    return bits.length > 0 ? bits.join(", ") : null;
  } catch {
    return null;
  }
}

function buildPrompt(tasks: SummaryTask[], weather: string | null): string {
  const lines = tasks.map((t) => {
    const bits: string[] = [];
    if (t.priority) bits.push(`(${t.priority})`);
    bits.push(cleanBody(t.text) || t.text);
    if (t.projects.length) bits.push(`[proyecto: ${t.projects.join(", ")}]`);
    if (t.contexts.length) bits.push(`[contexto: ${t.contexts.join(", ")}]`);
    if (t.dueDate) bits.push(`[fecha: ${t.dueDate}]`);
    return `- ${bits.join(" ")}`;
  });

  const taskList = lines.length > 0 ? lines.join("\n") : "(sin tareas activas)";
  const today = new Date().toISOString().slice(0, 10);
  const weatherLine = weather ? `\nClima hoy en Montevideo: ${weather}.\n` : "";

  return `Sos la voz de un titular editorial personal: alguien que conoce bien esta lista de tareas y la resume con criterio propio, no un bot que enumera. Tono directo, expresivo, con personalidad — no formulaico, no repitas siempre la misma estructura de una llamada a la otra. Hoy es ${today}.

Tareas activas:
${taskList}
${weatherLine}
Instrucciones:
- El resumen tiene que ser sobre las tareas mismas — 1 a 2 frases que cuenten qué hay para hacer. NO agregues una segunda frase de relleno/comentario tipo "todo tranquilo", "nada para preocuparse", "todo en marcha" salvo que la lista esté genuinamente vacía. Si ya contaste las tareas relevantes, ahí termina — no le sumes una coda tranquilizadora sin información nueva.
- Parafraseá, no copies el texto de la tarea tal cual — inferí de qué se trata y contalo con tus palabras, como lo diría una persona, no como una transcripción. Ejemplo: una tarea que dice literalmente "levantar las recetas de medicamentos" se puede contar como "pasar por la farmacia" o "buscar los remedios" — no repitas "recetas de medicamentos" textual.
- Priorizá lo vencido y las tareas de prioridad (A), pero no te limites a eso: sumá panorama general cuando aporte (un proyecto que se acumula, dos o tres tareas relacionadas contadas como una sola idea). Mezclá y conectá tareas distintas si tiene sentido, no las trates como ítems sueltos de una lista.
- Cada tarea con [fecha: ...] puede ser un plazo (algo que hay que hacer para esa fecha) o un evento que simplemente ocurre ese día — juzgá por el texto cuál es cuál. Para plazos usá "vence"/"hay que"; para eventos usá "es"/"sucede", con una construcción natural (no siempre "mañana la despedida de X" — variá: "X se despide mañana", "mañana es la despedida de X", etc.). Nunca digas que un evento "vence".
- Si hay datos de clima, integralo al titular como parte del panorama del día — no es opcional ni un aparte, es un ingrediente más de cómo pintás el día (ej. arrancar con "Día frío y ventoso" o similar antes de entrar en las tareas). Si además calza con una tarea puntual (algo afuera, algo que requiera abrigo), mejor, pero incluso si no calza con ninguna tarea igual merece su lugar en la frase — es contexto del día, no un dato descartable.
- Formato de respuesta EXACTO: dos partes separadas por "|||". Se muestran una al lado de la otra con UN SOLO espacio entre ellas — nosotros no agregamos ninguna puntuación, así que la puntuación de unión (coma, punto y espacio, nada) la ponés vos al final de la primera parte o al principio de la segunda, la que use. La segunda parte es otro dato concreto (de las tareas o del clima) que vale la pena remarcar (se resalta en rojo). Si con una sola frase ya está completo, devolvé solo esa parte, sin "|||" — no inventes una segunda parte solo por rellenar.
- Ejemplos (fijate que la puntuación de unión ya viene incluida en el texto, para que la concatenación con un espacio quede natural, y que la segunda parte siempre es información, nunca una muletilla):
  - "Día frío y con lluvia," + " " + "tres pendientes y una vencida desde ayer." → "Día frío y con lluvia,|||tres pendientes y una vencida desde ayer."
  - "Dos cosas para mañana:" + " " + "la despedida de Lelo y pasar por la farmacia." → "Dos cosas para mañana:|||la despedida de Lelo y pasar por la farmacia."
  - Una sola tarea, alcanza con una frase: "Ventoso hoy — solo tenés que pasar por la farmacia." (sin "|||")
- Si no hay tareas activas, algo breve y con onda tipo "Todo al día." o "Lista vacía, disfrutalo."
- Devolvé SOLO el texto del resumen. Sin comillas, sin explicaciones, sin markdown.`;
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Falta GEMINI_API_KEY");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.85, maxOutputTokens: 120 },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
  }

  const json = await res.json();
  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text || !text.trim()) throw new Error("Respuesta vacía de Gemini");
  return text.trim();
}

export default async function handler(req: MinimalRequest, res: MinimalResponse) {
  try {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      res.status(500).json({ ok: false, error: "Faltan variables de Supabase en el server" });
      return;
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const authHeaderRaw = req.headers.authorization;
    const authHeader = Array.isArray(authHeaderRaw) ? authHeaderRaw[0] : authHeaderRaw ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "");

    if (req.method === "GET") {
      if (!process.env.CRON_SECRET || token !== process.env.CRON_SECRET) {
        res.status(401).json({ ok: false, error: "No autorizado" });
        return;
      }
    } else if (req.method === "POST") {
      const { data: userData, error: userError } = await supabase.auth.getUser(token);
      if (userError || !userData.user) {
        res.status(401).json({ ok: false, error: "No autorizado" });
        return;
      }
    } else {
      res.status(405).json({ ok: false, error: "Método no permitido" });
      return;
    }

    // App de un solo usuario: tomamos el único usuario registrado.
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError || !users.users[0]) {
      throw new Error(usersError?.message ?? "No se encontró ningún usuario");
    }
    const userId = users.users[0].id;

    const { data: rows, error: tasksError } = await supabase
      .from("tasks")
      .select("text, priority, projects, contexts, urls, due_date, parent_id, done")
      .eq("user_id", userId)
      .eq("done", false)
      .is("parent_id", null);
    if (tasksError) throw new Error(tasksError.message);

    const tasks = (rows as TaskRow[]).map(rowToSummaryTask).filter((t) => !isLinkOnly(t));
    const weather = await fetchWeather();

    const prompt = buildPrompt(tasks, weather);
    const summary = await callGemini(prompt);

    const { error: upsertError } = await supabase.from("daily_summary").upsert({
      user_id: userId,
      summary,
      generated_at: new Date().toISOString(),
    });
    if (upsertError) throw new Error(upsertError.message);

    res.status(200).json({ ok: true, summary });
  } catch (err) {
    // No tocamos el cache existente si algo falla — el frontend cae al
    // titular calculado localmente si nunca hubo un resumen guardado.
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
}
