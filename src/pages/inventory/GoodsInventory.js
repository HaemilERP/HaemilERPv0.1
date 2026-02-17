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
  includesAnyTokens,
  includesText,
  matchBool,
  parseDRFErrors,
} from "../../utils/helpers";
import { downloadProductLotListXlsx } from "../../utils/excel";

import SearchBar from "../../components/common/SearchBar";
import Pagination from "../../components/common/Pagination";
import "../accounting/AccountingTable.css";

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

function toId(v) {
  if (v == null) return "";
  if (typeof v === "object") return asText(v.id ?? v.pk ?? "");
  return asText(v);
}

function toName(v, byId, nameKey = "product_name") {
  if (!v) return "";
  if (typeof v === "object") return asText(v[nameKey] ?? v.name ?? v.title);
  const id = asText(v);
  return asText(byId?.[id]?.[nameKey] ?? "");
}

export default function GoodsInventory() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [eggLots, setEggLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // CRUD
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
    memo: "",
    is_active: true,
  });

  // 상단 검색
  const [searchField, setSearchField] = useState("all");
  const [searchText, setSearchText] = useState("");

  // 좌측 필터
  const [fProduct, setFProduct] = useState("");
  const [fEggLot, setFEggLot] = useState("");
  const [fProcessType, setFProcessType] = useState("");
  const [fQtyMin, setFQtyMin] = useState("");
  const [fQtyMax, setFQtyMax] = useState("");
  const [fLocation, setFLocation] = useState("");
  const [fIsActive, setFIsActive] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const SEARCH_FIELDS = [
    { value: "all", label: "전체" },
    { value: "product", label: "제품" },
    { value: "egg_lot", label: "계란재고" },
    { value: "location", label: "위치" },
    { value: "memo", label: "메모" },
    { value: "id", label: "제품재고ID" },
  ];

  const productsById = useMemo(() => {
    const m = {};
    (products || []).forEach((p) => {
      const id = p?.id;
      if (id != null) m[String(id)] = p;
    });
    return m;
  }, [products]);

  const processTypes = useMemo(() => {
    const set = new Set();
    (products || []).forEach((p) => {
      const v = asText(p?.process_type);
      if (v) set.add(v);
    });
    return ["", ...Array.from(set)];
  }, [products]);

  const eggLotsById = useMemo(() => {
    const m = {};
    (eggLots || []).forEach((l) => {
      const id = l?.id;
      if (id != null) m[String(id)] = l;
    });
    return m;
  }, [eggLots]);

  const fetchRows = async () => {
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
      setErr(e?.response?.data?.detail || "제품재고 목록을 불러오지 못했습니다.");
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
    setForm({ product: "", egg_lot: "", quantity: "", location: "", memo: "", is_active: true });
    setModalOpen(true);
  }

  function openEdit(row) {
    setEditing(row);
    setFormErr("");
    setFieldErrs({});
    setForm({
      product: toId(row?.product) || "",
      egg_lot: toId(row?.egg_lot) || "",
      quantity: row?.quantity ?? "",
      location: asText(row?.location) || "",
      memo: asText(row?.memo) || "",
      is_active: Boolean(row?.is_active),
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
        location: form.location,
        is_active: Boolean(form.is_active),
        ...(form.memo ? { memo: form.memo } : {}),
      };

      const errs = {};
      if (!Number.isFinite(payload.product)) errs.product = "제품을 선택해주세요.";
      if (!Number.isFinite(payload.egg_lot)) errs.egg_lot = "계란재고를 선택해주세요.";
      if (!Number.isFinite(payload.quantity)) errs.quantity = "수량을 숫자로 입력해주세요.";
      if (!payload.location?.trim()) errs.location = "위치를 입력해주세요.";
      if (Object.keys(errs).length) {
        setFieldErrs(errs);
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
    const productLabel = toName(row?.product, productsById, "product_name");
    const ok = window.confirm(`'${row?.id ?? ""}(${productLabel || ""})' 제품재고를 삭제할까요?`);
    if (!ok) return;
    try {
      await deleteProductLot(row.id);
      setRows((prev) => prev.filter((r) => r?.id !== row.id));
    } catch (e) {
      alert(e?.response?.data?.detail || "삭제에 실패했습니다.");
    }
  }

  const filtered = useMemo(() => {
    const q = searchText.trim();
    const qtyMin = fQtyMin !== "" ? Number(fQtyMin) : null;
    const qtyMax = fQtyMax !== "" ? Number(fQtyMax) : null;

    return (rows || []).filter((r) => {
      const productId = toId(r?.product);
      const productName = toName(r?.product, productsById, "product_name");
      const productText = `${productName} ${productId}`.trim();

      const proc = asText(productsById?.[String(productId)]?.process_type);

      const eggLotId = toId(r?.egg_lot);
      const eggLotReceiving = ymd(eggLotsById?.[eggLotId]?.receiving_date);
      const eggLotText = `${eggLotId} ${eggLotReceiving}`.trim();

      if (fProduct && !includesAnyTokens(productText, fProduct)) return false;
      if (fEggLot && !includesAnyTokens(eggLotText, fEggLot)) return false;
      if (fProcessType && proc !== fProcessType) return false;
      if (qtyMin != null && Number(r?.quantity ?? 0) < qtyMin) return false;
      if (qtyMax != null && Number(r?.quantity ?? 0) > qtyMax) return false;
      if (fLocation && !includesAnyTokens(r?.location, fLocation)) return false;
      if (!matchBool(r?.is_active, fIsActive)) return false;

      if (!q) return true;
      if (searchField === "all") {
        return (
          includesText(productText, q) ||
          includesText(eggLotText, q) ||
          includesText(r?.location, q) ||
          includesText(r?.memo, q) ||
          includesText(r?.id, q)
        );
      }
      if (searchField === "product") return includesText(productText, q);
      if (searchField === "egg_lot") return includesText(eggLotText, q);
      return includesText(r?.[searchField], q);
    });
  }, [
    rows,
    productsById,
    eggLotsById,
    searchText,
    searchField,
    fProduct,
    fEggLot,
    fProcessType,
    fQtyMin,
    fQtyMax,
    fLocation,
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
    const body = filtered.map((r) => [
      r?.id ?? "",
      toId(r?.product),
      toId(r?.egg_lot),
      r?.quantity ?? "",
      asText(r?.location ?? ""),
      asText(r?.memo ?? ""),
      r?.is_active ? "유" : "무",
    ]);
    downloadProductLotListXlsx(body);
  }

  return (
    <div className="accounting-page inventory-page">
      <div className="filters-card">
        <div className="filters-title">필터</div>

        <div className="filter-group">
          <div className="filter-label">제품명(키워드 검색)</div>
          <input className="filter-input" value={fProduct} onChange={(e) => setFProduct(e.target.value)} placeholder="제품명(ID)" />
        </div>

        <div className="filter-group">
          <div className="filter-label">계란재고(키워드 검색)</div>
          <input className="filter-input" value={fEggLot} onChange={(e) => setFEggLot(e.target.value)} placeholder="계란재고(ID/입고일)" />
        </div>

        <div className="filter-group">
          <div className="filter-label">가공유형</div>
          <select className="filter-select" value={fProcessType} onChange={(e) => setFProcessType(e.target.value)}>
            {processTypes.map((v) => (
              <option key={v || "__all__"} value={v}>
                {v || "전체"}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">수량</div>
          <div style={{ display: "flex", gap: "var(--sp-8)" }}>
            <input
              className="filter-input"
              inputMode="numeric"
              value={fQtyMin}
              onChange={(e) => setFQtyMin(e.target.value)}
              placeholder="min"
            />
            <input
              className="filter-input"
              inputMode="numeric"
              value={fQtyMax}
              onChange={(e) => setFQtyMax(e.target.value)}
              placeholder="max"
            />
          </div>
        </div>

        <div className="filter-group">
          <div className="filter-label">위치</div>
          <input className="filter-input" value={fLocation} onChange={(e) => setFLocation(e.target.value)} placeholder="위치" />
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
          {loading ? "불러오는 중..." : err ? err : `총 ${filtered.length}건`}
        </div>
{err && <div className="field-error" style={{ marginTop: "var(--sp-10)" }}>{err}</div>}

        <div className="table-wrap no-x" style={{ marginTop: "var(--sp-12)" }}>
          <table className="data-table product-table">
            <thead>
              <tr>
                <th>제품재고ID</th>
                <th>제품</th>
                <th>계란재고</th>
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
                  <td colSpan={8} className="muted">불러오는 중...</td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={8} className="muted">데이터가 없습니다.</td>
                </tr>
              ) : (
                paged.map((r) => {
                  const productId = toId(r?.product);
                  const productName = toName(r?.product, productsById, "product_name");
                  const productLabel = productName ? `${productName}(${productId})` : productId;

                  const eggLotId = toId(r?.egg_lot);
                  const eggLotReceiving = ymd(eggLotsById?.[eggLotId]?.receiving_date);
                  const eggLotLabel = eggLotReceiving ? `${eggLotId} (${eggLotReceiving})` : eggLotId;

                  return (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td className="wrap-cell">{productLabel}</td>
                      <td className="wrap-cell">{eggLotLabel}</td>
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

      {modalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="modal-title">{editing ? "제품재고 수정" : "제품재고 추가"}</h3>
              <button className="btn secondary small" type="button" onClick={closeModal}>
                닫기
              </button>
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
                        <option key={p.id} value={p.id}>
                          {p.product_name}({p.id})
                        </option>
                      ))}
                    </select>
                    {fieldErrs.product && <div className="field-error">{fieldErrs.product}</div>}
                  </div>

                  <div className="field">
                    <div className="filter-label">계란재고</div>
                    <select className="filter-select" value={form.egg_lot} onChange={(e) => setForm((p) => ({ ...p, egg_lot: e.target.value }))}>
                      <option value="">선택</option>
                      {(eggLots || []).map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.id} / {ymd(l.receiving_date)} / {asText(l.egg_weight)} / {l.quantity}개
                        </option>
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

                  <div className="field" style={{ gridColumn: "1 / -1" }}>
                    <div className="filter-label">메모</div>
                    <textarea className="filter-input" rows={4} value={form.memo} onChange={(e) => setForm((p) => ({ ...p, memo: e.target.value }))} />
                  </div>

                  <div className="field">
                    <div className="filter-label">인증/여부</div>
                    <label className="checkbox" style={{ marginTop: "var(--sp-6)" }}>
                      <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
                      <span>활성여부</span>
                    </label>
                  </div>
                </div>
              </div>

              <div className="modal-head" style={{ borderTop: "1px solid var(--color-border-soft)", borderBottom: "none" }}>
                <div className="head-actions">
                  <button className="btn secondary" type="button" onClick={closeModal} disabled={submitting}>
                    취소
                  </button>
                  <button className="btn" type="submit" disabled={submitting}>
                    {submitting ? "저장 중..." : "저장"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
