import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listEggLots,
  listProductLotHistories,
  listProductLots,
  patchProductLotHistory,
} from "../../services/inventoryApi";
import { listProducts } from "../../services/accountingApi";
import { asText, includesText, matchBool, parseDRFErrors } from "../../utils/helpers";
import { downloadProductLotHistoryListXlsx } from "../../utils/excel";
import SearchBar from "../../components/common/SearchBar";
import Pagination from "../../components/common/Pagination";
import "../accounting/AccountingTable.css";

function formatYMDHMS(v) {
  const s = asText(v);
  if (!s) return "";
  const m = s.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  if (m) return m[0].replace("T", " ");
  return s;
}

function userToLabel(u) {
  if (!u) return "";
  if (typeof u === "object") return asText(u.username ?? u.name ?? u.email ?? u.id);
  return asText(u);
}

function productToName(p, products) {
  if (!p) return "";
  if (typeof p === "object") return asText(p.product_name ?? p.name ?? p.title ?? p.id);
  const id = asText(p);
  const found = Array.isArray(products) ? products.find((x) => asText(x?.id) === id) : null;
  return asText(found?.product_name ?? found?.name ?? id);
}

function eggLotToLabel(lot, eggLots) {
  if (!lot) return "";
  if (typeof lot === "object") {
    const id = asText(lot.id ?? lot.pk ?? "");
    const farmName =
      typeof lot.farm === "object" ? asText(lot.farm?.farm_name ?? lot.farm?.name) : "";
    const receiving = asText(lot.receiving_date).slice(0, 10);
    const weight = asText(lot.egg_weight);
    return [id || "", farmName, receiving, weight].filter(Boolean).join(" ");
  }
  const id = asText(lot);
  const found = Array.isArray(eggLots) ? eggLots.find((x) => asText(x?.id) === id) : null;
  return found ? eggLotToLabel(found, eggLots) : id;
}

function productLotToLabel(lot, productLots, products, eggLots) {
  if (!lot) return "";
  if (typeof lot === "object") {
    const id = asText(lot.id ?? lot.pk ?? "");
    const productName = productToName(lot.product, products);
    const location = asText(lot.location);
    const qty = lot.quantity != null ? `${lot.quantity}개` : "";
    const eggLotLabel = eggLotToLabel(lot.egg_lot, eggLots);
    const parts = [id || "", productName, location, qty, eggLotLabel].filter(Boolean);
    return parts.join(" ");
  }
  const id = asText(lot);
  const found = Array.isArray(productLots) ? productLots.find((x) => asText(x?.id) === id) : null;
  return found ? productLotToLabel(found, productLots, products, eggLots) : id;
}

const CHANGE_TYPE_LABEL = {
  RECEIVING: "입고",
  ADJUSTMENT: "수량조정",
  REMOVE: "삭제",
  ETC: "기타",
};

