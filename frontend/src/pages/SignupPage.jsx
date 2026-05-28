import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthCard from "../components/AuthCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";

export default function SignupPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "teacher"
  });
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");

    try {
      const user = await signup(form);
      navigate(user.role === "teacher" ? "/teacher" : "/student");
    } catch (signupError) {
      setError(signupError.message);
    }
  };

  return (
    <AuthCard
      title="Create account"
      subtitle="Create a teacher or student account for the live interval question system."
      footerText="Already registered?"
      footerLink={{ href: "/login", label: "Sign in" }}
    >
      <form className="stack" onSubmit={handleSubmit}>
        <input
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
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
          minLength="8"
          required
        />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
          <option value="teacher">Teacher</option>
          <option value="student">Student</option>
        </select>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit">Sign up</button>
      </form>
    </AuthCard>
  );
}
