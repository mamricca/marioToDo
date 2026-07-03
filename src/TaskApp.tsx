import { useEffect, useMemo, useRef, useState } from "react";
import { TaskInput } from "./components/TaskInput";
import { TaskList } from "./components/TaskList";
import { FilterBar } from "./components/FilterBar";
import { parseLine } from "./parser";
import {
  fetchTasks,
  insertTask,
  updateTaskRaw,
  updateTaskDone,
  deleteTaskById,
} from "./lib/tasksApi";
import type { Task, Filter } from "./types";

interface TaskAppProps {
  userId: string;
  userEmail: string | undefined;
  onSignOut: () => void;
  initialDraft: string | null;
}

function TaskApp({ userId, userEmail, onSignOut, initialDraft }: TaskAppProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>({ type: "all", value: null });
  const [showArchived, setShowArchived] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchTasks()
      .then(setTasks)
      .catch((err) => setErrorMessage(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (initialDraft) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    // Only relevant on first mount, when a share-target draft may be pending.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement;
      const isTyping =
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable);

      if (e.key === "/" && !isTyping) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const addTask = async (raw: string) => {
    const parsed = parseLine(raw);
    try {
      const task = await insertTask(raw, parsed, userId);
      setTasks((prev) => [...prev, task]);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const toggleTask = async (id: string) => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    try {
      const updated = await updateTaskDone(id, !current.done);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const deleteTask = async (id: string) => {
    try {
      await deleteTaskById(id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const editTask = async (id: string, newRaw: string) => {
    const parsed = parseLine(newRaw);
    try {
      const updated = await updateTaskRaw(id, newRaw, parsed);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    }
  };

  const { projects, contexts } = useMemo(() => {
    const projectSet = new Set<string>();
    const contextSet = new Set<string>();
    for (const t of tasks) {
      t.projects.forEach((p) => projectSet.add(p));
      t.contexts.forEach((c) => contextSet.add(c));
    }
    return {
      projects: [...projectSet].sort(),
      contexts: [...contextSet].sort(),
    };
  }, [tasks]);

  const activeTasks = tasks.filter((t) => !t.done);
  const archivedTasks = tasks.filter((t) => t.done);

  const filteredActive = activeTasks.filter((t) => {
    if (filter.type === "project") return t.projects.includes(filter.value!);
    if (filter.type === "context") return t.contexts.includes(filter.value!);
    return true;
  });

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-top">
          <h1>Todos</h1>
          <div className="account">
            <span className="account-email">{userEmail}</span>
            <button type="button" onClick={onSignOut}>
              Salir
            </button>
          </div>
        </div>
        <TaskInput ref={inputRef} onSubmit={addTask} initialValue={initialDraft} />
        <p className="hint">
          Presioná <kbd>/</kbd> para enfocar el input · sintaxis:{" "}
          <code>(A) texto +proyecto @contexto https://url</code>
        </p>
        {errorMessage && (
          <p className="error-banner" onClick={() => setErrorMessage(null)}>
            {errorMessage}
          </p>
        )}
      </header>

      <FilterBar
        projects={projects}
        contexts={contexts}
        filter={filter}
        onChange={setFilter}
        showArchived={showArchived}
        onToggleArchived={() => setShowArchived((v) => !v)}
        archivedCount={archivedTasks.length}
      />

      <main>
        {loading ? (
          <p className="empty-message">Cargando...</p>
        ) : (
          <>
            <TaskList
              tasks={filteredActive}
              onToggle={toggleTask}
              onDelete={deleteTask}
              onEdit={editTask}
              emptyMessage="No hay tareas pendientes en esta vista."
            />

            {showArchived && (
              <section className="archived-section">
                <h2>Archivadas</h2>
                <TaskList
                  tasks={archivedTasks}
                  onToggle={toggleTask}
                  onDelete={deleteTask}
                  onEdit={editTask}
                  emptyMessage="Todavía no archivaste ninguna tarea."
                />
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default TaskApp;
