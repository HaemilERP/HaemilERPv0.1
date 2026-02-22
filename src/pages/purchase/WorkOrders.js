import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "../accounting/AccountingTable.css";
import "./Purchase.css";

import { listCustomers, listProducts } from "../../services/accountingApi";
import { listEggLots } from "../../services/inventoryApi";
import {
  getOrder,
  listMatchingEggs,
  listOrders,
} from "../../services/purchaseApi";
import { asText, getApiErrorMessage, getIdentifierLabel, normalizeFarmType } from "../../utils/helpers";

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

function getLotLabel(lot) {
  const lotNo = getIdentifierLabel(lot, ["Egglot_no", "egg_lot_id"], ["id"]);
  const farmNo =
    typeof lot?.farm === "object"
      ? getIdentifierLabel(lot.farm, ["farm_id"], ["id"])
      : asText(lot?.farm);
  return [lotNo, farmNo ? `farm:${farmNo}` : "", ymd(lot?.receiving_date)].filter(Boolean).join(" / ");
}

function ymd(v) {
  if (!v) return "";
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}

async function listOrderMatches(orderPk) {
  if (!orderPk) return [];
  try {
    return await listMatchingEggs({ order: orderPk });
  } catch {
    try {
      return await listMatchingEggs({ order_id: orderPk });
    } catch {
      return [];
    }
  }
}

