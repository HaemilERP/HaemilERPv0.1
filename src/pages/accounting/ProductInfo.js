import { useCallback, useEffect, useMemo, useState } from "react";
import { listProducts, createProduct, patchProduct, deleteProduct, listCustomers } from "../../services/accountingApi";
import { includesText, matchBool, asText, parseDRFErrors } from "../../utils/helpers";
import { downloadProductListXlsx } from "../../utils/excel";
import "./AccountingTable.css";
import SearchBar from "../../components/common/SearchBar";
import Pagination from "../../components/common/Pagination";


function customerToText(customer, customers) {
  if (!customer) return "";
  // ✅ 고객사 "ID"는 화면/필터에서 불필요: 이름만 노출/검색되도록 구성
  // - customer가 객체면 이름 필드만 우선 사용
  // - 이름이 없고 id만 있다면 customers 목록에서 id로 이름을 찾아 사용
  // - 끝까지 이름을 못 찾으면 빈 문자열 반환(표시는 '-'로 처리)

  if (typeof customer === "object") {
    const name = asText(customer.customer_name ?? customer.name ?? customer.username);
    if (name) return name;
    const id = asText(customer.id);
    if (!id) return "";
    const found = Array.isArray(customers) ? customers.find((c) => asText(c?.id) === id) : null;
    return asText(found?.customer_name ?? found?.name ?? found?.username ?? "");
  }

  const id = asText(customer);
  const found = Array.isArray(customers) ? customers.find((c) => asText(c?.id) === id) : null;
  return asText(found?.customer_name ?? found?.name ?? found?.username ?? "");
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
    farm_type: "",
    egg_grade: "",
    egg_weight: "",
    process_type: "",
    // 제품 전용 필드 (고객사 필드와 별개)
    max_laying_days: "", // 납고가능(최대 산란일수)
    expiration_date: "", // 유통기한
    antibiotic_free: false,
    haccp: false,
    organic: false,
  });

  // 농장유형: 2가지로 고정
  const FARM_TYPES = ["일반농장", "동물복지농장"];

  // 난중(왕란/특란/대란/중란/소란)
  const EGG_WEIGHT_CHOICES = ["왕란", "특란", "대란", "중란", "소란"];

  // 무항생제/HACCP/유기농 필터 옵션: 유/무
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
    { value: "product_name", label: "제품명" },
    { value: "customer_name", label: "고객사명" },
    { value: "id", label: "제품ID" },
  ];
