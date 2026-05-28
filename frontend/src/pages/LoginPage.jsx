import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthCard from "../components/AuthCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", role: "teacher" });
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const user = await login(form);
      if (user.role !== form.role) {
        setError(`This account is registered as ${user.role}. Please choose ${user.role} to sign in.`);
        return;
      }
      navigate(user.role === "teacher" ? "/teacher" : "/student");
    } catch (loginError) {
      setError(loginError.message);
    }
  };

  return (
    <AuthCard
      title="Sign in"
      subtitle="Sign in as a teacher to run live sessions or as a student to answer interval MCQs."
      footerText="Need an account?"
      footerLink={{ href: "/signup", label: "Create one" }}
    >
      <form className="stack" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required
        />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </select>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit">Login</button>
      </form>
      <p className="muted center-text">
        Demo flow available after signup. <Link to="/signup">Start here</Link>.
      </p>
    </AuthCard>
  );
}
