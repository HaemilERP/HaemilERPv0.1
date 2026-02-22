import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "../accounting/AccountingTable.css";
import "./Purchase.css";

import { listCustomers, listProducts } from "../../services/accountingApi";
import { createOrder, deleteOrder, listOrders, patchOrder } from "../../services/purchaseApi";
import { getApiErrorMessage } from "../../utils/helpers";
import {
  loadAllOrderMatches,
  deleteOrderMatch,
  isOrderMatchSaved,
} from "../../utils/orderMatchLocal";
import {
  loadAllOrderExtras,
  saveOrderExtra,
  deleteOrderExtra,
} from "../../utils/orderExtraLocal";

function todayYmd() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(n) {
  return num(n, 0).toLocaleString();
}

function isTaxable(t) {
  const s = String(t || "").toUpperCase();
  return s === "TAXABLE" || s === "과세" || s === "TAX";
}

// 발주 목록 테이블: colgroup 퍼센트로 폭 조정
const ORDER_LIST_COLS = [
  { key: "id", width: "4%" },
  { key: "customer", width: "10%" },
  { key: "center", width: "6%" },
  { key: "product", width: "14%" },
  { key: "qty", width: "5%" },
  { key: "confirmed", width: "5%" },
  { key: "tax", width: "4%" },
  { key: "unit", width: "6%" },
  { key: "supply", width: "6%" },
  { key: "vat", width: "5%" },
  { key: "date", width: "6%" },
  { key: "memo", width: "9%" },
  { key: "orderStatus", width: "5%" },
  { key: "matchStatus", width: "5%" },
  { key: "actions", width: "10%" },
];

