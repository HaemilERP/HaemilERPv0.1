import { useCallback, useEffect, useMemo, useState } from "react";
import { listFarms, createFarm, patchFarm, deleteFarm } from "../../services/accountingApi";
import { includesText, matchBool, parseDRFErrors } from "../../utils/helpers";
import { downloadFarmListXlsx } from "../../utils/excel";
import "./AccountingTable.css";
import SearchBar from "../../components/common/SearchBar";
import Pagination from "../../components/common/Pagination";

export default function FarmInfo() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // CRUD
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // row | null
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [fieldErrs, setFieldErrs] = useState({});
  const [form, setForm] = useState({
    farm_name: "",
    shell_number: "",
    farm_type: "",
    antibiotic_free: false,
    haccp: false,
    organic: false,
  });

  // 농장유형: 2가지로 고정
  const FARM_TYPES = ["일반농장", "동물복지농장"];

  // 무항생제/HACCP/유기농 필터 옵션
  const FLAG_OPTIONS = [
    { value: "", label: "전체" },
    { value: "true", label: "유" },
    { value: "false", label: "무" },
  ];

  // 상단 검색
  const [searchField, setSearchField] = useState("all");
  const [searchText, setSearchText] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const SEARCH_FIELDS = [
    { value: "all", label: "전체" },
    { value: "farm_name", label: "농장명" },
    { value: "shell_number", label: "난각번호" },
    { value: "farm_type", label: "농장유형" },
  ];
