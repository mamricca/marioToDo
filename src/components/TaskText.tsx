const TOKEN_RE = /(https?:\/\/[^\s]+)|(\+\S+)|(@\S+)/g;

/** Renders task text with URLs as clickable links and +proj/@ctx tags highlighted. */
export function TaskText({ text }: { text: string }) {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const [full, url, project, context] = match;
    if (url) {
      parts.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="tag tag-url"
          onClick={(e) => e.stopPropagation()}
        >
          {url}
        </a>
      );
    } else if (project) {
      parts.push(
        <span key={key++} className="tag tag-project">
          {project}
        </span>
      );
    } else if (context) {
      parts.push(
        <span key={key++} className="tag tag-context">
          {context}
        </span>
      );
    }
    lastIndex = match.index + full.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return <>{parts}</>;
}
