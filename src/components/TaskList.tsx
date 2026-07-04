import type { Task } from "../types";
import { TaskRow } from "./TaskRow";

interface TaskListProps {
  tasks: Task[];
  subtasksByParent: Record<string, Task[]>;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string, newRaw: string) => void;
  emptyMessage?: string;
}

/**
 * Renders top-level tasks in the order given — sorting/filtering is the
 * caller's job (see sort.ts). Each task's sub-tasks (looked up from
 * `subtasksByParent`) render nested underneath it, regardless of the
 * current view/filter.
 */
export function TaskList({
  tasks,
  subtasksByParent,
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
          subtasks={subtasksByParent[task.id] ?? []}
          onToggle={onToggle}
          onDelete={onDelete}
          onEdit={onEdit}
        />
      ))}
    </div>
  );
}
