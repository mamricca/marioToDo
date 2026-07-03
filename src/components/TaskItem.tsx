import { useState } from "react";
import type { Task } from "../types";
import { TaskText } from "./TaskText";

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newRaw: string) => void;
}

export function TaskItem({ task, onToggle, onDelete, onEdit }: TaskItemProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.raw);

  const commitEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.raw) {
      onEdit(task.id, trimmed);
    } else {
      setDraft(task.raw);
    }
    setEditing(false);
  };

  return (
    <li className={`task-item${task.done ? " done" : ""}`}>
      <input
        type="checkbox"
        checked={task.done}
        onChange={() => onToggle(task.id)}
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
