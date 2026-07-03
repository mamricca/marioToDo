import { useEffect, useRef, useState } from "react";
import type { Task } from "../types";
import { TaskText } from "./TaskText";

const COMPLETE_TRANSITION_MS = 220;

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newRaw: string) => void;
}

export function TaskItem({ task, onToggle, onDelete, onEdit }: TaskItemProps) {
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
      // Marking as done: play a brief fade-out before it moves to Archivadas.
      setCompleting(true);
      timeoutRef.current = setTimeout(() => {
        onToggle(task.id);
      }, COMPLETE_TRANSITION_MS);
    } else {
      onToggle(task.id);
    }
  };

  return (
    <li
      className={`task-item${task.done ? " done" : ""}${
        completing ? " completing" : ""
      }`}
    >
      <input
        type="checkbox"
        checked={task.done || completing}
        onChange={handleToggle}
        aria-label={task.done ? "Marcar como pendiente" : "Marcar como completada"}
      />

      {task.priority && !task.done && (
        <span className={`priority priority-${task.priority}`}>
          {task.priority}
        </span>
      )}

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
        <span className="task-text" onDoubleClick={() => setEditing(true)}>
          <TaskText text={task.text} />
        </span>
      )}

      <span className="task-actions">
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Editar"
          aria-label="Editar"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={() => onDelete(task.id)}
          title="Borrar"
          aria-label="Borrar"
        >
          ✕
        </button>
      </span>
    </li>
  );
}
