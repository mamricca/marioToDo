import type { Filter, Task } from "../types";

interface FilterBarProps {
  projects: string[];
  contexts: string[];
  activeTasks: Task[];
  filter: Filter;
  onChange: (filter: Filter) => void;
  showArchived: boolean;
  onToggleArchived: () => void;
  archivedCount: number;
}

export function FilterBar({
  projects,
  contexts,
  activeTasks,
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
          Todas <span className="filter-count">{activeTasks.length}</span>
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
              +{p}{" "}
              <span className="filter-count">
                {activeTasks.filter((t) => t.projects.includes(p)).length}
              </span>
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
              @{c}{" "}
              <span className="filter-count">
                {activeTasks.filter((t) => t.contexts.includes(c)).length}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="filter-group">
        <button
          className={showArchived ? "active" : ""}
          onClick={onToggleArchived}
        >
          Archivadas <span className="filter-count">{archivedCount}</span>
        </button>
      </div>
    </nav>
  );
}
