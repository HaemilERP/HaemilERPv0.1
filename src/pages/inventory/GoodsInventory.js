import { useCallback, useEffect, useMemo, useState } from "react";
import {
  createProductLot,
  deleteProductLot,
  listEggLots,
  listProductLots,
  patchProductLot,
} from "../../services/inventoryApi";
import { listProducts } from "../../services/accountingApi";
import {
  asText,
  getApiErrorMessage,
  getIdentifierLabel,
  includesAnyTokens,
  includesText,
  parseDRFErrors,
} from "../../utils/helpers";
import { downloadProductLotListXlsx } from "../../utils/excel";

import SearchBar from "../../components/common/SearchBar";
import Pagination from "../../components/common/Pagination";
import "../accounting/AccountingTable.css";

function ymd(v) {
  const s = asText(v);
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}

function toPk(v) {
  if (v == null) return "";
  if (typeof v === "object") return String(v.id ?? v.pk ?? "");
  return String(v);
}

function toFilterNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function productLabel(product) {
  if (!product) return "-";
  const id = getIdentifierLabel(product, ["product_no", "product_id"], ["id"]);
  const name = asText(product?.product_name);
  if (name && id) return `${name} (${id})`;
  return name || id || "-";
}

function eggLotLabel(lot) {
  if (!lot) return "-";
  const id = getIdentifierLabel(lot, ["Egglot_no", "egg_lot_id"], ["id"]);
  const recv = ymd(lot?.receiving_date);
  return [id, recv].filter(Boolean).join(" / ") || "-";
}

