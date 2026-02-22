import { useCallback, useEffect, useMemo, useState } from "react";
import { listCustomers, createCustomer, patchCustomer, deleteCustomer, listFarms } from "../../services/accountingApi";
import { includesText, includesAnyTokens, farmsToText, parseDRFErrors } from "../../utils/helpers";
import { downloadCustomerListXlsx } from "../../utils/excel";
import "./AccountingTable.css";
import SearchBar from "../../components/common/SearchBar";
import Pagination from "../../components/common/Pagination";


export default function CustomerInfo() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // CRUD
  const [farms, setFarms] = useState([]);
  const [farmSearch, setFarmSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [fieldErrs, setFieldErrs] = useState({});
  const [form, setForm] = useState({
    customer_name: "",
    available_farms: [], // ids
    max_laying_days: "",
    expiration_date: "",
  });

  // 상단 검색
  const [searchField, setSearchField] = useState("all");
  const [searchText, setSearchText] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  

  const SEARCH_FIELDS = [
    { value: "all", label: "전체" },
    { value: "customer_name", label: "고객사명" },
    // 고객사 ID 검색은 불필요 → 고객사에 연결된 농장 ID로 검색
    { value: "available_farms", label: "농장ID" },
  ];
// 좌측 필터
  const [fCustomerName, setFCustomerName] = useState("");
  const [fFarmKeyword, setFFarmKeyword] = useState("");
  const [fMaxLayingMin, setFMaxLayingMin] = useState("");
  const [fMaxLayingMax, setFMaxLayingMax] = useState("");
  const [fExpMin, setFExpMin] = useState("");
  const [fExpMax, setFExpMax] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await listCustomers();
      setRows(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "고객사 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };


  // ✅ 검색 클릭/엔터 시마다 서버에서 다시 목록 갱신
  const onSearch = async () => {
    await fetchRows();
  };

  const fetchFarms = async () => {
    try {
      const data = await listFarms();
      setFarms(data);
    } catch {
      // farms 목록은 보조데이터라 실패해도 페이지는 동작
    }
  };



  const farmsById = useMemo(() => {
    const map = {};
    (farms || []).forEach((f) => {
      const id = f?.id;
      if (id !== null && id !== undefined) map[String(id)] = f;
    });
    return map;
  }, [farms]);

  const filteredFarmOptions = useMemo(() => {
    const q = farmSearch.trim();
    if (!q) return farms || [];
    // 공백으로 나뉜 키워드 중 하나라도 포함되면 노출(OR)
    return (farms || []).filter((f) => includesAnyTokens(`${f?.farm_name ?? ""} ${f?.id ?? ""}`, q));
  }, [farms, farmSearch]);
  useEffect(() => {
    fetchRows();
    fetchFarms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function farmsToIds(v) {
    if (!v) return [];
    if (!Array.isArray(v)) return [];
    return v
      .map((f) => {
        if (typeof f === "number") return f;
        if (typeof f === "string") return Number.isFinite(Number(f)) ? Number(f) : null;
        if (typeof f === "object") return f.id ?? null;
        return null;
      })
      .filter((x) => x != null);
  }

  function onExcelExport() {
    const body = filtered.map((r) => [
      r?.id ?? "",
      r?.customer_name ?? "",
      farmsToIds(r?.available_farms).join(","),
      r?.max_laying_days ?? "",
      r?.expiration_date ?? "",
    ]);

    downloadCustomerListXlsx(body);
  }

  function openCreate() {
    setEditing(null);
    setFormErr("");
    setFieldErrs({});
    setForm({ customer_name: "", available_farms: [], max_laying_days: "", expiration_date: "" });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setFormErr("");
    setFieldErrs({});
    setForm({
      customer_name: row?.customer_name ?? "",
      available_farms: farmsToIds(row?.available_farms),
      max_laying_days: row?.max_laying_days ?? "",
      expiration_date: row?.expiration_date ?? "",
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
      const payload = {
        customer_name: form.customer_name,
        available_farms: form.available_farms,
        max_laying_days: Number(form.max_laying_days),
        expiration_date: Number(form.expiration_date),
      };
      if (!payload.customer_name?.trim()) {
        setFieldErrs({ customer_name: "고객사명을 입력해주세요." });
        return;
      }
      if (!Number.isFinite(payload.max_laying_days)) {
        setFieldErrs({ max_laying_days: "납고가능 일수를 숫자로 입력해주세요." });
        return;
      }
      if (!Number.isFinite(payload.expiration_date)) {
        setFieldErrs({ expiration_date: "유통기한을 숫자로 입력해주세요." });
        return;
      }

      if (editing?.id != null) {
        await patchCustomer(editing.id, payload);
      } else {
        await createCustomer(payload);
      }
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
    const ok = window.confirm(`'${row?.customer_name ?? ""}' 고객사를 삭제할까요?`);
    if (!ok) return;
    try {
      await deleteCustomer(row.id);
      setRows((prev) => prev.filter((r) => r?.id !== row.id));
    } catch (e) {
      alert(e?.response?.data?.detail || "삭제에 실패했습니다.");
    }
  }

  const filtered = useMemo(() => {
    const q = searchText.trim();

    const minLay = fMaxLayingMin === "" ? null : Number(fMaxLayingMin);
    const maxLay = fMaxLayingMax === "" ? null : Number(fMaxLayingMax);
    const minExp = fExpMin === "" ? null : Number(fExpMin);
    const maxExp = fExpMax === "" ? null : Number(fExpMax);

    return rows.filter((r) => {
      const farmsText = farmsToText(r.available_farms, farmsById);

      // 좌측 필터
      if (fCustomerName && !includesText(r.customer_name, fCustomerName)) return false;
      // 공백 키워드 OR 검색
      if (fFarmKeyword && !includesAnyTokens(farmsText, fFarmKeyword)) return false;

      const lay = Number(r.max_laying_days);
      const exp = Number(r.expiration_date);
      if (minLay !== null && !(lay >= minLay)) return false;
      if (maxLay !== null && !(lay <= maxLay)) return false;
      if (minExp !== null && !(exp >= minExp)) return false;
      if (maxExp !== null && !(exp <= maxExp)) return false;

      // 상단 검색
      if (!q) return true;
      if (searchField === "all") {
        return (
          includesText(r.customer_name, q) ||
          includesText(farmsText, q) ||
          includesText(r.max_laying_days, q) ||
          includesText(r.expiration_date, q)
        );
      }
      if (searchField === "available_farms") return includesText(farmsText, q);
      return includesText(r[searchField], q);
    });
  }, [
    rows,
    farmsById,
    searchField,
    searchText,
    fCustomerName,
    fFarmKeyword,
    fMaxLayingMin,
    fMaxLayingMax,
    fExpMin,
    fExpMax,
  ]);

  // 필터/검색이 바뀌면 첫 페이지로
  useEffect(() => {
    setPage(1);
  }, [searchField, searchText, fCustomerName, fFarmKeyword, fMaxLayingMin, fMaxLayingMax, fExpMin, fExpMax]);

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
    setFCustomerName("");
    setFFarmKeyword("");
    setFMaxLayingMin("");
    setFMaxLayingMax("");
    setFExpMin("");
    setFExpMax("");
  }

  return (
    <div className="accounting-page">
      <aside className="filters-card">
        <div className="filters-title">필터</div>

        <div className="filter-group">
          <div className="filter-label">고객사명</div>
          <input className="filter-input" value={fCustomerName} onChange={(e) => setFCustomerName(e.target.value)} placeholder="고객사명" />
        </div>

        <div className="filter-group">
          <div className="filter-label">사용가능 농장(키워드 검색)</div>
          <input className="filter-input" value={fFarmKeyword} onChange={(e) => setFFarmKeyword(e.target.value)} placeholder="농장명(ID)" />
        </div>

        <div className="filter-group">
          <div className="filter-label">납고가능 일수</div>
          <div style={{ display: "flex", gap: "var(--sp-8)" }}>
            <input className="filter-input" value={fMaxLayingMin} onChange={(e) => setFMaxLayingMin(e.target.value)} placeholder="min" inputMode="numeric" />
            <input className="filter-input" value={fMaxLayingMax} onChange={(e) => setFMaxLayingMax(e.target.value)} placeholder="max" inputMode="numeric" />
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-label">유통기한</div>
          <div style={{ display: "flex", gap: "var(--sp-8)" }}>
            <input className="filter-input" value={fExpMin} onChange={(e) => setFExpMin(e.target.value)} placeholder="min" inputMode="numeric" />
            <input className="filter-input" value={fExpMax} onChange={(e) => setFExpMax(e.target.value)} placeholder="max" inputMode="numeric" />
          </div>
        </div>

        <button className="btn secondary" onClick={resetFilters} style={{ width: "100%" }}>
          필터 초기화
        </button>
      </aside>

      <section className="page-main">
        <div className="page-head">
          <h2 className="page-title">고객사정보</h2>

          <div className="head-actions">
            <button className="btn secondary" onClick={openCreate}>
              + 고객사 추가
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
            {/* ✅ '사용가능 농장' 컬럼만 더 넓게 (기존 디자인/스타일은 그대로) */}
            <colgroup>
              <col style={{ width: "clamp(170px, calc(220 * var(--ui)), 260px)" }} />
              <col style={{ width: "clamp(260px, calc(420 * var(--ui)), 520px)" }} />
              <col style={{ width: "clamp(120px, calc(150 * var(--ui)), 200px)" }} />
              <col style={{ width: "clamp(120px, calc(150 * var(--ui)), 200px)" }} />
              <col style={{ width: "clamp(130px, calc(160 * var(--ui)), 220px)" }} />
            </colgroup>
            <thead>
              <tr>
                <th>고객사명</th>
                <th>사용가능 농장</th>
                <th>납고가능 일수</th>
                <th>유통기한</th>
                <th style={{ textAlign: "center" }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="muted" style={{ padding: "var(--sp-18)" }}>
                    결과가 없습니다.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr key={r.id ?? r.customer_name}>
                    <td className="wrap-cell">{r.customer_name}</td>
                    <td className="wrap-cell">{farmsToText(r.available_farms, farmsById) || "-"}</td>
                    <td>{r.max_laying_days}</td>
                    <td>{r.expiration_date}</td>
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
              <h3 className="modal-title">{editing ? "고객사 수정" : "고객사 추가"}</h3>
              <button className="btn small secondary" onClick={closeModal}>닫기</button>
            </div>

            <form onSubmit={onSubmit}>
              <div className="modal-body">
                {formErr && <div className="field-error" style={{ marginBottom: "var(--sp-10)" }}>{formErr}</div>}

                <div className="modal-grid">
                  <div className="field">
                    <div className="filter-label">고객사명 </div>
                    <input
                      className="filter-input"
                      value={form.customer_name}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, customer_name: e.target.value }));
                        setFieldErrs((p) => ({ ...p, customer_name: "" }));
                      }}
                      placeholder="고객사명"
                    />
                    {fieldErrs.customer_name && <div className="field-error">{fieldErrs.customer_name}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">사용가능 농장</div>

                    <input
                      className="filter-input"
                      value={farmSearch}
                      onChange={(e) => setFarmSearch(e.target.value)}
                      placeholder="농장 검색 (농장명과 ID를 띄어쓰기로 키워드 검색)"
                    />

                    <div className="farm-pick-list">
                      {filteredFarmOptions.length === 0 ? (
                        <div className="muted" style={{ padding: "var(--sp-8)" }}>검색 결과가 없습니다.</div>
                      ) : (
                        filteredFarmOptions.map((f) => {
                          const checked = form.available_farms.includes(Number(f.id));
                          return (
                            <label key={f.id} className="farm-pick-item">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  const id = Number(f.id);
                                  setForm((p) => {
                                    const next = new Set(p.available_farms || []);
                                    if (next.has(id)) next.delete(id);
                                    else next.add(id);
                                    return { ...p, available_farms: Array.from(next) };
                                  });
                                  setFieldErrs((p) => ({ ...p, available_farms: "" }));
                                }}
                              />
                              <span>{(f.farm_name ?? "-") + `(${f.id})`}</span>
                            </label>
                          );
                        })
                      )}
                    </div>

                    <div className="field-help" style={{ marginTop: "var(--sp-8)" }}>선택된 농장</div>
                    <div className="farm-selected">
                      {(form.available_farms || []).length === 0 ? (
                        <span className="muted">선택 없음</span>
                      ) : (
                        (form.available_farms || [])
                          .map((id) => farmsById[String(id)] || { id, farm_name: String(id) })
                          .map((f) => (
                            <span key={f.id} className="farm-chip">
                              {(f.farm_name ?? "-") + `(${f.id})`}
                              <button
                                type="button"
                                className="farm-chip-x"
                                onClick={() => {
                                  const id = Number(f.id);
                                  setForm((p) => ({ ...p, available_farms: (p.available_farms || []).filter((x) => Number(x) !== id) }));
                                  setFieldErrs((p) => ({ ...p, available_farms: "" }));
                                }}
                                aria-label="remove"
                              >
                                ×
                              </button>
                            </span>
                          ))
                      )}
                    </div>

                    {fieldErrs.available_farms && <div className="field-error">{fieldErrs.available_farms}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">납고가능 일수 </div>
                    <input
                      className="filter-input"
                      value={form.max_laying_days}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, max_laying_days: e.target.value }));
                        setFieldErrs((p) => ({ ...p, max_laying_days: "" }));
                      }}
                      placeholder="예: 7"
                      inputMode="numeric"
                    />
                    {fieldErrs.max_laying_days && <div className="field-error">{fieldErrs.max_laying_days}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">유통기한</div>
                    <input
                      className="filter-input"
                      value={form.expiration_date}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, expiration_date: e.target.value }));
                        setFieldErrs((p) => ({ ...p, expiration_date: "" }));
                      }}
                      placeholder="예: 14"
                      inputMode="numeric"
                    />
                    {fieldErrs.expiration_date && <div className="field-error">{fieldErrs.expiration_date}</div>}
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
