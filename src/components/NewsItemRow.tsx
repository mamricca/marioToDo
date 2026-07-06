import type { FeedItem } from "../types";
import { formatRelativeTime } from "../format";

interface NewsItemRowProps {
  item: FeedItem;
  onToggleRead: (id: string) => void;
  onConvertToTask: (item: FeedItem) => void;
}

export function NewsItemRow({ item, onToggleRead, onConvertToTask }: NewsItemRowProps) {
  return (
    <div className={`item${item.read ? " read" : ""}`}>
      <button
        type="button"
        role="checkbox"
        aria-checked={!item.read}
        aria-label={item.read ? "Marcar como no leído" : "Marcar como leído"}
        className={`dot${item.read ? " read" : ""}`}
        onClick={() => onToggleRead(item.id)}
      />

      <div className="item-body-wrap">
        <a className="item-title" href={item.link} target="_blank" rel="noopener noreferrer">
          {item.title}
        </a>
        <div className="task-meta">
          <span className="tk-ctx">{item.feedName}</span>
          {item.publishedAt && <span>· {formatRelativeTime(item.publishedAt)}</span>}
        </div>
      </div>

      <div className="actions">
        <button type="button" onClick={() => onConvertToTask(item)}>
          → todo
        </button>
        <button type="button" onClick={() => onToggleRead(item.id)}>
          {item.read ? "no leído" : "leído"}
        </button>
      </div>
    </div>
  );
}
