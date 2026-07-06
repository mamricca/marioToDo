import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Parser from "rss-parser";

// Self-contained on purpose, same rationale as api/summary.ts: no imports
// from ../src (import.meta.env doesn't exist in this runtime), and small
// helpers (weather, date labels) are duplicated here rather than shared
// across api/ files to avoid coupling two independently-deployed functions.

interface MinimalRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
}
interface MinimalResponse {
  status(code: number): MinimalResponse;
  json(body: unknown): void;
}

const GEMINI_MODEL = "gemini-2.5-flash-lite";

interface FeedRow {
  id: string;
  name: string;
  url: string;
}

interface FeedItemForPrompt {
  title: string;
  feedName: string;
  publishedAt: string | null;
}

const rssParser = new Parser();

/** One feed failing to fetch/parse shouldn't stop the rest from ingesting. */
async function ingestFeeds(supabase: SupabaseClient, feeds: FeedRow[]): Promise<void> {
  for (const feed of feeds) {
    try {
      const parsed = await rssParser.parseURL(feed.url);
      const rows = (parsed.items ?? [])
        .map((item) => ({
          feed_id: feed.id,
          title: (item.title ?? "(sin título)").trim(),
          link: item.link ?? item.guid ?? "",
          published_at: item.isoDate ?? item.pubDate ?? null,
        }))
        .filter((row) => row.link);
      if (rows.length === 0) continue;

      const { error } = await supabase
        .from("feed_items")
        .upsert(rows as never[], { onConflict: "feed_id,link", ignoreDuplicates: true });
      if (error) {
        console.error(`feed_items upsert failed for ${feed.name}: ${error.message}`);
      }
    } catch (err) {
      console.error(`RSS fetch failed for ${feed.name}:`, err);
    }
  }
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

// UTC's calendar date runs 3h ahead of Uruguay's after 21:00 local — see
// api/summary.ts for the incident this avoids.
function todayInMontevideo(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Montevideo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Resolves a timestamp into "hace 3h" / "ayer" / "hace 4d", never a raw date
 * the model would have to compute itself (see describeDueDate in summary.ts
 * for why that's worth avoiding). */
function describeRecency(iso: string | null, now: Date): string {
  if (!iso) return "sin fecha";
  const then = new Date(iso);
  if (isNaN(then.getTime())) return "sin fecha";
  const diffMin = Math.round((now.getTime() - then.getTime()) / 60_000);
  if (diffMin < 60) return "recién";
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `hace ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  if (diffD === 1) return "ayer";
  return `hace ${diffD}d`;
}

function buildNewsPrompt(items: FeedItemForPrompt[], weather: string | null): string {
  const now = new Date();
  const lines = items.map(
    (item) => `- ${item.title} [fuente: ${item.feedName}, ${describeRecency(item.publishedAt, now)}]`
  );
  const itemList = lines.length > 0 ? lines.join("\n") : "(sin ítems nuevos)";
  const today = todayInMontevideo();
  const weatherLine = weather ? `\nClima hoy en Montevideo: ${weather}.\n` : "";

  return `Sos la voz de un titular editorial personal: alguien que sigue estos feeds de noticias y los resume con criterio propio, no un bot que enumera. Tono directo, expresivo, con personalidad — no formulaico, no repitas siempre la misma estructura de una llamada a la otra. Hoy es ${today}.

Ítems sin leer más recientes:
${itemList}
${weatherLine}
Instrucciones:
- El resumen tiene que ser sobre las noticias mismas — 1 a 2 frases que cuenten qué hay para leer. NO agregues una segunda frase de relleno/comentario tipo "nada importante", "todo tranquilo" salvo que la lista esté genuinamente vacía.
- Parafraseá, no copies los títulos tal cual — inferí de qué se trata y contalo con tus palabras, como lo diría una persona. Priorizá lo más reciente o relevante, pero está bien mezclar dos o tres ítems relacionados en una sola idea en vez de tratarlos como una lista suelta.
- Si hay datos de clima, integralo al titular como parte del panorama del día, igual que harías con las tareas de una agenda — no es un aparte opcional, es un ingrediente más de cómo pintás el día.
- Formato de respuesta EXACTO: dos partes separadas por "|||". Se muestran una al lado de la otra con UN SOLO espacio entre ellas — nosotros no agregamos ninguna puntuación, así que la puntuación de unión (coma, punto y espacio, nada) la ponés vos al final de la primera parte o al principio de la segunda, la que use. La segunda parte es el otro dato concreto que vale la pena remarcar (se resalta en rojo). Si con una sola frase ya está completo, devolvé solo esa parte, sin "|||".
- Ejemplo: "Llovió toda la noche y hoy sigue nublado," + " " + "Anthropic anunció Claude Sonnet 5 y hay dos artículos nuevos sobre PWAs offline." → "Llovió toda la noche y hoy sigue nublado,|||Anthropic anunció Claude Sonnet 5 y hay dos artículos nuevos sobre PWAs offline."
- Si no hay ítems nuevos, algo breve y con onda tipo "Nada nuevo por ahora." o "Feeds al día."
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

const PROMPT_ITEM_LIMIT = 20;

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

    const { data: feeds, error: feedsError } = await supabase
      .from("feeds")
      .select("id, name, url");
    if (feedsError) throw new Error(feedsError.message);

    // Ingestión primero — el resumen tiene que verse los ítems recién
    // traídos, no los de la corrida anterior.
    await ingestFeeds(supabase, feeds as FeedRow[]);

    const { data: unreadRows, error: unreadError } = await supabase
      .from("feed_items")
      .select("title, published_at, feeds(name)")
      .eq("read", false)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(PROMPT_ITEM_LIMIT);
    if (unreadError) throw new Error(unreadError.message);

    const items: FeedItemForPrompt[] = (unreadRows as unknown as Array<{
      title: string;
      published_at: string | null;
      feeds: { name: string } | null;
    }>).map((row) => ({
      title: row.title,
      feedName: row.feeds?.name ?? "",
      publishedAt: row.published_at,
    }));

    const weather = await fetchWeather();
    const prompt = buildNewsPrompt(items, weather);
    const summary = await callGemini(prompt);

    const { error: upsertError } = await supabase.from("news_summary").upsert({
      user_id: userId,
      summary,
      generated_at: new Date().toISOString(),
    });
    if (upsertError) throw new Error(upsertError.message);

    res.status(200).json({ ok: true, summary });
  } catch (err) {
    // No tocamos el cache existente si algo falla — el frontend cae al
    // cálculo local si nunca hubo un resumen guardado.
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
}
