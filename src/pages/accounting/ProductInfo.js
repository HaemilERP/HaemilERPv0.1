import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createProduct,
  deleteProduct,
  listCustomers,
  listProducts,
  patchProduct,
} from "../../services/accountingApi";
import {
  asText,
  getApiErrorMessage,
  getIdentifierLabel,
  includesText,
  matchBool,
  normalizeFarmType,
  parseDRFErrors,
} from "../../utils/helpers";
import { downloadProductListXlsx } from "../../utils/excel";
import "./AccountingTable.css";
import SearchBar from "../../components/common/SearchBar";
import Pagination from "../../components/common/Pagination";

const FARM_TYPES = ["", "일반농장", "동물복지농장"];
const EGG_WEIGHT_CHOICES = ["", "왕란", "특란", "대란", "중란", "소란"];
const FLAG_OPTIONS = [
  { value: "", label: "전체" },
  { value: "true", label: "유" },
  { value: "false", label: "무" },
];

const EGG_GRADE_CHOICES = ["무", "1", "1+", "기타"];
const EGG_GRADE_FILTER_OPTIONS = ["", ...EGG_GRADE_CHOICES];
const EGG_TYPE_CHOICES = ["구운란", "생란", "액란", "기타"];
const EGG_TYPE_FILTER_OPTIONS = ["", ...EGG_TYPE_CHOICES];
const PRODUCT_TABLE_COL_WIDTHS = [
  "6%",  // 제품식별자
  "11%", // 제품명
  "10%", // 고객사
  "5%",  // 계란수
  "8%", // 사육번호목록
  "7%",  // 농장유형
  "5%",  // 계란등급
  "5%",  // 중량
  "6%",  // 계란유형
  "7%",  // 최대산란일수
  "5%",  // 유통기한
  "5%",  // 무항생제
  "5%",  // HACCP
  "5%",  // 유기농
  "10%",  // 관리
];

function normalizeEggGrade(value) {
  const v = String(value ?? "").trim();
  if (!v || v === "무") return "무";
  if (v === "1") return "1";
  if (v === "1+") return "1+";
  if (v === "기타") return "기타";
  return "기타";
}

function normalizeEggType(value) {
  const v = String(value ?? "").trim();
  if (!v) return "생란";
  if (EGG_TYPE_CHOICES.includes(v)) return v;
  return "기타";
}

function toPk(v) {
  if (v == null) return "";
  if (typeof v === "object") return String(v.id ?? v.pk ?? "");
  return String(v);
}

function toCustomerLabel(customer) {
  const code = getIdentifierLabel(customer, ["customer_code", "customer_id"], []);
  const name = asText(customer?.customer_name);
  if (name && code) return `${name} (${code})`;
  return name || code || "-";
}

function toCustomerName(customer) {
  return asText(customer?.customer_name) || "-";
}

function toProductLabel(product) {
  const code = getIdentifierLabel(product, ["product_no", "product_id"], ["id"]);
  const name = asText(product?.product_name);
  if (name && code) return `${name} (${code})`;
  return name || code || "-";
}

function toNumberArray(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .filter((v) => v !== "")
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
}

function toIntegerFilterTokens(text) {
  const raw = String(text || "").trim();
  if (!raw) return [];
  return Array.from(new Set(raw.split(/\s+/).map((v) => Number(v)).filter((v) => Number.isInteger(v))));
}

function toBreedingNumbers(value) {
  if (Array.isArray(value)) {
    return Array.from(
      new Set(
        value
          .map((v) => Number(v))
          .filter((v) => Number.isInteger(v))
      )
    );
  }
  return Array.from(new Set(toNumberArray(value).filter((v) => Number.isInteger(v))));
}

function toBreedingText(value) {
  if (Array.isArray(value)) return value.join(", ");
  return asText(value);
}

function toFilterNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export default function ProductInfo() {
  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [fieldErrs, setFieldErrs] = useState({});
  const [form, setForm] = useState({
    product_no: "",
    product_name: "",
    customer: "",
    egg_count: "",
    breeding_number_text: "",
    farm_type: "",
    egg_grade: "무",
    egg_weight: "",
    process_type: "생란",
    max_laying_days: "",
    expiration_date: "",
    antibiotic_free: false,
    haccp: false,
    organic: false,
  });

  const [searchField, setSearchField] = useState("all");
  const [searchText, setSearchText] = useState("");

  const [fFarmType, setFFarmType] = useState("");
  const [fEggGrade, setFEggGrade] = useState("");
  const [fEggWeight, setFEggWeight] = useState("");
  const [fEggType, setFEggType] = useState("");
  const [fCustomer, setFCustomer] = useState("");
  const [fBreedingNumber, setFBreedingNumber] = useState("");
  const [fMaxLayingDaysMin, setFMaxLayingDaysMin] = useState("");
  const [fMaxLayingDaysMax, setFMaxLayingDaysMax] = useState("");
  const [fExpirationDateMin, setFExpirationDateMin] = useState("");
  const [fExpirationDateMax, setFExpirationDateMax] = useState("");
  const [fAntibioticFree, setFAntibioticFree] = useState("");
  const [fHaccp, setFHaccp] = useState("");
  const [fOrganic, setFOrganic] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const SEARCH_FIELDS = [
    { value: "all", label: "전체" },
    { value: "product_no", label: "제품식별자" },
    { value: "product_name", label: "제품명" },
  ];

  const customersByPk = useMemo(() => {
    const m = {};
    (customers || []).forEach((c) => {
      const pk = toPk(c);
      if (pk) m[pk] = c;
    });
    return m;
  }, [customers]);

  async function fetchRows() {
    setLoading(true);
    setErr("");
    try {
      const [productsData, customersData] = await Promise.all([listProducts(), listCustomers()]);
      setRows(productsData);
      setCustomers(customersData);
    } catch (e) {
      setErr(getApiErrorMessage(e, "제품 목록을 불러오지 못했습니다."));
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
      product_no: "",
      product_name: "",
      customer: "",
      egg_count: "",
      breeding_number_text: "",
      farm_type: "",
      egg_grade: "무",
      egg_weight: "",
      process_type: "생란",
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
      product_no: asText(row?.product_no || row?.product_id),
      product_name: asText(row?.product_name),
      customer: toPk(row?.customer),
      egg_count: row?.egg_count == null ? "" : String(row.egg_count),
      breeding_number_text: toBreedingText(row?.breeding_number),
      farm_type: normalizeFarmType(row?.farm_type),
      egg_grade: normalizeEggGrade(row?.egg_grade),
      egg_weight: asText(row?.egg_weight),
      process_type: normalizeEggType(row?.process_type),
      max_laying_days: row?.max_laying_days == null ? "" : String(row.max_laying_days),
      expiration_date: row?.expiration_date == null ? "" : String(row.expiration_date),
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
      const customerPk = Number(form.customer);
      const eggCount = Number(form.egg_count);
      const maxLaying = form.max_laying_days === "" ? null : Number(form.max_laying_days);
      const expiration = form.expiration_date === "" ? null : Number(form.expiration_date);
      const breedingNumbers = toNumberArray(form.breeding_number_text);

      const payload = {
        product_no: String(form.product_no || "").trim(),
        product_name: String(form.product_name || "").trim(),
        customer: customerPk,
        egg_count: eggCount,
        breeding_number: breedingNumbers,
        farm_type: normalizeFarmType(String(form.farm_type || "").trim()),
        egg_grade: normalizeEggGrade(form.egg_grade),
        egg_weight: String(form.egg_weight || "").trim(),
        process_type: normalizeEggType(form.process_type),
        max_laying_days: maxLaying,
        expiration_date: expiration,
        antibiotic_free: Boolean(form.antibiotic_free),
        haccp: Boolean(form.haccp),
        organic: Boolean(form.organic),
      };

      const nextErrs = {};
      if (!payload.product_no) nextErrs.product_no = "제품식별자(product_no)를 입력해주세요.";
      if (!payload.product_name) nextErrs.product_name = "제품명을 입력해주세요.";
      if (!Number.isFinite(customerPk)) nextErrs.customer = "고객사를 선택해주세요.";
      if (!Number.isFinite(eggCount)) nextErrs.egg_count = "계란수는 숫자로 입력해주세요.";
      if (!payload.farm_type) nextErrs.farm_type = "농장유형을 선택해주세요.";
      if (!payload.egg_weight) nextErrs.egg_weight = "중량을 선택해주세요.";
      if (!payload.process_type) nextErrs.process_type = "계란유형을 선택해주세요.";
      if (form.max_laying_days !== "" && !Number.isFinite(maxLaying)) nextErrs.max_laying_days = "최대산란일수는 숫자여야 합니다.";
      if (form.expiration_date !== "" && !Number.isFinite(expiration)) nextErrs.expiration_date = "유통기한은 숫자여야 합니다.";
      if (Object.keys(nextErrs).length) {
        setFieldErrs(nextErrs);
        return;
      }

      if (editing?.id != null) await patchProduct(editing.id, payload);
      else await createProduct(payload);

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
    const ok = window.confirm(`'${toProductLabel(row)}' 제품을 삭제할까요?`);
    if (!ok) return;
    try {
      await deleteProduct(row.id);
      setRows((prev) => prev.filter((r) => r?.id !== row.id));
    } catch (e) {
      window.alert(getApiErrorMessage(e, "삭제에 실패했습니다."));
    }
  }

  function onExcelExport() {
    const body = filtered.map((r) => [
      r?.product_no ?? r?.product_id ?? "",
      r?.product_name ?? "",
      getIdentifierLabel(customersByPk[toPk(r?.customer)] || {}, ["customer_code", "customer_id"], [toPk(r?.customer)]),
      r?.egg_count ?? "",
      Array.isArray(r?.breeding_number) ? r.breeding_number.join(",") : asText(r?.breeding_number),
      normalizeFarmType(r?.farm_type),
      normalizeEggGrade(r?.egg_grade),
      r?.egg_weight ?? "",
      normalizeEggType(r?.process_type),
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
    const breedingFilterTokens = toIntegerFilterTokens(fBreedingNumber);
    const maxLayingMin = toFilterNumber(fMaxLayingDaysMin);
    const maxLayingMax = toFilterNumber(fMaxLayingDaysMax);
    const expirationMin = toFilterNumber(fExpirationDateMin);
    const expirationMax = toFilterNumber(fExpirationDateMax);

    return (rows || []).filter((r) => {
      const customer = customersByPk[toPk(r?.customer)] || (typeof r?.customer === "object" ? r.customer : null);
      const customerLabel = toCustomerLabel(customer || { customer_code: toPk(r?.customer) });
      const productNo = asText(r?.product_no ?? r?.product_id);
      const productName = asText(r?.product_name);
      const breedingNumbers = toBreedingNumbers(r?.breeding_number);
      const eggType = normalizeEggType(r?.process_type);
      const farmType = normalizeFarmType(r?.farm_type);
      const maxLayingDaysValue = Number(r?.max_laying_days);
      const expirationDateValue = Number(r?.expiration_date);
      const eggWeight = asText(r?.egg_weight);
      const customerPk = toPk(r?.customer);

      if (fCustomer && customerPk !== fCustomer) return false;
      if (breedingFilterTokens.length && !breedingFilterTokens.some((token) => breedingNumbers.includes(token))) return false;

      if (fFarmType && farmType !== fFarmType) return false;
      if (fEggGrade && normalizeEggGrade(r?.egg_grade) !== fEggGrade) return false;
      if (fEggWeight && eggWeight !== fEggWeight) return false;
      if (fEggType && eggType !== fEggType) return false;
      if (maxLayingMin != null && (!Number.isFinite(maxLayingDaysValue) || maxLayingDaysValue < maxLayingMin)) return false;
      if (maxLayingMax != null && (!Number.isFinite(maxLayingDaysValue) || maxLayingDaysValue > maxLayingMax)) return false;
      if (expirationMin != null && (!Number.isFinite(expirationDateValue) || expirationDateValue < expirationMin)) return false;
      if (expirationMax != null && (!Number.isFinite(expirationDateValue) || expirationDateValue > expirationMax)) return false;
      if (!matchBool(r?.antibiotic_free, fAntibioticFree)) return false;
      if (!matchBool(r?.haccp, fHaccp)) return false;
      if (!matchBool(r?.organic, fOrganic)) return false;

      if (!q) return true;
      if (searchField === "product_no") return includesText(r?.product_no ?? r?.product_id, q);
      if (searchField === "product_name") return includesText(r?.product_name, q);

      return (
        includesText(productNo, q) ||
        includesText(productName, q) ||
        includesText(customerLabel, q) ||
        includesText(eggType, q)
      );
    });
  }, [
    rows,
    customersByPk,
    searchField,
    searchText,
    fCustomer,
    fBreedingNumber,
    fFarmType,
    fEggGrade,
    fEggWeight,
    fEggType,
    fMaxLayingDaysMin,
    fMaxLayingDaysMax,
    fExpirationDateMin,
    fExpirationDateMax,
    fAntibioticFree,
    fHaccp,
    fOrganic,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    searchField,
    searchText,
    fCustomer,
    fBreedingNumber,
    fFarmType,
    fEggGrade,
    fEggWeight,
    fEggType,
    fMaxLayingDaysMin,
    fMaxLayingDaysMax,
    fExpirationDateMin,
    fExpirationDateMax,
    fAntibioticFree,
    fHaccp,
    fOrganic,
  ]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length]);
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  return (
    <div className="accounting-page product-info-page">
      <aside className="filters-card">
        <div className="filters-title">필터</div>

        <div className="filter-group">
          <div className="filter-label">고객사</div>
          <select className="filter-select" value={fCustomer} onChange={(e) => setFCustomer(e.target.value)}>
            <option value="">전체</option>
            {(customers || []).map((c) => (
              <option key={toPk(c)} value={toPk(c)}>
                {toCustomerName(c)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">사육번호목록</div>
          <input
            className="filter-input"
            value={fBreedingNumber}
            onChange={(e) => setFBreedingNumber(e.target.value)}
            placeholder="예: 101 203 305"
          />
        </div>

        <div className="filter-group">
          <div className="filter-label">농장유형</div>
          <select className="filter-select" value={fFarmType} onChange={(e) => setFFarmType(e.target.value)}>
            {FARM_TYPES.map((t) => (
              <option key={t || "__all__"} value={t}>{t || "전체"}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">계란등급</div>
          <select className="filter-select" value={fEggGrade} onChange={(e) => setFEggGrade(e.target.value)}>
            {EGG_GRADE_FILTER_OPTIONS.map((grade) => (
              <option key={grade || "__all_egg_grade"} value={grade}>
                {grade || "전체"}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">중량</div>
          <select className="filter-select" value={fEggWeight} onChange={(e) => setFEggWeight(e.target.value)}>
            {EGG_WEIGHT_CHOICES.map((w) => (
              <option key={w || "__all_weight"} value={w}>
                {w || "전체"}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">계란유형</div>
          <select className="filter-select" value={fEggType} onChange={(e) => setFEggType(e.target.value)}>
            {EGG_TYPE_FILTER_OPTIONS.map((type) => (
              <option key={type || "__all_egg_type"} value={type}>
                {type || "전체"}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">최대산란일수</div>
          <div className="field-row range-row">
            <input
              className="filter-input"
              inputMode="numeric"
              placeholder="최소"
              value={fMaxLayingDaysMin}
              onChange={(e) => setFMaxLayingDaysMin(e.target.value)}
            />
            <input
              className="filter-input"
              inputMode="numeric"
              placeholder="최대"
              value={fMaxLayingDaysMax}
              onChange={(e) => setFMaxLayingDaysMax(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-label">유통기한</div>
          <div className="field-row range-row">
            <input
              className="filter-input"
              inputMode="numeric"
              placeholder="최소"
              value={fExpirationDateMin}
              onChange={(e) => setFExpirationDateMin(e.target.value)}
            />
            <input
              className="filter-input"
              inputMode="numeric"
              placeholder="최대"
              value={fExpirationDateMax}
              onChange={(e) => setFExpirationDateMax(e.target.value)}
            />
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
      </aside>

      <section className="page-main">
        <div className="page-head">
          <h2 className="page-title">제품 정보</h2>
          <div className="head-actions">
            <button className="btn secondary" onClick={openCreate}>+ 제품 추가</button>
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

        <div className="table-wrap no-x">
          <table className="data-table product-table">
            <colgroup>
              {PRODUCT_TABLE_COL_WIDTHS.map((width, idx) => (
                <col key={`product-col-${idx}`} style={{ width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th>제품식별자</th>
                <th>제품명</th>
                <th>고객사</th>
                <th>계란수</th>
                <th>사육번호목록</th>
                <th>농장유형</th>
                <th>계란등급</th>
                <th>중량</th>
                <th>계란유형</th>
                <th>최대산란일수</th>
                <th>유통기한</th>
                <th>무항생제</th>
                <th>HACCP</th>
                <th>유기농</th>
                <th className="actions-cell">관리</th>
              </tr>
            </thead>
            <tbody>
              {!loading && !pagedRows.length ? (
                <tr>
                  <td colSpan={15} className="muted" style={{ padding: "var(--sp-18)" }}>
                    결과가 없습니다.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => {
                  const customer = customersByPk[toPk(r?.customer)] || (typeof r?.customer === "object" ? r.customer : null);
                  return (
                    <tr key={r.id ?? r.product_no}>
                      <td>{getIdentifierLabel(r, ["product_no", "product_id"], ["id"])}</td>
                      <td className="wrap-cell">{r.product_name || "-"}</td>
                      <td className="wrap-cell">{toCustomerLabel(customer || { customer_code: toPk(r?.customer) })}</td>
                      <td>{r.egg_count ?? "-"}</td>
                      <td className="wrap-cell">{toBreedingText(r?.breeding_number) || "-"}</td>
                      <td>{normalizeFarmType(r?.farm_type) || "-"}</td>
                      <td>{normalizeEggGrade(r?.egg_grade)}</td>
                      <td>{r.egg_weight || "-"}</td>
                      <td>{normalizeEggType(r?.process_type)}</td>
                      <td>{r.max_laying_days ?? "-"}</td>
                      <td>{r.expiration_date ?? "-"}</td>
                      <td><span className={`badge ${r.antibiotic_free ? "ok" : "no"}`}>{r.antibiotic_free ? "유" : "무"}</span></td>
                      <td><span className={`badge ${r.haccp ? "ok" : "no"}`}>{r.haccp ? "유" : "무"}</span></td>
                      <td><span className={`badge ${r.organic ? "ok" : "no"}`}>{r.organic ? "유" : "무"}</span></td>
                      <td className="actions-cell">
                        <span className="row-actions actions-center">
                          <button className="btn small secondary" onClick={() => openEdit(r)}>수정</button>
                          <button className="btn small danger" onClick={() => onDelete(r)}>삭제</button>
                        </span>
                      </td>
                    </tr>
                  );
                })
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
            </div>

            <form onSubmit={onSubmit}>
              <div className="modal-body">
                {formErr && <div className="field-error" style={{ marginBottom: "var(--sp-10)" }}>{formErr}</div>}
                <div className="modal-grid">
                  <div className="field">
                    <div className="filter-label">제품식별자 (product_no)</div>
                    <input
                      className="filter-input"
                      value={form.product_no}
                      onChange={(e) => setForm((prev) => ({ ...prev, product_no: e.target.value }))}
                    />
                    {fieldErrs.product_no && <div className="field-error">{fieldErrs.product_no}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">제품명</div>
                    <input
                      className="filter-input"
                      value={form.product_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, product_name: e.target.value }))}
                    />
                    {fieldErrs.product_name && <div className="field-error">{fieldErrs.product_name}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">고객사</div>
                    <select
                      className="filter-select"
                      value={form.customer}
                      onChange={(e) => setForm((prev) => ({ ...prev, customer: e.target.value }))}
                    >
                      <option value="">선택</option>
                      {customers.map((c) => (
                        <option key={toPk(c)} value={toPk(c)}>
                          {toCustomerLabel(c)}
                        </option>
                      ))}
                    </select>
                    {fieldErrs.customer && <div className="field-error">{fieldErrs.customer}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">계란수</div>
                    <input
                      className="filter-input"
                      inputMode="numeric"
                      value={form.egg_count}
                      onChange={(e) => setForm((prev) => ({ ...prev, egg_count: e.target.value }))}
                    />
                    {fieldErrs.egg_count && <div className="field-error">{fieldErrs.egg_count}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">사육번호목록 (쉼표 구분)</div>
                    <input
                      className="filter-input"
                      value={form.breeding_number_text}
                      onChange={(e) => setForm((prev) => ({ ...prev, breeding_number_text: e.target.value }))}
                      placeholder="예: 1, 2, 3"
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
                          {t || "선택"}
                        </option>
                      ))}
                    </select>
                    {fieldErrs.farm_type && <div className="field-error">{fieldErrs.farm_type}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">계란등급</div>
                    <select
                      className="filter-select"
                      value={form.egg_grade}
                      onChange={(e) => setForm((prev) => ({ ...prev, egg_grade: e.target.value }))}
                    >
                      {EGG_GRADE_CHOICES.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <div className="filter-label">중량</div>
                    <select
                      className="filter-select"
                      value={form.egg_weight}
                      onChange={(e) => setForm((prev) => ({ ...prev, egg_weight: e.target.value }))}
                    >
                      {EGG_WEIGHT_CHOICES.map((w) => (
                        <option key={w || "__empty_weight"} value={w}>
                          {w || "선택"}
                        </option>
                      ))}
                    </select>
                    {fieldErrs.egg_weight && <div className="field-error">{fieldErrs.egg_weight}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">계란유형</div>
                    <select
                      className="filter-select"
                      value={form.process_type}
                      onChange={(e) => setForm((prev) => ({ ...prev, process_type: e.target.value }))}
                    >
                      {EGG_TYPE_CHOICES.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                    {fieldErrs.process_type && <div className="field-error">{fieldErrs.process_type}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">최대산란일수</div>
                    <input
                      className="filter-input"
                      inputMode="numeric"
                      value={form.max_laying_days}
                      onChange={(e) => setForm((prev) => ({ ...prev, max_laying_days: e.target.value }))}
                    />
                    {fieldErrs.max_laying_days && <div className="field-error">{fieldErrs.max_laying_days}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">유통기한</div>
                    <input
                      className="filter-input"
                      inputMode="numeric"
                      value={form.expiration_date}
                      onChange={(e) => setForm((prev) => ({ ...prev, expiration_date: e.target.value }))}
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
