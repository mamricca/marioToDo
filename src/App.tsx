import { useState } from "react";
import "./App.css";
import { useAuth } from "./hooks/useAuth";
import { supabase } from "./lib/supabaseClient";
import { Login } from "./components/Login";
import TaskApp from "./TaskApp";
import { consumeShareTarget } from "./shareTarget";

function App() {
  const { session, loading } = useAuth();
  const [initialDraft] = useState(() => consumeShareTarget());

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

  return (
    <TaskApp
      userId={session.user.id}
      userEmail={session.user.email}
      onSignOut={() => supabase.auth.signOut()}
      initialDraft={initialDraft}
    />
  );
}

export default App;
