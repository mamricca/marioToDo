import type { Task, TagFilter, View } from "../types";
import type { SortMode } from "../sort";

interface FiltersProps {
  view: View;
  onViewChange: (view: View) => void;
  projects: string[];
  contexts: string[];
  viewTasks: Task[];
  tagFilter: TagFilter | null;
  onTagFilterChange: (filter: TagFilter | null) => void;
  linksCount: number;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
}

export function Filters({
  view,
  onViewChange,
  projects,
  contexts,
  viewTasks,
  tagFilter,
  onTagFilterChange,
  linksCount,
  sortMode,
  onSortModeChange,
}: FiltersProps) {
  const toggleTag = (type: TagFilter["type"], value: string) => {
    if (tagFilter?.type === type && tagFilter.value === value) {
      onTagFilterChange(null);
    } else {
      onTagFilterChange({ type, value });
    }
  };

  const countFor = (type: TagFilter["type"], value: string) =>
    viewTasks.filter((t) =>
      type === "project" ? t.projects.includes(value) : t.contexts.includes(value)
    ).length;

  const isTagActive = (type: TagFilter["type"], value: string) =>
    tagFilter?.type === type && tagFilter.value === value;

  const showChips = view !== "links" && (projects.length > 0 || contexts.length > 0);

  return (
    <>
      <nav className="filters">
        <button
          type="button"
          className={`tab${view === "active" ? " active" : ""}`}
          onClick={() => onViewChange("active")}
        >
          Activas
        </button>
        <button
          type="button"
          className={`tab${view === "links" ? " active" : ""}`}
          onClick={() => onViewChange("links")}
        >
          Links <span className="count">{linksCount}</span>
        </button>
        <button
          type="button"
          className={`tab${view === "archived" ? " active" : ""}`}
          onClick={() => onViewChange("archived")}
        >
          Archivadas
        </button>

        {showChips && <span className="filter-sep">|</span>}

        {view !== "links" &&
          projects.map((p) => (
            <button
              key={`p-${p}`}
              type="button"
              className={`chip proy${isTagActive("project", p) ? " active" : ""}`}
              onClick={() => toggleTag("project", p)}
            >
              +{p} <span className="count">{countFor("project", p)}</span>
            </button>
          ))}

        {view !== "links" &&
          contexts.map((c) => (
            <button
              key={`c-${c}`}
              type="button"
              className={`chip ctx${isTagActive("context", c) ? " active" : ""}`}
              onClick={() => toggleTag("context", c)}
            >
              @{c} <span className="count">{countFor("context", c)}</span>
            </button>
          ))}
      </nav>

      <div className="sort-bar">
        <span className="sort-label">ordenar</span>
        <button
          type="button"
          className={`sort-btn${sortMode === "priority" ? " active" : ""}`}
          onClick={() => onSortModeChange("priority")}
        >
          prioridad
        </button>
        <button
          type="button"
          className={`sort-btn${sortMode === "date" ? " active" : ""}`}
          onClick={() => onSortModeChange("date")}
        >
          fecha
        </button>
      </div>
    </>
  );
}
