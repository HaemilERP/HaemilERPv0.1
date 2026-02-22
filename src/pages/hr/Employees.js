import "./Employees.css";
import "../accounting/AccountingTable.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { deleteUser, listEmployees, updateUserPassword } from "../../services/userApi";
import { getApiErrorMessage } from "../../utils/helpers";
import Pagination from "../../components/common/Pagination";
import SearchBar from "../../components/common/SearchBar";

export default function Employees() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();

  const isAdmin = Boolean(user?.isAdmin);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRow, setEditingRow] = useState(null);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  const [field, setField] = useState("ALL"); // ALL | USERNAME | ROLE
  const [q, setQ] = useState("");

  const [sort, setSort] = useState({ key: "id", dir: "asc" });

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listEmployees(); // ✅ accounts/accounts GET
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(getApiErrorMessage(e, "목록 조회 실패"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRows(); // 최초 1회 로드
  }, [fetchRows]);

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

  // 필터/검색/정렬이 바뀌면 첫 페이지로
  useEffect(() => {
    setPage(1);
  }, [q, field, sort.key, sort.dir]);

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(sorted.length / pageSize));
  }, [sorted.length]);

  useEffect(() => {
    // 데이터가 줄어들어 현재 페이지가 범위를 벗어나면 보정
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, page]);

  const toggleSort = (key) => {
    setSort((prev) => {
      if (prev.key !== key) return { key, dir: "asc" };
      return { key, dir: prev.dir === "asc" ? "desc" : "asc" };
    });
  };

  const onClickEdit = (row) => {
    const canEdit = isAdmin || (user?.id != null && row?.id === user.id);
    if (!canEdit) return;

    setEditingRow(row || null);
    setPw1("");
    setPw2("");
    setModalError("");
    setModalOpen(true);
  };

  const closeModal = useCallback(() => {
    if (saving) return;
    setModalOpen(false);
    setEditingRow(null);
    setPw1("");
    setPw2("");
    setModalError("");
  }, [saving]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, closeModal]);

  const onSubmitModal = async (e) => {
    e.preventDefault();
    if (!editingRow?.id) return;

    setModalError("");

    const nextPw = (pw1 || "").trim();
    if (!nextPw || nextPw.length < 8) {
      setModalError("비밀번호는 최소 8자 이상이어야 합니다.");
      return;
    }
    if (nextPw !== pw2) {
      setModalError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setSaving(true);
    try {
      await updateUserPassword(editingRow.id, nextPw);
      await fetchRows();
      setModalOpen(false);
      setEditingRow(null);
      setPw1("");
      setPw2("");
    } catch (e2) {
      setModalError(getApiErrorMessage(e2));
    } finally {
      setSaving(false);
    }
  };

  // ✅ 삭제 버튼 UX 개선: title/disabled 로직을 읽기 쉽게 분리
  const getDeleteMeta = (row) => {
    if (!isAdmin) {
      return { disabled: true, title: "삭제는 관리자만 가능합니다." };
    }
    if (user?.id === row?.id) {
      return { disabled: true, title: "관리자는 본인 계정을 삭제할 수 없습니다." };
    }
    return { disabled: false, title: "" };
  };

  const onDelete = async (id, username) => {
    // 방어 (UI에서 막혀도 혹시 모를 호출 대비)
    if (!isAdmin) return;
    if (user?.id === id) return;

    const ok = window.confirm(`정말로 '${username}' 계정을 삭제할까요?`);
    if (!ok) return;

    try {
      await deleteUser(id);
      setRows((prev) => prev.filter((r) => r?.id !== id));
      // ✅ 서버 기준으로 다시 동기화하고 싶으면 아래로 교체
      // await fetchRows();
    } catch (e) {
      alert(getApiErrorMessage(e, "삭제 실패"));
    }
  };

  const canEditRow = (row) => isAdmin || (user?.id != null && row?.id === user.id);

  // --- UI 스타일(기존 유지) ---
  // Employees 페이지는 기존 UI/기능을 유지하되,
  // 버튼/폼 컨트롤은 전역(.btn/.filter-*) 스타일로 통일합니다.

  // ✅ 검색 클릭/엔터 시마다 서버에서 다시 목록 갱신
  const onSearch = async () => {
    await fetchRows();
  };

  const SEARCH_FIELDS = useMemo(
    () => [
      { value: "ALL", label: "전체" },
      { value: "USERNAME", label: "아이디" },
      { value: "ROLE", label: "권한" },
    ],
    []
  );

  return (
    <div className="page-card">
      <h2 style={{ margin: 0 }}>직원 목록</h2>

      {/* 상단 검색/추가 */}
      <div
        style={{
          marginTop: "var(--sp-16)",
          display: "flex",
          gap: "var(--sp-12)",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "var(--sp-10)", alignItems: "center", flexWrap: "wrap" }}>
          {/* 고객사정보 페이지와 동일하게: 검색 중엔 버튼 disabled */}
          <SearchBar
            field={field}
            setField={setField}
            text={q}
            setText={setQ}
            fields={SEARCH_FIELDS}
            loading={loading}
            onSearch={onSearch}
            inputWidth="var(--w-330)"
          />
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate("/hr/add")}
            disabled={authLoading}
            className="btn secondary"
          >
            + 데이터 추가
          </button>
        )}
      </div>

      {/* 상태 */}
      {error && <div style={{ marginTop: "var(--sp-12)", color: "#ef4444", fontSize: "var(--fs-13)" }}>{error}</div>}
      {loading && <div style={{ marginTop: "var(--sp-12)", color: "#64748b", fontSize: "var(--fs-13)" }}>불러오는 중...</div>}

      {/* 테이블 */}
      <div
        style={{
          marginTop: "var(--sp-16)",
          background: "white",
          borderRadius: "clamp(14px, calc(16 * var(--ui)), 20px)",
          boxShadow: "var(--shadow-card)",
          overflow: "hidden",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
          <thead>
            <tr style={{ background: "#f8fafc", color: "#334155" }}>
              <th
                onClick={() => toggleSort("id")}
                style={{ textAlign: "left", padding: "var(--sp-14) var(--sp-16)", cursor: "pointer", fontWeight: 700 }}
              >
                번호 <span style={{ opacity: 0.5, fontSize: "var(--fs-12)" }}>▲▼</span>
              </th>
              <th
                onClick={() => toggleSort("username")}
                style={{ textAlign: "left", padding: "var(--sp-14) var(--sp-16)", cursor: "pointer", fontWeight: 700 }}
              >
                아이디 <span style={{ opacity: 0.5, fontSize: "var(--fs-12)" }}>▲▼</span>
              </th>
              <th
                onClick={() => toggleSort("role")}
                style={{ textAlign: "left", padding: "var(--sp-14) var(--sp-16)", cursor: "pointer", fontWeight: 700 }}
              >
                권한 <span style={{ opacity: 0.5, fontSize: "var(--fs-12)" }}>▲▼</span>
              </th>
              <th style={{ textAlign: "center" }}>관리</th>
            </tr>
          </thead>

          <tbody>
            {sorted.length === 0 && !loading ? (
              <tr>
                    <td colSpan={4} style={{ padding: "var(--sp-18)", color: "#64748b" }}>
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              pagedRows.map((r) => {
                const canEdit = canEditRow(r);
                const del = getDeleteMeta(r);

                return (
                  <tr key={r?.id} style={{ borderTop: "1px solid #eef2f7" }}>
                    <td
                      style={{
                        padding: "var(--sp-18) var(--sp-16)",
                        borderTop: "1px solid #eef2f7",
                        fontWeight: 700,
                        textAlign: "left",
                      }}
                    >
                      {r?.id}
                    </td>

                    <td style={{ padding: "var(--sp-18) var(--sp-16)", borderTop: "1px solid #eef2f7" }}>
                      {r?.username ?? "-"}
                    </td>

                    <td style={{ padding: "var(--sp-18) var(--sp-16)", borderTop: "1px solid #eef2f7" }}>
                      {r?.role ?? "-"}
                    </td>

                    <td style={{ textAlign: "center" }}>
                      <div className="row-actions" style={{ justifyContent: "center" }}>
                        <button
                          type="button"
                          disabled={!canEdit}
                          onClick={() => onClickEdit(r)}
                          className="btn small secondary"
                          title={!canEdit ? "본인 비밀번호만 변경 가능합니다." : ""}
                        >
                          수정
                        </button>

                        <button
                          type="button"
                          disabled={del.disabled}
                          onClick={() => onDelete(r?.id, r?.username)}
                          className="btn small danger"
                          title={del.title}
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ✅ 페이지네이션 */}
      <Pagination page={page} pageCount={pageCount} onChange={setPage} />

      {modalOpen && (
        <div className="modal-overlay" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <form onSubmit={onSubmitModal}>
              <div className="modal-head">
                <h3 className="modal-title">직원 편집</h3>
                <button className="btn secondary small" type="button" onClick={closeModal} disabled={saving}>
                  닫기
                </button>
              </div>

              <div className="modal-body">
                {modalError && <div className="field-error" style={{ marginBottom: "var(--sp-10)" }}>{modalError}</div>}

                <div className="modal-grid one">
                  <div className="field">
                    <div className="filter-label">ID</div>
                    <input className="filter-input" value={editingRow?.username || ""} readOnly />
                  </div>

                  <div className="field">
                    <div className="filter-label">권한</div>
                    <input className="filter-input" value={editingRow?.role || ""} readOnly />
                  </div>

                  <div className="field">
                    <div className="filter-label">새 비밀번호</div>
                    <input
                      className="filter-input"
                      type="password"
                      value={pw1}
                      onChange={(e) => setPw1(e.target.value)}
                      disabled={saving || authLoading}
                    />
                  </div>

                  <div className="field">
                    <div className="filter-label">비밀번호 확인</div>
                    <input
                      className="filter-input"
                      type="password"
                      value={pw2}
                      onChange={(e) => setPw2(e.target.value)}
                      disabled={saving || authLoading}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-foot">
                <button className="btn secondary" type="button" onClick={closeModal} disabled={saving}>
                  취소
                </button>
                <button className="btn" type="submit" disabled={saving || authLoading}>
                  {saving ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
