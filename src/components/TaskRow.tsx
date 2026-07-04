import { useEffect, useRef, useState } from "react";
import type { Task } from "../types";
import { stripTags } from "../parser";
import { formatDueDate, isOverdue } from "../format";

const COMPLETE_TRANSITION_MS = 220;

interface TaskRowProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newRaw: string) => void;
}

function priorityModifier(priority: string | null): "a" | "b" | "none" {
  if (!priority) return "none";
  return priority === "A" ? "a" : "b";
}

function linkLabel(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

export function TaskRow({ task, onToggle, onDelete, onEdit }: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.raw);
  const [completing, setCompleting] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.raw) {
      onEdit(task.id, trimmed);
    } else {
      setDraft(task.raw);
    }
    setEditing(false);
  };

  const handleToggle = () => {
    if (!task.done) {
      setCompleting(true);
      timeoutRef.current = setTimeout(() => {
        onToggle(task.id);
      }, COMPLETE_TRANSITION_MS);
    } else {
      onToggle(task.id);
    }
  };

  const bodyText = stripTags(task.text) || task.text;
  const hasMeta =
    task.projects.length > 0 ||
    task.contexts.length > 0 ||
    task.urls.length > 0 ||
    Boolean(task.dueDate);
  const overdue = task.dueDate && !task.done && isOverdue(task.dueDate);

  return (
    <div
      className={`task${task.done ? " completed" : ""}${
        completing ? " completing" : ""
      }`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={task.done || completing}
        aria-label={task.done ? "Marcar como pendiente" : "Marcar como completada"}
        className={`check${task.done || completing ? " done" : ""}`}
        onClick={handleToggle}
      />

      <div className={`pri-mark ${priorityModifier(task.priority)}`}>
        {task.priority ?? "·"}
      </div>

      <div className="task-body-wrap">
        {editing ? (
          <input
            className="edit-input"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitEdit();
              if (e.key === "Escape") {
                setDraft(task.raw);
                setEditing(false);
              }
            }}
          />
        ) : (
          <div className="task-body" onDoubleClick={() => setEditing(true)}>
            {bodyText}
          </div>
        )}

        {!editing && hasMeta && (
          <div className="task-meta">
            {task.dueDate && (
              <span className={`tk-due${overdue ? " overdue" : ""}`}>
                {formatDueDate(task.dueDate)}
              </span>
            )}
            {task.projects.map((p) => (
              <span key={`p-${p}`} className="tk-proy">
                +{p}
              </span>
            ))}
            {task.contexts.map((c) => (
              <span key={`c-${c}`} className="tk-ctx">
                @{c}
              </span>
            ))}
            {task.urls.map((u) => (
              <a
                key={u}
                className="tk-link"
                href={u}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
              >
                {linkLabel(u)}
              </a>
            ))}
          </div>
        )}
      </div>

      <div className="actions">
        <button type="button" onClick={() => setEditing(true)}>
          editar
        </button>
        <button type="button" onClick={() => onDelete(task.id)}>
          borrar
        </button>
      </div>
    </div>
  );
}
