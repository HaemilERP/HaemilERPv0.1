import "./Employees.css";
import "../accounting/AccountingTable.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  deleteUser,
  getMyAccount,
  listEmployees,
  updateUserPassword,
} from "../../services/userApi";
import { getApiErrorMessage } from "../../utils/helpers";
import Pagination from "../../components/common/Pagination";
import SearchBar from "../../components/common/SearchBar";

function isSameUser(a, b) {
  if (!a || !b) return false;
  if (a.id != null && b.id != null) return Number(a.id) === Number(b.id);
  return String(a.username || "").trim() === String(b.username || "").trim();
}

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

  const [field, setField] = useState("ALL");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState({ key: "id", dir: "asc" });

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const fetchRows = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      if (isAdmin) {
        const data = await listEmployees();
        setRows(Array.isArray(data) ? data : []);
      } else {
        const me = await getMyAccount();
        setRows(me ? [me] : []);
      }
    } catch (e) {
      setError(getApiErrorMessage(e, "직원 목록 조회 실패"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [isAdmin]);

  useEffect(() => {
    fetchRows();
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

  useEffect(() => {
    setPage(1);
  }, [q, field, sort.key, sort.dir]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(sorted.length / pageSize)), [sorted.length]);
  useEffect(() => {
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

  const isSelf = (row) => isSameUser(row, user);
  const canEditRow = (row) => isAdmin || isSelf(row);
  const canDeleteRow = (row) => (isAdmin ? !isSelf(row) : isSelf(row));

  const onClickEdit = (row) => {
    if (!canEditRow(row)) return;
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

    const nextPw = String(pw1 || "").trim();
    if (!nextPw || nextPw.length < 8) {
      setModalError("비밀번호는 최소 8자 이상이어야 합니다.");
      return;
    }
    if (nextPw !== String(pw2 || "").trim()) {
      setModalError("비밀번호 확인이 일치하지 않습니다.");
      return;
    }

    setSaving(true);
    try {
      await updateUserPassword(editingRow.id, nextPw);
      await fetchRows();
      closeModal();
    } catch (e2) {
      setModalError(getApiErrorMessage(e2, "비밀번호 변경 실패"));
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (row) => {
    if (!row?.id || !canDeleteRow(row)) return;
    const ok = window.confirm(`정말로 '${row?.username ?? ""}' 계정을 삭제할까요?`);
    if (!ok) return;

    try {
      await deleteUser(row.id);
      setRows((prev) => prev.filter((r) => !isSameUser(r, row)));
    } catch (e) {
      window.alert(getApiErrorMessage(e, "계정 삭제 실패"));
    }
  };

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

        {isAdmin && (
          <button
            type="button"
            onClick={() => navigate("/hr/add")}
            disabled={authLoading}
            className="btn secondary"
          >
            + 계정 추가
          </button>
        )}
      </div>

      {error && (
        <div style={{ marginTop: "var(--sp-12)", color: "#ef4444", fontSize: "var(--fs-13)" }}>
          {error}
        </div>
      )}
      {loading && (
        <div style={{ marginTop: "var(--sp-12)", color: "#64748b", fontSize: "var(--fs-13)" }}>
          불러오는 중..
        </div>
      )}

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
                번호
              </th>
              <th
                onClick={() => toggleSort("username")}
                style={{ textAlign: "left", padding: "var(--sp-14) var(--sp-16)", cursor: "pointer", fontWeight: 700 }}
              >
                아이디
              </th>
              <th
                onClick={() => toggleSort("role")}
                style={{ textAlign: "left", padding: "var(--sp-14) var(--sp-16)", cursor: "pointer", fontWeight: 700 }}
              >
                권한
              </th>
              <th style={{ textAlign: "center" }}>관리</th>
            </tr>
          </thead>

          <tbody>
            {!loading && sorted.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ padding: "var(--sp-18)", color: "#64748b" }}>
                  검색 결과가 없습니다.
                </td>
              </tr>
            ) : (
              pagedRows.map((r) => (
                <tr key={r?.id ?? r?.username} style={{ borderTop: "1px solid #eef2f7" }}>
                  <td
                    style={{
                      padding: "var(--sp-18) var(--sp-16)",
                      borderTop: "1px solid #eef2f7",
                      fontWeight: 700,
                      textAlign: "left",
                    }}
                  >
                    {r?.id ?? "-"}
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
                        disabled={!canEditRow(r)}
                        onClick={() => onClickEdit(r)}
                        className="btn small secondary"
                      >
                        수정
                      </button>

                      <button
                        type="button"
                        disabled={!canDeleteRow(r)}
                        onClick={() => onDelete(r)}
                        className="btn small danger"
                        title={!canDeleteRow(r) ? "삭제 권한이 없습니다." : ""}
                      >
                        삭제
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} pageCount={pageCount} onChange={setPage} />

      {modalOpen && (
        <div className="modal-overlay" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <form onSubmit={onSubmitModal}>
              <div className="modal-head">
                <h3 className="modal-title">비밀번호 수정</h3>
              </div>

              <div className="modal-body">
                {modalError && (
                  <div className="field-error" style={{ marginBottom: "var(--sp-10)" }}>
                    {modalError}
                  </div>
                )}

                <div className="modal-grid one">
                  <div className="field">
                    <div className="filter-label">아이디</div>
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
                  {saving ? "저장중.." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
