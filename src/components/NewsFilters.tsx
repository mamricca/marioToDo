import type { Feed, FeedItem, NewsView } from "../types";

interface NewsFiltersProps {
  view: NewsView;
  onViewChange: (view: NewsView) => void;
  feeds: Feed[];
  viewItems: FeedItem[];
  feedFilter: string | null;
  onFeedFilterChange: (feedId: string | null) => void;
  onToggleMute: (feedId: string, muted: boolean) => void;
}

export function NewsFilters({
  view,
  onViewChange,
  feeds,
  viewItems,
  feedFilter,
  onFeedFilterChange,
  onToggleMute,
}: NewsFiltersProps) {
  const toggleFeed = (feedId: string) => {
    onFeedFilterChange(feedFilter === feedId ? null : feedId);
  };

  const countFor = (feedId: string) => viewItems.filter((i) => i.feedId === feedId).length;

  return (
    <nav className="filters">
      <button
        type="button"
        className={`tab${view === "unread" ? " active" : ""}`}
        onClick={() => onViewChange("unread")}
      >
        No leídas
      </button>
      <button
        type="button"
        className={`tab${view === "all" ? " active" : ""}`}
        onClick={() => onViewChange("all")}
      >
        Todas
      </button>

      {feeds.length > 0 && <span className="filter-sep">|</span>}

      {feeds.map((feed) => (
        <span key={feed.id} className="chip-wrap">
          <button
            type="button"
            className={`chip ctx${feedFilter === feed.id ? " active" : ""}${
              feed.muted ? " muted" : ""
            }`}
            onClick={() => toggleFeed(feed.id)}
          >
            {feed.name} <span className="count">{countFor(feed.id)}</span>
          </button>
          <button
            type="button"
            className="chip-mute"
            onClick={() => onToggleMute(feed.id, !feed.muted)}
          >
            {feed.muted ? "activar" : "silenciar"}
          </button>
        </span>
      ))}
    </nav>
  );
}
