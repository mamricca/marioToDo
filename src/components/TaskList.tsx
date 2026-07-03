import type { Task } from "../types";
import { TaskRow } from "./TaskRow";

interface TaskListProps {
  tasks: Task[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newRaw: string) => void;
  emptyMessage?: string;
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.priority !== b.priority) {
      if (!a.priority) return 1;
      if (!b.priority) return -1;
      return a.priority.localeCompare(b.priority);
    }
    return a.createdAt - b.createdAt;
  });
}

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
      {sortTasks(tasks).map((task) => (
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
