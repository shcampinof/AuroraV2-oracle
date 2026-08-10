import { useEffect } from 'react';

export default function Toast({
  open,
  message,
  onClose,
  durationMs = 2500,
  placement = 'bottom-right', // 'bottom-right' | 'center'
  emphasis = false,
}) {
  useEffect(() => {
    if (!open) return undefined;
    if (!durationMs) return undefined;

    const t = window.setTimeout(() => {
      if (typeof onClose === 'function') onClose();
    }, durationMs);

    return () => window.clearTimeout(t);
  }, [open, durationMs, onClose]);

  if (!open) return null;

  const wrapClassName = [
    'toast-wrap',
    placement === 'center' ? 'toast-wrap--center' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const toastClassName = ['toast', emphasis ? 'toast--emphasis' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={wrapClassName} role="status" aria-live="polite">
      <div className={toastClassName}>
        <div className="toast-icon" aria-hidden="true">
          &#10003;
        </div>
        <div className="toast-body">
          <div className="toast-title">{message || ''}</div>
        </div>
        <button className="toast-close" type="button" onClick={onClose} aria-label="Cerrar">
          &times;
        </button>
      </div>
    </div>
  );
}
