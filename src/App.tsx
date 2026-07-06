import { useEffect, useState } from "react";
import "./App.css";
import { useAuth } from "./hooks/useAuth";
import { supabase } from "./lib/supabaseClient";
import { Login } from "./components/Login";
import TaskApp from "./TaskApp";
import NewsApp from "./NewsApp";
import { consumeShareTarget } from "./shareTarget";
import type { Mode } from "./types";

const MODE_KEY = "todos:mode";

function loadMode(): Mode {
  return localStorage.getItem(MODE_KEY) === "noticias" ? "noticias" : "agenda";
}

function App() {
  const { session, loading } = useAuth();
  const [initialDraft] = useState(() => consumeShareTarget());
  const [mode, setMode] = useState<Mode>(loadMode);

  useEffect(() => {
    localStorage.setItem(MODE_KEY, mode);
  }, [mode]);

  if (loading) {
    return (
      <div className="app-loading">
        <span className="spinner" />
        Cargando...
      </div>
    );
  }

  if (!session) {
    return <Login />;
  }

  return mode === "agenda" ? (
    <TaskApp
      userId={session.user.id}
      userEmail={session.user.email}
      onSignOut={() => supabase.auth.signOut()}
      initialDraft={initialDraft}
      mode={mode}
      onModeChange={setMode}
    />
  ) : (
    <NewsApp
      userId={session.user.id}
      userEmail={session.user.email}
      onSignOut={() => supabase.auth.signOut()}
      mode={mode}
      onModeChange={setMode}
    />
  );
}

export default App;
