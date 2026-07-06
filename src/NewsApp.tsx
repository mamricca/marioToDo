import { useEffect, useMemo, useState } from "react";
import { NewsFilters } from "./components/NewsFilters";
import { NewsList } from "./components/NewsList";
import { ModeToggle } from "./components/ModeToggle";
import { parseLine } from "./parser";
import {
  formatKicker,
  splitSummary,
  newsFallbackHeadline,
  newsColophonText,
  isToday,
  getErrorMessage,
} from "./format";
import { fetchFeeds, fetchFeedItems, setFeedItemRead } from "./lib/feedsApi";
import { insertTask } from "./lib/tasksApi";
import { fetchNewsSummary, regenerateNewsSummary } from "./lib/newsSummaryApi";
import type { Feed, FeedItem, Mode, NewsView } from "./types";

interface NewsAppProps {
  userId: string;
  userEmail: string | undefined;
  onSignOut: () => void;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}

function NewsApp({ userId, userEmail, onSignOut, mode, onModeChange }: NewsAppProps) {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [view, setView] = useState<NewsView>("unread");
  const [feedFilter, setFeedFilter] = useState<string | null>(null);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    Promise.all([fetchFeeds(), fetchFeedItems()])
      .then(([feedRows, itemRows]) => {
        setFeeds(feedRows);
        setItems(itemRows);
      })
      .catch((err) => setErrorMessage(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchNewsSummary()
      .then((cached) => setAiSummary(cached?.summary ?? null))
      .catch(() => setAiSummary(null));
  }, []);

  const handleRegenerateSummary = async () => {
    setRegenerating(true);
    try {
      await regenerateNewsSummary();
      const [itemRows, cached] = await Promise.all([fetchFeedItems(), fetchNewsSummary()]);
      setItems(itemRows);
      setAiSummary(cached?.summary ?? null);
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    } finally {
      setRegenerating(false);
    }
  };

  const toggleRead = async (id: string) => {
    const current = items.find((i) => i.id === id);
    if (!current) return;
    const nextRead = !current.read;
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: nextRead } : i)));
    try {
      await setFeedItemRead(id, nextRead);
    } catch (err) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, read: current.read } : i)));
      setErrorMessage(getErrorMessage(err));
    }
  };

  const convertToTask = async (item: FeedItem) => {
    try {
      const raw = `${item.title} ${item.link}`;
      const parsed = parseLine(raw);
      await insertTask(raw, parsed, userId, null);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, read: true } : i)));
      await setFeedItemRead(item.id, true);
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    }
  };

  const viewItems = view === "unread" ? items.filter((i) => !i.read) : items;
  const displayedItems = feedFilter
    ? viewItems.filter((i) => i.feedId === feedFilter)
    : viewItems;

  const unreadCount = items.filter((i) => !i.read).length;
  const newTodayCount = useMemo(
    () => items.filter((i) => isToday(i.fetchedAt)).length,
    [items]
  );
  const activeFeedCount = useMemo(
    () => new Set(items.map((i) => i.feedId)).size,
    [items]
  );

  const { lead, accent, accentGlue } = aiSummary
    ? { ...splitSummary(aiSummary), accentGlue: " " }
    : { lead: newsFallbackHeadline(unreadCount), accent: null as string | null, accentGlue: ", " };

  return (
    <div className="app">
      <div className="masthead">
        <div className="masthead-row">
          <div className="kicker">
            {formatKicker(new Date())}
            <button
              type="button"
              className="regenerate-btn"
              onClick={handleRegenerateSummary}
              disabled={regenerating}
              title="Actualizar noticias"
              aria-label="Actualizar noticias"
            >
              {regenerating ? "…" : "↻"}
            </button>
          </div>
          <ModeToggle mode={mode} onChange={onModeChange} />
        </div>
        <div className="headline">
          {lead}
          {accent && (
            <span className="accent">
              {accentGlue}
              {accent}
            </span>
          )}
        </div>
      </div>

      <div className="session">
        <span>{userEmail}</span>
        <button type="button" className="btn-ghost" onClick={onSignOut}>
          Salir
        </button>
      </div>

      {errorMessage && (
        <p className="error-banner" onClick={() => setErrorMessage(null)}>
          {errorMessage}
        </p>
      )}

      <NewsFilters
        view={view}
        onViewChange={setView}
        feeds={feeds}
        viewItems={viewItems}
        feedFilter={feedFilter}
        onFeedFilterChange={setFeedFilter}
      />

      {loading ? (
        <p className="empty-message">
          <span className="spinner" /> Cargando...
        </p>
      ) : (
        <NewsList
          items={displayedItems}
          onToggleRead={toggleRead}
          onConvertToTask={convertToTask}
          emptyMessage={
            view === "unread" ? "No hay ítems sin leer." : "Todavía no se ingirió ningún feed."
          }
        />
      )}

      <div className="colophon">
        {newsColophonText(newTodayCount, activeFeedCount)}
        <span className="version"> · v{__APP_VERSION__}</span>
      </div>
    </div>
  );
}

export default NewsApp;
