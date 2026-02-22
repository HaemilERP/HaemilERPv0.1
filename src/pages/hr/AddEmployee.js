import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { signupUser } from "../../services/userApi";

import { getApiErrorMessage, getApiFieldErrors } from "../../utils/apiError";

export default function AddEmployee() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ username: "", password: "", role: "MANAGER" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorMessage, setErrorMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const isAdmin = useMemo(
    () => user?.isAdmin === true || user?.role === "ADMIN",
    [user]
  );

  // ✅ /me 확인 중에는 권한판정 보류
  if (authLoading) {
    return (
      <div className="page-card">
        <h2>로딩중...</h2>
        <p style={{ color: "#64748b" }}>권한 정보를 확인하고 있습니다.</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="page-card">
        <h2>권한 없음</h2>
        <p style={{ color: "#64748b" }}>직원 등록은 관리자만 가능합니다.</p>
      </div>
    );
  }

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
    // 입력 수정하면 해당 필드 에러 지우기
    setFieldErrors((p) => ({ ...p, [name]: "" }));
    setErrorMessage("");
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMessage("");
    setFieldErrors({});

    // 프론트에서 1차 검증 (서버 400 줄이기)
    if (!form.username?.trim()) {
      setFieldErrors({ username: "ID(Username)을 입력해 주세요." });
      setSubmitting(false);
      return;
    }
    if (!form.password || form.password.length < 8) {
      setFieldErrors({ password: "비밀번호는 최소 8자 이상이어야 합니다." });
      setSubmitting(false);
      return;
    }

    try {
      await signupUser(form);
      navigate("/hr/employees");
    } catch (err) {

      const fields = getApiFieldErrors(err);
      setFieldErrors(fields);

      // ✅ form-level(detail/non_field_errors 등) 메시지만 따로 표시
      // (필드 에러가 있으면 중복 표시를 피하기 위해 전역 메시지는 숨김)
      const msg = getApiErrorMessage(err, "");
      setErrorMessage(Object.keys(fields || {}).length ? "" : msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="page-card">
      <h2 style={{ margin: 0 }}>직원 등록</h2>

      <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gap: 12, maxWidth: 420 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <label>ID</label>
          <input name="username" value={form.username} onChange={onChange} />
          {fieldErrors.username && (
            <div style={{ color: "#ef4444", fontSize: 13 }}>{fieldErrors.username}</div>
          )}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Password</label>
          <input type="password" name="password" value={form.password} onChange={onChange} />
          {fieldErrors.password && (
            <div style={{ color: "#ef4444", fontSize: 13 }}>{fieldErrors.password}</div>
          )}
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Role</label>
          <select name="role" value={form.role} onChange={onChange}>
            <option value="MANAGER">MANAGER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          {fieldErrors.role && (
            <div style={{ color: "#ef4444", fontSize: 13 }}>{fieldErrors.role}</div>
          )}
        </div>

        {errorMessage && <div style={{ color: "#ef4444", fontSize: 13 }}>{errorMessage}</div>}

        <button type="submit" className="btn" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Saving..." : "저장"}
        </button>
      </form>
    </div>
  );
}
