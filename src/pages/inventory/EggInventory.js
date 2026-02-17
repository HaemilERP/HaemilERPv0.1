import { useCallback, useEffect, useMemo, useState } from "react";
import { createEggLot, deleteEggLot, listEggLots, patchEggLot } from "../../services/inventoryApi";
import { listFarms } from "../../services/accountingApi";
import {
  asText,
  includesAnyTokens,
  includesText,
  matchBool,
  parseDRFErrors,
} from "../../utils/helpers";
import { downloadEggLotListXlsx } from "../../utils/excel";

import SearchBar from "../../components/common/SearchBar";
import Pagination from "../../components/common/Pagination";
import "../accounting/AccountingTable.css";

const EGG_TYPE_CHOICES = ["", "구운란", "생란", "액란", "기타"];
const FARM_TYPES = ["", "일반농장", "동물복지농장"];
const EGG_WEIGHT_CHOICES = ["", "왕란", "특란", "대란", "중란", "소란"];

// 재고 페이지 활성여부 표기(농장정보와 동일: 유/무)
const ACTIVE_OPTIONS = [
  { value: "", label: "전체" },
  { value: "true", label: "유" },
  { value: "false", label: "무" },
];

function ymd(v) {
  const s = asText(v);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function toFarmId(v) {
  if (v == null) return "";
  if (typeof v === "object") return asText(v.id ?? v.pk ?? "");
  return asText(v);
}

function toFarmName(v, farmsById) {
  if (!v) return "";
  if (typeof v === "object") return asText(v.farm_name ?? v.name ?? v.title);
  const id = asText(v);
  return asText(farmsById?.[id]?.farm_name ?? "");
}

export default function EggInventory() {
  const [rows, setRows] = useState([]);
  const [farms, setFarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // CRUD
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
    egg_type: "",
    egg_weight: "",
    laying_date: "",
    egg_grade: "",
    location: "",
    quantity: "",
    memo: "",
    is_active: true,
  });

  // 상단 검색
  const [searchField, setSearchField] = useState("all");
  const [searchText, setSearchText] = useState("");

  // 좌측 필터
  const [fFarm, setFFarm] = useState("");
  const [fReceivingFrom, setFReceivingFrom] = useState("");
  const [fReceivingTo, setFReceivingTo] = useState("");
  const [fLayingFrom, setFLayingFrom] = useState("");
  const [fLayingTo, setFLayingTo] = useState("");
  const [fEggType, setFEggType] = useState("");
  const [fEggWeight, setFEggWeight] = useState("");
  const [fEggGrade, setFEggGrade] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fQtyMin, setFQtyMin] = useState("");
  const [fQtyMax, setFQtyMax] = useState("");
  const [fIsActive, setFIsActive] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const SEARCH_FIELDS = [
    { value: "all", label: "전체" },
    { value: "farm", label: "농장" },
    { value: "shell_number", label: "난각번호" },
    { value: "egg_grade", label: "등급" },
    { value: "location", label: "위치" },
    { value: "memo", label: "메모" },
    { value: "id", label: "계란재고ID" },
  ];

  const farmsById = useMemo(() => {
    const m = {};
    (farms || []).forEach((f) => {
      const id = f?.id;
      if (id != null) m[String(id)] = f;
    });
    return m;
  }, [farms]);

  const fetchRows = async () => {
    setLoading(true);
    setErr("");
    try {
      const [lots, farmList] = await Promise.all([listEggLots(), listFarms()]);
      setRows(lots);
      setFarms(farmList);
    } catch (e) {
      setErr(e?.response?.data?.detail || "계란재고 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

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
    setForm({
      farm: "",
      receiving_date: "",
      shell_number: "",
      breeding_number: "",
      farm_type: "",
      age_weeks: "",
      egg_type: "",
      egg_weight: "",
      laying_date: "",
      egg_grade: "",
      location: "",
      quantity: "",
      memo: "",
      is_active: true,
    });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setFormErr("");
    setFieldErrs({});
    setForm({
      farm: toFarmId(row?.farm) || "",
      receiving_date: ymd(row?.receiving_date) || "",
      shell_number: asText(row?.shell_number) || "",
      breeding_number: row?.breeding_number ?? "",
      farm_type: asText(row?.farm_type) || "",
      age_weeks: row?.age_weeks ?? "",
      egg_type: asText(row?.egg_type) || "",
      egg_weight: asText(row?.egg_weight) || "",
      laying_date: ymd(row?.laying_date) || "",
      egg_grade: asText(row?.egg_grade) || "",
      location: asText(row?.location) || "",
      quantity: row?.quantity ?? "",
      memo: asText(row?.memo) || "",
      is_active: Boolean(row?.is_active),
    });
    setModalOpen(true);
  }

  const closeModal = useCallback(() => {
    if (submitting) return;
    setModalOpen(false);
  }, [submitting]);

  // ESC로 모달 닫기
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
        egg_weight: form.egg_weight,
        laying_date: form.laying_date,
        egg_grade: form.egg_grade,
        quantity: Number(form.quantity),
        is_active: Boolean(form.is_active),
        ...(form.shell_number ? { shell_number: form.shell_number } : {}),
        ...(form.breeding_number !== "" && form.breeding_number != null
          ? { breeding_number: Number(form.breeding_number) }
          : {}),
        ...(form.farm_type ? { farm_type: form.farm_type } : {}),
        ...(form.egg_type ? { egg_type: form.egg_type } : {}),
        ...(form.location ? { location: form.location } : {}),
        ...(form.memo ? { memo: form.memo } : {}),
      };

      const errs = {};
      if (!Number.isFinite(payload.farm)) errs.farm = "농장을 선택해주세요.";
      if (!payload.receiving_date) errs.receiving_date = "입고일은 필수입니다.";
      if (!Number.isFinite(payload.age_weeks)) errs.age_weeks = "주령을 숫자로 입력해주세요.";
      if (!payload.egg_weight) errs.egg_weight = "난중을 선택해주세요.";
      if (!payload.laying_date) errs.laying_date = "산란일은 필수입니다.";
      if (!payload.egg_grade?.trim()) errs.egg_grade = "등급을 입력해주세요.";
      if (!Number.isFinite(payload.quantity)) errs.quantity = "수량을 숫자로 입력해주세요.";

      if (Object.keys(errs).length) {
        setFieldErrs(errs);
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
    const label = `${row?.id ?? ""}(${toFarmName(row?.farm, farmsById)})`;
    const ok = window.confirm(`'${label}' 계란재고를 삭제할까요?`);
    if (!ok) return;
    try {
      await deleteEggLot(row.id);
      setRows((prev) => prev.filter((r) => r?.id !== row.id));
    } catch (e) {
      alert(e?.response?.data?.detail || "삭제에 실패했습니다.");
    }
  }

  const filtered = useMemo(() => {
    const q = searchText.trim();
    const recvFrom = fReceivingFrom ? new Date(fReceivingFrom) : null;
    const recvTo = fReceivingTo ? new Date(fReceivingTo) : null;
    const layFrom = fLayingFrom ? new Date(fLayingFrom) : null;
    const layTo = fLayingTo ? new Date(fLayingTo) : null;

    const qtyMin = fQtyMin.trim() !== "" && Number.isFinite(Number(fQtyMin)) ? Number(fQtyMin) : null;
    const qtyMax = fQtyMax.trim() !== "" && Number.isFinite(Number(fQtyMax)) ? Number(fQtyMax) : null;

    return (rows || []).filter((r) => {
      const farmId = toFarmId(r?.farm);
      const farmName = toFarmName(r?.farm, farmsById);
      const farmText = `${farmName} ${farmId}`.trim();

      if (fFarm && !includesAnyTokens(farmText, fFarm)) return false;
      if (fEggType && asText(r?.egg_type) !== fEggType) return false;
      if (fEggWeight && asText(r?.egg_weight) !== fEggWeight) return false;
      if (!matchBool(r?.is_active, fIsActive)) return false;
      if (fEggGrade && !includesAnyTokens(r?.egg_grade, fEggGrade)) return false;
      if (fLocation && !includesAnyTokens(r?.location, fLocation)) return false;
      const qty = Number(r?.quantity);
      if (qtyMin !== null && (!Number.isFinite(qty) || qty < qtyMin)) return false;
      if (qtyMax !== null && (!Number.isFinite(qty) || qty > qtyMax)) return false;

      const recv = r?.receiving_date ? new Date(ymd(r.receiving_date)) : null;
      if (recvFrom && (!recv || recv < recvFrom)) return false;
      if (recvTo && (!recv || recv > recvTo)) return false;

      const lay = r?.laying_date ? new Date(ymd(r.laying_date)) : null;
      if (layFrom && (!lay || lay < layFrom)) return false;
      if (layTo && (!lay || lay > layTo)) return false;

      if (!q) return true;

      if (searchField === "all") {
        return (
          includesText(farmText, q) ||
          includesText(r?.shell_number, q) ||
          includesText(r?.egg_grade, q) ||
          includesText(r?.location, q) ||
          includesText(r?.memo, q) ||
          includesText(r?.id, q)
        );
      }
      if (searchField === "farm") return includesText(farmText, q);
      return includesText(r?.[searchField], q);
    });
  }, [
    rows,
    farmsById,
    searchText,
    searchField,
    fFarm,
    fReceivingFrom,
    fReceivingTo,
    fLayingFrom,
    fLayingTo,
    fEggType,
    fEggWeight,
    fEggGrade,
    fLocation,
    fQtyMin,
    fQtyMax,
    fIsActive,
  ]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  function onExcelExport() {
    const body = filtered.map((r) => {
      const farmId = toFarmId(r?.farm);
      return [
        r?.id ?? "",
        farmId,
        ymd(r?.receiving_date),
        asText(r?.shell_number ?? ""),
        r?.breeding_number ?? "",
        asText(r?.farm_type ?? ""),
        r?.age_weeks ?? "",
        asText(r?.egg_type ?? ""),
        asText(r?.egg_weight ?? ""),
        ymd(r?.laying_date),
        asText(r?.egg_grade ?? ""),
        asText(r?.location ?? ""),
        r?.quantity ?? "",
        asText(r?.memo ?? ""),
        r?.is_active ? "유" : "무",
      ];
    });
    downloadEggLotListXlsx(body);
  }

  return (
    <div className="accounting-page inventory-page">
      {/* 좌측 필터 */}
      <div className="filters-card">
        <div className="filters-title">필터</div>

        <div className="filter-group">
          <div className="filter-label">농장명(키워드 검색)</div>
          <input className="filter-input" value={fFarm} onChange={(e) => setFFarm(e.target.value)} placeholder="농장명(ID)" />
        </div>

        <div className="filter-group">
          <div className="filter-label">입고일(From)</div>
          <div className="field-row">
            <input className="filter-input" type="date" value={fReceivingFrom} onChange={(e) => setFReceivingFrom(e.target.value)} />
          </div>
          <div className="filter-label">입고일(To)</div>
          <div className="field-row">
            <input className="filter-input" type="date" value={fReceivingTo} onChange={(e) => setFReceivingTo(e.target.value)} />
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-label">산란일(From)</div>
          <div className="field-row">
            <input className="filter-input" type="date" value={fLayingFrom} onChange={(e) => setFLayingFrom(e.target.value)} />
          </div>
          <div className="filter-label">산란일(To)</div>
          <div className="field-row">
            <input className="filter-input" type="date" value={fLayingTo} onChange={(e) => setFLayingTo(e.target.value)} />
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-label">계란유형</div>
          <select className="filter-select" value={fEggType} onChange={(e) => setFEggType(e.target.value)}>
            {EGG_TYPE_CHOICES.map((t) => (
              <option key={t} value={t}>
                {t || "전체"}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">난중</div>
          <select className="filter-select" value={fEggWeight} onChange={(e) => setFEggWeight(e.target.value)}>
            {EGG_WEIGHT_CHOICES.map((w) => (
              <option key={w} value={w}>
                {w || "전체"}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">등급</div>
          <input className="filter-input" value={fEggGrade} onChange={(e) => setFEggGrade(e.target.value)} placeholder="등급" />
        </div>

        <div className="filter-group">
          <div className="filter-label">위치</div>
          <input className="filter-input" value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="위치" />
        </div>

        <div className="filter-group">
          <div className="filter-label">수량</div>
          <div style={{ display: "flex", gap: "var(--sp-8)" }}>
            <input className="filter-input" inputMode="numeric" value={fQtyMin} onChange={(e) => setFQtyMin(e.target.value)} placeholder="min" />
            <input className="filter-input" inputMode="numeric" value={fQtyMax} onChange={(e) => setFQtyMax(e.target.value)} placeholder="max" />
          </div>
        </div>

        <div className="filter-group" style={{ marginBottom: 0 }}>
          <div className="filter-label">활성여부</div>
          <select className="filter-select" value={fIsActive} onChange={(e) => setFIsActive(e.target.value)}>
            {ACTIVE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 메인 */}
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
          {loading ? "불러오는 중..." : err ? err : `총 ${filtered.length}건`}
        </div>
{err && <div className="field-error" style={{ marginTop: "var(--sp-10)" }}>{err}</div>}

        <div className="table-wrap no-x" style={{ marginTop: "var(--sp-12)" }}>
          <table className="data-table product-table">
            <thead>
              <tr>
                <th>계란재고ID</th>
                <th>농장</th>
                <th>입고일</th>
                <th>산란일</th>
                <th>난중</th>
                <th>가공</th>
                <th>등급</th>
                <th>수량</th>
                <th>위치</th>
                <th>메모</th>
                <th>활성</th>
                <th className="actions-cell">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="muted">불러오는 중...</td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={12} className="muted">데이터가 없습니다.</td>
                </tr>
              ) : (
                paged.map((r) => {
                  const farmId = toFarmId(r?.farm);
                  const farmName = toFarmName(r?.farm, farmsById);
                  const farmLabel = farmName ? `${farmName}(${farmId})` : farmId;
                  return (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td className="wrap-cell">{farmLabel}</td>
                      <td>{ymd(r.receiving_date)}</td>
                      <td>{ymd(r.laying_date)}</td>
                      <td>{asText(r.egg_weight)}</td>
                      <td>{asText(r.egg_type)}</td>
                      <td>{asText(r.egg_grade)}</td>
                      <td>{r.quantity}</td>
                      <td className="wrap-cell">{asText(r.location)}</td>
                      <td className="wrap-cell">{asText(r.memo)}</td>
                      <td>
                        <span className={`badge ${r.is_active ? "ok" : "no"}`}>{r.is_active ? "유" : "무"}</span>
                      </td>
                      <td className="actions-cell">
                        <div className="row-actions">
                          <button className="btn small secondary" type="button" onClick={() => openEdit(r)}>
                            수정
                          </button>
                          <button className="btn small danger" type="button" onClick={() => onDelete(r)}>
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

        <Pagination page={page} totalPages={totalPages} setPage={setPage} />
      </div>

      {/* CRUD 모달 */}
      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="modal-title">{editing ? "계란재고 수정" : "계란재고 추가"}</h3>
              <button className="btn secondary small" type="button" onClick={closeModal}>
                닫기
              </button>
            </div>

            <form onSubmit={onSubmit}>
              <div className="modal-body">
                {formErr && <div className="field-error" style={{ whiteSpace: "pre-wrap" }}>{formErr}</div>}

                <div className="modal-grid">
                  <div className="field">
                    <div className="filter-label">농장</div>
                    <select className="filter-select" value={form.farm} onChange={(e) => setForm((p) => ({ ...p, farm: e.target.value }))}>
                      <option value="">선택</option>
                      {(farms || []).map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.farm_name}({f.id})
                        </option>
                      ))}
                    </select>
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
                    <div className="filter-label">난중</div>
                    <select className="filter-select" value={form.egg_weight} onChange={(e) => setForm((p) => ({ ...p, egg_weight: e.target.value }))}>
                      <option value="">선택</option>
                      {EGG_WEIGHT_CHOICES.filter(Boolean).map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </select>
                    {fieldErrs.egg_weight && <div className="field-error">{fieldErrs.egg_weight}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">계란유형</div>
                    <select className="filter-select" value={form.egg_type} onChange={(e) => setForm((p) => ({ ...p, egg_type: e.target.value }))}>
                      {EGG_TYPE_CHOICES.map((t) => (
                        <option key={t} value={t}>
                          {t || "선택"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <div className="filter-label">등급</div>
                    <input className="filter-input" value={form.egg_grade} onChange={(e) => setForm((p) => ({ ...p, egg_grade: e.target.value }))} placeholder="등급" />
                    {fieldErrs.egg_grade && <div className="field-error">{fieldErrs.egg_grade}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">수량</div>
                    <input className="filter-input" type="number" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
                    {fieldErrs.quantity && <div className="field-error">{fieldErrs.quantity}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">난각번호</div>
                    <input className="filter-input" value={form.shell_number} onChange={(e) => setForm((p) => ({ ...p, shell_number: e.target.value }))} />
                  </div>

                  <div className="field">
                    <div className="filter-label">사육번호</div>
                    <input className="filter-input" type="number" value={form.breeding_number} onChange={(e) => setForm((p) => ({ ...p, breeding_number: e.target.value }))} />
                  </div>

                  <div className="field">
                    <div className="filter-label">농장유형</div>
                    <select className="filter-select" value={form.farm_type} onChange={(e) => setForm((p) => ({ ...p, farm_type: e.target.value }))}>
                      {FARM_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t || "선택안함"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <div className="filter-label">위치</div>
                    <input className="filter-input" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} />
                  </div>

                  <div className="field">
                    <div className="filter-label">인증/여부</div>
                    <label className="checkbox" style={{ marginTop: "var(--sp-6)" }}>
                      <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
                      <span>활성여부</span>
                    </label>
                  </div>

                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <div className="filter-label">메모</div>
                    <textarea className="filter-input" rows={4} value={form.memo} onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))} />
                  </div>
                </div>
              </div>

              <div className="modal-foot">
                <button className="btn secondary" type="button" onClick={closeModal} disabled={submitting}>
                  취소
                </button>
                <button className="btn" type="submit" disabled={submitting}>
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