export default function WorkOrders() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();

  const [date, setDate] = useState(sp.get("date") || todayYmd());
  const [orderIdInput, setOrderIdInput] = useState(sp.get("orderId") || "");
  const [orderOptions, setOrderOptions] = useState([]);

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [eggLots, setEggLots] = useState([]);

  const [order, setOrder] = useState(null);
  const [matches, setMatches] = useState([]);

  const [loading, setLoading] = useState(true);
  const [orderLoading, setOrderLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [resultMsg, setResultMsg] = useState("");

  const [form, setForm] = useState({
    process_day: "",
    machine_line: "",
    location: "",
    memo: "",
  });

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

  const eggLotsByPk = useMemo(() => {
    const m = {};
    (eggLots || []).forEach((l) => {
      const pk = toPk(l);
      if (pk) m[pk] = l;
    });
    return m;
  }, [eggLots]);

  const customer = useMemo(() => {
    if (!order) return null;
    return customersByPk[toPk(order?.customer)] || (typeof order?.customer === "object" ? order.customer : null);
  }, [order, customersByPk]);

  const product = useMemo(() => {
    if (!order) return null;
    return productsByPk[toPk(order?.product)] || (typeof order?.product === "object" ? order.product : null);
  }, [order, productsByPk]);

  const confirmedQty = useMemo(() => num(order?.quantity, 0), [order]);
  const matchedQty = useMemo(
    () => (matches || []).reduce((sum, row) => sum + Math.max(0, num(row?.quantity, 0)), 0),
    [matches]
  );
  const isMatchedComplete = useMemo(
    () => confirmedQty > 0 && matchedQty === confirmedQty,
    [confirmedQty, matchedQty]
  );

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr("");
      try {
        const [cs, ps, lots] = await Promise.all([listCustomers(), listProducts(), listEggLots()]);
        if (!alive) return;
        setCustomers(cs);
        setProducts(ps);
        setEggLots(lots);
      } catch (e) {
        if (!alive) return;
        setErr(getApiErrorMessage(e, "기초 데이터를 불러오지 못했습니다."));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!date) {
        setOrderOptions([]);
        return;
      }
      try {
        const rows = await listOrders({ delivery_date: date });
        if (!alive) return;
        setOrderOptions(rows);
      } catch {
        if (!alive) return;
        setOrderOptions([]);
      }
    })();
    return () => {
      alive = false;
    };
  }, [date]);

  async function loadOrderById(id) {
    if (!id) return;
    setOrderLoading(true);
    setErr("");
    setResultMsg("");
    try {
      const nextOrder = await getOrder(id);
      const nextMatches = await listOrderMatches(getOrderPk(nextOrder));
      setOrder(nextOrder);
      setMatches(nextMatches);

      const next = new URLSearchParams(sp);
      next.set("orderId", String(id));
      if (date) next.set("date", date);
      setSp(next, { replace: true });
    } catch (e) {
      setErr(getApiErrorMessage(e, "발주 또는 매칭정보를 불러오지 못했습니다."));
      setOrder(null);
      setMatches([]);
    } finally {
      setOrderLoading(false);
    }
  }

  useEffect(() => {
    const qid = sp.get("orderId");
    if (qid) loadOrderById(qid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createInstructions() {
    if (submitting) return;
    setErr("");
    setResultMsg("");

    const orderPk = getOrderPk(order);
    if (!orderPk) {
      setErr("작업지시서를 생성할 발주를 먼저 선택해주세요.");
      return;
    }
    if (!confirmedQty || confirmedQty <= 0) {
      setErr("생산수량확정이 완료된 발주만 작업지시서를 작성할 수 있습니다.");
      return;
    }
    if (!isMatchedComplete) {
      setErr("원란매칭 수량이 확정수량과 같아야 작업지시서를 작성할 수 있습니다.");
      return;
    }
    if (!form.location.trim()) {
      setErr("작업 위치를 입력해주세요.");
      return;
    }

    const validMatches = (matches || []).filter(
      (m) => Number.isFinite(Number(toPk(m?.egg_lot))) && num(m?.quantity, 0) > 0
    );
    if (!validMatches.length) {
      setErr("매칭된 원란 데이터가 없습니다.");
      return;
    }

    setSubmitting(true);
    try {
      const location = form.location.trim();
      const machineLine = form.machine_line.trim();
      const processDay = form.process_day.trim();
      const memo = form.memo.trim();
      const totalMatched = validMatches.reduce((sum, m) => sum + num(m?.quantity, 0), 0);

      const summary = [
        "작업지시서가 생성되었습니다. (재고 반영 없음)",
        `발주번호: ${getOrderLabel(order)}`,
        `확정수량: ${fmt(confirmedQty)}`,
        `원란매칭수량: ${fmt(totalMatched)}`,
        `원란건수: ${validMatches.length}`,
        `작업위치: ${location}`,
        processDay ? `공정일: ${processDay}` : "",
        machineLine ? `라인: ${machineLine}` : "",
        memo ? `메모: ${memo}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      setResultMsg(summary);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="page-card">
        <h2 className="page-title">작업지시서</h2>
        <div className="muted" style={{ marginTop: "var(--sp-12)" }}>불러오는 중..</div>
      </div>
    );
  }

  return (
    <div className="purchase-shell">
      <div className="page-card">
        <div className="purchase-head">
          <div>
            <h2 className="page-title" style={{ margin: 0 }}>작업지시서 작성</h2>
            <div className="sub" style={{ marginTop: "var(--sp-8)" }}>
              원란매칭 완료 발주를 기준으로 작업지시서 데이터를 생성합니다. (재고 반영 없음)
            </div>
          </div>
        </div>

        <div className="purchase-remote">
          <div className="remote-grid">
            <div className="field">
              <label>출고일자</label>
              <input
                type="date"
                value={date}
                onChange={(e) => {
                  const v = e.target.value;
                  setDate(v);
                  const next = new URLSearchParams(sp);
                  if (v) next.set("date", v);
                  else next.delete("date");
                  setSp(next, { replace: true });
                }}
              />
            </div>

            <div className="field remote-span-2">
              <label>발주 선택</label>
              <select
                value={order?.id ? String(order.id) : ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (!v) return;
                  setOrderIdInput(v);
                  loadOrderById(v);
                }}
              >
                <option value="">선택</option>
                {orderOptions.map((o) => {
                  const c =
                    customersByPk[toPk(o?.customer)] ||
                    (typeof o?.customer === "object" ? o.customer : null);
                  const p =
                    productsByPk[toPk(o?.product)] ||
                    (typeof o?.product === "object" ? o.product : null);
                  return (
                    <option key={toPk(o) || getOrderLabel(o)} value={toPk(o)}>
                      {getOrderLabel(o)} / {getCustomerLabel(c)} / {getProductLabel(p)}
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="field">
              <label>발주번호</label>
              <div className="order-id-controls">
                <input
                  value={orderIdInput}
                  onChange={(e) => setOrderIdInput(e.target.value)}
                  placeholder="예: 123"
                  inputMode="numeric"
                />
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    const v = orderIdInput.trim();
                    if (!v) return;
                    loadOrderById(v);
                  }}
                  disabled={orderLoading}
                >
                  불러오기
                </button>
              </div>
            </div>
          </div>
        </div>

        {err && <div className="field-error" style={{ whiteSpace: "pre-wrap" }}>{err}</div>}
        {resultMsg && <div className="field-help" style={{ whiteSpace: "pre-wrap" }}>{resultMsg}</div>}
      </div>

      <div className="page-card">
        <div className="summary-kpi">
          <div className="kpi">
            <div className="k">발주번호</div>
            <div className="v">{order ? getOrderLabel(order) : "-"}</div>
            <div className="muted" style={{ marginTop: "var(--sp-6)" }}>출고일자: {ymd(order?.delivery_date) || "-"}</div>
          </div>
          <div className="kpi">
            <div className="k">고객사 / 제품</div>
            <div className="v" style={{ fontSize: "var(--fs-14)" }}>{getCustomerLabel(customer)}</div>
            <div className="muted" style={{ marginTop: "var(--sp-6)" }}>{getProductLabel(product)}</div>
          </div>
          <div className="kpi">
            <div className="k">매칭상태</div>
            <div className="v">{fmt(matchedQty)} / {fmt(confirmedQty)}</div>
            <div className="muted" style={{ marginTop: "var(--sp-6)" }}>
              {isMatchedComplete ? "원란매칭 완료" : "원란매칭 미완료"}
            </div>
          </div>
        </div>

        <div className="purchase-table-wrap" style={{ marginTop: "var(--sp-14)" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>원란식별자</th>
                <th>매칭수량</th>
                <th>입고일</th>
                <th>농장유형</th>
              </tr>
            </thead>
            <tbody>
              {!matches.length ? (
                <tr>
                  <td colSpan={4} className="muted">매칭된 원란이 없습니다.</td>
                </tr>
              ) : (
                matches.map((m) => {
                  const lot = eggLotsByPk[toPk(m?.egg_lot)] || (typeof m?.egg_lot === "object" ? m.egg_lot : null);
                  return (
                    <tr key={m?.id ?? `${toPk(m?.egg_lot)}-${m?.quantity}`}>
                      <td>{lot ? getLotLabel(lot) : toPk(m?.egg_lot)}</td>
                      <td>{fmt(m?.quantity)}</td>
                      <td>{ymd(lot?.receiving_date) || "-"}</td>
                      <td>{normalizeFarmType(lot?.farm_type) || "-"}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="page-card">
        <h3 style={{ marginTop: 0 }}>지시 정보</h3>
        <div className="purchase-remote">
          <div className="remote-grid">
            <div className="field">
              <label>공정일</label>
              <input
                value={form.process_day}
                onChange={(e) => setForm((prev) => ({ ...prev, process_day: e.target.value }))}
                placeholder="예: 2026-02-22 AM"
              />
            </div>

            <div className="field">
              <label>라인</label>
              <input
                value={form.machine_line}
                onChange={(e) => setForm((prev) => ({ ...prev, machine_line: e.target.value }))}
                placeholder="예: LINE-1"
              />
            </div>

            <div className="field remote-span-2">
              <label>작업 위치</label>
              <input
                value={form.location}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="예: 가공실 A"
              />
            </div>

            <div className="field remote-span-3">
              <label>메모</label>
              <input
                value={form.memo}
                onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
                placeholder="(선택)"
              />
            </div>
          </div>

          <div className="remote-actions">
            <button
              className="btn secondary"
              type="button"
              onClick={() => {
                const qs = new URLSearchParams();
                if (date) qs.set("date", date);
                if (order?.id) qs.set("orderId", String(order.id));
                nav(`/purchase/egg-matching?${qs.toString()}`);
              }}
            >
              원란매칭 이동
            </button>
            <button className="btn" type="button" onClick={createInstructions} disabled={submitting}>
              {submitting ? "생성중.." : "작업지시서 생성 (재고 미반영)"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
