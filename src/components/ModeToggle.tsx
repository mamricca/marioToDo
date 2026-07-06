import type { Mode } from "../types";

interface ModeToggleProps {
  mode: Mode;
  onChange: (mode: Mode) => void;
}

export function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div className="mode-toggle">
      <button
        type="button"
        className={mode === "agenda" ? "active" : ""}
        onClick={() => onChange("agenda")}
      >
        Agenda
      </button>
      <button
        type="button"
        className={mode === "noticias" ? "active" : ""}
        onClick={() => onChange("noticias")}
      >
        Noticias
      </button>
    </div>
  );
}
