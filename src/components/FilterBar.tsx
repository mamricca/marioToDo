import type { Filter } from "../types";

interface FilterBarProps {
  projects: string[];
  contexts: string[];
  filter: Filter;
  onChange: (filter: Filter) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  archivedCount: number;
}

export function FilterBar({
  projects,
  contexts,
  filter,
  onChange,
  showArchived,
  onToggleArchived,
  archivedCount,
}: FilterBarProps) {
  const isActive = (type: Filter["type"], value: string | null) =>
    filter.type === type && filter.value === value;

  return (
    <nav className="filter-bar">
      <div className="filter-group">
        <button
          className={isActive("all", null) ? "active" : ""}
          onClick={() => onChange({ type: "all", value: null })}
        >
          Todas
        </button>
      </div>

      {projects.length > 0 && (
        <div className="filter-group">
          <span className="filter-group-label">Categorías</span>
          {projects.map((p) => (
            <button
              key={p}
              className={isActive("project", p) ? "active" : ""}
              onClick={() => onChange({ type: "project", value: p })}
            >
              +{p}
            </button>
          ))}
        </div>
      )}

      {contexts.length > 0 && (
        <div className="filter-group">
          <span className="filter-group-label">Contextos</span>
          {contexts.map((c) => (
            <button
              key={c}
              className={isActive("context", c) ? "active" : ""}
              onClick={() => onChange({ type: "context", value: c })}
            >
              @{c}
            </button>
          ))}
        </div>
      )}

      <div className="filter-group">
        <button
          className={showArchived ? "active" : ""}
          onClick={onToggleArchived}
        >
          Archivadas ({archivedCount})
        </button>
      </div>
    </nav>
  );
}
