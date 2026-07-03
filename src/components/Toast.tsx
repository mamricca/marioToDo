interface ToastProps {
  message: string;
  actionLabel: string;
  onAction: () => void;
}

export function Toast({ message, actionLabel, onAction }: ToastProps) {
  return (
    <div className="toast">
      <span>{message}</span>
      <button type="button" className="btn-ghost" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}
