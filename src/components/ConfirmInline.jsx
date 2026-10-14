// Inline delete confirmation bar. We never use window.confirm anywhere.

export default function ConfirmInline({
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Keep',
  onConfirm,
  onCancel,
}) {
  return (
    <div className="confirm-inline" role="alertdialog" aria-label={message}>
      <span className="confirm-msg">{message}</span>
      <div className="confirm-actions">
        <button type="button" className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
