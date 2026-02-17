import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Login.css";

export default function Login() {
  const { login, authLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    const { ok, message } = await login(form);
    if (!ok) return setError(message);
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="login-wrapper">
      <div className="login-card">
        <h2 className="login-title">Haemil ERP</h2>
        <form className="login-form" onSubmit={onSubmit}>
          <input className="login-input" name="username" value={form.username} onChange={onChange} placeholder="ID" />
          <input className="login-input" type="password" name="password" value={form.password} onChange={onChange} placeholder="Password" />
          {error && <div style={{ color: "#ef4444", fontSize: "var(--fs-13)" }}>{error}</div>}
          <button className="login-button" type="submit" disabled={authLoading}>
            {authLoading ? "로그인 중..." : "로그인"}
          </button>
        </form>
        <p className="login-footer">© 2026 Haemil Co., Ltd.</p>
      </div>
    </div>
  );
}
