import { useAuth } from "../../context/AuthContext";

/**
 * ADMIN-only gate.
 * - authLoading 동안에는 권한 판정을 보류(깜빡임/오판 방지)
 * - 권한이 없으면 기존 UI 스타일(page-card)을 유지한 채 안내
 */
export default function AdminRoute({
  children,
  title = "권한 없음",
  message = "관리자만 접근 가능합니다.",
}) {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="page-card">
        <h2>로딩중...</h2>
        <p style={{ color: "#64748b" }}>권한 정보를 확인하고 있습니다.</p>
      </div>
    );
  }

  if (!user?.isAdmin) {
    return (
      <div className="page-card">
        <h2>{title}</h2>
        <p style={{ color: "#64748b" }}>{message}</p>
      </div>
    );
  }

  return children;
}