// 좌측 필터
  const [fProductName, setFProductName] = useState("");
  const [fCustomer, setFCustomer] = useState("");
  const [fProcessType, setFProcessType] = useState("");
  const [fFarmType, setFFarmType] = useState("");
  const [fEggGrade, setFEggGrade] = useState("");
  const [fMaxLayingMin, setFMaxLayingMin] = useState("");
  const [fMaxLayingMax, setFMaxLayingMax] = useState("");
  const [fExpMin, setFExpMin] = useState("");
  const [fExpMax, setFExpMax] = useState("");
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
      farm_type: "",
      egg_grade: "",
      egg_weight: "",
      process_type: "",
      max_laying_days: "",
      expiration_date: "",
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
      farm_type: row?.farm_type ?? "",
      egg_grade: row?.egg_grade ?? "",
      egg_weight: row?.egg_weight ?? "",
      process_type: row?.process_type ?? "",
      max_laying_days: row?.max_laying_days ?? "",
      expiration_date: row?.expiration_date ?? "",
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
      const product_name = String(form.product_name || "").trim();
      const customerRaw = String(form.customer ?? "").trim();
      const eggCountRaw = String(form.egg_count ?? "").trim();
      const breedingRaw = String(form.breeding_number ?? "").trim();
      const farm_type = String(form.farm_type || "").trim();
      const egg_grade = String(form.egg_grade || "").trim();
      const egg_weight = String(form.egg_weight || "").trim();
      const process_type = String(form.process_type || "").trim();
      const maxLayingRaw = String(form.max_laying_days ?? "").trim();
      const expirationRaw = String(form.expiration_date ?? "").trim();

      const customer = Number(customerRaw);
      const egg_count = Number(eggCountRaw);
      const breeding_number = Number(breedingRaw);
      const max_laying_days = maxLayingRaw === "" ? null : Number(maxLayingRaw);
      const expiration_date = expirationRaw === "" ? null : Number(expirationRaw);

      const payload = {
        product_name,
        customer,
        egg_count,
        breeding_number,
        farm_type,
        egg_grade,
        egg_weight,
        process_type,
        // 제품 전용 필드
        max_laying_days,
        expiration_date,
        antibiotic_free: Boolean(form.antibiotic_free),
        haccp: Boolean(form.haccp),
        organic: Boolean(form.organic),
      };

      const nextErrs = {};
      if (!product_name) nextErrs.product_name = "제품명을 입력해주세요.";
      if (!customerRaw || !Number.isFinite(customer) || customer <= 0) nextErrs.customer = "고객사를 선택해주세요.";
      if (!eggCountRaw || !Number.isFinite(egg_count)) nextErrs.egg_count = "계란수를 숫자로 입력해주세요.";
      if (!breedingRaw || !Number.isFinite(breeding_number)) nextErrs.breeding_number = "사육번호를 숫자로 입력해주세요.";
      if (!farm_type) nextErrs.farm_type = "농장유형을 선택해주세요.";
      if (!egg_grade) nextErrs.egg_grade = "계란등급을 입력해주세요.";
      if (!egg_weight) nextErrs.egg_weight = "난중을 선택해주세요.";
      if (!process_type) nextErrs.process_type = "가공여부를 입력해주세요.";
      if (maxLayingRaw !== "" && !Number.isFinite(max_laying_days)) nextErrs.max_laying_days = "납고가능 일수를 숫자로 입력해주세요.";
      if (expirationRaw !== "" && !Number.isFinite(expiration_date)) nextErrs.expiration_date = "유통기한 값을 숫자로 입력해주세요.";

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

  function onExcelExport() {
    const body = filtered.map((r) => [
      r?.id ?? "",
      r?.product_name ?? "",
      r?.customer ?? "",
      r?.egg_count ?? "",
      r?.breeding_number ?? "",
      r?.farm_type ?? "",
      r?.egg_grade ?? "",
      r?.egg_weight ?? "",
      r?.process_type ?? "",
      r?.max_laying_days ?? "",
      r?.expiration_date ?? "",
      r?.antibiotic_free ? "유" : "무",
      r?.haccp ? "유" : "무",
      r?.organic ? "유" : "무",
    ]);

    downloadProductListXlsx(body);
  }

  const filtered = useMemo(() => {
    const q = searchText.trim();
    const minLay = fMaxLayingMin === "" ? null : Number(fMaxLayingMin);
    const maxLay = fMaxLayingMax === "" ? null : Number(fMaxLayingMax);
    const minExp = fExpMin === "" ? null : Number(fExpMin);
    const maxExp = fExpMax === "" ? null : Number(fExpMax);

    return rows.filter((r) => {
      const customerText = customerToText(r.customer, customers);

      // 좌측 필터
      if (fProductName && !includesText(r.product_name, fProductName)) return false;
      if (fCustomer && !includesText(customerText, fCustomer)) return false;
      if (fProcessType && !includesText(r.process_type, fProcessType)) return false;
      if (fFarmType && !includesText(r.farm_type, fFarmType)) return false;
      if (fEggGrade && !includesText(r.egg_grade, fEggGrade)) return false;
      if (!matchBool(r.antibiotic_free, fAntibioticFree)) return false;
      if (!matchBool(r.haccp, fHaccp)) return false;
      if (!matchBool(r.organic, fOrganic)) return false;
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
          includesText(r.product_name, q) ||
          includesText(asText(r.id), q) ||
          includesText(customerText, q) ||
          includesText(r.egg_count, q) ||
          includesText(r.breeding_number, q) ||
          includesText(r.farm_type, q) ||
          includesText(r.egg_grade, q) ||
          includesText(r.egg_weight, q) ||
          includesText(r.process_type, q)
        );
      }
      if (searchField === "customer_name") return includesText(customerText, q);
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
    fFarmType,
    fEggGrade,
    fMaxLayingMin,
    fMaxLayingMax,
    fExpMin,
    fExpMax,
    fAntibioticFree,
    fHaccp,
    fOrganic,
  ]);

  // 필터/검색이 바뀌면 첫 페이지로
  useEffect(() => {
    setPage(1);
  }, [searchField, searchText, fProductName, fCustomer, fProcessType, fFarmType, fEggGrade, fMaxLayingMin, fMaxLayingMax, fExpMin, fExpMax, fAntibioticFree, fHaccp, fOrganic]);

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
    setFProductName("");
    setFCustomer("");
    setFProcessType("");
    setFFarmType("");
    setFEggGrade("");
    setFMaxLayingMin("");
    setFMaxLayingMax("");
    setFExpMin("");
    setFExpMax("");
    setFAntibioticFree("");
    setFHaccp("");
    setFOrganic("");
  }

  return (
    <div className="accounting-page product-info-page">
      <aside className="filters-card">
        <div className="filters-title">필터</div>

        <div className="filter-group">
          <div className="filter-label">제품명</div>
          <input className="filter-input" value={fProductName} onChange={(e) => setFProductName(e.target.value)} placeholder="제품명" />
        </div>

        <div className="filter-group">
          <div className="filter-label">고객사</div>
          <input className="filter-input" value={fCustomer} onChange={(e) => setFCustomer(e.target.value)} placeholder="고객사명" />
        </div>

        <div className="filter-group">
          <div className="filter-label">가공여부</div>
          <input className="filter-input" value={fProcessType} onChange={(e) => setFProcessType(e.target.value)} placeholder="process_type" />
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
          <div className="filter-label">계란등급</div>
          <input className="filter-input" value={fEggGrade} onChange={(e) => setFEggGrade(e.target.value)} placeholder="A/B..." />
        </div>

        <div className="filter-group">
          <div className="filter-label">납고가능 일수</div>
          <div style={{ display: "flex", gap: "var(--sp-8)" }}>
            <input className="filter-input" value={fMaxLayingMin} onChange={(e) => setFMaxLayingMin(e.target.value)} placeholder="min" inputMode="numeric" />
            <input className="filter-input" value={fMaxLayingMax} onChange={(e) => setFMaxLayingMax(e.target.value)} placeholder="max" inputMode="numeric" />
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-label">유통기한(일)</div>
          <div style={{ display: "flex", gap: "var(--sp-8)" }}>
            <input className="filter-input" value={fExpMin} onChange={(e) => setFExpMin(e.target.value)} placeholder="min" inputMode="numeric" />
            <input className="filter-input" value={fExpMax} onChange={(e) => setFExpMax(e.target.value)} placeholder="max" inputMode="numeric" />
          </div>
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

        <div className="table-wrap no-x">
          <table className="data-table product-table">
            <colgroup>
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "12%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>제품</th>
                <th>고객사</th>
                <th>계란수</th>
                <th>사육번호</th>
                <th>농장유형</th>
                <th>계란등급</th>
                <th>난중</th>
                <th>가공여부</th>
                <th>무항생제</th>
                <th>HACCP</th>
                <th>유기농</th>
                <th>납고가능 일수</th>
                <th>유통기한</th>
                <th style={{ textAlign: "center" }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {!loading && filtered.length === 0 ? (
                <tr>
                  <td colSpan={14} className="muted" style={{ padding: "var(--sp-18)" }}>
                    결과가 없습니다.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr key={r.id ?? `${r.product_name}-${customerToText(r.customer, customers)}`}>
                    <td className="wrap-cell">{`${r.product_name ?? ""}(${r.id ?? ""})`}</td>
                    <td className="wrap-cell">{customerToText(r.customer, customers) || "-"}</td>
                    <td>{r.egg_count}</td>
                    <td>{r.breeding_number}</td>
                    <td>{r.farm_type}</td>
                    <td>{r.egg_grade}</td>
                    <td>{r.egg_weight}</td>
                    <td>{r.process_type}</td>
                    <td><span className={`badge ${r.antibiotic_free ? "ok" : "no"}`}>{r.antibiotic_free ? "유" : "무"}</span></td>
                    <td><span className={`badge ${r.haccp ? "ok" : "no"}`}>{r.haccp ? "유" : "무"}</span></td>
                    <td><span className={`badge ${r.organic ? "ok" : "no"}`}>{r.organic ? "유" : "무"}</span></td>
                  <td className="num-cell" style={{ textAlign: "left" }}>{r.max_laying_days ?? "-"}</td>
                  <td className="num-cell" style={{ textAlign: "left" }}>{r.expiration_date ?? "-"}</td>
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
              <h3 className="modal-title">{editing ? "제품 수정" : "제품 추가"}</h3>
              <button className="btn small secondary" onClick={closeModal}>닫기</button>
            </div>

            <form onSubmit={onSubmit}>
              <div className="modal-body">
                {formErr && <div className="field-error" style={{ marginBottom: "var(--sp-10)" }}>{formErr}</div>}

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
                    <div className="filter-label">계란수</div>
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
                    <div className="filter-label">사육번호</div>
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
                    <div className="filter-label">계란등급</div>
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
                    <div className="filter-label">난중</div>
                    <select
                      className="filter-select"
                      value={form.egg_weight}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, egg_weight: e.target.value }));
                        setFieldErrs((p) => ({ ...p, egg_weight: "" }));
                      }}
                    >
                      <option value="">선택</option>
                      {EGG_WEIGHT_CHOICES.map((w) => (
                        <option key={w} value={w}>{w}</option>
                      ))}
                    </select>
                    {fieldErrs.egg_weight && <div className="field-error">{fieldErrs.egg_weight}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">가공여부</div>
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

                  <div className="field">
                    <div className="filter-label">납고가능 일수</div>
                    <input
                      className="filter-input"
                      value={form.max_laying_days}
                      onChange={(e) => {
                        setForm((p) => ({ ...p, max_laying_days: e.target.value }));
                        setFieldErrs((p) => ({ ...p, max_laying_days: "" }));
                      }}
                      placeholder="예: 30"
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
                      placeholder="예: 45"
                      inputMode="numeric"
                    />
                    {fieldErrs.expiration_date && <div className="field-error">{fieldErrs.expiration_date}</div>}
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
