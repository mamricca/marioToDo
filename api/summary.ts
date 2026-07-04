import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import { stripTags } from "../src/parser";
import { isLinkOnly } from "../src/sort";
import type { Task } from "../src/types";

const GEMINI_MODEL = "gemini-2.5-flash-lite";

interface TaskRow {
  text: string;
  priority: string | null;
  projects: string[];
  contexts: string[];
  urls: string[];
  due_date: string | null;
  parent_id: string | null;
  done: boolean;
  created_at: string;
  completed_at: string | null;
}

function rowToTask(row: TaskRow, id: string): Task {
  return {
    id,
    raw: row.text,
    text: row.text,
    priority: row.priority,
    projects: row.projects,
    contexts: row.contexts,
    urls: row.urls,
    dueDate: row.due_date,
    parentId: row.parent_id,
    done: row.done,
    createdAt: new Date(row.created_at).getTime(),
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
  };
}

function buildPrompt(tasks: Task[]): string {
  const lines = tasks.map((t) => {
    const bits: string[] = [];
    if (t.priority) bits.push(`(${t.priority})`);
    bits.push(stripTags(t.text) || t.text);
    if (t.projects.length) bits.push(`[proyecto: ${t.projects.join(", ")}]`);
    if (t.contexts.length) bits.push(`[contexto: ${t.contexts.join(", ")}]`);
    if (t.dueDate) bits.push(`[vence: ${t.dueDate}]`);
    return `- ${bits.join(" ")}`;
  });

  const taskList = lines.length > 0 ? lines.join("\n") : "(sin tareas activas)";
  const today = new Date().toISOString().slice(0, 10);

  return `Sos un asistente que resume una lista de tareas pendientes en español, en tono directo y editorial, sin relleno. Hoy es ${today}.

Tareas activas:
${taskList}

Instrucciones:
- Resumen de 1 a 2 frases, priorizando lo vencido y las tareas de prioridad (A).
- Formato de respuesta EXACTO: dos partes separadas por "|||". La primera parte es neutra (ej. cantidad de pendientes). La segunda parte es la frase que más urge remarcar (se resalta en rojo en la interfaz). Si no hay nada urgente que remarcar, devolvé solo la primera parte sin "|||".
- Ejemplos de tono y formato: "Tres pendientes|||una vencida desde ayer" — "Nada urgente, pero +trabajo se está acumulando" — "Todo al día"
- Si no hay tareas activas, devolvé algo breve tipo "Todo al día".
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
      generationConfig: { temperature: 0.7, maxOutputTokens: 80 },
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    res.status(500).json({ ok: false, error: "Faltan variables de Supabase en el server" });
    return;
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const authHeader = req.headers.authorization ?? "";
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

  try {
    // App de un solo usuario: tomamos el único usuario registrado.
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();
    if (usersError || !users.users[0]) {
      throw new Error(usersError?.message ?? "No se encontró ningún usuario");
    }
    const userId = users.users[0].id;

    const { data: rows, error: tasksError } = await supabase
      .from("tasks")
      .select("id, text, priority, projects, contexts, urls, due_date, parent_id, done, created_at, completed_at")
      .eq("user_id", userId)
      .eq("done", false)
      .is("parent_id", null);
    if (tasksError) throw new Error(tasksError.message);

    const tasks = (rows as (TaskRow & { id: string })[])
      .map((row) => rowToTask(row, row.id))
      .filter((t) => !isLinkOnly(t));

    const prompt = buildPrompt(tasks);
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
