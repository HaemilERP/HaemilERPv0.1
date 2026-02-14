import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { signupUser } from "../../services/userApi";

export default function AddEmployee() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: "", password: "", role: "MANAGER" });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ✅ /me 확인 중에는 권한판정 보류
  if (authLoading) {
    return (
      <div className="page-card">
        <h2>로딩중...</h2>
        <p style={{ color: "#64748b" }}>권한 정보를 확인하고 있습니다.</p>
      </div>
    );
  }

  // ✅ isAdmin이 누락되는 상황까지 방어 (role fallback)
  const isAdmin = user?.isAdmin === true || user?.role === "ADMIN";

  if (!isAdmin) {
    return (
      <div className="page-card">
        <h2>권한 없음</h2>
        <p style={{ color: "#64748b" }}>직원 등록은 관리자만 가능합니다.</p>
      </div>
    );
  }

  const onChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await signupUser(form);
      navigate("/hr/employees");
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.response?.data?.message ||
          err?.message ||
          "등록 실패"
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-card">
      <h2 style={{ margin: 0 }}>직원 등록</h2>

      <form
        onSubmit={onSubmit}
        style={{ marginTop: 14, display: "grid", gap: 12, maxWidth: 420 }}
      >
        <div style={{ display: "grid", gap: 6 }}>
          <label>ID</label>
          <input name="username" value={form.username} onChange={onChange} />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Password</label>
          <input
            type="password"
            name="password"
            value={form.password}
            onChange={onChange}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Role</label>
          <select name="role" value={form.role} onChange={onChange}>
            <option value="MANAGER">MANAGER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
        </div>

        {error && <div style={{ color: "#ef4444", fontSize: 13 }}>{error}</div>}

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "none",
            background: "#009781",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          {submitting ? "Saving..." : "저장"}
        </button>
      </form>
    </div>
  );
}
