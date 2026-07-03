import { supabase } from "./supabaseClient";
import type { ParsedLine } from "../parser";
import type { Task } from "../types";

interface TaskRow {
  id: string;
  raw: string;
  text: string;
  priority: string | null;
  projects: string[];
  contexts: string[];
  urls: string[];
  done: boolean;
  created_at: string;
  completed_at: string | null;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    raw: row.raw,
    text: row.text,
    priority: row.priority,
    projects: row.projects,
    contexts: row.contexts,
    urls: row.urls,
    done: row.done,
    createdAt: new Date(row.created_at).getTime(),
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
  };
}

export async function fetchTasks(): Promise<Task[]> {
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as TaskRow[]).map(rowToTask);
}

export async function insertTask(
  raw: string,
  parsed: ParsedLine,
  userId: string
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: userId,
      raw,
      text: parsed.text,
      priority: parsed.priority,
      projects: parsed.projects,
      contexts: parsed.contexts,
      urls: parsed.urls,
    })
    .select()
    .single();
  if (error) throw error;
  return rowToTask(data as TaskRow);
}

export async function updateTaskRaw(
  id: string,
  raw: string,
  parsed: ParsedLine
): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update({
      raw,
      text: parsed.text,
      priority: parsed.priority,
      projects: parsed.projects,
      contexts: parsed.contexts,
      urls: parsed.urls,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToTask(data as TaskRow);
}

export async function updateTaskDone(id: string, done: boolean): Promise<Task> {
  const { data, error } = await supabase
    .from("tasks")
    .update({ done, completed_at: done ? new Date().toISOString() : null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return rowToTask(data as TaskRow);
}

export async function deleteTaskById(id: string): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}