export default function Purchase() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  // 발주 페이지 최초 진입 시: 오늘 날짜로 기본 조회
  const [date, setDate] = useState(sp.get("date") || todayYmd());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // create form
  const [form, setForm] = useState({
    customer: "", // 거처(고객사)
    center_type: "", // 센터구분
    product: "", // 제품
    quantity: "", // 발주수량(판)
    confirmed_quantity: "", // 확정수량(판)
    tax_type: "TAXABLE", // 과세구분
    unit_price: "", // 단가
    delivery_date: sp.get("date") || todayYmd(),
    memo: "", // 비고
  });
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");

  // local matching cache for status
  const [localMatches, setLocalMatches] = useState(() => loadAllOrderMatches());
  const [localExtras, setLocalExtras] = useState(() => loadAllOrderExtras());

  const customersById = useMemo(() => {
    const m = {};
    (customers || []).forEach((c) => {
      if (c?.id != null) m[String(c.id)] = c;
    });
    return m;
  }, [customers]);

  const productsById = useMemo(() => {
    const m = {};
    (products || []).forEach((p) => {
      if (p?.id != null) m[String(p.id)] = p;
    });
    return m;
  }, [products]);

  const selectedProduct = useMemo(() => productsById[String(form.product)] || null, [form.product, productsById]);

  const baseQty = useMemo(() => {
    const cq = num(form.confirmed_quantity, NaN);
    if (Number.isFinite(cq) && cq >= 0) return cq;
    return num(form.quantity, 0);
  }, [form.confirmed_quantity, form.quantity]);

  const supplyPrice = useMemo(() => {
    const up = num(form.unit_price, 0);
    return Math.max(0, baseQty) * Math.max(0, up);
  }, [baseQty, form.unit_price]);

  const vatPrice = useMemo(() => {
    if (!isTaxable(form.tax_type)) return 0;
    return Math.round(supplyPrice * 0.1);
  }, [form.tax_type, supplyPrice]);

  async function bootstrap() {
    setLoading(true);
    setErr("");
    try {
      const [cs, ps] = await Promise.all([listCustomers(), listProducts()]);
      setCustomers(cs);
      setProducts(ps);
    } catch (e) {
      setErr(getApiErrorMessage(e, "기초 데이터를 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }

  async function fetchOrders(targetDate) {
    setLoading(true);
    setErr("");
    try {
      const list = await listOrders(targetDate ? { delivery_date: targetDate } : {});
      setRows(list);
    } catch (e) {
      setErr(getApiErrorMessage(e, "발주 목록을 불러오지 못했습니다."));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // 날짜 선택 전에는 목록을 비워둡니다(불필요한 전체 조회 방지)
    if (!date) {
      setRows([]);
      return;
    }
    fetchOrders(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  // local match/extra status should reflect after other page save
  useEffect(() => {
    const refresh = () => {
      setLocalMatches(loadAllOrderMatches());
      setLocalExtras(loadAllOrderExtras());
    };
    const onStorage = (e) => {
      if (!e?.key) return;
      if (e.key.includes("haemil_order_egg_matches") || e.key.includes("haemil_order_extras")) refresh();
    };
    const onCustom = () => refresh();
    const onVis = () => {
      if (document.visibilityState === "visible") refresh();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("haemil:orderMatchUpdated", onCustom);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("haemil:orderMatchUpdated", onCustom);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  function setF(k, v) {
    setForm((p) => ({ ...p, [k]: v }));
  }

  function isConfirmed(order) {
    if (!order) return false;
    if (order?.is_confirmed != null) return Boolean(order.is_confirmed);
    const s = String(order?.status || "").toUpperCase();
    return s === "CONFIRMED" || s === "DONE" || s === "COMPLETED";
  }

  function getMatch(order) {
    if (!order?.id) return null;
    return localMatches?.[String(order.id)] || null;
  }

  function getExtra(order) {
    if (!order?.id) return null;
    return localExtras?.[String(order.id)] || null;
  }

  async function createOrderWithFallback(fullPayload, minimalPayload, extrasToStore) {
    try {
      const created = await createOrder(fullPayload);
      if (created?.id != null && extrasToStore) {
        // 백엔드에 필드가 아직 없어도 UI 표시를 위해 로컬에 저장
        saveOrderExtra(created.id, extrasToStore);
        setLocalExtras(loadAllOrderExtras());
      }
      return created;
    } catch (e) {
      // 백엔드 스키마 미구현(추가 필드로 400)일 수 있어 최소 payload로 재시도
      const status = e?.response?.status;
      if (status !== 400) throw e;
      const created = await createOrder(minimalPayload);
      if (created?.id != null && extrasToStore) {
        saveOrderExtra(created.id, extrasToStore);
        setLocalExtras(loadAllOrderExtras());
      }
      return created;
    }
  }

  async function onCreate(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormErr("");
    try {
      const payload = {
        customer: Number(form.customer),
        product: Number(form.product),
        quantity: Number(form.quantity),
        delivery_date: form.delivery_date,
        ...(form.memo ? { history_memo: form.memo } : {}),

        // ✅ 백엔드 미구현일 수 있는 확장 필드들
        ...(form.center_type ? { center_type: form.center_type } : {}),
        ...(form.confirmed_quantity !== "" ? { confirmed_quantity: Number(form.confirmed_quantity) } : {}),
        ...(form.tax_type ? { tax_type: form.tax_type } : {}),
        ...(form.unit_price !== "" ? { unit_price: Number(form.unit_price) } : {}),
        supply_price: supplyPrice,
        vat_price: vatPrice,
        remark: form.memo,
        ...(selectedProduct?.egg_weight ? { product_egg_weight: selectedProduct.egg_weight } : {}),
      };

      const minimal = {
        customer: Number(form.customer),
        product: Number(form.product),
        quantity: Number(form.quantity),
        delivery_date: form.delivery_date,
        ...(form.memo ? { history_memo: form.memo } : {}),
        ...(selectedProduct?.egg_weight ? { product_egg_weight: selectedProduct.egg_weight } : {}),
      };

      const errs = [];
      if (!Number.isFinite(minimal.customer)) errs.push("거처(고객사)를 선택해주세요.");
      if (!Number.isFinite(minimal.product)) errs.push("제품을 선택해주세요.");
      if (!Number.isFinite(minimal.quantity) || minimal.quantity < 0) errs.push("발주수량(판)을 숫자로 입력해주세요.");
      if (!minimal.delivery_date) errs.push("출고일자를 선택해주세요.");
      if (errs.length) {
        setFormErr(errs.join("\n"));
        return;
      }

      const extras = {
        center_type: form.center_type,
        confirmed_quantity: form.confirmed_quantity === "" ? null : Number(form.confirmed_quantity),
        tax_type: form.tax_type,
        unit_price: form.unit_price === "" ? null : Number(form.unit_price),
        supply_price: supplyPrice,
        vat_price: vatPrice,
        remark: form.memo,
        updated_at: new Date().toISOString(),
      };

      await createOrderWithFallback(payload, minimal, extras);

      setForm({
        customer: "",
        center_type: "",
        product: "",
        quantity: "",
        confirmed_quantity: "",
        tax_type: "TAXABLE",
        unit_price: "",
        delivery_date: date,
        memo: "",
      });
      await fetchOrders(date);
    } catch (e2) {
      setFormErr(getApiErrorMessage(e2, "발주 등록에 실패했습니다."));
    } finally {
      setSubmitting(false);
    }
  }

  async function onConfirm(order) {
    if (!order?.id) return;
    const ok = window.confirm(`${order.id} 발주를 확인(완료) 처리할까요?`);
    if (!ok) return;
    try {
      const extra = getExtra(order) || {};
      const confirmedQty = order?.confirmed_quantity ?? extra?.confirmed_quantity ?? order?.quantity;
      const payload = {
        history_memo: "발주 확인",
        is_confirmed: true,
        status: "CONFIRMED",
        confirmed_quantity: confirmedQty,
      };
      await patchOrder(order.id, payload);
      await fetchOrders(date);
    } catch (e) {
      window.alert(getApiErrorMessage(e, "발주 확인 처리에 실패했습니다."));
    }
  }

  async function onDelete(order) {
    if (!order?.id) return;
    const ok = window.confirm(`${order.id} 발주를 삭제할까요?`);
    if (!ok) return;
    try {
      await deleteOrder(order.id);
      deleteOrderMatch(order.id);
      deleteOrderExtra(order.id);
      setLocalMatches(loadAllOrderMatches());
      setLocalExtras(loadAllOrderExtras());
      await fetchOrders(date);
    } catch (e) {
      window.alert(getApiErrorMessage(e, "발주 삭제에 실패했습니다."));
    }
  }

  return (
    <div className="purchase-shell">
      {/* Card 1: 헤더 + 조회/등록 */}
      <div className="page-card">
        <div className="purchase-head">
          <div>
            <h2 className="page-title" style={{ margin: 0 }}>발주</h2>
            <div className="sub" style={{ marginTop: "var(--sp-8)" }}>
              상단에서 발주를 추가하고, 하단에서 선택한 날짜의 발주 목록을 확인합니다.
            </div>
          </div>
          <div className="head-actions">
            <div className="field-row">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <button className="btn secondary" onClick={() => fetchOrders(date)} disabled={loading}>
                조회
              </button>
            </div>
          </div>
        </div>

        {err && <div className="field-error" style={{ whiteSpace: "pre-wrap" }}>{err}</div>}

        <form className="purchase-remote" onSubmit={onCreate}>
          <div className="remote-grid">
            <div className="field">
              <label>거처</label>
              <select value={form.customer} onChange={(e) => setF("customer", e.target.value)}>
                <option value="">선택</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.customer_name}</option>
                ))}
              </select>
              <div className="field-help">고객사 선택</div>
            </div>

            <div className="field">
              <label>센터구분</label>
              <input value={form.center_type} onChange={(e) => setF("center_type", e.target.value)} placeholder="예: A센터" />
            </div>

            <div className="field remote-span-2">
              <label>제품이름</label>
              <select value={form.product} onChange={(e) => setF("product", e.target.value)}>
                <option value="">선택</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.product_name}({p.id}){p.egg_weight ? ` (${p.egg_weight})` : ""}
                  </option>
                ))}
              </select>
              <div className="field-help">
                {selectedProduct?.egg_weight ? (
                  <>선택 제품 난중: <b>{selectedProduct.egg_weight}</b></>
                ) : (
                  "제품에 난중 정보가 없으면 원란 매칭 필터가 제한될 수 있습니다."
                )}
              </div>
            </div>

            <div className="field">
              <label>발주수량(판)</label>
              <input
                type="number"
                value={form.quantity}
                onChange={(e) => setF("quantity", e.target.value)}
                min={0}
                step={1}
                placeholder="예: 10"
              />
              <div className="field-help">1판 = 30알 (고정)</div>
            </div>

            <div className="field">
              <label>확정수량(판)</label>
              <input
                type="number"
                value={form.confirmed_quantity}
                onChange={(e) => setF("confirmed_quantity", e.target.value)}
                min={0}
                step={1}
                placeholder="(선택)"
              />
            </div>

            <div className="field">
              <label>과세구분</label>
              <select value={form.tax_type} onChange={(e) => setF("tax_type", e.target.value)}>
                <option value="TAXABLE">과세</option>
                <option value="EXEMPT">면세</option>
              </select>
            </div>

            <div className="field">
              <label>단가</label>
              <input
                type="number"
                value={form.unit_price}
                onChange={(e) => setF("unit_price", e.target.value)}
                min={0}
                step={1}
                placeholder="예: 3500"
              />
            </div>

            <div className="field">
              <label>공급가</label>
              <input value={fmt(supplyPrice)} readOnly />
            </div>

            <div className="field">
              <label>부가세</label>
              <input value={fmt(vatPrice)} readOnly />
            </div>

            <div className="field">
              <label>출고일자</label>
              <input type="date" value={form.delivery_date} onChange={(e) => setF("delivery_date", e.target.value)} />
            </div>

            <div className="field remote-span-3">
              <label>비고</label>
              <input value={form.memo} onChange={(e) => setF("memo", e.target.value)} placeholder="(선택)" />
            </div>
          </div>

          {formErr && <div className="field-error" style={{ whiteSpace: "pre-wrap" }}>{formErr}</div>}

          <div className="remote-actions">
            <button className="btn" type="submit" disabled={submitting}>발주 추가</button>
          </div>
        </form>
      </div>

      {/* Card 2: 목록 */}
      <div className="page-card">
        <div className="purchase-table-wrap">
          <table className="data-table purchase-table">
            <colgroup>
              {ORDER_LIST_COLS.map((c) => (
                <col key={c.key} style={{ width: c.width }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th>발주번호</th>
                <th>거처</th>
                <th>센터</th>
                <th>제품</th>
                <th>발주</th>
                <th>확정</th>
                <th>과세</th>
                <th>단가</th>
                <th>공급가</th>
                <th>부가세</th>
                <th>출고일자</th>
                <th>비고</th>
                <th>발주</th>
                <th>원란</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={15} className="muted">불러오는 중...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={15} className="muted">해당 날짜의 발주가 없습니다.</td></tr>
              ) : (
                rows.map((r) => {
                  const c = customersById[String(r?.customer ?? "")];
                  const p = productsById[String(r?.product ?? "")];
                  const extra = getExtra(r) || {};

                  const confirmed = isConfirmed(r);
                  const match = getMatch(r);
                  const matchSaved = isOrderMatchSaved(match);

                  const productLabel = p?.product_name ? `${p.product_name}(${p.id})` : (r?.product != null ? String(r.product) : "-");
                  const center = r?.center_type ?? extra?.center_type ?? "-";
                  const orderQty = num(r?.quantity, 0);
                  const confirmedQty = num(r?.confirmed_quantity ?? extra?.confirmed_quantity, NaN);
                  const confirmedQtyShow = Number.isFinite(confirmedQty) ? confirmedQty : "-";
                  const tax = r?.tax_type ?? extra?.tax_type ?? "-";
                  const unit = num(r?.unit_price ?? extra?.unit_price, NaN);
                  const unitShow = Number.isFinite(unit) ? fmt(unit) : "-";

                  const base = Number.isFinite(confirmedQty) ? confirmedQty : orderQty;
                  const supply = num(r?.supply_price ?? extra?.supply_price, NaN);
                  const supplyComputed = Number.isFinite(supply) ? supply : (Number.isFinite(unit) ? base * unit : 0);
                  const vat = num(r?.vat_price ?? extra?.vat_price, NaN);
                  const vatComputed = Number.isFinite(vat) ? vat : (isTaxable(tax) ? Math.round(supplyComputed * 0.1) : 0);

                  return (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{c?.customer_name || r?.customer || "-"}</td>
                      <td>{center}</td>
                      <td title={productLabel}>{productLabel}</td>
                      <td>{fmt(orderQty)}</td>
                      <td>{confirmedQtyShow === "-" ? "-" : fmt(confirmedQtyShow)}</td>
                      <td>{tax === "TAXABLE" ? "과세" : tax === "EXEMPT" ? "면세" : tax}</td>
                      <td>{unitShow}</td>
                      <td>{supplyComputed ? fmt(supplyComputed) : "-"}</td>
                      <td>{vatComputed ? fmt(vatComputed) : "-"}</td>
                      <td>{String(r?.delivery_date || "").slice(0, 10)}</td>
                      <td title={extra?.remark || r?.remark || ""}>{extra?.remark || r?.remark || "-"}</td>
                      <td><span className={`badge ${confirmed ? "ok" : "neutral"}`}>{confirmed ? "발주완료" : "미확정"}</span></td>
                      <td><span className={`badge ${matchSaved ? "ok" : "warn"}`}>{matchSaved ? "원란확인" : "원란미정"}</span></td>
                      <td>
                        <span className="row-actions">
                          <button
                            className="btn secondary small"
                            onClick={() => onConfirm(r)}
                            disabled={confirmed}
                            title={confirmed ? "이미 발주완료" : "발주 확인"}
                          >
                            {confirmed ? "완료" : "발주 확인"}
                          </button>
                          <button
                            className="btn secondary small"
                            onClick={() => {
                              const qs = new URLSearchParams({ orderId: String(r.id) });
                              if (date) qs.set("date", date);
                              nav(`/purchase/egg-matching?${qs.toString()}`);
                            }}
                          >
                            원란매칭
                          </button>
                          <button className="btn danger small" onClick={() => onDelete(r)} title="발주 삭제">삭제</button>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