export default function GoodsInventory() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [eggLots, setEggLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [fieldErrs, setFieldErrs] = useState({});
  const [form, setForm] = useState({
    product: "",
    egg_lot: "",
    quantity: "",
    location: "",
    process_day: "",
    machine_line: "",
    memo: "",
    history_memo: "",
  });

  const [searchField, setSearchField] = useState("all");
  const [searchText, setSearchText] = useState("");

  const [fProduct, setFProduct] = useState("");
  const [fProcessDay, setFProcessDay] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fQuantityMin, setFQuantityMin] = useState("");
  const [fQuantityMax, setFQuantityMax] = useState("");
  const [fLine, setFLine] = useState("");

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const SEARCH_FIELDS = [
    { value: "all", label: "전체" },
    { value: "ProductLot_no", label: "제품재고식별자" },
    { value: "product", label: "제품" },
    { value: "egg_lot", label: "계란식별자" },
    { value: "memo", label: "메모" },
  ];

  const productsByPk = useMemo(() => {
    const m = {};
    (products || []).forEach((p) => {
      const pk = toPk(p);
      if (pk) m[pk] = p;
    });
    return m;
  }, [products]);

  const eggLotsByPk = useMemo(() => {
    const m = {};
    (eggLots || []).forEach((l) => {
      const pk = toPk(l);
      if (pk) m[pk] = l;
    });
    return m;
  }, [eggLots]);

  async function fetchRows() {
    setLoading(true);
    setErr("");
    try {
      const [lots, prods, eggs] = await Promise.all([
        listProductLots(),
        listProducts(),
        listEggLots(),
      ]);
      setRows(lots);
      setProducts(prods);
      setEggLots(eggs);
    } catch (e) {
      setErr(getApiErrorMessage(e, "제품재고 목록을 불러오지 못했습니다."));
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
      product: "",
      egg_lot: "",
      quantity: "",
      location: "",
      process_day: "",
      machine_line: "",
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
      product: toPk(row?.product),
      egg_lot: toPk(row?.egg_lot),
      quantity: row?.quantity == null ? "" : String(row.quantity),
      location: asText(row?.location),
      process_day: ymd(row?.process_day),
      machine_line: asText(row?.machine_line),
      memo: asText(row?.memo),
      history_memo: "",
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
    if (submitting) return;
    setSubmitting(true);
    setFormErr("");
    setFieldErrs({});

    try {
      const payload = {
        product: Number(form.product),
        egg_lot: Number(form.egg_lot),
        quantity: Number(form.quantity),
        location: String(form.location || "").trim(),
        ...(String(form.process_day || "").trim() ? { process_day: String(form.process_day).trim() } : {}),
        ...(String(form.machine_line || "").trim() ? { machine_line: String(form.machine_line).trim() } : {}),
        ...(String(form.memo || "").trim() ? { memo: String(form.memo).trim() } : {}),
        ...(editing?.id != null ? { history_memo: String(form.history_memo || "").trim() } : {}),
      };

      const nextErrs = {};
      if (!Number.isFinite(payload.product)) nextErrs.product = "제품을 선택해주세요.";
      if (!Number.isFinite(payload.egg_lot)) nextErrs.egg_lot = "계란식별자를 선택해주세요.";
      if (!Number.isFinite(payload.quantity)) nextErrs.quantity = "수량은 숫자여야 합니다.";
      if (!payload.location) nextErrs.location = "위치를 입력해주세요.";
      if (editing?.id != null && !payload.history_memo) nextErrs.history_memo = "수정 시 변경내역 메모를 입력해주세요.";
      if (Object.keys(nextErrs).length) {
        setFieldErrs(nextErrs);
        return;
      }

      if (editing?.id != null) await patchProductLot(editing.id, payload);
      else await createProductLot(payload);

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
    const label = getIdentifierLabel(row, ["ProductLot_no", "product_lot_id"], ["id"]);
    const ok = window.confirm(`'${label}' 제품재고를 삭제할까요?`);
    if (!ok) return;
    try {
      await deleteProductLot(row.id);
      setRows((prev) => prev.filter((r) => r?.id !== row.id));
    } catch (e) {
      window.alert(getApiErrorMessage(e, "삭제에 실패했습니다."));
    }
  }

  const filtered = useMemo(() => {
    const q = searchText.trim();
    const quantityMin = toFilterNumber(fQuantityMin);
    const quantityMax = toFilterNumber(fQuantityMax);
    return (rows || []).filter((r) => {
      const product =
        productsByPk[toPk(r?.product)] ||
        (typeof r?.product === "object" ? r.product : null);
      const productText = productLabel(product || { product_no: toPk(r?.product) });

      const eggLot =
        eggLotsByPk[toPk(r?.egg_lot)] ||
        (typeof r?.egg_lot === "object" ? r.egg_lot : null);
      const eggText = eggLotLabel(eggLot || { Egglot_no: toPk(r?.egg_lot) });

      const quantity = Number(r?.quantity);
      const processDay = ymd(r?.process_day);

      if (fProduct && !includesAnyTokens(productText, fProduct)) return false;
      if (fProcessDay && processDay !== fProcessDay) return false;
      if (fLocation && !includesAnyTokens(r?.location, fLocation)) return false;
      if (quantityMin != null && (!Number.isFinite(quantity) || quantity < quantityMin)) return false;
      if (quantityMax != null && (!Number.isFinite(quantity) || quantity > quantityMax)) return false;
      if (fLine && !includesAnyTokens(r?.machine_line, fLine)) return false;

      if (!q) return true;
      if (searchField === "ProductLot_no") {
        return includesText(
          getIdentifierLabel(r, ["ProductLot_no", "product_lot_id"], ["id"]),
          q
        );
      }
      if (searchField === "product") return includesText(productText, q);
      if (searchField === "egg_lot") return includesText(eggText, q);
      if (searchField === "location") return includesText(r?.location, q);
      if (searchField === "memo") return includesText(r?.memo, q);

      return (
        includesText(getIdentifierLabel(r, ["ProductLot_no", "product_lot_id"], ["id"]), q) ||
        includesText(productText, q) ||
        includesText(eggText, q) ||
        includesText(r?.location, q) ||
        includesText(processDay, q) ||
        includesText(r?.machine_line, q) ||
        includesText(r?.memo, q)
      );
    });
  }, [rows, productsByPk, eggLotsByPk, searchText, searchField, fProduct, fProcessDay, fLocation, fQuantityMin, fQuantityMax, fLine]);

  useEffect(() => {
    setPage(1);
  }, [searchField, searchText, fProduct, fProcessDay, fLocation, fQuantityMin, fQuantityMax, fLine]);

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
      getIdentifierLabel(r, ["ProductLot_no", "product_lot_id"], ["id"]),
      getIdentifierLabel(
        productsByPk[toPk(r?.product)] || {},
        ["product_no", "product_id"],
        [toPk(r?.product)]
      ),
      getIdentifierLabel(
        eggLotsByPk[toPk(r?.egg_lot)] || {},
        ["Egglot_no", "egg_lot_id"],
        [toPk(r?.egg_lot)]
      ),
      asText(r?.quantity || ""),
      asText(r?.location || ""),
      ymd(r?.process_day),
      asText(r?.machine_line || ""),
      asText(r?.memo || ""),
    ]);
    downloadProductLotListXlsx(body);
  }

  return (
    <div className="accounting-page inventory-page">
      <div className="filters-card">
        <div className="filters-title">필터</div>

        <div className="filter-group">
          <div className="filter-label">제품</div>
          <input className="filter-input" value={fProduct} onChange={(e) => setFProduct(e.target.value)} placeholder="예: 제품명 제품식별자" />
        </div>

        <div className="filter-group">
          <div className="filter-label">공정일</div>
          <input
            className="filter-input"
            type="date"
            value={fProcessDay}
            onChange={(e) => setFProcessDay(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <div className="filter-label">위치</div>
          <input className="filter-input" value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="위치" />
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

        <div className="filter-group">
          <div className="filter-label">라인</div>
          <input className="filter-input" value={fLine} onChange={(e) => setFLine(e.target.value)} placeholder="라인" />
        </div>
      </div>

      <div className="page-main">
        <div className="page-head">
          <h2 className="page-title">제품재고</h2>
          <div className="head-actions">
            <button className="btn secondary" type="button" onClick={openCreate}>
              + 제품재고 추가
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
          {loading ? "불러오는 중.." : err ? err : `총 ${filtered.length}건`}
        </div>
        {err && <div className="field-error" style={{ marginTop: "var(--sp-10)" }}>{err}</div>}

        <div className="table-wrap no-x" style={{ marginTop: "var(--sp-12)" }}>
          <table className="data-table product-table">
            <thead>
              <tr>
                <th>제품재고식별자</th>
                <th>제품</th>
                <th>계란식별자</th>
                <th>수량</th>
                <th>위치</th>
                <th>공정일</th>
                <th>라인</th>
                <th>메모</th>
                <th className="actions-cell">작업</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="muted">불러오는 중..</td></tr>
              ) : !paged.length ? (
                <tr><td colSpan={9} className="muted">데이터가 없습니다.</td></tr>
              ) : (
                paged.map((r) => {
                  const product =
                    productsByPk[toPk(r?.product)] ||
                    (typeof r?.product === "object" ? r.product : null);
                  const eggLot =
                    eggLotsByPk[toPk(r?.egg_lot)] ||
                    (typeof r?.egg_lot === "object" ? r.egg_lot : null);

                  return (
                    <tr key={r.id ?? getIdentifierLabel(r, ["ProductLot_no", "product_lot_id"], ["id"])}>
                      <td>{getIdentifierLabel(r, ["ProductLot_no", "product_lot_id"], ["id"])}</td>
                      <td className="wrap-cell">{productLabel(product || { product_no: toPk(r?.product) })}</td>
                      <td className="wrap-cell">{eggLotLabel(eggLot || { Egglot_no: toPk(r?.egg_lot) })}</td>
                      <td>{asText(r?.quantity)}</td>
                      <td className="wrap-cell">{asText(r?.location)}</td>
                      <td>{ymd(r?.process_day)}</td>
                      <td>{asText(r?.machine_line)}</td>
                      <td className="wrap-cell">{asText(r?.memo)}</td>
                      <td className="actions-cell">
                        <div className="row-actions">
                          <button className="btn small secondary" type="button" onClick={() => openEdit(r)}>수정</button>
                          <button className="btn small danger" type="button" onClick={() => onDelete(r)}>삭제</button>
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

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="modal-title">{editing ? "제품재고 수정" : "제품재고 추가"}</h3>
            </div>

            <form onSubmit={onSubmit}>
              <div className="modal-body">
                {formErr && <div className="field-error" style={{ whiteSpace: "pre-wrap" }}>{formErr}</div>}

                <div className="modal-grid">
                  <div className="field">
                    <div className="filter-label">제품</div>
                    <select className="filter-select" value={form.product} onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))}>
                      <option value="">선택</option>
                      {(products || []).map((p) => (
                        <option key={toPk(p)} value={toPk(p)}>{productLabel(p)}</option>
                      ))}
                    </select>
                    {fieldErrs.product && <div className="field-error">{fieldErrs.product}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">계란식별자</div>
                    <select className="filter-select" value={form.egg_lot} onChange={(e) => setForm((p) => ({ ...p, egg_lot: e.target.value }))}>
                      <option value="">선택</option>
                      {(eggLots || []).map((l) => (
                        <option key={toPk(l)} value={toPk(l)}>{eggLotLabel(l)}</option>
                      ))}
                    </select>
                    {fieldErrs.egg_lot && <div className="field-error">{fieldErrs.egg_lot}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">수량</div>
                    <input className="filter-input" type="number" value={form.quantity} onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))} />
                    {fieldErrs.quantity && <div className="field-error">{fieldErrs.quantity}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">위치</div>
                    <input className="filter-input" value={form.location} onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))} placeholder="위치" />
                    {fieldErrs.location && <div className="field-error">{fieldErrs.location}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">공정일</div>
                    <input
                      className="filter-input"
                      type="date"
                      value={form.process_day}
                      onChange={(e) => setForm((p) => ({ ...p, process_day: e.target.value }))}
                    />
                  </div>

                  <div className="field">
                    <div className="filter-label">라인</div>
                    <input className="filter-input" value={form.machine_line} onChange={(e) => setForm((p) => ({ ...p, machine_line: e.target.value }))} placeholder="예: LINE-1" />
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
