import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { deleteUser, listEmployees } from "../../services/userApi";

export default function Employees() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();

  const isAdmin = user?.isAdmin === true || user?.role === "ADMIN";

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [field, setField] = useState("ALL"); // ALL | USERNAME | ROLE
  const [q, setQ] = useState("");

  const [sort, setSort] = useState({ key: "id", dir: "asc" });

  const fetchRows = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listEmployees();
      setRows(data);
    } catch (e) {
      setError(
        e?.response?.data?.detail ||
          e?.response?.data?.message ||
          e?.message ||
          "목록 조회 실패"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return rows;

    return rows.filter((r) => {
      const idStr = String(r?.id ?? "");
      const username = String(r?.username ?? r?.user ?? "").toLowerCase();
      const role = String(r?.role ?? "").toLowerCase();

      if (field === "USERNAME") return username.includes(keyword);
      if (field === "ROLE") return role.includes(keyword);
      return idStr.includes(keyword) || username.includes(keyword) || role.includes(keyword);
    });
  }, [rows, q, field]);

  const sorted = useMemo(() => {
    const { key, dir } = sort;
    const sign = dir === "asc" ? 1 : -1;

    const getVal = (r) => {
      if (key === "id") return Number(r?.id ?? 0);
      if (key === "username") return String(r?.username ?? "");
      if (key === "role") return String(r?.role ?? "");
      return "";
    };

    return [...filtered].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
      return String(av).localeCompare(String(bv)) * sign;
    });
  }, [filtered, sort]);

  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const onClickEdit = (id) => navigate(`/hr/edit/${id}`);

  const onDelete = async (id, username) => {
    if (!isAdmin) return;
    if (user?.id === id) return;

    const ok = window.confirm(`정말로 '${username}' 계정을 삭제할까요?`);
    if (!ok) return;

    try {
      await deleteUser(id);
      setRows((prev) => prev.filter((r) => r?.id !== id));
    } catch (e) {
      alert(
        e?.response?.data?.detail ||
          e?.response?.data?.message ||
          e?.message ||
          "삭제 실패"
      );
    }
  };

  const canEditRow = (row) => isAdmin || (user?.id != null && row?.id === user.id);

  return (
    <div className="page-card">
      <h2 style={{ margin: 0 }}>직원 목록</h2>

      {/* 상단 검색/추가 */}
      <div
        style={{
          marginTop: 16,
          display: "flex",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select
            value={field}
            onChange={(e) => setField(e.target.value)}
            style={{
              height: 40,
              borderRadius: 12,
              padding: "0 12px",
              border: "1px solid #e5e7eb",
              background: "white",
              boxShadow: "0 6px 18px rgba(2,6,23,0.06)",
            }}
          >
            <option value="ALL">전체</option>
            <option value="USERNAME">아이디</option>
            <option value="ROLE">권한</option>
          </select>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "white",
              border: "1px solid #e5e7eb",
              borderRadius: 14,
              padding: "0 10px",
              height: 40,
              boxShadow: "0 6px 18px rgba(2,6,23,0.06)",
              minWidth: 320,
            }}
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="검색어를 입력하세요"
              style={{ border: "none", outline: "none", width: "100%" }}
            />
            <button
              type="button"
              onClick={() => {}}
              style={{
                height: 32,
                padding: "0 14px",
                borderRadius: 10,
                border: "none",
                background: "#009781",
                color: "white",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                whiteSpace: "nowrap",
              }}
            >
              검색
            </button>
          </div>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate("/hr/add")}
            disabled={authLoading}
            style={{
              height: 40,
              padding: "0 16px",
              borderRadius: 12,
              border: "none",
              background: "#009781",
              color: "white",
              cursor: "pointer",
              boxShadow: "0 10px 20px rgba(2,6,23,0.10)",
            }}
          >
            + 데이터 추가
          </button>
        )}
      </div>

      {/* 상태 */}
      {error && <div style={{ marginTop: 12, color: "#ef4444", fontSize: 13 }}>{error}</div>}
      {loading && <div style={{ marginTop: 12, color: "#64748b", fontSize: 13 }}>불러오는 중...</div>}

      {/* 테이블 */}
      <div
        style={{
          marginTop: 16,
          background: "white",
          borderRadius: 16,
          boxShadow: "0 12px 30px rgba(2,6,23,0.08)",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: "#f8fafc", color: "#334155" }}>
              <th
                onClick={() => toggleSort("id")}
                style={{ textAlign: "left", padding: "14px 16px", cursor: "pointer", fontWeight: 700 }}
              >
                번호 <span style={{ opacity: 0.5, fontSize: 12 }}>▲▼</span>
              </th>
              <th
                onClick={() => toggleSort("username")}
                style={{ textAlign: "left", padding: "14px 16px", cursor: "pointer", fontWeight: 700 }}
              >
                아이디 <span style={{ opacity: 0.5, fontSize: 12 }}>▲▼</span>
              </th>
              <th
                onClick={() => toggleSort("role")}
                style={{ textAlign: "left", padding: "14px 16px", cursor: "pointer", fontWeight: 700 }}
              >
                권한 <span style={{ opacity: 0.5, fontSize: 12 }}>▲▼</span>
              </th>
              <th style={{ textAlign: "center", padding: "14px 16px", fontWeight: 700 }}>관리</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && !loading ? (
              <tr>
                <td colSpan={4} style={{ padding: 18, color: "#64748b" }}>
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              sorted.map((r) => {
                const canEdit = canEditRow(r);

                return (
                  <tr key={r?.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td style={{ padding: "18px 16px", borderTop: "1px solid #eef2f7", fontWeight: 700 }}>
                      {r?.id}
                    </td>
                    <td style={{ padding: "18px 16px", borderTop: "1px solid #eef2f7" }}>
                      {r?.username ?? "-"}
                    </td>
                    <td style={{ padding: "18px 16px", borderTop: "1px solid #eef2f7" }}>
                      {r?.role ?? "-"}
                    </td>

                    <td
                      style={{
                        padding: "18px 16px",
                        borderTop: "1px solid #eef2f7",
                        textAlign: "center",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => onClickEdit(r?.id)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          border: "none",
                          background: canEdit ? "#c7d2fe" : "#e5e7eb",
                          color: "#111827",
                          cursor: canEdit ? "pointer" : "not-allowed",
                          marginRight: 10,
                        }}
                        title={!canEdit ? "본인 비밀번호만 변경 가능합니다." : ""}
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        disabled={!isAdmin || user?.id === r?.id}
                        onClick={() => onDelete(r?.id, r?.username)}
                        style={{
                          padding: "10px 14px",
                          borderRadius: 10,
                          background: "white",
                          border: "2px solid #ef4444",
                          color: "#ef4444",
                          cursor: !isAdmin || user?.id === r?.id ? "not-allowed" : "pointer",
                          opacity: !isAdmin || user?.id === r?.id ? 0.5 : 1,
                        }}
                        title={
                          !isAdmin
                            ? "삭제는 관리자만 가능합니다."
                            : user?.id === r?.id
                              ? "본인 계정은 삭제할 수 없습니다."
                              : ""
                        }
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
