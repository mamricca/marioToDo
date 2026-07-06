import type { FeedItem } from "../types";
import { NewsItemRow } from "./NewsItemRow";

interface NewsListProps {
  items: FeedItem[];
  onToggleRead: (id: string) => void;
  onConvertToTask: (item: FeedItem) => void;
  emptyMessage?: string;
}

export function NewsList({ items, onToggleRead, onConvertToTask, emptyMessage }: NewsListProps) {
  if (items.length === 0) {
    return <p className="empty-message">{emptyMessage ?? "No hay ítems."}</p>;
  }

  return (
    <div className="items">
      {items.map((item) => (
        <NewsItemRow
          key={item.id}
          item={item}
          onToggleRead={onToggleRead}
          onConvertToTask={onConvertToTask}
        />
      ))}
    </div>
  );
}
