export default function ToastStack({ toasts = [] }) {
  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-card ${toast.kind === "error" ? "toast-error" : ""}`}>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
