import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { deleteUser, listEmployees, updateUserPassword } from "../../services/userApi";
import { getApiErrorMessage } from "../../utils/helpers";

export default function EditEmployee() {
  const { user, authLoading } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();

  const isAdmin = Boolean(user?.isAdmin);
  const myId = user?.id;

  const targetId = useMemo(() => {
    // /hr/edit 로 들어온 경우: ADMIN은 선택 유도, MANAGER는 본인으로
    if (!id) return isAdmin ? null : myId ?? null;
    const n = Number(id);
    return Number.isFinite(n) ? n : null;
  }, [id, isAdmin, myId]);

  const isSelf = targetId != null && myId != null && targetId === myId;

  // ✅ "프론트에서 권한으로 막지 말고" 서버 응답을 그대로 보여주기 위해
  // canChangePassword는 UI disable 용도로만 유지 (디자인 유지 목적)
  const canChangePassword = Boolean(isAdmin || isSelf);

  const [targetUser, setTargetUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");

  // ✅ 대상 유저 정보 로드
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setError("");
      setSuccess("");

      if (targetId == null) {
        setTargetUser(null);
        return;
      }

      // 본인일 때는 이미 AuthContext에 있는 값 사용
      if (isSelf) {
        if (mounted) setTargetUser(user);
        return;
      }

      // ADMIN이 타인 편집 시: 목록에서 찾아서 표시
      if (!isAdmin) {
        if (mounted) setTargetUser(null);
        return;
      }

      setLoading(true);
      try {
        const list = await listEmployees();
        const found = list.find((u) => Number(u?.id) === Number(targetId));
        if (mounted) setTargetUser(found || { id: targetId, username: "", role: "" });
      } catch (e) {
        if (mounted) setError(getApiErrorMessage(e));
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [targetId, isSelf, isAdmin, user]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // ✅ 길이 검증 로직 (8자 기준)
    const nextPw = (pw1 || "").trim();
    if (!nextPw || nextPw.length < 8) {
      setError("비밀번호는 최소 8자 이상이어야 합니다.");
      return;
    }
    if (nextPw !== pw2) {
      setError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setSaving(true);
    try {
      await updateUserPassword(targetId, nextPw);
      setPw1("");
      setPw2("");
      setSuccess("비밀번호가 변경되었습니다.");
    } catch (e2) {
      // ✅ ADMIN과 동일: 서버 에러 메시지(detail/message) 그대로 표시
      setError(getApiErrorMessage(e2));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!isAdmin || targetId == null) return;
    if (myId === targetId) return;

    const ok = window.confirm("정말로 이 계정을 삭제할까요?");
    if (!ok) return;

    try {
      await deleteUser(targetId);
      navigate("/hr/employees");
    } catch (e) {
      setError(getApiErrorMessage(e));
    }
  };

  // /hr/edit 로 들어왔는데 관리자면 선택 유도
  if (targetId == null && isAdmin) {
    return (
      <div className="page-card">
        <h2 style={{ margin: 0 }}>직원 편집</h2>
        <p style={{ color: "#64748b", marginTop: 10 }}>
          직원 목록에 있는 계정의 수정 버튼을 눌러서 진행할 수 있습니다.
        </p>
        <button
          type="button"
          onClick={() => navigate("/hr/employees")}
          style={{
            marginTop: 12,
            padding: "10px 12px",
            borderRadius: 10,
            border: "none",
            background: "#00a990",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          직원목록으로 이동
        </button>
      </div>
    );
  }

  // MANAGER가 남의 계정을 보려고 하면 안내 + 본인으로 이동 버튼 (기존 UI 유지)
  if (!isAdmin && targetId != null && myId != null && targetId !== myId) {
    return (
      <div className="page-card">
        <h2 style={{ margin: 0 }}>권한 없음</h2>
        <p style={{ color: "#64748b", marginTop: 10 }}>
          매니저는 본인 계정의 비밀번호만 변경할 수 있습니다.
        </p>
        <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate(`/hr/edit/${myId}`)}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "none",
              background: "#009781",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            내 비밀번호 변경
          </button>
          <button
            type="button"
            onClick={() => navigate("/hr/employees")}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer",
            }}
          >
            직원목록으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-card">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div>
          <h2 style={{ margin: 0 }}>직원 편집</h2>
          <div style={{ marginTop: 8, color: "#64748b", fontSize: 13 }}>
            {isAdmin ? "관리자는 모든 계정의 비밀번호 변경/삭제가 가능합니다." : "본인 계정의 비밀번호만 변경할 수 있습니다."}
          </div>
        </div>

        {isAdmin && targetId != null && myId !== targetId && (
          <button
            type="button"
            onClick={onDelete}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "white",
              border: "2px solid #ef4444",
              color: "#ef4444",
              cursor: "pointer",
            }}
          >
            계정 삭제
          </button>
        )}
      </div>

      {loading && <div style={{ marginTop: 12, color: "#64748b", fontSize: 13 }}>불러오는 중...</div>}
      {error && <div style={{ marginTop: 12, color: "#ef4444", fontSize: 13 }}>{error}</div>}
      {success && <div style={{ marginTop: 12, color: "#16a34a", fontSize: 13 }}>{success}</div>}

      <form onSubmit={onSubmit} style={{ marginTop: 14, display: "grid", gap: 12, maxWidth: 420 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <label>ID</label>
          <input value={targetUser?.username || ""} readOnly style={{ background: "#f8fafc" }} />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Role</label>
          <input value={targetUser?.role || ""} readOnly style={{ background: "#f8fafc" }} />
        </div>

        <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
          <label>New Password</label>
          <input
            type="password"
            value={pw1}
            onChange={(e) => setPw1(e.target.value)}
            disabled={!canChangePassword || authLoading}
          />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label>Confirm Password</label>
          <input
            type="password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            disabled={!canChangePassword || authLoading}
          />
        </div>

        <button
          type="submit"
          disabled={!canChangePassword || saving || authLoading}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "none",
            background: !canChangePassword ? "#94a3b8" : "#009781",
            color: "#fff",
            cursor: !canChangePassword ? "not-allowed" : "pointer",
          }}
          title={!canChangePassword ? "본인 계정의 비밀번호만 변경할 수 있습니다." : ""}
        >
          {saving ? "Saving..." : "비밀번호 변경"}
        </button>

        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate("/hr/employees")}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              background: "white",
              cursor: "pointer",
            }}
          >
            직원목록으로
          </button>
        )}
      </form>
    </div>
  );
}
