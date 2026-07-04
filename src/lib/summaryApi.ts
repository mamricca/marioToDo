import { supabase } from "./supabaseClient";

export interface DailySummary {
  summary: string;
  generatedAt: number;
}

export async function fetchDailySummary(): Promise<DailySummary | null> {
  const { data, error } = await supabase
    .from("daily_summary")
    .select("summary, generated_at")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { summary: data.summary, generatedAt: new Date(data.generated_at).getTime() };
}

/** Calls the serverless function to regenerate the summary right now. */
export async function regenerateDailySummary(): Promise<void> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error("No hay sesión activa");

  const res = await fetch("/api/summary", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const json = await res.json();
  if (!res.ok || !json.ok) {
    throw new Error(json.error ?? "No se pudo regenerar el resumen");
  }
}
