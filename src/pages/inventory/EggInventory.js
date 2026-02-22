import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createEggLot,
  deleteEggLot,
  listEggLots,
  patchEggLot,
} from "../../services/inventoryApi";
import { listFarms } from "../../services/accountingApi";
import {
  asText,
  getApiErrorMessage,
  getIdentifierLabel,
  includesAnyTokens,
  includesText,
  normalizeFarmType,
  parseDRFErrors,
} from "../../utils/helpers";
import { downloadEggLotListXlsx } from "../../utils/excel";

import SearchBar from "../../components/common/SearchBar";
import Pagination from "../../components/common/Pagination";
import "../accounting/AccountingTable.css";

const FARM_TYPES = ["", "일반농장", "동물복지농장"];
const EGG_WEIGHT_CHOICES = ["", "왕란", "특란", "대란", "중란", "소란"];
const EGG_GRADE_CHOICES = ["무", "1", "1+", "기타"];
const EGG_GRADE_FILTER_OPTIONS = ["", ...EGG_GRADE_CHOICES];

function ymd(v) {
  const s = asText(v);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function normalizeEggGrade(value) {
  const v = String(value ?? "").trim();
  if (!v || v === "무") return "무";
  if (v === "1") return "1";
  if (v === "1+") return "1+";
  if (v === "기타") return "기타";
  return "기타";
}

function toFilterNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function toPk(v) {
  if (v == null) return "";
  if (typeof v === "object") return String(v.id ?? v.pk ?? "");
  return String(v);
}

function farmLabel(farm, farmsByPk) {
  if (!farm) return "-";
  if (typeof farm === "object") {
    const id = getIdentifierLabel(farm, ["farm_id"], ["id"]);
    const name = asText(farm?.farm_name);
    if (name && id) return `${name} (${id})`;
    return name || id || "-";
  }

  const pk = toPk(farm);
  const found = farmsByPk[pk];
  if (!found) return pk || "-";

  const id = getIdentifierLabel(found, ["farm_id"], ["id"]);
  const name = asText(found?.farm_name);
  if (name && id) return `${name} (${id})`;
  return name || id || "-";
}

export default function EggInventory() {
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
    farm: "",
    receiving_date: "",
    shell_number: "",
    breeding_number: "",
    farm_type: "",
    age_weeks: "",
    egg_weight: "",
    laying_date: "",
    egg_grade: "무",
    location: "",
    quantity: "",
    memo: "",
    history_memo: "",
  });

  const [searchField, setSearchField] = useState("all");
  const [searchText, setSearchText] = useState("");

  const [fFarm, setFFarm] = useState("");
  const [fFarmType, setFFarmType] = useState("");
  const [fEggWeight, setFEggWeight] = useState("");
  const [fEggGrade, setFEggGrade] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fAgeWeeksMin, setFAgeWeeksMin] = useState("");
  const [fAgeWeeksMax, setFAgeWeeksMax] = useState("");
  const [fReceivingDate, setFReceivingDate] = useState("");
  const [fLayingDate, setFLayingDate] = useState("");
  const [fQuantityMin, setFQuantityMin] = useState("");
  const [fQuantityMax, setFQuantityMax] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const SEARCH_FIELDS = [
    { value: "all", label: "전체" },
    { value: "Egglot_no", label: "계란재고식별자" },
    { value: "farm", label: "농장" },
    { value: "shell_number", label: "산란번호" },
    { value: "memo", label: "메모" },
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
      const [lots, farmRows] = await Promise.all([listEggLots(), listFarms()]);
      setRows(lots);
      setFarms(farmRows);
    } catch (e) {
      setErr(getApiErrorMessage(e, "계란재고 목록을 불러오지 못했습니다."));
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
      farm: "",
      receiving_date: "",
      shell_number: "",
      breeding_number: "",
      farm_type: "",
      age_weeks: "",
      egg_weight: "",
      laying_date: "",
      egg_grade: "무",
      location: "",
      quantity: "",
      memo: "",
      history_memo: "",
    });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setFormErr("");
    setFieldErrs({});
    setForm({
      farm: toPk(row?.farm),
      receiving_date: ymd(row?.receiving_date),
      shell_number: asText(row?.shell_number),
      breeding_number: row?.breeding_number == null ? "" : String(row.breeding_number),
      farm_type: normalizeFarmType(row?.farm_type),
      age_weeks: row?.age_weeks == null ? "" : String(row.age_weeks),
      egg_weight: asText(row?.egg_weight),
      laying_date: ymd(row?.laying_date),
      egg_grade: normalizeEggGrade(row?.egg_grade),
      location: asText(row?.location),
      quantity: row?.quantity == null ? "" : String(row.quantity),
      memo: asText(row?.memo),
      history_memo: "",
    });
    setModalOpen(true);
  }

  function applyFarmDefault(farmPk) {
    const farm = farmsByPk[String(farmPk)];
    if (!farm) return;

    setForm((prev) => ({
      ...prev,
      farm: farmPk,
      shell_number: prev.shell_number || asText(farm?.shell_number),
      farm_type: prev.farm_type || normalizeFarmType(farm?.farm_type),
    }));
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
    if (submitting) return;

    setSubmitting(true);
    setFormErr("");
    setFieldErrs({});

    try {
      const payload = {
        farm: Number(form.farm),
        receiving_date: form.receiving_date,
        age_weeks: Number(form.age_weeks),
        farm_type: normalizeFarmType(String(form.farm_type || "").trim()),
        egg_weight: String(form.egg_weight || "").trim(),
        laying_date: form.laying_date,
        egg_grade: normalizeEggGrade(form.egg_grade),
        quantity: Number(form.quantity),
        ...(String(form.shell_number || "").trim()
          ? { shell_number: String(form.shell_number).trim() }
          : {}),
        ...(String(form.breeding_number || "").trim()
          ? { breeding_number: Number(form.breeding_number) }
          : {}),
        ...(String(form.location || "").trim()
          ? { location: String(form.location).trim() }
          : {}),
        ...(String(form.memo || "").trim() ? { memo: String(form.memo).trim() } : {}),
        ...(editing?.id != null
          ? { history_memo: String(form.history_memo || "").trim() }
          : {}),
      };

      const nextErrs = {};
      if (!Number.isFinite(payload.farm)) nextErrs.farm = "농장을 선택해주세요.";
      if (!payload.receiving_date) nextErrs.receiving_date = "입고일은 필수입니다.";
      if (!Number.isFinite(payload.age_weeks)) nextErrs.age_weeks = "주령은 숫자여야 합니다.";
      if (!payload.farm_type) nextErrs.farm_type = "농장유형은 필수입니다.";
      if (!payload.egg_weight) nextErrs.egg_weight = "중량은 필수입니다.";
      if (!payload.laying_date) nextErrs.laying_date = "산란일은 필수입니다.";
      if (!Number.isFinite(payload.quantity)) nextErrs.quantity = "수량은 숫자여야 합니다.";
      if (editing?.id != null && !payload.history_memo) {
        nextErrs.history_memo = "수정 시 변경내역 메모를 입력해주세요.";
      }

      if (Object.keys(nextErrs).length) {
        setFieldErrs(nextErrs);
        return;
      }

      if (editing?.id != null) await patchEggLot(editing.id, payload);
      else await createEggLot(payload);

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
    const label = getIdentifierLabel(row, ["Egglot_no", "egg_lot_id"], ["id"]);
    const ok = window.confirm(`'${label}' 계란재고를 삭제할까요?`);
    if (!ok) return;

    try {
      await deleteEggLot(row.id);
      setRows((prev) => prev.filter((r) => r?.id !== row.id));
    } catch (e) {
      window.alert(getApiErrorMessage(e, "삭제에 실패했습니다."));
    }
  }

  const filtered = useMemo(() => {
    const q = searchText.trim();
    const ageWeeksMin = toFilterNumber(fAgeWeeksMin);
    const ageWeeksMax = toFilterNumber(fAgeWeeksMax);
    const quantityMin = toFilterNumber(fQuantityMin);
    const quantityMax = toFilterNumber(fQuantityMax);

    return (rows || []).filter((r) => {
      const farmText = farmLabel(r?.farm, farmsByPk);
      const lotNo = getIdentifierLabel(r, ["Egglot_no", "egg_lot_id"], ["id"]);
      const farmType = normalizeFarmType(r?.farm_type);
      const ageWeeks = Number(r?.age_weeks);
      const receivingDate = ymd(r?.receiving_date);
      const layingDate = ymd(r?.laying_date);
      const quantity = Number(r?.quantity);

      if (fFarm && !includesAnyTokens(farmText, fFarm)) return false;
      if (fFarmType && farmType !== fFarmType) return false;
      if (fEggWeight && String(r?.egg_weight || "") !== fEggWeight) return false;
      if (fEggGrade && normalizeEggGrade(r?.egg_grade) !== fEggGrade) return false;
      if (fLocation && !includesAnyTokens(r?.location, fLocation)) return false;
      if (ageWeeksMin != null && (!Number.isFinite(ageWeeks) || ageWeeks < ageWeeksMin)) return false;
      if (ageWeeksMax != null && (!Number.isFinite(ageWeeks) || ageWeeks > ageWeeksMax)) return false;
      if (fReceivingDate && receivingDate !== fReceivingDate) return false;
      if (fLayingDate && layingDate !== fLayingDate) return false;
      if (quantityMin != null && (!Number.isFinite(quantity) || quantity < quantityMin)) return false;
      if (quantityMax != null && (!Number.isFinite(quantity) || quantity > quantityMax)) return false;

      if (!q) return true;
      if (searchField === "Egglot_no") return includesText(lotNo, q);
      if (searchField === "farm") return includesText(farmText, q);
      if (searchField === "shell_number") return includesText(r?.shell_number, q);
      if (searchField === "memo") return includesText(r?.memo, q);

      return (
        includesText(lotNo, q) ||
        includesText(farmText, q) ||
        includesText(r?.shell_number, q) ||
        includesText(normalizeEggGrade(r?.egg_grade), q) ||
        includesText(r?.location, q) ||
        includesText(r?.memo, q)
      );
    });
  }, [
    rows,
    farmsByPk,
    searchText,
    searchField,
    fFarm,
    fFarmType,
    fEggWeight,
    fEggGrade,
    fLocation,
    fAgeWeeksMin,
    fAgeWeeksMax,
    fReceivingDate,
    fLayingDate,
    fQuantityMin,
    fQuantityMax,
  ]);

  useEffect(() => {
    setPage(1);
  }, [
    searchField,
    searchText,
    fFarm,
    fFarmType,
    fEggWeight,
    fEggGrade,
    fLocation,
    fAgeWeeksMin,
    fAgeWeeksMax,
    fReceivingDate,
    fLayingDate,
    fQuantityMin,
    fQuantityMax,
  ]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filtered.length / pageSize)), [filtered.length]);
  useEffect(() => {
    setPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  function onExcelExport() {
    const body = filtered.map((r) => [
      getIdentifierLabel(r, ["Egglot_no", "egg_lot_id"], ["id"]),
      getIdentifierLabel(
        typeof r?.farm === "object" ? r.farm : farmsByPk[toPk(r?.farm)] || {},
        ["farm_id"],
        [toPk(r?.farm)]
      ),
      normalizeFarmType(r?.farm_type),
      asText(r?.shell_number || ""),
      ymd(r?.receiving_date),
      ymd(r?.laying_date),
      asText(r?.egg_weight || ""),
      normalizeEggGrade(r?.egg_grade),
      asText(r?.location || ""),
      asText(r?.age_weeks || ""),
      asText(r?.quantity || ""),
      asText(r?.memo || ""),
    ]);
    downloadEggLotListXlsx(body);
  }

  return (
    <div className="accounting-page inventory-page">
      <div className="filters-card">
        <div className="filters-title">필터</div>

        <div className="filter-group">
          <div className="filter-label">농장</div>
          <input
            className="filter-input"
            value={fFarm}
            onChange={(e) => setFFarm(e.target.value)}
            placeholder="예: 농장명 농장식별자"
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
          <div className="filter-label">중량</div>
          <select className="filter-select" value={fEggWeight} onChange={(e) => setFEggWeight(e.target.value)}>
            {EGG_WEIGHT_CHOICES.map((w) => (
              <option key={w || "__all_weight"} value={w}>{w || "전체"}</option>
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
          <div className="filter-label">위치</div>
          <input className="filter-input" value={fLocation} onChange={(e) => setFLocation(e.target.value)} />
        </div>

        <div className="filter-group">
          <div className="filter-label">입고일</div>
          <input
            className="filter-input"
            type="date"
            value={fReceivingDate}
            onChange={(e) => setFReceivingDate(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <div className="filter-label">산란일</div>
          <input
            className="filter-input"
            type="date"
            value={fLayingDate}
            onChange={(e) => setFLayingDate(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <div className="filter-label">주령</div>
          <div className="field-row range-row">
            <input
              className="filter-input"
              inputMode="numeric"
              placeholder="최소"
              value={fAgeWeeksMin}
              onChange={(e) => setFAgeWeeksMin(e.target.value)}
            />
            <input
              className="filter-input"
              inputMode="numeric"
              placeholder="최대"
              value={fAgeWeeksMax}
              onChange={(e) => setFAgeWeeksMax(e.target.value)}
            />
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-label">수량</div>
          <div className="field-row range-row">
            <input
              className="filter-input"
              inputMode="numeric"
              placeholder="최소"
              value={fQuantityMin}
              onChange={(e) => setFQuantityMin(e.target.value)}
            />
            <input
              className="filter-input"
              inputMode="numeric"
              placeholder="최대"
              value={fQuantityMax}
              onChange={(e) => setFQuantityMax(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="page-main">
        <div className="page-head">
          <h2 className="page-title">계란재고</h2>
          <div className="head-actions">
            <button className="btn secondary" type="button" onClick={openCreate}>
              + 계란재고 추가
            </button>
            <button className="btn secondary" type="button" onClick={onExcelExport}>
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
              placeholder="검색어"
            />
          </div>
        </div>

        <div className="muted" style={{ marginBottom: "var(--sp-10)" }}>
          {loading ? "불러오는 중." : err ? err : `총 ${filtered.length}건`}
        </div>
        {err && <div className="field-error" style={{ marginTop: "var(--sp-10)" }}>{err}</div>}

        <div className="table-wrap no-x" style={{ marginTop: "var(--sp-12)" }}>
          <table className="data-table product-table">
            <colgroup>
              <col style={{ width: "9%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "5%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "10%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>계란재고식별자</th>
                <th>농장</th>
                <th>농장유형</th>
                <th>산란번호</th>
                <th>입고일</th>
                <th>산란일</th>
                <th>중량</th>
                <th>계란등급</th>
                <th>위치</th>
                <th>주령</th>
                <th>수량</th>
                <th>메모</th>
                <th className="actions-cell">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className="muted">불러오는 중.</td></tr>
              ) : !paged.length ? (
                <tr><td colSpan={13} className="muted">데이터가 없습니다.</td></tr>
              ) : (
                paged.map((r) => (
                  <tr key={r.id ?? getIdentifierLabel(r, ["Egglot_no", "egg_lot_id"], ["id"])}>
                    <td>{getIdentifierLabel(r, ["Egglot_no", "egg_lot_id"], ["id"])}</td>
                    <td className="wrap-cell">{farmLabel(r?.farm, farmsByPk)}</td>
                    <td>{normalizeFarmType(r?.farm_type)}</td>
                    <td>{asText(r?.shell_number)}</td>
                    <td>{ymd(r?.receiving_date)}</td>
                    <td>{ymd(r?.laying_date)}</td>
                    <td>{asText(r?.egg_weight)}</td>
                    <td>{normalizeEggGrade(r?.egg_grade)}</td>
                    <td className="wrap-cell">{asText(r?.location)}</td>
                    <td>{asText(r?.age_weeks)}</td>
                    <td>{asText(r?.quantity)}</td>
                    <td className="wrap-cell">{asText(r?.memo)}</td>
                    <td className="actions-cell">
                      <div className="row-actions">
                        <button className="btn small secondary" type="button" onClick={() => openEdit(r)}>수정</button>
                        <button className="btn small danger" type="button" onClick={() => onDelete(r)}>삭제</button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} setPage={setPage} />
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="modal-title">{editing ? "계란재고 수정" : "계란재고 추가"}</h3>
            </div>

            <form onSubmit={onSubmit}>
              <div className="modal-body">
                {formErr && <div className="field-error" style={{ whiteSpace: "pre-wrap" }}>{formErr}</div>}

                <div className="modal-grid">
                  <div className="field">
                    <div className="filter-label">농장</div>
                    <select
                      className="filter-select"
                      value={form.farm}
                      onChange={(e) => applyFarmDefault(e.target.value)}
                    >
                      <option value="">선택</option>
                      {(farms || []).map((f) => (
                        <option key={toPk(f)} value={toPk(f)}>
                          {farmLabel(f, farmsByPk)}
                        </option>
                      ))}
                    </select>
                    <div className="field-help">농장을 선택하면 농장유형/산란번호 기본값이 자동 입력됩니다. 필요 시 수정 가능합니다.</div>
                    {fieldErrs.farm && <div className="field-error">{fieldErrs.farm}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">입고일</div>
                    <input className="filter-input" type="date" value={form.receiving_date} onChange={(e) => setForm((p) => ({ ...p, receiving_date: e.target.value }))} />
                    {fieldErrs.receiving_date && <div className="field-error">{fieldErrs.receiving_date}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">산란일</div>
                    <input className="filter-input" type="date" value={form.laying_date} onChange={(e) => setForm((p) => ({ ...p, laying_date: e.target.value }))} />
                    {fieldErrs.laying_date && <div className="field-error">{fieldErrs.laying_date}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">주령</div>
                    <input className="filter-input" type="number" value={form.age_weeks} onChange={(e) => setForm((p) => ({ ...p, age_weeks: e.target.value }))} />
                    {fieldErrs.age_weeks && <div className="field-error">{fieldErrs.age_weeks}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">농장유형</div>
                    <select className="filter-select" value={form.farm_type} onChange={(e) => setForm((p) => ({ ...p, farm_type: e.target.value }))}>
                      {FARM_TYPES.map((t) => (
                        <option key={t || "__empty_farm_type"} value={t}>{t || "선택"}</option>
                      ))}
                    </select>
                    {fieldErrs.farm_type && <div className="field-error">{fieldErrs.farm_type}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">중량</div>
                    <select className="filter-select" value={form.egg_weight} onChange={(e) => setForm((p) => ({ ...p, egg_weight: e.target.value }))}>
                      {EGG_WEIGHT_CHOICES.map((w) => (
                        <option key={w || "__empty_weight"} value={w}>{w || "선택"}</option>
                      ))}
                    </select>
                    {fieldErrs.egg_weight && <div className="field-error">{fieldErrs.egg_weight}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">계란등급 (기본: 무)</div>
                    <select
                      className="filter-select"
                      value={form.egg_grade}
                      onChange={(e) => setForm((p) => ({ ...p, egg_grade: e.target.value }))}
                    >
                      {EGG_GRADE_CHOICES.map((grade) => (
                        <option key={grade} value={grade}>
                          {grade}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <div className="filter-label">수량</div>
                    <input className="filter-input" type="number" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
                    {fieldErrs.quantity && <div className="field-error">{fieldErrs.quantity}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">산란번호</div>
                    <input className="filter-input" value={form.shell_number} onChange={(e) => setForm((p) => ({ ...p, shell_number: e.target.value }))} />
                  </div>

                  <div className="field">
                    <div className="filter-label">사육번호</div>
                    <input className="filter-input" type="number" value={form.breeding_number} onChange={(e) => setForm((p) => ({ ...p, breeding_number: e.target.value }))} />
                  </div>

                  <div className="field">
                    <div className="filter-label">위치</div>
                    <input className="filter-input" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
                  </div>

                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <div className="filter-label">메모</div>
                    <textarea className="filter-input" rows={4} value={form.memo} onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))} />
                  </div>

                  {editing?.id != null && (
                    <div className="field" style={{ gridColumn: "1 / -1" }}>
                      <div className="filter-label">변경내역 메모</div>
                      <textarea
                        className="filter-input"
                        rows={4}
                        value={form.history_memo}
                        onChange={(e) => setForm((p) => ({ ...p, history_memo: e.target.value }))}
                        placeholder="변경 사유를 입력하세요"
                      />
                      {fieldErrs.history_memo && <div className="field-error">{fieldErrs.history_memo}</div>}
                    </div>
                  )}
                </div>
              </div>

              <div className="modal-foot">
                <button className="btn secondary" type="button" onClick={closeModal} disabled={submitting}>취소</button>
                <button className="btn" type="submit" disabled={submitting}>
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
