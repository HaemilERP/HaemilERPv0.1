/**
 * 발주 부가정보(프론트-only 임시 저장)
 * - 현재 백엔드 Order 스키마에 없는 필드(거처/센터구분/과세구분/단가/비고 등)를
 *   UI에 먼저 반영하기 위한 로컬 저장소입니다.
 * - 백엔드에 필드가 추가되면 점진적으로 제거할 수 있습니다.
 */

const KEY = "haemil_order_extras_v1";

function safeParse(raw, fallback) {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function loadAllOrderExtras() {
  const raw = localStorage.getItem(KEY);
  const obj = safeParse(raw, {});
  return obj && typeof obj === "object" ? obj : {};
}

export function loadOrderExtra(orderId) {
  if (orderId == null) return null;
  const all = loadAllOrderExtras();
  return all?.[String(orderId)] || null;
}

export function saveOrderExtra(orderId, data) {
  if (orderId == null) return;
  const all = loadAllOrderExtras();
  all[String(orderId)] = data;
  localStorage.setItem(KEY, JSON.stringify(all));
}

export function deleteOrderExtra(orderId) {
  if (orderId == null) return;
  const all = loadAllOrderExtras();
  delete all[String(orderId)];
  localStorage.setItem(KEY, JSON.stringify(all));
}
