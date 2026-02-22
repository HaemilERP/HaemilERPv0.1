import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "../accounting/AccountingTable.css";
import "./Purchase.css";

import { listCustomers, listProducts } from "../../services/accountingApi";
import { listProductLots } from "../../services/inventoryApi";
import { listOrders, patchOrder } from "../../services/purchaseApi";
import { asText, getApiErrorMessage, getIdentifierLabel } from "../../utils/helpers";

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

function fmt(v) {
  return num(v, 0).toLocaleString();
}

function toPk(v) {
  if (v == null) return "";
  if (typeof v === "object") return String(v.id ?? v.pk ?? "");
  return String(v);
}

function getOrderPk(order) {
  return order?.id ?? null;
}

function getOrderLabel(order) {
  return getIdentifierLabel(order, ["order_id"], ["id"]);
}

function getCustomerLabel(customer) {
  const code = getIdentifierLabel(customer, ["customer_code", "customer_id"], []);
  const name = asText(customer?.customer_name);
  if (name && code) return `${name} (${code})`;
  return name || code || "-";
}

function getProductLabel(product) {
  const code = getIdentifierLabel(product, ["product_no", "product_id"], []);
  const name = asText(product?.product_name);
  if (name && code) return `${name} (${code})`;
  return name || code || "-";
}

function isQuantityConfirmed(order) {
  if (order?.is_quantity_confirmed != null) return Boolean(order.is_quantity_confirmed);
  return num(order?.quantity, 0) > 0;
}

