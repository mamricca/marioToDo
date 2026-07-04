import type { Task } from "../types";
import { TaskRow } from "./TaskRow";

interface TaskListProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newRaw: string) => void;
  emptyMessage?: string;
}

/** Renders tasks in the order given — sorting is the caller's job (see sort.ts). */
export function TaskList({
  tasks,
  onToggle,
  onDelete,
  onEdit,
  emptyMessage,
}: TaskListProps) {
  if (tasks.length === 0) {
    return <p className="empty-message">{emptyMessage ?? "No hay tareas."}</p>;
  }

  return (
    <div className="tasks">
      {tasks.map((task) => (
        <TaskRow
          key={task.id}
          task={task}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