export default function GoodsInventoryHistory() {
  const [rows, setRows] = useState([]);
  const [products, setProducts] = useState([]);
  const [productLots, setProductLots] = useState([]);
  const [eggLots, setEggLots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // 검색
  const [searchField, setSearchField] = useState("all");
  const [searchText, setSearchText] = useState("");

  // 좌측 필터
  const [fChangeType, setFChangeType] = useState("");
  const [fHasMemo, setFHasMemo] = useState("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // memo edit
  const [memoModalOpen, setMemoModalOpen] = useState(false);
  const [memoTarget, setMemoTarget] = useState(null);
  const [memoText, setMemoText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");
  const [fieldErrs, setFieldErrs] = useState({});

  const closeMemoModal = useCallback(() => {
    if (submitting) return;
    setMemoModalOpen(false);
  }, [submitting]);

  useEffect(() => {
    if (!memoModalOpen) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") closeMemoModal();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [memoModalOpen, closeMemoModal]);

  const SEARCH_FIELDS = [
    { value: "all", label: "전체" },
    { value: "product_lot", label: "제품재고" },
    { value: "product", label: "제품" },
    { value: "changed_by", label: "변경자" },
    { value: "memo", label: "메모" },
    { value: "id", label: "ID" },
  ];

  const fetchSupport = async () => {
    try {
      const [p, lots, egg] = await Promise.all([listProducts(), listProductLots(), listEggLots()]);
      setProducts(p);
      setProductLots(lots);
      setEggLots(egg);
    } catch {
      // optional
    }
  };

  const fetchRows = async () => {
    setLoading(true);
    setErr("");
    try {
      const data = await listProductLotHistories();
      setRows(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || "제품재고 변경내역을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    fetchSupport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSearch = async () => {
    await fetchRows();
  };

  function withinDateTime(dt, from, to) {
    const s = asText(dt);
    if (!s) return true;
    const d = s.slice(0, 10);
    if (from && d < from) return false;
    if (to && d > to) return false;
    return true;
  }

  const matchesSearch = useCallback((r) => {
    const q = searchText.trim();
    if (!q) return true;

    const lotLabel = productLotToLabel(r.product_lot, productLots, products, eggLots);
    const productName =
      typeof r.product_lot === "object" ? productToName(r.product_lot?.product, products) : "";
    const userLabel = userToLabel(r.changed_by);
    const memo = asText(r.memo);

    const hayAll = [r.id, lotLabel, productName, userLabel, memo, r.change_type]
      .map(asText)
      .join(" ");

    if (searchField === "all") return includesText(hayAll, q);
    if (searchField === "product_lot") return includesText(lotLabel, q);
    if (searchField === "product") return includesText(productName, q);
    if (searchField === "changed_by") return includesText(userLabel, q);
    if (searchField === "memo") return includesText(memo, q);
    if (searchField === "id") return includesText(r.id, q);
    return true;
  }, [searchText, searchField, productLots, products, eggLots]);

  const filtered = useMemo(() => {
    return (rows || [])
      .filter(matchesSearch)
      .filter((r) => {
        if (fChangeType && asText(r.change_type) !== asText(fChangeType)) return false;
        if (fHasMemo) {
          const has = Boolean(asText(r.memo).trim());
          if (!matchBool(has, fHasMemo)) return false;
        }
        if (!withinDateTime(r.changed_at, fFrom, fTo)) return false;
        return true;
      });
  }, [rows, matchesSearch, fChangeType, fHasMemo, fFrom, fTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [searchField, searchText, fChangeType, fHasMemo, fFrom, fTo]);

  function openMemo(r) {
    setMemoTarget(r);
    setMemoText(asText(r?.memo));
    setFormErr("");
    setFieldErrs({});
    setMemoModalOpen(true);
  }

  async function saveMemo() {
    if (!memoTarget?.id || submitting) return;
    setSubmitting(true);
    setFormErr("");
    setFieldErrs({});
    try {
      await patchProductLotHistory(memoTarget.id, { memo: memoText });
      setMemoModalOpen(false);
      await fetchRows();
    } catch (e) {
      const parsed = e?.response?.data ? parseDRFErrors(e.response.data) : null;
      setFormErr(parsed?.form || "저장에 실패했습니다.");
      setFieldErrs(parsed?.fields || {});
    } finally {
      setSubmitting(false);
    }
  }

  async function onExport() {
    const body = filtered.map((r) => [
      r.id ?? "",
      productLotToLabel(r.product_lot, productLots, products, eggLots) || "-",
      CHANGE_TYPE_LABEL[r.change_type] || asText(r.change_type),
      r.quantity_before ?? "",
      r.quantity_after ?? "",
      r.quantity_change ?? "",
      userToLabel(r.changed_by),
      formatYMDHMS(r.changed_at),
      asText(r.memo),
    ]);
    await downloadProductLotHistoryListXlsx(body);
  }

  return (
    <div className="accounting-page">
      <aside className="filters-card">
        <div className="filters-title">필터</div>

        <div className="filter-group">
          <div className="filter-label">변경유형</div>
          <select className="filter-select" value={fChangeType} onChange={(e) => setFChangeType(e.target.value)}>
            <option value="">전체</option>
            {Object.entries(CHANGE_TYPE_LABEL).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">메모 존재</div>
          <select className="filter-select" value={fHasMemo} onChange={(e) => setFHasMemo(e.target.value)}>
            <option value="">전체</option>
            <option value="true">유</option>
            <option value="false">무</option>
          </select>
        </div>

        <div className="filter-group">
          <div className="filter-label">변경일 (From)</div>
          <input className="filter-input" type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
        </div>
        <div className="filter-group">
          <div className="filter-label">변경일 (To)</div>
          <input className="filter-input" type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
        </div>
      </aside>

      <section className="page-main">
        <div className="page-head">
          <h2 className="page-title">제품재고 변경내역</h2>
          <div className="head-actions">
            <button className="btn secondary" type="button" onClick={onExport} disabled={loading}>
              엑셀출력
            </button>
          </div>
        </div>

        <SearchBar
          field={searchField}
          setField={setSearchField}
          text={searchText}
          setText={setSearchText}
          fields={SEARCH_FIELDS}
          loading={loading}
          onSearch={onSearch}
          placeholder="검색어 (예: 제품명, #제품재고ID, 변경자, 메모)"
          inputWidth="var(--w-330)"
        />

        <div className="muted" style={{ marginTop: "var(--sp-10)" }}>
          {loading ? "불러오는 중..." : err ? err : `총 ${filtered.length}건`}
        </div>

        <div className="table-wrap no-x" style={{ marginTop: "var(--sp-12)" }}>
          <table className="data-table product-table">
            <colgroup>
              <col style={{ width: "5%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "7%" }} />
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "18%" }} />
              <col style={{ width: "8%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>ID</th>
                <th>제품재고</th>
                <th>유형</th>
                <th className="num-cell">변경전</th>
                <th className="num-cell">변경후</th>
                <th className="num-cell">변화량</th>
                <th>변경자</th>
                <th>변경일시</th>
                <th>메모</th>
                <th className="actions-cell">관리</th>
              </tr>
            </thead>
            <tbody>
              {!loading && !pageRows.length && (
                <tr>
                  <td colSpan={10} className="muted" style={{ textAlign: "left" }}>
                    데이터가 없습니다.
                  </td>
                </tr>
              )}

              {pageRows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td className="wrap-cell">{productLotToLabel(r.product_lot, productLots, products, eggLots) || "-"}</td>
                  <td>{CHANGE_TYPE_LABEL[r.change_type] || asText(r.change_type)}</td>
                  <td>{r.quantity_before ?? ""}</td>
                  <td>{r.quantity_after ?? ""}</td>
                  <td>{r.quantity_change ?? ""}</td>
                  <td className="wrap-cell">{userToLabel(r.changed_by) || "-"}</td>
                  <td>{formatYMDHMS(r.changed_at)}</td>
                  <td className="wrap-cell">{asText(r.memo)}</td>
                  <td className="actions-cell">
                    <div className="row-actions">
                      <button className="btn small secondary" type="button" onClick={() => openMemo(r)}>
                        메모
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: "var(--sp-12)" }}>
          <Pagination page={page} setPage={setPage} totalPages={totalPages} />
        </div>
      </section>

      {memoModalOpen && (
        <div className="modal-overlay" onMouseDown={closeMemoModal}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h3 className="modal-title">변경내역 메모</h3>
              <button className="btn secondary" type="button" onClick={closeMemoModal} disabled={submitting}>
                닫기
              </button>
            </div>

            <div className="modal-body">
              <div className="muted">
                대상: {memoTarget ? productLotToLabel(memoTarget.product_lot, productLots, products, eggLots) : ""} / 변경유형: {memoTarget ? (CHANGE_TYPE_LABEL[memoTarget.change_type] || memoTarget.change_type) : ""}
              </div>

              {formErr && <div className="field-error" style={{ marginTop: "var(--sp-10)" }}>{formErr}</div>}
              {fieldErrs.memo && <div className="field-error" style={{ marginTop: "var(--sp-10)" }}>{fieldErrs.memo}</div>}

              <div className="field" style={{ marginTop: "var(--sp-10)" }}>
                <textarea value={memoText} onChange={(e) => setMemoText(e.target.value)} rows={6} />
                <div className="field-help">변경내역에 대한 코멘트를 남길 수 있습니다.</div>
              </div>
            </div>

            <div className="modal-foot">
              <button className="btn secondary" type="button" onClick={closeMemoModal} disabled={submitting}>
                취소
              </button>
              <button className="btn" type="button" onClick={saveMemo} disabled={submitting}>
                {submitting ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
