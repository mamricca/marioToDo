import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";

export function Login() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) {
      setStatus("error");
      setErrorMessage(error.message);
    } else {
      setStatus("sent");
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>Todos</h1>
        <p className="login-hint">Ingresá tu email para recibir un link de acceso.</p>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="vos@ejemplo.com"
          autoComplete="email"
          required
        />
        <button type="submit" disabled={status === "sending"}>
          {status === "sending" ? "Enviando..." : "Enviar link mágico"}
        </button>
        {status === "sent" && (
          <p className="login-success">
            Revisá tu email y hacé click en el link para entrar.
          </p>
        )}
        {status === "error" && (
          <p className="login-error">Error: {errorMessage}</p>
        )}
      </form>
    </div>
  );
}
