import { supabase } from "./supabaseClient";

export interface NewsSummary {
  summary: string;
  generatedAt: number;
}

export async function fetchNewsSummary(): Promise<NewsSummary | null> {
  const { data, error } = await supabase
    .from("news_summary")
    .select("summary, generated_at")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { summary: data.summary, generatedAt: new Date(data.generated_at).getTime() };
}

async function postNews(path: string): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("No hay sesión activa");

  const res = await fetch(path, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? "No se pudieron actualizar las noticias");
  }
}

/** Calls the serverless function to re-ingest feeds and regenerate the
 * summary right now (same pipeline the daily cron runs) — costs a Gemini
 * call, use sparingly. */
export async function regenerateNewsSummary(): Promise<void> {
  await postNews("/api/news");
}

/** Re-ingests feeds only, skipping the Gemini summary call entirely — the
 * cheap refresh for "just show me new items". */
export async function refreshFeeds(): Promise<void> {
  await postNews("/api/news?summary=0");
}
