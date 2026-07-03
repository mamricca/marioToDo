import { forwardRef, useState } from "react";
import type { KeyboardEvent } from "react";

interface TaskInputProps {
  onSubmit: (raw: string) => void;
  placeholder?: string;
  initialValue?: string | null;
}

export const TaskInput = forwardRef<HTMLInputElement, TaskInputProps>(
  function TaskInput({ onSubmit, placeholder, initialValue }, ref) {
    const [value, setValue] = useState(initialValue ?? "");

    const submit = () => {
      const trimmed = value.trim();
      if (!trimmed) return;
      onSubmit(trimmed);
      setValue("");
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        submit();
      } else if (e.key === "Escape") {
        setValue("");
        (e.target as HTMLInputElement).blur();
      }
    };

    return (
      <input
        ref={ref}
        className="task-input"
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={
          placeholder ?? "(A) Terminar informe +trabajo @compu https://ejemplo.com"
        }
        autoComplete="off"
        spellCheck={false}
      />
    );
  }
);
