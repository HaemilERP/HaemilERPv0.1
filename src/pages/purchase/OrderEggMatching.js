import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import "../accounting/AccountingTable.css";
import "./Purchase.css";

import { listCustomers, listProducts } from "../../services/accountingApi";
import { listEggLots } from "../../services/inventoryApi";
import { getOrder, listOrders } from "../../services/purchaseApi";
import {
  loadOrderMatch,
  saveOrderMatch,
} from "../../utils/orderMatchLocal";
import { getApiErrorMessage } from "../../utils/helpers";

const EGG_WEIGHT_RANK = {
  "소란": 1,
  "중란": 2,
  "대란": 3,
  "특란": 4,
  "왕란": 5,
};

function ymd(v) {
  if (!v) return "";
  const s = String(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s;
}

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(n) {
  const v = num(n, 0);
  return v.toLocaleString();
}

export default function OrderEggMatching() {
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();

  // 출고일자는 사용자가 직접 선택/입력합니다(기본값: 빈 값)
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

  const UNIT_SIZE = 30; // 발주/원란 매칭 기본 단위: 1판 = 30알(고정)
  const [accOpen, setAccOpen] = useState(false);

  // 발주가 없으면(선택/로드 실패 등) 대체가능 원란 영역을 닫습니다.
  useEffect(() => {
    if (!order?.id) setAccOpen(false);
  }, [order?.id]);

  // local match state
  const [items, setItems] = useState([]); // [{eggLotId, trays, eggsPerTray}]
  const [saveMsg, setSaveMsg] = useState("");

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

  const eggLotsById = useMemo(() => {
    const m = {};
    (eggLots || []).forEach((l) => {
      if (l?.id != null) m[String(l.id)] = l;
    });
    return m;
  }, [eggLots]);

  const selectedProduct = useMemo(() => {
    if (!order) return null;
    const pid = order?.product;
    return productsById[String(pid)] || null;
  }, [order, productsById]);

  const requiredWeight = useMemo(() => {
    // 발주 당시 난중(백엔드 확장 필드)이 있으면 그걸 우선, 없으면 제품 마스터 난중
    const w = order?.product_egg_weight || selectedProduct?.egg_weight;
    return w ? String(w) : "";
  }, [order, selectedProduct]);

  const requiredRank = useMemo(() => EGG_WEIGHT_RANK[requiredWeight] || 0, [requiredWeight]);

  const eligibleLots = useMemo(() => {
    // "해당 난중 이상"만
    if (!requiredRank) return (eggLots || []).slice();
    return (eggLots || [])
      .filter((l) => {
        const r = EGG_WEIGHT_RANK[String(l?.egg_weight || "")] || 0;
        return r >= requiredRank;
      })
      .slice();
  }, [eggLots, requiredRank]);

  const baseLots = useMemo(() => {
    if (!requiredWeight) return [];
    return eligibleLots
      .filter((l) => String(l?.egg_weight || "") === requiredWeight)
      .sort((a, b) => (String(b?.receiving_date || "").localeCompare(String(a?.receiving_date || ""))));
  }, [eligibleLots, requiredWeight]);

  const substituteLots = useMemo(() => {
    // 발주 선택 전에는 대체가능 원란 목록을 표시하지 않습니다.
    if (!order?.id) return [];
    // 기타 대체가능 원란: 기준 난중 제외 + 난중 작은 순(= 기준보다 큰 것들 중 가까운 것부터)
    return eligibleLots
      .filter((l) => String(l?.egg_weight || "") !== requiredWeight)
      .sort((a, b) => {
        const ra = EGG_WEIGHT_RANK[String(a?.egg_weight || "")] || 0;
        const rb = EGG_WEIGHT_RANK[String(b?.egg_weight || "")] || 0;
        if (ra !== rb) return ra - rb;
        return String(b?.receiving_date || "").localeCompare(String(a?.receiving_date || ""));
      });
  }, [eligibleLots, requiredWeight, order?.id]);

  const orderQtyTrays = useMemo(() => num(order?.confirmed_quantity ?? order?.quantity, 0), [order]);
  const allocatedTrays = useMemo(
    () => (items || []).reduce((s, it) => s + Math.max(0, num(it?.trays, 0)), 0),
    [items]
  );
  const progressPct = useMemo(() => {
    if (!orderQtyTrays) return 0;
    return Math.min(100, Math.round((allocatedTrays / orderQtyTrays) * 100));
  }, [allocatedTrays, orderQtyTrays]);

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

  // 날짜별 발주 목록(선택용)
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (!date) {
          if (!alive) return;
          setOrderOptions([]);
          return;
        }
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
    setSaveMsg("");
    try {
      const o = await getOrder(id);
      setOrder(o);

      // local match restore
      const saved = loadOrderMatch(id);
      setItems(Array.isArray(saved?.items) ? saved.items : []);

      // sync url
      const next = new URLSearchParams(sp);
      next.set("orderId", String(id));
      if (date) next.set("date", date);
      setSp(next, { replace: true });
    } catch (e) {
      setErr(getApiErrorMessage(e, "발주 정보를 불러오지 못했습니다."));
      setOrder(null);
      setItems([]);
    } finally {
      setOrderLoading(false);
    }
  }

  useEffect(() => {
    const qid = sp.get("orderId");
    if (qid) loadOrderById(qid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function availTrays(lot) {
    const q = num(lot?.quantity, 0);
    if (q <= 0) return 0;
    return Math.floor(q / UNIT_SIZE);
  }

  function getItem(eggLotId) {
    return items.find((x) => String(x.eggLotId) === String(eggLotId));
  }

  function upsertItem(eggLotId, trays) {
    const t = Math.max(0, Math.floor(num(trays, 0)));
    const id = String(eggLotId);
    setItems((prev) => {
      const next = prev.slice();
      const idx = next.findIndex((x) => String(x.eggLotId) === id);
      if (t === 0) {
        if (idx >= 0) next.splice(idx, 1);
        return next;
      }
      const payload = { eggLotId: Number(eggLotId), trays: t, eggsPerTray: UNIT_SIZE };
      if (idx >= 0) next[idx] = payload;
      else next.push(payload);
      return next;
    });
  }

  function pickLot(lot) {
    const lotId = lot?.id;
    if (lotId == null) return;
    const max = availTrays(lot);
    if (max <= 0) return;
    const exists = getItem(lotId);
    if (exists) return;
    // 배정 판 수는 우측 "배정 목록"에서 조절하므로, 추가 시 기본 1판으로 넣습니다.
    upsertItem(lotId, 1);
  }

  async function onSave() {
    if (!order?.id) return;
    const payload = {
      eggsPerTray: UNIT_SIZE,
      items,
      updatedAt: new Date().toISOString(),
    };
    saveOrderMatch(order.id, payload);
    const msg = '저장했습니다. 발주 목록에서 "원란확인"으로 표시됩니다.';
    setSaveMsg(msg);
    // 저장 직후 페이지 이동으로 인해 메시지가 보이지 않는 문제가 있어 알림을 띄웁니다.
    window.alert(msg);

    // 요구: 저장 후 발주 페이지로 이동
    const qs = new URLSearchParams();
    if (date) qs.set("date", date);
    nav(`/purchase?${qs.toString()}`);
  }

  const customerName = useMemo(() => {
    const c = customersById[String(order?.customer ?? "")];
    return c?.customer_name || c?.name || "";
  }, [order, customersById]);

  const productName = useMemo(() => {
    const p = selectedProduct;
    if (!p) return "";
    const name = p?.product_name || p?.name || "";
    return name ? `${name}(${p?.id ?? "-"})` : "";
  }, [selectedProduct]);

  // (orderQtyTrays / allocatedTrays) 는 useMemo로 계산

  if (loading) {
    return (
      <div className="page-card">
        <h2 className="page-title">원란 매칭</h2>
        <div className="muted" style={{ marginTop: "var(--sp-12)" }}>
          불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="page-card purchase-shell">
      <div className="purchase-head">
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>원란 매칭</h2>
          <div className="sub" style={{ marginTop: "var(--sp-8)" }}>
            발주번호를 선택/입력한 뒤, 기준 난중 원란과 대체가능 원란에서 배정합니다.
          </div>
        </div>
      </div>

      {err && (
        <div className="field-error" style={{ whiteSpace: "pre-wrap" }}>{err}</div>
      )}

      {/* Remote */}
      <div className="purchase-remote">
        <div className="remote-grid">
          <div className="field">
            <label>날짜</label>
            <input type="date" value={date} onChange={(e) => {
              const v = e.target.value;
              setDate(v);
              const next = new URLSearchParams(sp);
              if (v) next.set("date", v);
              else next.delete("date");
              setSp(next, { replace: true });
            }} />
          </div>

          <div className="field remote-span-2">
            <label>발주 선택</label>
            <select
              value={order?.id ? String(order.id) : ""}
              onChange={(e) => {
                const v = e.target.value;
                if (v) {
                  setOrderIdInput(String(v));
                  loadOrderById(v);
                }
              }}
            >
              <option value="">선택</option>
              {orderOptions.map((o) => {
                const cid = String(o?.customer ?? "");
                const pid = String(o?.product ?? "");
                const c = customersById[cid]?.customer_name || "고객사";
                const p0 = productsById[pid]?.product_name || "제품";
                const p = `${p0}(${pid || "-"})`;
                const q = num(o?.confirmed_quantity ?? o?.quantity, 0);
                return (
                  <option key={o.id} value={o.id}>
                    {o.id} / {c} / {p} / {q}판
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
                  if (!orderIdInput.trim()) return;
                  loadOrderById(orderIdInput.trim());
                }}
                disabled={orderLoading}
              >
                불러오기
              </button>
              <button
                type="button"
                className="btn"
                onClick={onSave}
                disabled={!order?.id || orderLoading}
              >
                저장
              </button>
            </div>
          </div>
        </div>

        {saveMsg && <div className="field-help" style={{ whiteSpace: "pre-wrap" }}>{saveMsg}</div>}
      </div>

      {/* Order Summary */}
      <div className="summary-kpi">
        <div className="kpi">
          <div className="k">발주</div>
          <div className="v">{order?.id ?? "-"}</div>
          <div className="muted" style={{ marginTop: "var(--sp-6)" }}>출고일자: {ymd(order?.delivery_date) || "-"}</div>
        </div>
        <div className="kpi">
          <div className="k">고객사 / 제품</div>
          <div className="v" style={{ fontSize: "var(--fs-14)" }}>{customerName || "-"}</div>
          <div className="muted" style={{ marginTop: "var(--sp-6)" }}>{productName || "-"}</div>
        </div>
        <div className="kpi">
          <div className="k">배정</div>
          <div className="v">{fmt(allocatedTrays)}판</div>
          <div className="muted" style={{ marginTop: "var(--sp-6)" }}>발주 수량: {fmt(orderQtyTrays)}판</div>
        </div>
      </div>

      <div>
        <div className="field-row" style={{ justifyContent: "space-between" }}>
          <div className="field-help">
            기본 단위: 1판 = 30알 (고정)
          </div>
        </div>

        <div className="progress" style={{ marginTop: "var(--sp-10)" }}>
          <div style={{ width: `${progressPct}%` }} />
        </div>
        <div className="muted" style={{ marginTop: "var(--sp-8)" }}>진행률: {progressPct}%</div>
      </div>

      <div className="match-grid">
        {/* Left: Lots */}
        <div style={{ display: "grid", gap: "var(--sp-16)" }}>
          <div className="scroll-box">
            <div className="scroll-head">
              <div style={{ fontWeight: 900 }}>기준 난중 원란</div>
              <div className="muted">{requiredWeight ? `기준 난중: ${requiredWeight}` : "제품 난중이 없습니다."}</div>
            </div>
            <div className="scroll-body">
              <LotTable
                rows={baseLots}
                availTrays={availTrays}
                  onToggle={(lot, checked) => {
                    if (checked) pickLot(lot);
                    else upsertItem(lot?.id, 0);
                  }}
                selectedIds={new Set(items.map((x) => String(x.eggLotId)))}
              />
            </div>
          </div>

          <div className="accordion">
            <div
              className={`acc-head ${order?.id ? "" : "disabled"}`}
              onClick={order?.id ? () => setAccOpen((v) => !v) : undefined}
              aria-disabled={!order?.id}
              title={!order?.id ? "발주를 먼저 선택해주세요." : ""}
            >
              <div className="acc-title">기타 대체가능 원란</div>
              <div className="muted" style={{ fontWeight: 900 }}>{accOpen ? "▾" : "▸"}</div>
            </div>
            {accOpen && (
              <div className="acc-body">
                <div className="scroll-box" style={{ border: 0, borderTop: "1px solid var(--color-border-soft)", borderRadius: 0 }}>
                  <div className="scroll-head">
                    <div className="muted">기준 난중 이상 / 오름차순</div>
                  </div>
                  <div className="scroll-body">
                    <LotTable
                      rows={substituteLots}
                      availTrays={availTrays}
                      onToggle={(lot, checked) => {
                        if (checked) pickLot(lot);
                        else upsertItem(lot?.id, 0);
                      }}
                      selectedIds={new Set(items.map((x) => String(x.eggLotId)))}
                      showWeight
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Assigned */}
        <div className="scroll-box" style={{ position: "sticky", top: "var(--sp-18)", alignSelf: "start" }}>
          <div className="scroll-head">
            <div style={{ fontWeight: 900 }}>배정 목록</div>
            <button
              className="btn secondary small"
              onClick={() => {
                const ok = window.confirm("배정 목록을 비울까요?");
                if (!ok) return;
                setItems([]);
              }}
              disabled={items.length === 0}
            >
              전체 해제
            </button>
          </div>
          <div className="scroll-body" style={{ maxHeight: "clamp(320px, calc(520 * var(--ui, 1)), 620px)" }}>
            <div className="purchase-table-wrap">
              <table className="data-table" style={{ width: "100%", tableLayout: "fixed" }}>
                <colgroup>
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "54%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>재고ID</th>
                    <th>난중</th>
                    <th>가능(판)</th>
                    <th>배정(판)</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="muted">배정된 원란이 없습니다.</td>
                    </tr>
                  ) : (
                    items
                      .slice()
                      .sort((a, b) => String(a.eggLotId).localeCompare(String(b.eggLotId)))
                      .map((it) => {
                        const lot = eggLotsById[String(it.eggLotId)];
                        const max = lot ? availTrays(lot) : 0;
                        const trays = num(it.trays, 0);
                        return (
                          <tr key={it.eggLotId}>
                            <td>{it.eggLotId}</td>
                            <td>{lot?.egg_weight || "-"}</td>
                            <td>{fmt(max)}</td>
                            <td>
                              <div className="assign-cell">
                                <input
                                  type="number"
                                  value={String(trays)}
                                  min={0}
                                  step={1}
                                  onChange={(e) => {
                                    const v = num(e.target.value, 0);
                                    if (max > 0 && v > max) return;
                                    upsertItem(it.eggLotId, v);
                                  }}
                                />
                                <button className="btn danger small" onClick={() => upsertItem(it.eggLotId, 0)}>삭제</button>
                              </div>
                              <div className="field-help">1판 = 30알</div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <div className="modal-foot" style={{ borderTop: "1px solid var(--color-border-soft)" }}>
          </div>
        </div>
      </div>
    </div>
  );
}

function LotTable({ rows, availTrays, onToggle, onPick, selectedIds, showWeight = false }) {

  // backward compat: older prop name(onPick)
  const toggle = onToggle || onPick;

  if (!rows || rows.length === 0) {
    return (
      <div className="muted" style={{ padding: "var(--sp-12)" }}>
        표시할 원란 재고가 없습니다.
      </div>
    );
  }

  return (
    <div className="purchase-table-wrap">
      <table className="data-table" style={{ minWidth: showWeight ? "860px" : "780px" }}>
        <thead>
          <tr>
            <th>재고ID</th>
            {showWeight && <th>난중</th>}
            <th>농장</th>
            <th>산란일</th>
            <th>위치</th>
            <th>수량(알)</th>
            <th>가능(판)</th>
            <th>선택</th>
          </tr>
        </thead>
        <tbody>
          {(rows || []).map((r) => {
            const id = r?.id;
            const max = availTrays(r);
            const selected = selectedIds?.has(String(id));
            return (
              <tr key={id}>
                <td>{id}</td>
                {showWeight && <td>{r?.egg_weight || "-"}</td>}
                <td>{typeof r?.farm === "object" ? (r.farm?.farm_name || r.farm?.name || "-") : (r?.farm || "-")}</td>
                <td>{ymd(r?.laying_date) || "-"}</td>
                <td>{r?.location || "-"}</td>
                <td>{fmt(r?.quantity)}</td>
                <td>{fmt(max)}판</td>
                <td>
                  <span className="lot-check">
                    <input
                      type="checkbox"
                      checked={Boolean(selected)}
                      disabled={max <= 0}
                      onChange={(e) => toggle(r, e.target.checked)}
                    />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
