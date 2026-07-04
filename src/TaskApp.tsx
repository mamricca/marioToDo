import { useEffect, useMemo, useRef, useState } from "react";
import { CaptureInput } from "./components/CaptureInput";
import { TaskList } from "./components/TaskList";
import { Filters } from "./components/Filters";
import { Toast } from "./components/Toast";
import { parseLine, stripTags } from "./parser";
import {
  colophonText,
  formatKicker,
  countPhrase,
  priorityClause,
  getErrorMessage,
} from "./format";
import { sortTasks, isLinkOnly, type SortMode } from "./sort";
import {
  fetchTasks,
  insertTask,
  updateTaskRaw,
  updateTaskDone,
  deleteTaskById,
} from "./lib/tasksApi";
import type { Task, TagFilter, View } from "./types";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const UNDO_WINDOW_MS = 5000;

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
  const [view, setView] = useState<View>("active");
  const [tagFilter, setTagFilter] = useState<TagFilter | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("priority");
  const [pendingDelete, setPendingDelete] = useState<Task[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingDeleteTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Which top-level task the next "> sub-task" line should attach to.
  const lastParentIdRef = useRef<string | null>(null);

  useEffect(() => {
    fetchTasks()
      .then(setTasks)
      .catch((err) => setErrorMessage(getErrorMessage(err)))
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

  useEffect(() => {
    return () => {
      if (pendingDeleteTimeout.current) clearTimeout(pendingDeleteTimeout.current);
    };
  }, []);

  const addTask = async (raw: string) => {
    const trimmed = raw.trim();

    // "> algo" — a sub-task of the most recently touched top-level task.
    if (trimmed.startsWith(">")) {
      const subRaw = trimmed.slice(1).trim();
      if (!subRaw) return;
      const parent = lastParentIdRef.current
        ? tasks.find(
            (t) => t.id === lastParentIdRef.current && !t.done && !t.parentId
          )
        : undefined;
      const parsed = parseLine(subRaw);
      try {
        const task = await insertTask(subRaw, parsed, userId, parent?.id ?? null);
        setTasks((prev) => [...prev, task]);
      } catch (err) {
        setErrorMessage(getErrorMessage(err));
      }
      return;
    }

    const parsed = parseLine(trimmed);
    const cleanBody = stripTags(parsed.text);
    // Typing the same top-level task text again attaches new sub-tasks to
    // the existing one instead of creating a duplicate.
    const duplicate =
      cleanBody &&
      tasks.find((t) => !t.done && !t.parentId && stripTags(t.text) === cleanBody);
    if (duplicate) {
      lastParentIdRef.current = duplicate.id;
      return;
    }

    try {
      const task = await insertTask(trimmed, parsed, userId, null);
      setTasks((prev) => [...prev, task]);
      lastParentIdRef.current = task.id;
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    }
  };

  const toggleTask = async (id: string) => {
    const current = tasks.find((t) => t.id === id);
    if (!current) return;
    try {
      const updated = await updateTaskDone(id, !current.done);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    }
  };

  const editTask = async (id: string, newRaw: string) => {
    const parsed = parseLine(newRaw);
    try {
      const updated = await updateTaskRaw(id, newRaw, parsed);
      setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    }
  };

  const finalizeDelete = async (group: Task[]) => {
    // Deleting a parent cascades to its sub-tasks in the DB — only need to
    // issue a delete for whichever tasks in the group aren't already covered
    // by another task in the same group being deleted.
    const roots = group.filter(
      (t) => !t.parentId || !group.some((g) => g.id === t.parentId)
    );
    try {
      await Promise.all(roots.map((t) => deleteTaskById(t.id)));
    } catch (err) {
      setErrorMessage(getErrorMessage(err));
    }
  };

  const deleteTask = (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const children = task.parentId ? [] : tasks.filter((t) => t.parentId === id);
    const group = [task, ...children];

    // Only one pending undo at a time — finalize any previous one right away.
    if (pendingDelete) {
      if (pendingDeleteTimeout.current) clearTimeout(pendingDeleteTimeout.current);
      finalizeDelete(pendingDelete);
    }

    const groupIds = new Set(group.map((t) => t.id));
    setTasks((prev) => prev.filter((t) => !groupIds.has(t.id)));
    setPendingDelete(group);
    pendingDeleteTimeout.current = setTimeout(() => {
      finalizeDelete(group);
      setPendingDelete(null);
    }, UNDO_WINDOW_MS);
  };

  const undoDelete = () => {
    if (!pendingDelete) return;
    if (pendingDeleteTimeout.current) clearTimeout(pendingDeleteTimeout.current);
    setTasks((prev) => [...prev, ...pendingDelete]);
    setPendingDelete(null);
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

  const subtasksByParent = useMemo(() => {
    const map: Record<string, Task[]> = {};
    for (const t of tasks) {
      if (t.parentId) {
        (map[t.parentId] ??= []).push(t);
      }
    }
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => a.createdAt - b.createdAt);
    }
    return map;
  }, [tasks]);

  const topLevel = tasks.filter((t) => !t.parentId);
  const nonArchived = topLevel.filter((t) => !t.done);
  const archivedTasks = topLevel.filter((t) => t.done);
  const linkTasks = nonArchived.filter(isLinkOnly);
  const activeTasks = nonArchived.filter((t) => !isLinkOnly(t));

  const viewTasks =
    view === "active" ? activeTasks : view === "links" ? linkTasks : archivedTasks;

  const displayedTasks = sortTasks(
    viewTasks.filter((t) => {
      if (view === "links" || !tagFilter) return true;
      return tagFilter.type === "project"
        ? t.projects.includes(tagFilter.value)
        : t.contexts.includes(tagFilter.value);
    }),
    sortMode
  );

  const priorityCount = activeTasks.filter((t) => t.priority).length;
  const completedThisWeek = archivedTasks.filter(
    (t) => t.completedAt && Date.now() - t.completedAt < WEEK_MS
  ).length;

  return (
    <div className="app">
      <div className="masthead">
        <div className="kicker">{formatKicker(new Date())}</div>
        <div className="headline">
          {countPhrase(activeTasks.length, "pendiente", "pendientes", "m")}
          {priorityCount > 0 && (
            <span className="accent">{priorityClause(priorityCount)}</span>
          )}
        </div>
      </div>

      <div className="session">
        <span>{userEmail}</span>
        <button type="button" className="btn-ghost" onClick={onSignOut}>
          Salir
        </button>
      </div>

      <CaptureInput
        ref={inputRef}
        onSubmit={addTask}
        initialValue={initialDraft}
        knownProjects={projects}
        knownContexts={contexts}
      />

      {errorMessage && (
        <p className="error-banner" onClick={() => setErrorMessage(null)}>
          {errorMessage}
        </p>
      )}

      <Filters
        view={view}
        onViewChange={setView}
        projects={projects}
        contexts={contexts}
        viewTasks={viewTasks}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        linksCount={linkTasks.length}
        sortMode={sortMode}
        onSortModeChange={setSortMode}
      />

      {loading ? (
        <p className="empty-message">
          <span className="spinner" /> Cargando...
        </p>
      ) : (
        <TaskList
          tasks={displayedTasks}
          subtasksByParent={subtasksByParent}
          onToggle={toggleTask}
          onDelete={deleteTask}
          onEdit={editTask}
          emptyMessage={
            view === "active"
              ? "No hay tareas pendientes en esta vista."
              : view === "links"
              ? "Todavía no guardaste ningún link suelto."
              : "Todavía no archivaste ninguna tarea."
          }
        />
      )}

      <div className="colophon">
        {colophonText(activeTasks.length, completedThisWeek)}
      </div>

      {pendingDelete && (
        <Toast
          message={pendingDelete.length > 1 ? "Tareas borradas" : "Tarea borrada"}
          actionLabel="deshacer"
          onAction={undoDelete}
        />
      )}
    </div>
  );
}

export default TaskApp;
