import { Link } from "react-router-dom";

export default function AuthCard({ title, subtitle, footerText, footerLink, children }) {
  return (
    <div className="auth-layout">
      <div className="auth-panel">
        <p className="eyebrow">Automatic Question Generation</p>
        <h1>{title}</h1>
        <p className="auth-copy">{subtitle}</p>
        {children}
        <p className="auth-footer">
          {footerText} <Link to={footerLink.href}>{footerLink.label}</Link>
        </p>
      </div>
    </div>
  );
}