export default function QuantityConfirmation() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const [date, setDate] = useState(sp.get("date") || todayYmd());
  const [focusOrderId] = useState(sp.get("orderId") || "");

  const [rows, setRows] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [productLots, setProductLots] = useState([]);

  const [quantityDrafts, setQuantityDrafts] = useState({});

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [savingOrderPk, setSavingOrderPk] = useState(null);

  const customersByPk = useMemo(() => {
    const m = {};
    (customers || []).forEach((c) => {
      const pk = toPk(c);
      if (pk) m[pk] = c;
    });
    return m;
  }, [customers]);

  const productsByPk = useMemo(() => {
    const m = {};
    (products || []).forEach((p) => {
      const pk = toPk(p);
      if (pk) m[pk] = p;
    });
    return m;
  }, [products]);

  const stockByProductPk = useMemo(() => {
    const out = {};
    (productLots || []).forEach((lot) => {
      const productPk = toPk(lot?.product);
      if (!productPk) return;
      out[productPk] = num(out[productPk], 0) + Math.max(0, num(lot?.quantity, 0));
    });
    return out;
  }, [productLots]);

  const sortedRows = useMemo(() => {
    if (!focusOrderId) return rows;
    const first = [];
    const others = [];
    rows.forEach((row) => {
      if (String(getOrderPk(row)) === String(focusOrderId)) first.push(row);
      else others.push(row);
    });
    return [...first, ...others];
  }, [rows, focusOrderId]);

  function syncDrafts(orderRows) {
    const next = {};
    (orderRows || []).forEach((row) => {
      const pk = getOrderPk(row);
      if (pk == null) return;
      const confirmed = row?.quantity;
      next[String(pk)] = confirmed == null ? "" : String(confirmed);
    });
    setQuantityDrafts(next);
  }

  async function bootstrap() {
    setLoading(true);
    setErr("");
    try {
      const [cs, ps, lots] = await Promise.all([listCustomers(), listProducts(), listProductLots()]);
      setCustomers(cs);
      setProducts(ps);
      setProductLots(lots);
    } catch (e) {
      setErr(getApiErrorMessage(e, "기초 데이터를 불러오지 못했습니다."));
    } finally {
      setLoading(false);
    }
  }

  async function fetchRows(targetDate) {
    setLoading(true);
    setErr("");
    try {
      const data = await listOrders(targetDate ? { delivery_date: targetDate } : {});
      setRows(data);
      syncDrafts(data);
    } catch (e) {
      setErr(getApiErrorMessage(e, "발주 목록을 불러오지 못했습니다."));
      setRows([]);
      setQuantityDrafts({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRows(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function saveConfirmedQuantity(order) {
    const orderPk = getOrderPk(order);
    if (orderPk == null) return;

    const raw = quantityDrafts[String(orderPk)];
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 0) {
      window.alert("확정수량은 0 이상의 숫자로 입력해주세요.");
      return;
    }

    setSavingOrderPk(orderPk);
    try {
      await patchOrder(orderPk, { quantity: value });
      await fetchRows(date);
    } catch (e) {
      window.alert(getApiErrorMessage(e, "생산수량 확정에 실패했습니다."));
    } finally {
      setSavingOrderPk(null);
    }
  }

  return (
    <div className="purchase-shell">
      <div className="page-card">
        <div className="purchase-head">
          <div>
            <h2 className="page-title" style={{ margin: 0 }}>생산수량확정</h2>
            <div className="sub" style={{ marginTop: "var(--sp-8)" }}>
              현재 제품재고와 출고량을 확인하고 발주의 확정수량을 저장합니다.
            </div>
          </div>
          <div className="head-actions">
            <div className="field-row">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <button className="btn secondary" onClick={() => fetchRows(date)} disabled={loading}>
                조회
              </button>
            </div>
          </div>
        </div>

        {err && <div className="field-error" style={{ whiteSpace: "pre-wrap" }}>{err}</div>}
      </div>

      <div className="page-card">
        <div className="purchase-table-wrap">
          <table className="data-table purchase-table">
            <thead>
              <tr>
                <th>발주번호</th>
                <th>고객사</th>
                <th>제품</th>
                <th>현재 제품재고</th>
                <th>출고량(발주수량)</th>
                <th>확정수량</th>
                <th>확정상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="muted">불러오는 중..</td>
                </tr>
              ) : !sortedRows.length ? (
                <tr>
                  <td colSpan={8} className="muted">발주 데이터가 없습니다.</td>
                </tr>
              ) : (
                sortedRows.map((row) => {
                  const orderPk = getOrderPk(row);
                  const productPk = toPk(row?.product);
                  const customerPk = toPk(row?.customer);

                  const customer =
                    customersByPk[customerPk] ||
                    (typeof row?.customer === "object" ? row.customer : null);
                  const product =
                    productsByPk[productPk] ||
                    (typeof row?.product === "object" ? row.product : null);

                  const stock = stockByProductPk[String(productPk)] || 0;
                  const shippingQty = num(row?.order_quantity, 0);
                  const confirmed = isQuantityConfirmed(row);

                  const isFocused = focusOrderId && String(orderPk) === String(focusOrderId);

                  return (
                    <tr key={orderPk ?? getOrderLabel(row)} style={isFocused ? { background: "rgba(0, 151, 129, 0.06)" } : undefined}>
                      <td>{getOrderLabel(row)}</td>
                      <td>{getCustomerLabel(customer || { customer_name: "", customer_code: customerPk })}</td>
                      <td>{getProductLabel(product || { product_name: "", product_no: productPk })}</td>
                      <td>{fmt(stock)}</td>
                      <td>{fmt(shippingQty)}</td>
                      <td>
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={quantityDrafts[String(orderPk)] ?? ""}
                          onChange={(e) =>
                            setQuantityDrafts((prev) => ({ ...prev, [String(orderPk)]: e.target.value }))
                          }
                        />
                      </td>
                      <td>
                        <span className={`badge ${confirmed ? "ok" : "warn"}`}>
                          {confirmed ? "확정완료" : "미확정"}
                        </span>
                      </td>
                      <td>
                        <span className="row-actions">
                          <button
                            className="btn secondary small"
                            onClick={() => saveConfirmedQuantity(row)}
                            disabled={savingOrderPk === orderPk}
                          >
                            {savingOrderPk === orderPk ? "저장중.." : "확정저장"}
                          </button>
                          <button
                            className="btn secondary small"
                            onClick={() => {
                              const qs = new URLSearchParams();
                              if (date) qs.set("date", date);
                              if (orderPk != null) qs.set("orderId", String(orderPk));
                              nav(`/purchase/egg-matching?${qs.toString()}`);
                            }}
                            disabled={!confirmed}
                          >
                            원란매칭
                          </button>
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