// 좌측 필터
  const [fFarmName, setFFarmName] = useState("");
  const [fShellNumber, setFShellNumber] = useState("");
  const [fFarmType, setFFarmType] = useState("");
  const [fAntibioticFree, setFAntibioticFree] = useState("");
  const [fHaccp, setFHaccp] = useState("");
  const [fOrganic, setFOrganic] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await listFarms();
      setRows(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "농장 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };


  // ✅ 검색 클릭/엔터 시마다 서버에서 다시 목록 갱신
  const onSearch = async () => {
    await fetchRows();
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setFormErr("");
    setFieldErrs({});
    setForm({ farm_name: "", shell_number: "", farm_type: "", antibiotic_free: false, haccp: false, organic: false });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setFormErr("");
    setFieldErrs({});
    setForm({
      farm_name: row?.farm_name ?? "",
      shell_number: row?.shell_number ?? "",
      farm_type: row?.farm_type ?? "",
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

  // ✅ ESC로 팝업 닫기
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
      const farm_name = (form.farm_name || "").trim();
      const shell_number_raw = String(form.shell_number || "").trim();
      const farm_type_raw = String(form.farm_type || "").trim();

      if (!farm_name) {
        setFieldErrs({ farm_name: "농장명을 입력해주세요." });
        return;
      }

      // ✅ shell_number가 숫자 제약일 수 있어 프론트에서 방어 (서버 500 방지)
      let shell_number;
      if (shell_number_raw) {
        const onlyDigits = /^\d+$/.test(shell_number_raw);
        if (!onlyDigits) {
          setFieldErrs({ shell_number: "난각번호는 숫자만 입력해주세요." });
          return;
        }
        shell_number = shell_number_raw; // 숫자 문자열로 전송 (서버가 string/int 모두 대응 가능)
      }

      const payload = {
        farm_name,
        antibiotic_free: Boolean(form.antibiotic_free),
        haccp: Boolean(form.haccp),
        organic: Boolean(form.organic),
        ...(shell_number !== undefined ? { shell_number } : {}),
        ...(farm_type_raw ? { farm_type: farm_type_raw } : {}),
      };
if (editing?.id != null) {
        await patchFarm(editing.id, payload);
      } else {
        await createFarm(payload);
      }
      setModalOpen(false);
      await fetchRows();
    } catch (e2) {
      console.error("❌ create/patch farm failed:", {
        status: e2?.response?.status,
        data: e2?.response?.data,
      });

      const data = e2?.response?.data;
      if (typeof data === "string" && data.includes("<!doctype html")) {
        setFormErr("서버 내부 오류(500)입니다. 백엔드 로그(Traceback)를 확인해주세요.");
        return;
      }

      const parsed = parseDRFErrors(data);
      setFormErr(parsed.form || "저장에 실패했습니다.");
      setFieldErrs(parsed.fields || {});
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(row) {
    const ok = window.confirm(`'${row?.farm_name ?? ""}' 농장을 삭제할까요?`);
    if (!ok) return;
    try {
      await deleteFarm(row.id);
      setRows((prev) => prev.filter((r) => r?.id !== row.id));
    } catch (e) {
      alert(e?.response?.data?.detail || "삭제에 실패했습니다.");
    }
  }

  function onExcelExport() {
    const body = filtered.map((r) => [
      r?.id ?? "",
      r?.farm_name ?? "",
      r?.shell_number ?? "",
      r?.farm_type ?? "",
      r?.antibiotic_free ? "유" : "무",
      r?.haccp ? "유" : "무",
      r?.organic ? "유" : "무",
    ]);

    downloadFarmListXlsx(body);
  }

  const filtered = useMemo(() => {
    const q = searchText.trim();

    return rows.filter((r) => {
      // 좌측 필터
      if (fFarmName && !includesText(r.farm_name, fFarmName)) return false;
      if (fShellNumber && !includesText(r.shell_number, fShellNumber)) return false;
      if (fFarmType && !includesText(r.farm_type, fFarmType)) return false;
      if (!matchBool(r.antibiotic_free, fAntibioticFree)) return false;
      if (!matchBool(r.haccp, fHaccp)) return false;
      if (!matchBool(r.organic, fOrganic)) return false;

      // 상단 검색
      if (!q) return true;
      if (searchField === "all") {
        return (
          includesText(r.farm_name, q) ||
          includesText(r.shell_number, q) ||
          includesText(r.farm_type, q) ||
          includesText(r.antibiotic_free ? "유" : "무", q) ||
          includesText(r.haccp ? "유" : "무", q) ||
          includesText(r.organic ? "유" : "무", q)
        );
      }
      return includesText(r[searchField], q);
    });
  }, [
    rows,
    searchField,
    searchText,
    fFarmName,
    fShellNumber,
    fFarmType,
    fAntibioticFree,
    fHaccp,
    fOrganic,
  ]);

  // 필터/검색이 바뀌면 첫 페이지로
  useEffect(() => {
    setPage(1);
  }, [searchField, searchText, fFarmName, fShellNumber, fFarmType, fAntibioticFree, fHaccp, fOrganic]);

  const pageCount = useMemo(() => {
    return Math.max(1, Math.ceil(filtered.length / pageSize));
  }, [filtered.length]);

  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  function resetFilters() {
    setSearchField("all");
    setSearchText("");
    setFFarmName("");
    setFShellNumber("");
    setFFarmType("");
    setFAntibioticFree("");
    setFHaccp("");
    setFOrganic("");
  }

  return (
    <div className="accounting-page">
      <aside className="filters-card">
        <div className="filters-title">필터</div>

        <div className="filter-group">
          <div className="filter-label">농장명</div>
          <input className="filter-input" value={fFarmName} onChange={(e) => setFFarmName(e.target.value)} placeholder="농장명" />
        </div>

        <div className="filter-group">
          <div className="filter-label">난각번호</div>
          <input className="filter-input" value={fShellNumber} onChange={(e) => setFShellNumber(e.target.value)} placeholder="난각번호" />
        </div>

        <div className="filter-group">
          <div className="filter-label">농장유형</div>
          <select className="filter-select" value={fFarmType} onChange={(e) => setFFarmType(e.target.value)}>
            <option value="">전체</option>
            {FARM_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">무항생제 인증</div>
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

        <button className="btn secondary" onClick={resetFilters} style={{ width: "100%" }}>
          필터 초기화
        </button>
      </aside>

      <section className="page-main">
        <div className="page-head">
          <h2 className="page-title">농장정보</h2>

          <div className="head-actions">
            <button className="btn secondary" onClick={openCreate}>
              + 농장 추가
            </button>

            <button className="btn secondary" onClick={onExcelExport}>
              엑셀 출력
            </button>

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
          {loading ? "불러오는 중..." : err ? err : `총 ${filtered.length}건`}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>농장</th>
                <th>난각번호</th>
                <th>농장유형</th>
                <th>무항생제</th>
                <th>HACCP</th>
                <th>유기농</th>
                <th style={{ textAlign: "center" }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="muted" style={{ padding: "var(--sp-18)" }}>
                    결과가 없습니다.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr key={r.id ?? `${r.farm_name}-${r.shell_number}`}>
                    <td className="wrap-cell">{`${r.farm_name ?? ""}(${r.id ?? ""})`}</td>
                    <td>{r.shell_number ?? "-"}</td>
                    <td>{r.farm_type ?? "-"}</td>
                    <td><span className={`badge ${r.antibiotic_free ? "ok" : "no"}`}>{r.antibiotic_free ? "유" : "무"}</span></td>
                    <td><span className={`badge ${r.haccp ? "ok" : "no"}`}>{r.haccp ? "유" : "무"}</span></td>
                    <td><span className={`badge ${r.organic ? "ok" : "no"}`}>{r.organic ? "유" : "무"}</span></td>
                    <td style={{ textAlign: "center" }}>
                      <span className="row-actions">
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
              <button className="btn small secondary" onClick={closeModal}>닫기</button>
            </div>
            <form onSubmit={onSubmit}>
              <div className="modal-body">
                {formErr && <div className="field-error" style={{ marginBottom: "var(--sp-10)" }}>{formErr}</div>}

                <div className="modal-grid">
                  <div className="field">
                    <div className="filter-label">농장명 </div>
                    <input
                      className="filter-input"
                      value={form.farm_name}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, farm_name: e.target.value }));
                        setFieldErrs((p) => ({ ...p, farm_name: "" }));
                      }}
                      placeholder="농장명"
                    />
                    {fieldErrs.farm_name && <div className="field-error">{fieldErrs.farm_name}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">난각번호</div>
                    <input
                      className="filter-input"
                      value={form.shell_number}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, shell_number: e.target.value }));
                        setFieldErrs((p) => ({ ...p, shell_number: "" }));
                      }}
                      placeholder="난각번호"
                    />
                    {fieldErrs.shell_number && <div className="field-error">{fieldErrs.shell_number}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">농장유형</div>
                    <select
                      className="filter-select"
                      value={form.farm_type}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, farm_type: e.target.value }));
                        setFieldErrs((p) => ({ ...p, farm_type: "" }));
                      }}
                    >
                      <option value="">선택</option>
                      {FARM_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    {fieldErrs.farm_type && <div className="field-error">{fieldErrs.farm_type}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">인증/여부</div>
                    <div className="field-row">
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={form.antibiotic_free}
                          onChange={(e) => setForm((p) => ({ ...p, antibiotic_free: e.target.checked }))}
                        />
                        무항생제
                      </label>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={form.haccp}
                          onChange={(e) => setForm((p) => ({ ...p, haccp: e.target.checked }))}
                        />
                        HACCP
                      </label>
                      <label className="checkbox">
                        <input
                          type="checkbox"
                          checked={form.organic}
                          onChange={(e) => setForm((p) => ({ ...p, organic: e.target.checked }))}
                        />
                        유기농
                      </label>
                    </div>
                    {(fieldErrs.antibiotic_free || fieldErrs.haccp || fieldErrs.organic) && (
                      <div className="field-error">
                        {[fieldErrs.antibiotic_free, fieldErrs.haccp, fieldErrs.organic].filter(Boolean).join(" ")}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-foot">
                <button type="button" className="btn secondary" onClick={closeModal} disabled={submitting}>
                  취소
                </button>
                <button type="submit" className="btn" disabled={submitting}>
                  {submitting ? "저장 중..." : "저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
