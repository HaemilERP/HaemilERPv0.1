/**
 * 원란 매칭(프론트-only 상태/저장)
 * - 사용자가 원란 매칭 페이지에서 저장한 내용을 localStorage에 보관합니다.
 * - 백엔드에서 발주(확정/완료) 상태는 내려주지만, "원란 미정" 표기는 프론트에서만 구분해야 한다는 요구 반영.
 */

const KEY = "haemil_order_egg_matches_v1";

function safeJsonParse(s, fallback) {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
}

export function loadAllOrderMatches() {
  const raw = localStorage.getItem(KEY);
  const obj = safeJsonParse(raw, {});
  return obj && typeof obj === "object" ? obj : {};
}

export function loadOrderMatch(orderId) {
  if (orderId == null) return null;
  const all = loadAllOrderMatches();
  return all?.[String(orderId)] || null;
}

export function saveOrderMatch(orderId, data) {
  if (orderId == null) return;
  const all = loadAllOrderMatches();
  all[String(orderId)] = data;
  localStorage.setItem(KEY, JSON.stringify(all));

  // same-tab에서도 즉시 UI 갱신이 필요하므로 커스텀 이벤트를 쏴줍니다.
  // (storage 이벤트는 다른 탭에서만 동작)
  try {
    window.dispatchEvent(new Event("haemil:orderMatchUpdated"));
  } catch {
    // noop
  }
}

export function deleteOrderMatch(orderId) {
  if (orderId == null) return;
  const all = loadAllOrderMatches();
  delete all[String(orderId)];
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function calcRequiredEggs(order) {
  const trays30 = Number(order?.confirmed_quantity ?? order?.confirmedQuantity ?? order?.quantity ?? 0);
  if (!Number.isFinite(trays30) || trays30 <= 0) return 0;
  return trays30 * 30;
}

export function calcAllocatedEggs(match) {
  const items = match?.items;
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum, it) => {
    const trays = Number(it?.trays ?? 0);
    const eggsPerTray = Number(it?.eggsPerTray ?? match?.eggsPerTray ?? 30);
    if (!Number.isFinite(trays) || !Number.isFinite(eggsPerTray)) return sum;
    return sum + Math.max(0, trays) * Math.max(0, eggsPerTray);
  }, 0);
}

export function isOrderMatched(order, match) {
  const required = calcRequiredEggs(order);
  const allocated = calcAllocatedEggs(match);
  if (required <= 0) return false;
  return allocated >= required;
}

/**
 * 사용자가 원란매칭을 "저장"했는지 여부(프론트-only 상태)
 * - 수량 충족 여부와 별개로, 저장된 배정 항목이 1개 이상이면 "원란 확인"으로 표시합니다.
 */
export function isOrderMatchSaved(match) {
  const items = match?.items;
  if (!Array.isArray(items)) return false;
  return items.some((it) => {
    const trays = Number(it?.trays ?? 0);
    return Number.isFinite(trays) && trays > 0 && it?.eggLotId != null;
  });
}
