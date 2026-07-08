import { supabase } from "./supabaseClient";
import type { Feed, FeedItem } from "../types";

interface FeedItemRow {
  id: string;
  feed_id: string;
  title: string;
  link: string;
  published_at: string | null;
  read: boolean;
  fetched_at: string;
  feeds: { name: string } | null;
}

function rowToFeedItem(row: FeedItemRow): FeedItem {
  return {
    id: row.id,
    feedId: row.feed_id,
    feedName: row.feeds?.name ?? "",
    title: row.title,
    link: row.link,
    publishedAt: row.published_at ? new Date(row.published_at).getTime() : null,
    read: row.read,
    fetchedAt: new Date(row.fetched_at).getTime(),
  };
}

export async function fetchFeeds(): Promise<Feed[]> {
  const { data, error } = await supabase
    .from("feeds")
    .select("id, name, url, muted")
    .order("name");
  if (error) throw error;
  return data as Feed[];
}

export async function setFeedMuted(id: string, muted: boolean): Promise<void> {
  const { error } = await supabase.from("feeds").update({ muted }).eq("id", id);
  if (error) throw error;
}

export async function fetchFeedItems(): Promise<FeedItem[]> {
  const { data, error } = await supabase
    .from("feed_items")
    .select("id, feed_id, title, link, published_at, read, fetched_at, feeds(name)")
    .order("published_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data as unknown as FeedItemRow[]).map(rowToFeedItem);
}

export async function setFeedItemRead(id: string, read: boolean): Promise<void> {
  const { error } = await supabase.from("feed_items").update({ read }).eq("id", id);
  if (error) throw error;
}
