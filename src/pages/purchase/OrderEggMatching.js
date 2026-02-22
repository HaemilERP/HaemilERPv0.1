import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "../accounting/AccountingTable.css";
import "./Purchase.css";

import { listCustomers, listProducts } from "../../services/accountingApi";
import { listEggLots } from "../../services/inventoryApi";
import {
  createMatchingEgg,
  deleteMatchingEgg,
  getOrder,
  listMatchingEggs,
  listOrders,
  patchMatchingEgg,
} from "../../services/purchaseApi";
import { asText, getApiErrorMessage, getIdentifierLabel, normalizeFarmType } from "../../utils/helpers";

function ymd(v) {
  if (!v) return "";
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
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

function getLotPk(lot) {
  return lot?.id ?? null;
}

function getLotLabel(lot) {
  const no = getIdentifierLabel(lot, ["Egglot_no", "egg_lot_id"], ["id"]);
  const farm =
    typeof lot?.farm === "object"
      ? getIdentifierLabel(lot.farm, ["farm_id"], ["id"])
      : asText(lot?.farm);
  const qty = num(lot?.quantity, 0);
  const parts = [no, farm ? `farm:${farm}` : "", qty ? `qty:${fmt(qty)}` : ""].filter(Boolean);
  return parts.join(" / ");
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

export default function OrderEggMatching() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();

  const [date, setDate] = useState(sp.get("date") || "");
  const [orderIdInput, setOrderIdInput] = useState(sp.get("orderId") || "");
  const [orderOptions, setOrderOptions] = useState([]);

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [eggLots, setEggLots] = useState([]);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [order, setOrder] = useState(null);
  const [orderLoading, setOrderLoading] = useState(false);

  const [serverMatches, setServerMatches] = useState([]);
  const [draftRows, setDraftRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState("");
  const [saveMsg, setSaveMsg] = useState("");

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

  const selectedCustomer = useMemo(() => {
    if (!order) return null;
    return customersByPk[toPk(order?.customer)] || (typeof order?.customer === "object" ? order.customer : null);
  }, [order, customersByPk]);

  const selectedProduct = useMemo(() => {
    if (!order) return null;
    return productsByPk[toPk(order?.product)] || (typeof order?.product === "object" ? order.product : null);
  }, [order, productsByPk]);

  const confirmedQty = useMemo(() => num(order?.quantity, 0), [order]);
  const allocatedQty = useMemo(
    () => draftRows.reduce((sum, row) => sum + Math.max(0, num(row?.quantity, 0)), 0),
    [draftRows]
  );
  const progressPct = useMemo(() => {
    if (!confirmedQty) return 0;
    return Math.min(100, Math.round((allocatedQty / confirmedQty) * 100));
  }, [allocatedQty, confirmedQty]);

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
    setSaveErr("");
    setSaveMsg("");
    try {
      const nextOrder = await getOrder(id);
      const orderPk = getOrderPk(nextOrder);
      const matches = await listOrderMatches(orderPk);

      setOrder(nextOrder);
      setServerMatches(matches);
      setDraftRows(
        (matches || []).map((m) => ({
          id: m?.id ?? null,
          egg_lot: toPk(m?.egg_lot),
          quantity: String(num(m?.quantity, 0)),
        }))
      );

      const next = new URLSearchParams(sp);
      next.set("orderId", String(id));
      if (date) next.set("date", date);
      setSp(next, { replace: true });
    } catch (e) {
      setErr(getApiErrorMessage(e, "발주 정보를 불러오지 못했습니다."));
      setOrder(null);
      setServerMatches([]);
      setDraftRows([]);
    } finally {
      setOrderLoading(false);
    }
  }

  useEffect(() => {
    const qid = sp.get("orderId");
    if (qid) loadOrderById(qid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function addDraftRow() {
    setDraftRows((prev) => [...prev, { id: null, egg_lot: "", quantity: "" }]);
  }

  function updateDraftRow(index, patch) {
    setDraftRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeDraftRow(index) {
    setDraftRows((prev) => prev.filter((_, i) => i !== index));
  }

  function validateRows() {
    if (!order?.id) return "발주를 먼저 선택해주세요.";
    if (!confirmedQty || confirmedQty <= 0) return "생산수량확정(확정수량) 이후에 원란매칭을 진행할 수 있습니다.";

    const usedLotSet = new Set();
    for (const row of draftRows) {
      const lotPk = String(row?.egg_lot || "").trim();
      const quantity = num(row?.quantity, NaN);
      if (!lotPk) return "모든 매칭 행에서 원란 로트를 선택해주세요.";
      if (!Number.isFinite(quantity) || quantity <= 0) return "매칭 수량은 1 이상의 숫자여야 합니다.";
      if (usedLotSet.has(lotPk)) return "같은 원란 로트를 중복으로 선택할 수 없습니다.";
      usedLotSet.add(lotPk);
    }

    if (allocatedQty !== confirmedQty) {
      return `매칭수량(${fmt(allocatedQty)})과 확정수량(${fmt(confirmedQty)})이 같아야 합니다.`;
    }

    return "";
  }

  async function onSave() {
    if (saving) return;
    setSaveErr("");
    setSaveMsg("");

    const validationError = validateRows();
    if (validationError) {
      setSaveErr(validationError);
      return;
    }

    setSaving(true);
    try {
      const orderPk = getOrderPk(order);
      const nextRows = draftRows.map((row) => ({
        id: row?.id ?? null,
        egg_lot: Number(row.egg_lot),
        quantity: Number(row.quantity),
      }));

      const serverById = new Map((serverMatches || []).map((m) => [String(m.id), m]));
      const keptIds = new Set();

      for (const row of nextRows) {
        if (row.id != null && serverById.has(String(row.id))) {
          keptIds.add(String(row.id));
          const prev = serverById.get(String(row.id));
          if (Number(prev?.egg_lot) !== row.egg_lot || Number(prev?.quantity) !== row.quantity) {
            await patchMatchingEgg(row.id, {
              order: Number(orderPk),
              egg_lot: row.egg_lot,
              quantity: row.quantity,
            });
          }
          continue;
        }

        const created = await createMatchingEgg({
          order: Number(orderPk),
          egg_lot: row.egg_lot,
          quantity: row.quantity,
        });
        if (created?.id != null) keptIds.add(String(created.id));
      }

      for (const prev of serverMatches || []) {
        const prevId = String(prev?.id ?? "");
        if (!prevId) continue;
        if (keptIds.has(prevId)) continue;
        await deleteMatchingEgg(prev.id);
      }

      await loadOrderById(orderPk);
      setSaveMsg("저장되었습니다. 발주 목록에서 원란매칭 완료 상태로 표시됩니다.");
    } catch (e) {
      setSaveErr(getApiErrorMessage(e, "원란매칭 저장에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="page-card">
        <h2 className="page-title">원란 매칭</h2>
        <div className="muted" style={{ marginTop: "var(--sp-12)" }}>불러오는 중..</div>
      </div>
    );
  }

  return (
    <div className="page-card purchase-shell">
      <div className="purchase-head">
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>원란 매칭</h2>
          <div className="sub" style={{ marginTop: "var(--sp-8)" }}>
            확정수량과 원란 매칭수량이 정확히 같아야 저장할 수 있습니다.
          </div>
        </div>
      </div>

      {err && <div className="field-error" style={{ whiteSpace: "pre-wrap" }}>{err}</div>}

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
                const customer =
                  customersByPk[toPk(o?.customer)] ||
                  (typeof o?.customer === "object" ? o.customer : null);
                const product =
                  productsByPk[toPk(o?.product)] ||
                  (typeof o?.product === "object" ? o.product : null);

                return (
                  <option key={toPk(o) || getOrderLabel(o)} value={toPk(o)}>
                    {getOrderLabel(o)} / {getCustomerLabel(customer)} / {getProductLabel(product)} / 확정:{fmt(o?.quantity)}
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

      <div className="summary-kpi">
        <div className="kpi">
          <div className="k">발주번호</div>
          <div className="v">{order ? getOrderLabel(order) : "-"}</div>
          <div className="muted" style={{ marginTop: "var(--sp-6)" }}>
            출고일자: {ymd(order?.delivery_date) || "-"}
          </div>
        </div>

        <div className="kpi">
          <div className="k">고객사 / 제품</div>
          <div className="v" style={{ fontSize: "var(--fs-14)" }}>{getCustomerLabel(selectedCustomer)}</div>
          <div className="muted" style={{ marginTop: "var(--sp-6)" }}>{getProductLabel(selectedProduct)}</div>
        </div>

        <div className="kpi">
          <div className="k">매칭 진행</div>
          <div className="v">{fmt(allocatedQty)}</div>
          <div className="muted" style={{ marginTop: "var(--sp-6)" }}>
            확정수량: {fmt(confirmedQty)}
          </div>
        </div>
      </div>

      <div>
        <div className="progress" style={{ marginTop: "var(--sp-10)" }}>
          <div style={{ width: `${progressPct}%` }} />
        </div>
        <div className="muted" style={{ marginTop: "var(--sp-8)" }}>
          진행률 {progressPct}% ({fmt(allocatedQty)} / {fmt(confirmedQty)})
        </div>
      </div>

      {saveErr && <div className="field-error" style={{ whiteSpace: "pre-wrap" }}>{saveErr}</div>}
      {saveMsg && <div className="field-help" style={{ whiteSpace: "pre-wrap" }}>{saveMsg}</div>}

      <div className="match-grid">
        <div className="scroll-box">
          <div className="scroll-head">
            <div style={{ fontWeight: 900 }}>원란 재고</div>
            <div className="muted">식별자: Egglot_no / egg_lot_id</div>
          </div>
          <div className="scroll-body">
            <div className="purchase-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>원란식별자</th>
                    <th>농장식별자</th>
                    <th>입고일</th>
                    <th>농장유형</th>
                    <th>재고량</th>
                    <th>추가</th>
                  </tr>
                </thead>
                <tbody>
                  {!eggLots.length ? (
                    <tr>
                      <td colSpan={6} className="muted">원란 재고가 없습니다.</td>
                    </tr>
                  ) : (
                    eggLots.map((lot) => {
                      const lotPk = getLotPk(lot);
                      const lotKey = lotPk == null ? getLotLabel(lot) : String(lotPk);
                      const already = draftRows.some((row) => String(row?.egg_lot) === String(lotPk));
                      const farmId =
                        typeof lot?.farm === "object"
                          ? getIdentifierLabel(lot.farm, ["farm_id"], ["id"])
                          : asText(lot?.farm);

                      return (
                        <tr key={lotKey}>
                          <td>{getIdentifierLabel(lot, ["Egglot_no", "egg_lot_id"], ["id"])}</td>
                          <td>{farmId || "-"}</td>
                          <td>{ymd(lot?.receiving_date) || "-"}</td>
                          <td>{normalizeFarmType(lot?.farm_type) || "-"}</td>
                          <td>{fmt(lot?.quantity)}</td>
                          <td>
                            <button
                              className="btn secondary small"
                              type="button"
                              disabled={already}
                              onClick={() => {
                                setDraftRows((prev) => [
                                  ...prev,
                                  { id: null, egg_lot: String(lotPk), quantity: "0" },
                                ]);
                              }}
                            >
                              {already ? "추가됨" : "추가"}
                            </button>
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

        <div className="scroll-box" style={{ position: "sticky", top: "var(--sp-18)", alignSelf: "start" }}>
          <div className="scroll-head">
            <div style={{ fontWeight: 900 }}>매칭 목록</div>
            <div className="row-actions">
              <button className="btn secondary small" type="button" onClick={addDraftRow}>
                행 추가
              </button>
              <button className="btn secondary small" type="button" onClick={() => setDraftRows([])}>
                전체 비우기
              </button>
            </div>
          </div>

          <div className="scroll-body">
            <div className="purchase-table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>원란식별자</th>
                    <th>매칭수량</th>
                    <th>삭제</th>
                  </tr>
                </thead>
                <tbody>
                  {!draftRows.length ? (
                    <tr><td colSpan={3} className="muted">매칭 행이 없습니다.</td></tr>
                  ) : (
                    draftRows.map((row, index) => (
                      <tr key={`${row?.id ?? "new"}-${index}`}>
                        <td>
                          <select
                            value={row?.egg_lot || ""}
                            onChange={(e) => updateDraftRow(index, { egg_lot: e.target.value })}
                          >
                            <option value="">선택</option>
                            {eggLots.map((lot) => {
                              const lotPk = getLotPk(lot);
                              const lotPkText = lotPk == null ? "" : String(lotPk);
                              return (
                                <option key={lotPkText || getLotLabel(lot)} value={lotPkText}>
                                  {getLotLabel(lot)}
                                </option>
                              );
                            })}
                          </select>
                        </td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={row?.quantity ?? ""}
                            onChange={(e) => updateDraftRow(index, { quantity: e.target.value })}
                          />
                        </td>
                        <td>
                          <button
                            className="btn danger small"
                            type="button"
                            onClick={() => removeDraftRow(index)}
                          >
                            삭제
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="modal-foot" style={{ borderTop: "1px solid var(--color-border-soft)" }}>
            <button className="btn secondary" type="button" onClick={() => nav(`/purchase?date=${date || ""}`)}>
              발주목록
            </button>
            <button className="btn" type="button" onClick={onSave} disabled={saving || !order?.id}>
              {saving ? "저장중.." : "저장"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
