import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, KeyboardEvent, MutableRefObject } from "react";
import { tokenizeForHighlight } from "../parser";

interface CaptureInputProps {
  onSubmit: (raw: string) => void;
  placeholder?: string;
  initialValue?: string | null;
  knownProjects: string[];
  knownContexts: string[];
}

interface CurrentToken {
  start: number;
  trigger: "+" | "@";
  query: string;
}

function getCurrentToken(value: string, cursor: number): CurrentToken | null {
  let start = cursor;
  while (start > 0 && !/\s/.test(value[start - 1])) start--;
  const word = value.slice(start, cursor);
  if (word[0] === "+" || word[0] === "@") {
    return { start, trigger: word[0], query: word.slice(1) };
  }
  return null;
}

const TOKEN_CLASS: Record<string, string | undefined> = {
  priority: "tk-pri",
  project: "tk-proy",
  context: "tk-ctx",
  url: "tk-link",
  date: "tk-due",
};

export const CaptureInput = forwardRef<HTMLInputElement, CaptureInputProps>(
  function CaptureInput(
    { onSubmit, placeholder, initialValue, knownProjects, knownContexts },
    ref
  ) {
    const [value, setValue] = useState(initialValue ?? "");
    const [token, setToken] = useState<CurrentToken | null>(null);
    const [highlightIndex, setHighlightIndex] = useState(0);
    const innerRef = useRef<HTMLInputElement | null>(null);
    const backdropRef = useRef<HTMLDivElement>(null);

    const setRefs = useCallback(
      (el: HTMLInputElement | null) => {
        innerRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as MutableRefObject<HTMLInputElement | null>).current = el;
      },
      [ref]
    );

    const pool = token?.trigger === "+" ? knownProjects : knownContexts;
    const suggestions = useMemo(() => {
      if (!token) return [];
      const q = token.query.toLowerCase();
      return pool.filter((p) => p.toLowerCase().startsWith(q)).slice(0, 6);
    }, [token, pool]);

    useEffect(() => {
      setHighlightIndex(0);
    }, [suggestions.length, token?.start]);

    const updateTokenFromCursor = (el: HTMLInputElement) => {
      const cursor = el.selectionStart ?? el.value.length;
      setToken(getCurrentToken(el.value, cursor));
    };

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      setValue(e.target.value);
      updateTokenFromCursor(e.target);
    };

    const acceptSuggestion = (choice: string) => {
      if (!token || !innerRef.current) return;
      const cursor = innerRef.current.selectionStart ?? value.length;
      const before = value.slice(0, token.start);
      const after = value.slice(cursor);
      const inserted = `${token.trigger}${choice} `;
      const next = before + inserted + after;
      setValue(next);
      setToken(null);
      requestAnimationFrame(() => {
        const pos = before.length + inserted.length;
        innerRef.current?.setSelectionRange(pos, pos);
        innerRef.current?.focus();
      });
    };

    const submit = () => {
      const trimmed = value.trim();
      if (!trimmed) return;
      onSubmit(trimmed);
      setValue("");
      setToken(null);
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
      if (suggestions.length > 0) {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          setHighlightIndex((i) => (i + 1) % suggestions.length);
          return;
        }
        if (e.key === "ArrowUp") {
          e.preventDefault();
          setHighlightIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
          return;
        }
        if (e.key === "Enter" || e.key === "Tab") {
          e.preventDefault();
          acceptSuggestion(suggestions[highlightIndex]);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setToken(null);
          return;
        }
      }

      if (e.key === "Enter") {
        submit();
      } else if (e.key === "Escape") {
        setValue("");
        setToken(null);
        (e.target as HTMLInputElement).blur();
      }
    };

    const handleScroll = () => {
      if (backdropRef.current && innerRef.current) {
        backdropRef.current.scrollLeft = innerRef.current.scrollLeft;
      }
    };

    const tokens = useMemo(() => tokenizeForHighlight(value), [value]);

    return (
      <div className="capture-wrap">
        <div className="capture-shell">
          <div className="capture-backdrop" ref={backdropRef} aria-hidden="true">
            {tokens.map((t, i) => (
              <span key={i} className={TOKEN_CLASS[t.type]}>
                {t.text}
              </span>
            ))}
          </div>
          <input
            ref={setRefs}
            className="capture-input"
            type="text"
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            onKeyUp={(e) => updateTokenFromCursor(e.currentTarget)}
            onClick={(e) => updateTokenFromCursor(e.currentTarget)}
            onScroll={handleScroll}
            onBlur={() => setToken(null)}
            placeholder={
              placeholder ??
              "(A) Terminar informe +trabajo @compu el sábado https://ejemplo.com"
            }
            autoComplete="off"
            spellCheck={false}
          />
          {suggestions.length > 0 && (
            <div className="suggestions">
              {suggestions.map((s, i) => (
                <button
                  key={s}
                  type="button"
                  className={`suggestion${i === highlightIndex ? " highlighted" : ""}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    acceptSuggestion(s);
                  }}
                >
                  {token?.trigger}
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="capture-hint">
          <kbd>/</kbd> para escribir · (A) texto +proyecto @contexto https://url
          el sábado / el próximo sábado / mañana
        </p>
      </div>
    );
  }
);
