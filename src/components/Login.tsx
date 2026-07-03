import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setStatus("sending");
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="kicker">Todos</div>
        <div className="headline">
          Iniciá <span className="accent">sesión</span>
        </div>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="vos@ejemplo.com"
            autoComplete="email"
            required
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            required
          />
          <button type="submit" disabled={status === "sending"}>
            {status === "sending" ? "entrando…" : "entrar"}
          </button>
          {status === "error" && (
            <p className="login-error">Error: {errorMessage}</p>
          )}
        </form>
      </div>
    </div>
  );
}
