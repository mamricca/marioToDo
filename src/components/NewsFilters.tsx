import type { Feed, FeedItem, NewsView } from "../types";

interface NewsFiltersProps {
  view: NewsView;
  onViewChange: (view: NewsView) => void;
  feeds: Feed[];
  viewItems: FeedItem[];
  feedFilter: string | null;
  onFeedFilterChange: (feedId: string | null) => void;
}

export function NewsFilters({
  view,
  onViewChange,
  feeds,
  viewItems,
  feedFilter,
  onFeedFilterChange,
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
        <button
          key={feed.id}
          type="button"
          className={`chip ctx${feedFilter === feed.id ? " active" : ""}`}
          onClick={() => toggleFeed(feed.id)}
        >
          {feed.name} <span className="count">{countFor(feed.id)}</span>
        </button>
      ))}
    </nav>
  );
}
