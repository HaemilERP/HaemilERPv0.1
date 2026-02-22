import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createCustomer,
  deleteCustomer,
  listCustomers,
  listFarms,
  patchCustomer,
} from "../../services/accountingApi";
import {
  getApiErrorMessage,
  getIdentifierLabel,
  includesText,
  parseDRFErrors,
  toStringArray,
} from "../../utils/helpers";
import { downloadCustomerListXlsx } from "../../utils/excel";
import "./AccountingTable.css";
import SearchBar from "../../components/common/SearchBar";
import Pagination from "../../components/common/Pagination";

function toPk(v) {
  if (v == null) return "";
  if (typeof v === "object") return String(v.id ?? v.pk ?? "");
  return String(v);
}

function toFarmPkList(v) {
  if (!Array.isArray(v)) return [];
  return v
    .map((farm) => {
      if (farm == null) return "";
      if (typeof farm === "object") return toPk(farm);
      return String(farm);
    })
    .filter(Boolean);
}

function toFarmLabel(farm) {
  const id = getIdentifierLabel(farm, ["farm_id"], ["id"]);
  const name = String(farm?.farm_name || "").trim();
  if (name && id) return `${name} (${id})`;
  return name || id || "-";
}

function toFarmFilterLabel(farm) {
  const name = String(farm?.farm_name || "").trim();
  if (name) return name;
  return getIdentifierLabel(farm, ["farm_id"], ["id"]) || "-";
}

function toCustomerLabel(customer) {
  const code = getIdentifierLabel(customer, ["customer_code", "customer_id"], []);
  const name = String(customer?.customer_name || "").trim();
  if (name && code) return `${name} (${code})`;
  return name || code || "-";
}

function toFilterNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export default function CustomerInfo() {
  const [rows, setRows] = useState([]);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [fieldErrs, setFieldErrs] = useState({});
  const [form, setForm] = useState({
    customer_code: "",
    customer_name: "",
    client_text: "",
    available_farms: [],
    max_laying_days: "",
    expiration_date: "",
  });

  const [searchField, setSearchField] = useState("all");
  const [searchText, setSearchText] = useState("");

  const [fFarmPk, setFFarmPk] = useState("");
  const [fMaxLayingDaysMin, setFMaxLayingDaysMin] = useState("");
  const [fMaxLayingDaysMax, setFMaxLayingDaysMax] = useState("");
  const [fExpirationDateMin, setFExpirationDateMin] = useState("");
  const [fExpirationDateMax, setFExpirationDateMax] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 10;
  const SEARCH_FIELDS = [
    { value: "all", label: "전체" },
    { value: "customer_code", label: "고객사코드" },
    { value: "customer_name", label: "고객사명" },
    { value: "client", label: "납품처" },
    { value: "farm", label: "사용농장" },
  ];

  const farmsByPk = useMemo(() => {
    const m = {};
    (farms || []).forEach((f) => {
      const pk = toPk(f);
      if (pk) m[pk] = f;
    });
    return m;
  }, [farms]);

  async function fetchRows() {
    setLoading(true);
    setErr("");
    try {
      const [customersData, farmsData] = await Promise.all([listCustomers(), listFarms()]);
      setRows(customersData);
      setFarms(farmsData);
    } catch (e) {
      setErr(getApiErrorMessage(e, "고객사 목록을 불러오지 못했습니다."));
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
      customer_code: "",
      customer_name: "",
      client_text: "",
      available_farms: [],
      max_laying_days: "",
      expiration_date: "",
    });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setFormErr("");
    setFieldErrs({});
    setForm({
      customer_code: String(row?.customer_code || ""),
      customer_name: String(row?.customer_name || ""),
      client_text: toStringArray(row?.client).join(", "),
      available_farms: toFarmPkList(row?.available_farms),
      max_laying_days: row?.max_laying_days == null ? "" : String(row.max_laying_days),
      expiration_date: row?.expiration_date == null ? "" : String(row.expiration_date),
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
        customer_code: String(form.customer_code || "").trim(),
        customer_name: String(form.customer_name || "").trim(),
        client: toStringArray(form.client_text),
        available_farms: (form.available_farms || [])
          .map((pk) => Number(pk))
          .filter((v) => Number.isFinite(v)),
        max_laying_days: Number(form.max_laying_days),
        expiration_date: Number(form.expiration_date),
      };

      const nextErrs = {};
      if (!payload.customer_code) nextErrs.customer_code = "고객사코드를 입력해주세요.";
      if (!payload.customer_name) nextErrs.customer_name = "고객사명을 입력해주세요.";
      if (!Number.isFinite(payload.max_laying_days)) nextErrs.max_laying_days = "최대 산란일수는 숫자여야 합니다.";
      if (!Number.isFinite(payload.expiration_date)) nextErrs.expiration_date = "유통기한은 숫자여야 합니다.";
      if (Object.keys(nextErrs).length) {
        setFieldErrs(nextErrs);
        return;
      }

      if (editing?.id != null) await patchCustomer(editing.id, payload);
      else await createCustomer(payload);

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
    const ok = window.confirm(`'${toCustomerLabel(row)}' 고객사를 삭제할까요?`);
    if (!ok) return;
    try {
      await deleteCustomer(row.id);
      setRows((prev) => prev.filter((r) => r?.id !== row.id));
    } catch (e) {
      window.alert(getApiErrorMessage(e, "삭제에 실패했습니다."));
    }
  }

  const filtered = useMemo(() => {
    const q = searchText.trim();
    const maxLayingMin = toFilterNumber(fMaxLayingDaysMin);
    const maxLayingMax = toFilterNumber(fMaxLayingDaysMax);
    const expirationMin = toFilterNumber(fExpirationDateMin);
    const expirationMax = toFilterNumber(fExpirationDateMax);

    return (rows || []).filter((r) => {
      const customerCode = String(r?.customer_code || r?.customer_id || "");
      const customerName = String(r?.customer_name || "");
      const clients = toStringArray(r?.client).join(", ");
      const farmPks = toFarmPkList(r?.available_farms);
      const farmLabels = farmPks
        .map((pk) => toFarmLabel(farmsByPk[pk] || { farm_id: pk }))
        .join(", ");
      const maxLayingDaysValue = Number(r?.max_laying_days);
      const expirationDateValue = Number(r?.expiration_date);

      if (fFarmPk && !farmPks.includes(fFarmPk)) return false;
      if (maxLayingMin != null && (!Number.isFinite(maxLayingDaysValue) || maxLayingDaysValue < maxLayingMin)) return false;
      if (maxLayingMax != null && (!Number.isFinite(maxLayingDaysValue) || maxLayingDaysValue > maxLayingMax)) return false;
      if (expirationMin != null && (!Number.isFinite(expirationDateValue) || expirationDateValue < expirationMin)) return false;
      if (expirationMax != null && (!Number.isFinite(expirationDateValue) || expirationDateValue > expirationMax)) return false;

      if (!q) return true;
      if (searchField === "customer_code") return includesText(customerCode, q);
      if (searchField === "customer_name") return includesText(customerName, q);
      if (searchField === "client") return includesText(clients, q);
      if (searchField === "farm") return includesText(farmLabels, q);

      return (
        includesText(customerCode, q) ||
        includesText(customerName, q) ||
        includesText(clients, q) ||
        includesText(farmLabels, q)
      );
    });
  }, [
    rows,
    searchField,
    searchText,
    farmsByPk,
    fFarmPk,
    fMaxLayingDaysMin,
    fMaxLayingDaysMax,
    fExpirationDateMin,
    fExpirationDateMax,
  ]);

  useEffect(() => {
    setPage(1);
  }, [searchField, searchText, fFarmPk, fMaxLayingDaysMin, fMaxLayingDaysMax, fExpirationDateMin, fExpirationDateMax]);

  const pageCount = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length]);
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), pageCount));
  }, [pageCount]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  function onExcelExport() {
    const body = filtered.map((r) => [
      r?.customer_code ?? "",
      r?.customer_name ?? "",
      toStringArray(r?.client).join(","),
      toFarmPkList(r?.available_farms)
        .map((pk) => {
          const farm = farmsByPk[pk];
          return farm ? getIdentifierLabel(farm, ["farm_id"], ["id"]) : pk;
        })
        .join(","),
      r?.max_laying_days ?? "",
      r?.expiration_date ?? "",
    ]);
    downloadCustomerListXlsx(body);
  }

  function toggleFarmPk(pk) {
    setForm((prev) => {
      const set = new Set(prev.available_farms || []);
      if (set.has(pk)) set.delete(pk);
      else set.add(pk);
      return { ...prev, available_farms: Array.from(set) };
    });
  }

  return (
    <div className="accounting-page customer-info-page">
      <aside className="filters-card">
        <div className="filters-title">필터</div>
        <div className="filter-group">
          <div className="filter-label">사용농장</div>
          <select className="filter-select" value={fFarmPk} onChange={(e) => setFFarmPk(e.target.value)}>
            <option value="">전체</option>
            {(farms || []).map((f) => (
              <option key={toPk(f)} value={toPk(f)}>
                {toFarmFilterLabel(f)}
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
      </aside>

      <section className="page-main">
        <div className="page-head">
          <h2 className="page-title">고객사 정보</h2>
          <div className="head-actions">
            <button className="btn secondary" onClick={openCreate}>+ 고객사 추가</button>
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
                <th>고객사코드</th>
                <th>고객사명</th>
                <th>납품처</th>
                <th>사용농장</th>
                <th>최대산란일수</th>
                <th>유통기한</th>
                <th style={{ textAlign: "center" }}>관리</th>
              </tr>
            </thead>
            <tbody>
              {!loading && !pagedRows.length ? (
                <tr>
                  <td colSpan={7} className="muted" style={{ padding: "var(--sp-18)" }}>
                    결과가 없습니다.
                  </td>
                </tr>
              ) : (
                pagedRows.map((r) => (
                  <tr key={r.id ?? `${r.customer_code}-${r.customer_name}`}>
                    <td>{getIdentifierLabel(r, ["customer_code", "customer_id"], ["id"])}</td>
                    <td className="wrap-cell">{r.customer_name || "-"}</td>
                    <td className="wrap-cell">{toStringArray(r.client).join(", ") || "-"}</td>
                    <td className="wrap-cell">
                      {toFarmPkList(r.available_farms)
                        .map((pk) => toFarmLabel(farmsByPk[pk] || { farm_id: pk }))
                        .join(", ") || "-"}
                    </td>
                    <td>{r.max_laying_days ?? "-"}</td>
                    <td>{r.expiration_date ?? "-"}</td>
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
            </div>

            <form onSubmit={onSubmit}>
              <div className="modal-body">
                {formErr && <div className="field-error" style={{ marginBottom: "var(--sp-10)" }}>{formErr}</div>}
                <div className="modal-grid">
                  <div className="field">
                    <div className="filter-label">고객사코드</div>
                    <input
                      className="filter-input"
                      value={form.customer_code}
                      onChange={(e) => setForm((prev) => ({ ...prev, customer_code: e.target.value }))}
                    />
                    {fieldErrs.customer_code && <div className="field-error">{fieldErrs.customer_code}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">고객사명</div>
                    <input
                      className="filter-input"
                      value={form.customer_name}
                      onChange={(e) => setForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                    />
                    {fieldErrs.customer_name && <div className="field-error">{fieldErrs.customer_name}</div>}
                  </div>

                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <div className="filter-label">납품처 (쉼표 구분)</div>
                    <textarea
                      className="filter-input"
                      rows={3}
                      value={form.client_text}
                      onChange={(e) => setForm((prev) => ({ ...prev, client_text: e.target.value }))}
                      placeholder="예: 납품처A, 납품처B"
                    />
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
                    <div className="filter-label">사용농장</div>
                    <div className="farm-pick-list">
                      {(farms || []).map((f) => {
                        const pk = toPk(f);
                        const checked = (form.available_farms || []).includes(pk);
                        return (
                          <label key={pk} className="farm-pick-item">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFarmPk(pk)}
                            />
                            <span>{toFarmLabel(f)}</span>
                          </label>
                        );
                      })}
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
