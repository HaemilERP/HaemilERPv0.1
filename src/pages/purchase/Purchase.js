import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "../accounting/AccountingTable.css";
import "./Purchase.css";

import { listCustomers, listProducts } from "../../services/accountingApi";
import { downloadOrderCommonFormXlsx } from "../../utils/excel";
import {
  createOrder,
  deleteOrder,
  listMatchingEggs,
  listOrders,
} from "../../services/purchaseApi";
import {
  getApiErrorMessage,
  getIdentifierLabel,
  toStringArray,
} from "../../utils/helpers";

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

function numOrBlank(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

function toPk(v) {
  if (v == null) return "";
  if (typeof v === "object") return String(v.id ?? v.pk ?? "");
  return String(v);
}

function isQuantityConfirmed(order) {
  if (order?.is_quantity_confirmed != null) return Boolean(order.is_quantity_confirmed);
  const q = Number(order?.quantity);
  return Number.isFinite(q) && q > 0;
}

function getOrderPk(order) {
  const id = order?.id;
  return id == null ? null : id;
}

function getOrderLabel(order) {
  return getIdentifierLabel(order, ["order_id"], ["id"]);
}

function getCustomerLabel(customer) {
  const code = getIdentifierLabel(customer, ["customer_code", "customer_id"], []);
  const name = String(customer?.customer_name || "").trim();
  if (name && code) return `${name} (${code})`;
  return name || code || "-";
}

function getProductLabel(product) {
  const code = getIdentifierLabel(product, ["product_no", "product_id"], []);
  const name = String(product?.product_name || "").trim();
  if (name && code) return `${name} (${code})`;
  return name || code || "-";
}

function getClients(customer) {
  return toStringArray(customer?.client);
}

function getTaxationLabel(order) {
  const v = order?.taxation;
  if (v === null || v === undefined || v === "") return "";
  if (typeof v === "boolean") return v ? "과세" : "면세";

  const s = String(v).trim().toLowerCase();
  if (["taxable", "true", "1", "o", "y", "yes", "과세"].includes(s)) return "과세";
  if (["exempt", "false", "0", "x", "n", "no", "면세", "non_taxable", "nontaxable"].includes(s)) {
    return "면세";
  }
  return String(v);
}

async function fetchOrderMatchingSum(orderPk) {
  if (orderPk == null) return 0;

  let rows = [];
  try {
    rows = await listMatchingEggs({ order: orderPk });
  } catch {
    rows = [];
  }

  if (!Array.isArray(rows) || rows.length === 0) {
    try {
      rows = await listMatchingEggs({ order_id: orderPk });
    } catch {
      rows = [];
    }
  }

  if (!Array.isArray(rows)) return 0;
  const filtered = rows.filter((r) => {
    if (r?.order == null) return true;
    return String(r.order) === String(orderPk);
  });
  return filtered.reduce((sum, r) => sum + Math.max(0, num(r?.quantity, 0)), 0);
}

const ORDER_LIST_COLS = [
  { key: "order", width: "8%" },
  { key: "customer", width: "13%" },
  { key: "client", width: "11%" },
  { key: "product", width: "15%" },
  { key: "orderQty", width: "7%" },
  { key: "confirmedQty", width: "7%" },
  { key: "matchedQty", width: "7%" },
  { key: "price", width: "7%" },
  { key: "delivery", width: "8%" },
  { key: "memo", width: "10%" },
  { key: "status", width: "7%" },
  { key: "actions", width: "20%" },
];

export default function Purchase() {
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);

  const [date, setDate] = useState(sp.get("date") || todayYmd());
  const [rows, setRows] = useState([]);
  const [matchingSums, setMatchingSums] = useState({});

  const [loading, setLoading] = useState(true);
  const [loadingMatch, setLoadingMatch] = useState(false);
  const [err, setErr] = useState("");

  const [form, setForm] = useState({
    customer: "",
    client: "",
    product: "",
    order_quantity: "",
    taxation: true,
    price: "",
    delivery_date: sp.get("date") || todayYmd(),
    memo: "",
  });

  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState("");

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

  const selectedCustomer = useMemo(
    () => customersByPk[String(form.customer)] || null,
    [customersByPk, form.customer]
  );

  const selectedProduct = useMemo(
    () => productsByPk[String(form.product)] || null,
    [productsByPk, form.product]
  );

  const clientOptions = useMemo(() => getClients(selectedCustomer), [selectedCustomer]);

  const filteredProducts = useMemo(() => {
    if (!form.customer) return products;
    return (products || []).filter((p) => String(toPk(p?.customer)) === String(form.customer));
  }, [products, form.customer]);

  const supplyPrice = useMemo(() => {
    return Math.max(0, num(form.order_quantity, 0)) * Math.max(0, num(form.price, 0));
  }, [form.order_quantity, form.price]);

  const vatPrice = useMemo(() => {
    if (!form.taxation) return 0;
    return Math.round(supplyPrice * 0.1);
  }, [form.taxation, supplyPrice]);

  function setF(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

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

  async function fetchMatchingSummary(orders) {
    const next = {};
    const orderPks = (orders || [])
      .map((o) => getOrderPk(o))
      .filter((o) => o != null);

    if (!orderPks.length) {
      setMatchingSums({});
      return;
    }

    setLoadingMatch(true);
    try {
      const sums = await Promise.all(
        orderPks.map(async (orderPk) => [String(orderPk), await fetchOrderMatchingSum(orderPk)])
      );
      sums.forEach(([k, v]) => {
        next[k] = v;
      });
      setMatchingSums(next);
    } finally {
      setLoadingMatch(false);
    }
  }

  async function fetchOrders(targetDate) {
    setLoading(true);
    setErr("");
    try {
      const list = await listOrders(targetDate ? { delivery_date: targetDate } : {});
      setRows(list);
      await fetchMatchingSummary(list);
    } catch (e) {
      setErr(getApiErrorMessage(e, "발주 목록을 불러오지 못했습니다."));
      setRows([]);
      setMatchingSums({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!date) {
      setRows([]);
      setMatchingSums({});
      return;
    }
    fetchOrders(date);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function onCreate(e) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setFormErr("");

    try {
      const customer = Number(form.customer);
      const product = Number(form.product);
      const orderQuantity = Number(form.order_quantity);
      const price = form.price === "" ? null : Number(form.price);
      const client = String(form.client || "").trim();
      const hasMultiClientDelimiter = /[\r\n,]/.test(client);

      const nextErrs = [];
      if (!Number.isFinite(customer) || customer <= 0) nextErrs.push("고객사를 선택해주세요.");
      if (!Number.isFinite(product) || product <= 0) nextErrs.push("제품을 선택해주세요.");
      if (!Number.isFinite(orderQuantity) || orderQuantity < 0) nextErrs.push("발주수량을 숫자로 입력해주세요.");
      if (!form.delivery_date) nextErrs.push("출고일자를 선택해주세요.");
      if (!client) nextErrs.push("발주처를 입력하거나 선택해주세요.");
      if (hasMultiClientDelimiter) nextErrs.push("발주에서는 납품처를 1개만 입력해주세요.");
      if (form.price !== "" && (!Number.isFinite(price) || price < 0)) nextErrs.push("단가를 숫자로 입력해주세요.");

      if (nextErrs.length) {
        setFormErr(nextErrs.join("\n"));
        return;
      }

      const payload = {
        customer,
        product,
        order_quantity: orderQuantity,
        client,
        taxation: Boolean(form.taxation),
        delivery_date: form.delivery_date,
        ...(price != null ? { price } : {}),
        ...(price != null ? { supply_price: supplyPrice } : {}),
        ...(price != null ? { VAT: vatPrice } : {}),
        ...(form.memo ? { memo: form.memo } : {}),
      };

      await createOrder(payload);

      setForm({
        customer: "",
        client: "",
        product: "",
        order_quantity: "",
        taxation: true,
        price: "",
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

  async function onDelete(order) {
    const orderPk = getOrderPk(order);
    if (!orderPk) return;
    const ok = window.confirm(`${getOrderLabel(order)} 발주를 삭제할까요?`);
    if (!ok) return;

    try {
      await deleteOrder(orderPk);
      await fetchOrders(date);
    } catch (e) {
      window.alert(getApiErrorMessage(e, "발주 삭제에 실패했습니다."));
    }
  }

  async function onExportOrderExcel() {
    try {
      const exportRows = rows.map((r) => {
        const customerPk = toPk(r?.customer);
        const productPk = toPk(r?.product);
        const customer =
          customersByPk[customerPk] ||
          (typeof r?.customer === "object" ? r.customer : null);
        const product =
          productsByPk[productPk] ||
          (typeof r?.product === "object" ? r.product : null);

        const customerName =
          String(customer?.customer_name || "").trim() ||
          getIdentifierLabel(customer || {}, ["customer_code", "customer_id"], []) ||
          customerPk ||
          "-";

        const productName =
          String(product?.product_name || "").trim() ||
          getIdentifierLabel(product || {}, ["product_no", "product_id"], []) ||
          productPk ||
          "-";

        const orderQty = numOrBlank(r?.order_quantity);
        const confirmedQty = numOrBlank(r?.quantity);
        const price = numOrBlank(r?.price);
        const supplyPrice = Number.isFinite(Number(r?.supply_price))
          ? Number(r.supply_price)
          : Number.isFinite(Number(price)) && Number.isFinite(Number(orderQty))
            ? Number(price) * Number(orderQty)
            : "";
        const vat = Number.isFinite(Number(r?.VAT))
          ? Number(r.VAT)
          : Number.isFinite(Number(r?.vat))
            ? Number(r.vat)
            : getTaxationLabel(r) === "과세" && Number.isFinite(Number(supplyPrice))
              ? Math.round(Number(supplyPrice) * 0.1)
              : "";

        return [
          customerName,
          String(r?.client || ""),
          productName,
          orderQty,
          confirmedQty,
          getTaxationLabel(r),
          price,
          supplyPrice,
          vat,
          String(r?.delivery_date || "").slice(0, 10),
          String(r?.memo || ""),
        ];
      });

      await downloadOrderCommonFormXlsx(exportRows);
    } catch (e) {
      window.alert(getApiErrorMessage(e, "발주목록 엑셀 출력에 실패했습니다."));
    }
  }

  return (
    <div className="purchase-shell">
      <div className="page-card">
        <div className="purchase-head">
          <div>
            <h2 className="page-title" style={{ margin: 0 }}>발주 추가</h2>
            <div className="sub" style={{ marginTop: "var(--sp-8)" }}>
              발주를 등록한 뒤 생산수량확정, 원란매칭, 작업지시서 순서로 진행하세요.
            </div>
          </div>

          <div className="head-actions">
            <div className="field-row">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              <button type="button" className="btn secondary" onClick={() => fetchOrders(date)} disabled={loading}>
                조회
              </button>
              <button
                type="button"
                className="btn secondary"
                onClick={onExportOrderExcel}
                disabled={loading || rows.length === 0}
              >
                엑셀출력
              </button>
            </div>
          </div>
        </div>

        {err && <div className="field-error" style={{ whiteSpace: "pre-wrap" }}>{err}</div>}

        <form className="purchase-remote" onSubmit={onCreate}>
          <div className="remote-grid">
            <div className="field">
              <label>고객사</label>
              <select
                value={form.customer}
                onChange={(e) => {
                  const nextCustomer = e.target.value;
                  setForm((prev) => ({
                    ...prev,
                    customer: nextCustomer,
                    product: "",
                    client: "",
                  }));
                }}
              >
                <option value="">선택</option>
                {customers.map((c) => {
                  const pk = toPk(c);
                  return (
                    <option key={pk} value={pk}>
                      {getCustomerLabel(c)}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="field">
              <label>발주처</label>
              {clientOptions.length > 0 ? (
                <select value={form.client} onChange={(e) => setF("client", e.target.value)}>
                  <option value="">선택</option>
                  {clientOptions.map((clientName) => (
                    <option key={clientName} value={clientName}>
                      {clientName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={form.client}
                  onChange={(e) => setF("client", e.target.value)}
                  placeholder="발주처(1개)"
                />
              )}
            </div>

            <div className="field remote-span-2">
              <label>제품</label>
              <select value={form.product} onChange={(e) => setF("product", e.target.value)}>
                <option value="">선택</option>
                {filteredProducts.map((p) => {
                  const pk = toPk(p);
                  return (
                    <option key={pk} value={pk}>
                      {getProductLabel(p)}
                    </option>
                  );
                })}
              </select>
              <div className="field-help">
                {selectedProduct ? `선택 제품 식별자: ${getIdentifierLabel(selectedProduct, ["product_no", "product_id"], ["id"])}` : ""}
              </div>
            </div>

            <div className="field">
              <label>발주수량</label>
              <input
                type="number"
                value={form.order_quantity}
                onChange={(e) => setF("order_quantity", e.target.value)}
                min={0}
                step={1}
                placeholder="예: 100"
              />
            </div>

            <div className="field">
              <label>과세여부</label>
              <select
                value={form.taxation ? "TAXABLE" : "EXEMPT"}
                onChange={(e) => setF("taxation", e.target.value === "TAXABLE")}
              >
                <option value="TAXABLE">과세</option>
                <option value="EXEMPT">면세</option>
              </select>
            </div>

            <div className="field">
              <label>단가</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setF("price", e.target.value)}
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
              <input
                type="date"
                value={form.delivery_date}
                onChange={(e) => setF("delivery_date", e.target.value)}
              />
            </div>

            <div className="field remote-span-3">
              <label>비고</label>
              <input
                value={form.memo}
                onChange={(e) => setF("memo", e.target.value)}
                placeholder="(선택)"
              />
            </div>
          </div>

          {formErr && <div className="field-error" style={{ whiteSpace: "pre-wrap" }}>{formErr}</div>}

          <div className="remote-actions">
            <button className="btn" type="submit" disabled={submitting}>
              발주 추가
            </button>
          </div>
        </form>
      </div>

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
                <th>고객사</th>
                <th>발주처</th>
                <th>제품</th>
                <th>발주수량</th>
                <th>확정수량</th>
                <th>매칭수량</th>
                <th>단가</th>
                <th>출고일자</th>
                <th>비고</th>
                <th>상태</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={12} className="muted">불러오는 중..</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={12} className="muted">해당 날짜의 발주가 없습니다.</td></tr>
              ) : (
                rows.map((r) => {
                  const orderPk = getOrderPk(r);
                  const customerPk = toPk(r?.customer);
                  const productPk = toPk(r?.product);

                  const customer =
                    customersByPk[customerPk] ||
                    (typeof r?.customer === "object" ? r.customer : null);
                  const product =
                    productsByPk[productPk] ||
                    (typeof r?.product === "object" ? r.product : null);

                  const orderQty = num(r?.order_quantity, 0);
                  const confirmedQty = num(r?.quantity, NaN);
                  const quantityConfirmed = isQuantityConfirmed(r);
                  const matchedQty = orderPk == null ? 0 : num(matchingSums[String(orderPk)], 0);
                  const matchDone = quantityConfirmed && Number.isFinite(confirmedQty) && matchedQty === confirmedQty;

                  return (
                    <tr key={orderPk ?? getOrderLabel(r)}>
                      <td>{getOrderLabel(r)}</td>
                      <td>{getCustomerLabel(customer || { customer_name: "", customer_code: customerPk })}</td>
                      <td>{String(r?.client || "-")}</td>
                      <td>{getProductLabel(product || { product_name: "", product_no: productPk })}</td>
                      <td>{fmt(orderQty)}</td>
                      <td>{Number.isFinite(confirmedQty) ? fmt(confirmedQty) : "-"}</td>
                      <td>{fmt(matchedQty)}</td>
                      <td>{r?.price != null ? fmt(r.price) : "-"}</td>
                      <td>{String(r?.delivery_date || "").slice(0, 10)}</td>
                      <td className="wrap-cell">{String(r?.memo || "-")}</td>
                      <td>
                        <span className={`badge ${matchDone ? "ok" : quantityConfirmed ? "neutral" : "warn"}`}>
                          {matchDone ? "매칭완료" : quantityConfirmed ? "수량확정" : "미확정"}
                        </span>
                        {loadingMatch && <div className="field-help">매칭 확인중...</div>}
                      </td>
                      <td>
                        <span className="row-actions">
                          <button
                            className="btn secondary small"
                            onClick={() => {
                              const qs = new URLSearchParams();
                              if (date) qs.set("date", date);
                              if (orderPk != null) qs.set("orderId", String(orderPk));
                              nav(`/purchase/quantity-confirmation?${qs.toString()}`);
                            }}
                          >
                            생산수량확정
                          </button>

                          <button
                            className="btn secondary small"
                            disabled={!quantityConfirmed}
                            title={!quantityConfirmed ? "생산수량확정 후 진행 가능합니다." : ""}
                            onClick={() => {
                              const qs = new URLSearchParams();
                              if (date) qs.set("date", date);
                              if (orderPk != null) qs.set("orderId", String(orderPk));
                              nav(`/purchase/egg-matching?${qs.toString()}`);
                            }}
                          >
                            원란매칭
                          </button>

                          <button
                            className="btn secondary small"
                            disabled={!matchDone}
                            title={!matchDone ? "원란매칭 수량이 확정수량과 같아야 합니다." : ""}
                            onClick={() => {
                              const qs = new URLSearchParams();
                              if (date) qs.set("date", date);
                              if (orderPk != null) qs.set("orderId", String(orderPk));
                              nav(`/purchase/work-orders?${qs.toString()}`);
                            }}
                          >
                            작업지시서
                          </button>

                          <button className="btn danger small" onClick={() => onDelete(r)}>
                            삭제
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
