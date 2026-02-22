import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createFarm,
  deleteFarm,
  listFarms,
  patchFarm,
} from "../../services/accountingApi";
import {
  getApiErrorMessage,
  getIdentifierLabel,
  includesText,
  matchBool,
  normalizeFarmType,
  parseDRFErrors,
} from "../../utils/helpers";
import { downloadFarmListXlsx } from "../../utils/excel";
import "./AccountingTable.css";
import SearchBar from "../../components/common/SearchBar";
import Pagination from "../../components/common/Pagination";

const FARM_TYPES = ["", "일반농장", "동물복지농장"];
const FLAG_OPTIONS = [
  { value: "", label: "전체" },
  { value: "true", label: "유" },
  { value: "false", label: "무" },
];

function toFarmLabel(row) {
  const farmId = getIdentifierLabel(row, ["farm_id"], ["id"]);
  const farmName = String(row?.farm_name || "").trim();
  if (farmName && farmId) return `${farmName} (${farmId})`;
  return farmName || farmId || "-";
}

export default function FarmInfo() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [fieldErrs, setFieldErrs] = useState({});
  const [form, setForm] = useState({
    farm_id: "",
    farm_name: "",
    shell_number: "",
    farm_type: "",
    antibiotic_free: false,
    haccp: false,
    organic: false,
  });

  const [searchField, setSearchField] = useState("all");
  const [searchText, setSearchText] = useState("");

  const [fFarmType, setFFarmType] = useState("");
  const [fAntibioticFree, setFAntibioticFree] = useState("");
  const [fHaccp, setFHaccp] = useState("");
  const [fOrganic, setFOrganic] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const SEARCH_FIELDS = [
    { value: "all", label: "전체" },
    { value: "farm_id", label: "농장식별자" },
    { value: "farm_name", label: "농장명" },
    { value: "shell_number", label: "산란번호" },
  ];

  async function fetchRows() {
    setLoading(true);
    setErr("");
    try {
      const data = await listFarms();
      setRows(data);
    } catch (e) {
      setErr(getApiErrorMessage(e, "농장 목록을 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
  }, []);

  const onSearch = async () => {
    await fetchRows();
  };

  function openCreate() {
    setEditing(null);
    setFormErr("");
    setFieldErrs({});
    setForm({
      farm_id: "",
      farm_name: "",
      shell_number: "",
      farm_type: "",
      antibiotic_free: false,
      haccp: false,
      organic: false,
    });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setFormErr("");
    setFieldErrs({});
    setForm({
      farm_id: String(row?.farm_id || ""),
      farm_name: String(row?.farm_name || ""),
      shell_number: String(row?.shell_number || ""),
      farm_type: normalizeFarmType(row?.farm_type),
      antibiotic_free: Boolean(row?.antibiotic_free),
      haccp: Boolean(row?.haccp),
      organic: Boolean(row?.organic),
    });
    setModalOpen(true);
  }

  const closeModal = useCallback(() => {
    if (submitting) return;
    setModalOpen(false);
  }, [submitting]);

  useEffect(() => {
    if (!modalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, closeModal]);

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setFormErr("");
    setFieldErrs({});

    try {
      const payload = {
        farm_id: String(form.farm_id || "").trim(),
        farm_name: String(form.farm_name || "").trim(),
        antibiotic_free: Boolean(form.antibiotic_free),
        haccp: Boolean(form.haccp),
        organic: Boolean(form.organic),
        ...(String(form.shell_number || "").trim() ? { shell_number: String(form.shell_number).trim() } : {}),
        ...(String(form.farm_type || "").trim()
          ? { farm_type: normalizeFarmType(String(form.farm_type).trim()) }
          : {}),
      };

      const nextErrs = {};
      if (!payload.farm_id) nextErrs.farm_id = "농장식별자(farm_id)를 입력해주세요.";
      if (!payload.farm_name) nextErrs.farm_name = "농장명을 입력해주세요.";
      if (Object.keys(nextErrs).length) {
        setFieldErrs(nextErrs);
        return;
      }

      if (editing?.id != null) await patchFarm(editing.id, payload);
      else await createFarm(payload);

      setModalOpen(false);
      await fetchRows();
    } catch (e2) {
      const parsed = parseDRFErrors(e2?.response?.data);
      setFormErr(parsed.form || "저장에 실패했습니다.");
      setFieldErrs(parsed.fields || {});
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(row) {
    const ok = window.confirm(`'${toFarmLabel(row)}' 농장을 삭제할까요?`);
    if (!ok) return;
    try {
      await deleteFarm(row.id);
      setRows((prev) => prev.filter((r) => r?.id !== row.id));
    } catch (e) {
      window.alert(getApiErrorMessage(e, "삭제에 실패했습니다."));
    }
  }

  function onExcelExport() {
    const body = filtered.map((r) => [
      r?.farm_id ?? "",
      r?.farm_name ?? "",
      r?.shell_number ?? "",
      normalizeFarmType(r?.farm_type),
      r?.antibiotic_free ? "유" : "무",
      r?.haccp ? "유" : "무",
      r?.organic ? "유" : "무",
    ]);
    downloadFarmListXlsx(body);
  }

  const filtered = useMemo(() => {
    const q = searchText.trim();
    return (rows || []).filter((r) => {
      const farmType = normalizeFarmType(r?.farm_type);
      if (fFarmType && farmType !== fFarmType) return false;
      if (!matchBool(r?.antibiotic_free, fAntibioticFree)) return false;
      if (!matchBool(r?.haccp, fHaccp)) return false;
      if (!matchBool(r?.organic, fOrganic)) return false;

      if (!q) return true;
      if (searchField === "farm_id") return includesText(r?.farm_id, q);
      if (searchField === "farm_name") return includesText(r?.farm_name, q);
      if (searchField === "shell_number") return includesText(r?.shell_number, q);
      return (
        includesText(r?.farm_id, q) ||
        includesText(r?.farm_name, q) ||
        includesText(r?.shell_number, q) ||
        includesText(farmType, q)
      );
    });
  }, [rows, searchField, searchText, fFarmType, fAntibioticFree, fHaccp, fOrganic]);

  useEffect(() => {
    setPage(1);
  }, [searchField, searchText, fFarmType, fAntibioticFree, fHaccp, fOrganic]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length]);
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  return (
    <div className="accounting-page">
      <aside className="filters-card">
        <div className="filters-title">필터</div>

        <div className="filter-group">
          <div className="filter-label">농장유형</div>
          <select className="filter-select" value={fFarmType} onChange={(e) => setFFarmType(e.target.value)}>
            {FARM_TYPES.map((t) => (
              <option key={t || "__all__"} value={t}>
                {t || "전체"}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">무항생제</div>
          <select className="filter-select" value={fAntibioticFree} onChange={(e) => setFAntibioticFree(e.target.value)}>
            {FLAG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">HACCP</div>
          <select className="filter-select" value={fHaccp} onChange={(e) => setFHaccp(e.target.value)}>
            {FLAG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">유기농</div>
          <select className="filter-select" value={fOrganic} onChange={(e) => setFOrganic(e.target.value)}>
            {FLAG_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </aside>

      <section className="page-main">
        <div className="page-head">
          <h2 className="page-title">농장 정보</h2>
          <div className="head-actions">
            <button className="btn secondary" onClick={openCreate}>+ 농장 추가</button>
            <button className="btn secondary" onClick={onExcelExport}>엑셀 출력</button>
            <SearchBar
              field={searchField}
              setField={setSearchField}
              text={searchText}
              setText={setSearchText}
              fields={SEARCH_FIELDS}
              loading={loading}
              onSearch={onSearch}
            />
          </div>
        </div>

        <div className="muted" style={{ marginBottom: "var(--sp-10)" }}>
          {loading ? "불러오는 중.." : err ? err : `총 ${filtered.length}건`}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>농장식별자</th>
                <th>농장명</th>
                <th>산란번호</th>
                <th>농장유형</th>
                <th>무항생제</th>
                <th>HACCP</th>
                <th>유기농</th>
                <th style={{ textAlign: "center" }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {!loading && !pagedRows.length ? (
                <tr>
                  <td colSpan={8} className="muted" style={{ padding: "var(--sp-18)" }}>
                    결과가 없습니다.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr key={r.id ?? r.farm_id}>
                    <td>{getIdentifierLabel(r, ["farm_id"], ["id"])}</td>
                    <td className="wrap-cell">{r.farm_name || "-"}</td>
                    <td>{r.shell_number || "-"}</td>
                    <td>{normalizeFarmType(r?.farm_type) || "-"}</td>
                    <td><span className={`badge ${r.antibiotic_free ? "ok" : "no"}`}>{r.antibiotic_free ? "유" : "무"}</span></td>
                    <td><span className={`badge ${r.haccp ? "ok" : "no"}`}>{r.haccp ? "유" : "무"}</span></td>
                    <td><span className={`badge ${r.organic ? "ok" : "no"}`}>{r.organic ? "유" : "무"}</span></td>
                    <td style={{ textAlign: "center" }}>
                      <span className="row-actions actions-center">
                        <button className="btn small secondary" onClick={() => openEdit(r)}>수정</button>
                        <button className="btn small danger" onClick={() => onDelete(r)}>삭제</button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} pageCount={pageCount} onChange={setPage} />
      </section>

      {modalOpen && (
        <div className="modal-overlay" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="modal-title">{editing ? "농장 수정" : "농장 추가"}</h3>
            </div>

            <form onSubmit={onSubmit}>
              <div className="modal-body">
                {formErr && <div className="field-error" style={{ marginBottom: "var(--sp-10)" }}>{formErr}</div>}
                <div className="modal-grid">
                  <div className="field">
                    <div className="filter-label">농장식별자 (farm_id)</div>
                    <input
                      className="filter-input"
                      value={form.farm_id}
                      onChange={(e) => setForm((prev) => ({ ...prev, farm_id: e.target.value }))}
                    />
                    {fieldErrs.farm_id && <div className="field-error">{fieldErrs.farm_id}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">농장명</div>
                    <input
                      className="filter-input"
                      value={form.farm_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, farm_name: e.target.value }))}
                    />
                    {fieldErrs.farm_name && <div className="field-error">{fieldErrs.farm_name}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">산란번호</div>
                    <input
                      className="filter-input"
                      value={form.shell_number}
                      onChange={(e) => setForm((prev) => ({ ...prev, shell_number: e.target.value }))}
                    />
                  </div>

                  <div className="field">
                    <div className="filter-label">농장유형</div>
                    <select
                      className="filter-select"
                      value={form.farm_type}
                      onChange={(e) => setForm((prev) => ({ ...prev, farm_type: e.target.value }))}
                    >
                      {FARM_TYPES.map((t) => (
                        <option key={t || "__empty__"} value={t}>
                          {t || "선택 안함"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <div className="filter-label">인증/여부</div>
                    <div className="field-row">
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={form.antibiotic_free}
                          onChange={(e) => setForm((prev) => ({ ...prev, antibiotic_free: e.target.checked }))}
                        />
                        무항생제
                      </label>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={form.haccp}
                          onChange={(e) => setForm((prev) => ({ ...prev, haccp: e.target.checked }))}
                        />
                        HACCP
                      </label>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={form.organic}
                          onChange={(e) => setForm((prev) => ({ ...prev, organic: e.target.checked }))}
                        />
                        유기농
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn secondary" onClick={closeModal} disabled={submitting}>
                  취소
                </button>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? "저장중.." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
