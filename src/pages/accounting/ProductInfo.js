
import { useEffect, useMemo, useState } from "react";
import { listProducts, createProduct, patchProduct, deleteProduct, listCustomers } from "../../services/accountingApi";
import { BOOL_OPTIONS, includesText, matchBool, farmsToText, asText, parseDRFErrors } from "../../utils/helpers";
import "./AccountingTable.css";
import SearchBar from "../../components/common/SearchBar";


function customerToText(customer, customers) {
  if (!customer) return "";
  if (typeof customer === "object") return asText(customer.customer_name ?? customer.name ?? customer.username ?? customer.id);
  const id = asText(customer);
  const found = Array.isArray(customers) ? customers.find((c) => asText(c?.id) === id) : null;
  return asText(found?.customer_name ?? found?.name ?? found?.username ?? id);
}


export default function ProductInfo() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // CRUD
  const [customers, setCustomers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [fieldErrs, setFieldErrs] = useState({});
  const [form, setForm] = useState({
    product_name: "",
    customer: "", // id
    egg_count: "",
    breeding_number: "",
    egg_type: "",
    egg_grade: "",
    egg_weight: "",
    process_type: "",
    antibiotic_free: false,
    haccp: false,
    organic: false,
  });

  // 상단 검색
  const [searchField, setSearchField] = useState("all");
  const [searchText, setSearchText] = useState("");

  

  const SEARCH_FIELDS = [
    { value: "all", label: "전체" },
    { value: "product_name", label: "제품명" },
    { value: "customer_name", label: "고객사명" },
    { value: "id", label: "ID" },
  ];
// 좌측 필터
  const [fProductName, setFProductName] = useState("");
  const [fCustomer, setFCustomer] = useState("");
  const [fProcessType, setFProcessType] = useState("");
  const [fEggType, setFEggType] = useState("");
  const [fEggGrade, setFEggGrade] = useState("");
  const [fAntibioticFree, setFAntibioticFree] = useState("");
  const [fHaccp, setFHaccp] = useState("");
  const [fOrganic, setFOrganic] = useState("");

  const fetchRows = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await listProducts();
      setRows(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "제품 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };


  // ✅ 검색 클릭/엔터 시마다 서버에서 다시 목록 갱신
  const onSearch = async () => {
    await fetchRows();
  };

  const fetchCustomers = async () => {
    try {
      const data = await listCustomers();
      setCustomers(data);
    } catch {
      // 보조데이터
    }
  };

  useEffect(() => {
    fetchRows();
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toCustomerId(c) {
    if (!c) return "";
    if (typeof c === "number") return String(c);
    if (typeof c === "string") return c;
    if (typeof c === "object") return c.id != null ? String(c.id) : "";
    return "";
  }

  function openCreate() {
    setEditing(null);
    setFormErr("");
    setFieldErrs({});
    setForm({
      product_name: "",
      customer: "",
      egg_count: "",
      breeding_number: "",
      egg_type: "",
      egg_grade: "",
      egg_weight: "",
      process_type: "",
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
      product_name: row?.product_name ?? "",
      customer: toCustomerId(row?.customer),
      egg_count: row?.egg_count ?? "",
      breeding_number: row?.breeding_number ?? "",
      egg_type: row?.egg_type ?? "",
      egg_grade: row?.egg_grade ?? "",
      egg_weight: row?.egg_weight ?? "",
      process_type: row?.process_type ?? "",
      antibiotic_free: Boolean(row?.antibiotic_free),
      haccp: Boolean(row?.haccp),
      organic: Boolean(row?.organic),
    });
    setModalOpen(true);
  }

  function closeModal() {
    if (submitting) return;
    setModalOpen(false);
  }

  async function onSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setFormErr("");
    setFieldErrs({});

    try {
      const payload = {
        product_name: form.product_name,
        customer: Number(form.customer),
        egg_count: Number(form.egg_count),
        breeding_number: Number(form.breeding_number),
        egg_type: form.egg_type,
        egg_grade: form.egg_grade,
        egg_weight: Number(form.egg_weight),
        process_type: form.process_type,
        antibiotic_free: Boolean(form.antibiotic_free),
        haccp: Boolean(form.haccp),
        organic: Boolean(form.organic),
      };

      const nextErrs = {};
      if (!payload.product_name?.trim()) nextErrs.product_name = "제품명을 입력해주세요.";
      if (!Number.isFinite(payload.customer)) nextErrs.customer = "고객사를 선택해주세요.";
      if (!Number.isFinite(payload.egg_count)) nextErrs.egg_count = "계란수(egg_count)를 숫자로 입력해주세요.";
      if (!Number.isFinite(payload.breeding_number)) nextErrs.breeding_number = "사육번호를 숫자로 입력해주세요.";
      if (!payload.egg_type?.trim()) nextErrs.egg_type = "계란 구분(egg_type)을 입력해주세요.";
      if (!payload.egg_grade?.trim()) nextErrs.egg_grade = "계란 등급(egg_grade)을 입력해주세요.";
      if (!Number.isFinite(payload.egg_weight)) nextErrs.egg_weight = "난중(egg_weight)을 숫자로 입력해주세요.";
      if (!payload.process_type?.trim()) nextErrs.process_type = "가공여부(process_type)를 입력해주세요.";
      if (Object.keys(nextErrs).length) {
        setFieldErrs(nextErrs);
        return;
      }

      if (editing?.id != null) {
        await patchProduct(editing.id, payload);
      } else {
        await createProduct(payload);
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
    const ok = window.confirm(`'${row?.product_name ?? ""}' 제품을 삭제할까요?`);
    if (!ok) return;
    try {
      await deleteProduct(row.id);
      setRows((prev) => prev.filter((r) => r?.id !== row.id));
    } catch (e) {
      alert(e?.response?.data?.detail || "삭제에 실패했습니다.");
    }
  }

  const filtered = useMemo(() => {
    const q = searchText.trim();

    return rows.filter((r) => {
      const farmsText = farmsToText(r.available_farms);
      const customerText = customerToText(r.customer, customers);

      // 좌측 필터
      if (fProductName && !includesText(r.product_name, fProductName)) return false;
      if (fCustomer && !includesText(customerText, fCustomer)) return false;
      if (fProcessType && !includesText(r.process_type, fProcessType)) return false;
      if (fEggType && !includesText(r.egg_type, fEggType)) return false;
      if (fEggGrade && !includesText(r.egg_grade, fEggGrade)) return false;
      if (!matchBool(r.antibiotic_free, fAntibioticFree)) return false;
      if (!matchBool(r.haccp, fHaccp)) return false;
      if (!matchBool(r.organic, fOrganic)) return false;

      // 상단 검색
      if (!q) return true;
      if (searchField === "all") {
        return (
          includesText(r.product_name, q) ||
          includesText(customerText, q) ||
          includesText(r.egg_count, q) ||
          includesText(r.breeding_number, q) ||
          includesText(r.egg_type, q) ||
          includesText(r.egg_grade, q) ||
          includesText(r.egg_weight, q) ||
          includesText(r.process_type, q) ||
          includesText(farmsText, q)
        );
      }
      if (searchField === "customer_name") return includesText(customerText, q);
      if (searchField === "available_farms") return includesText(farmsText, q);
      return includesText(r[searchField], q);
    });
  }, [
    rows,
    searchField,
    searchText,
    customers,
    fProductName,
    fCustomer,
    fProcessType,
    fEggType,
    fEggGrade,
    fAntibioticFree,
    fHaccp,
    fOrganic,
  ]);

  function resetFilters() {
    setSearchField("all");
    setSearchText("");
    setFProductName("");
    setFCustomer("");
    setFProcessType("");
    setFEggType("");
    setFEggGrade("");
    setFAntibioticFree("");
    setFHaccp("");
    setFOrganic("");
  }

  return (
    <div className="accounting-page">
      <aside className="filters-card">
        <div className="filters-title">필터</div>

        <div className="filter-group">
          <div className="filter-label">제품명</div>
          <input className="filter-input" value={fProductName} onChange={(e) => setFProductName(e.target.value)} placeholder="제품명" />
        </div>

        <div className="filter-group">
          <div className="filter-label">고객사</div>
          <input className="filter-input" value={fCustomer} onChange={(e) => setFCustomer(e.target.value)} placeholder="고객사명/ID" />
        </div>

        <div className="filter-group">
          <div className="filter-label">가공여부 (생란/구운란 등)</div>
          <input className="filter-input" value={fProcessType} onChange={(e) => setFProcessType(e.target.value)} placeholder="process_type" />
        </div>

        <div className="filter-group">
          <div className="filter-label">계란 구분</div>
          <input className="filter-input" value={fEggType} onChange={(e) => setFEggType(e.target.value)} placeholder="일반/동물복지..." />
        </div>

        <div className="filter-group">
          <div className="filter-label">계란 등급</div>
          <input className="filter-input" value={fEggGrade} onChange={(e) => setFEggGrade(e.target.value)} placeholder="A/B..." />
        </div>

        <div className="filter-group">
          <div className="filter-label">무항생제</div>
          <select className="filter-select" value={fAntibioticFree} onChange={(e) => setFAntibioticFree(e.target.value)}>
            {BOOL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">HACCP</div>
          <select className="filter-select" value={fHaccp} onChange={(e) => setFHaccp(e.target.value)}>
            {BOOL_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">유기농</div>
          <select className="filter-select" value={fOrganic} onChange={(e) => setFOrganic(e.target.value)}>
            {BOOL_OPTIONS.map((o) => (
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
          <h2 className="page-title">제품정보</h2>

          <div className="head-actions">
            <button className="btn secondary" onClick={openCreate}>
              + 제품 추가
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

        <div className="muted" style={{ marginBottom: 10 }}>
          {loading ? "불러오는 중..." : err ? err : `총 ${filtered.length}건`}
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>제품명</th>
                <th>고객사</th>
                <th>계란수</th>
                <th>사육번호</th>
                <th>계란구분</th>
                <th>등급</th>
                <th>난중</th>
                <th>가공여부</th>
                <th>무항생제</th>
                <th>HACCP</th>
                <th>유기농</th>
                <th>납고가능</th>
                <th>유통기한</th>
                <th style={{ textAlign: "right" }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} className="muted" style={{ padding: 18 }}>
                    결과가 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id ?? `${r.product_name}-${customerToText(r.customer, customers)}`}>
                    <td>{r.product_name}</td>
                    <td>{customerToText(r.customer, customers) || "-"}</td>
                    <td>{r.egg_count}</td>
                    <td>{r.breeding_number}</td>
                    <td>{r.egg_type}</td>
                    <td>{r.egg_grade}</td>
                    <td>{r.egg_weight}</td>
                    <td>{r.process_type}</td>
                    <td><span className={`badge ${r.antibiotic_free ? "ok" : "no"}`}>{r.antibiotic_free ? "예" : "아니오"}</span></td>
                    <td><span className={`badge ${r.haccp ? "ok" : "no"}`}>{r.haccp ? "예" : "아니오"}</span></td>
                    <td><span className={`badge ${r.organic ? "ok" : "no"}`}>{r.organic ? "예" : "아니오"}</span></td>
                    <td>{r.max_laying_days ?? "-"}</td>
                    <td>{r.expiration_date ?? "-"}</td>
                    <td style={{ textAlign: "right" }}>
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

      </section>

      {modalOpen && (
        <div className="modal-overlay" onMouseDown={closeModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="modal-title">{editing ? "제품 수정" : "제품 추가"}</h3>
              <button className="btn small secondary" onClick={closeModal}>닫기</button>
            </div>

            <form onSubmit={onSubmit}>
              <div className="modal-body">
                {formErr && <div className="field-error" style={{ marginBottom: 10 }}>{formErr}</div>}

                <div className="modal-grid">
                  <div className="field">
                    <div className="filter-label">제품명 </div>
                    <input
                      className="filter-input"
                      value={form.product_name}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, product_name: e.target.value }));
                        setFieldErrs((p) => ({ ...p, product_name: "" }));
                      }}
                      placeholder="제품명"
                    />
                    {fieldErrs.product_name && <div className="field-error">{fieldErrs.product_name}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">고객사 </div>
                    <select
                      className="filter-select"
                      value={form.customer}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, customer: e.target.value }));
                        setFieldErrs((p) => ({ ...p, customer: "" }));
                      }}
                    >
                      <option value="">선택</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.customer_name} (ID:{c.id})
                        </option>
                      ))}
                    </select>
                    {fieldErrs.customer && <div className="field-error">{fieldErrs.customer}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">계란수(egg_count) </div>
                    <input
                      className="filter-input"
                      value={form.egg_count}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, egg_count: e.target.value }));
                        setFieldErrs((p) => ({ ...p, egg_count: "" }));
                      }}
                      placeholder="예: 10"
                      inputMode="numeric"
                    />
                    {fieldErrs.egg_count && <div className="field-error">{fieldErrs.egg_count}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">사육번호(breeding_number) </div>
                    <input
                      className="filter-input"
                      value={form.breeding_number}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, breeding_number: e.target.value }));
                        setFieldErrs((p) => ({ ...p, breeding_number: "" }));
                      }}
                      placeholder="예: 1"
                      inputMode="numeric"
                    />
                    {fieldErrs.breeding_number && <div className="field-error">{fieldErrs.breeding_number}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">계란구분(egg_type) </div>
                    <input
                      className="filter-input"
                      value={form.egg_type}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, egg_type: e.target.value }));
                        setFieldErrs((p) => ({ ...p, egg_type: "" }));
                      }}
                      placeholder="일반/동물복지"
                    />
                    {fieldErrs.egg_type && <div className="field-error">{fieldErrs.egg_type}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">등급(egg_grade) </div>
                    <input
                      className="filter-input"
                      value={form.egg_grade}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, egg_grade: e.target.value }));
                        setFieldErrs((p) => ({ ...p, egg_grade: "" }));
                      }}
                      placeholder="A/B"
                    />
                    {fieldErrs.egg_grade && <div className="field-error">{fieldErrs.egg_grade}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">난중(egg_weight) </div>
                    <input
                      className="filter-input"
                      value={form.egg_weight}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, egg_weight: e.target.value }));
                        setFieldErrs((p) => ({ ...p, egg_weight: "" }));
                      }}
                      placeholder="예: 60"
                      inputMode="numeric"
                    />
                    {fieldErrs.egg_weight && <div className="field-error">{fieldErrs.egg_weight}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">가공여부(process_type) </div>
                    <input
                      className="filter-input"
                      value={form.process_type}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, process_type: e.target.value }));
                        setFieldErrs((p) => ({ ...p, process_type: "" }));
                      }}
                      placeholder="생란/구운란"
                    />
                    {fieldErrs.process_type && <div className="field-error">{fieldErrs.process_type}</div>}
                  </div>

                  <div className="field" style={{ gridColumn: "1 / -1" }}>
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
