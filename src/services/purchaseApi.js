import { api } from "./apiClient";
import { unwrapList } from "../utils/helpers";

/**
 * Purchase/발주 API
 * - API_BASE_URL 이 이미 /api 를 포함하므로, 여기서는 "/orders/" 형태로 호출합니다.
 * - 백엔드가 배열([]) 또는 {results: []} 형태로 반환할 수 있어 방어 처리합니다.
 */

const asList = unwrapList;

export async function listOrders(params = {}) {
  const res = await api.get("/orders/", { params });
  return asList(res.data);
}

export async function getOrder(id) {
  const res = await api.get(`/orders/${id}/`);
  return res.data;
}

export async function createOrder(payload) {
  const res = await api.post("/orders/", payload);
  return res.data;
}

export async function patchOrder(id, payload) {
  const res = await api.patch(`/orders/${id}/`, payload);
  return res.data;
}

export async function deleteOrder(id) {
  const res = await api.delete(`/orders/${id}/`);
  return res.data;
}

// Histories
export async function listOrderHistories(params = {}) {
  const res = await api.get("/orders/histories/", { params });
  return asList(res.data);
}

export async function getOrderHistory(id) {
  const res = await api.get(`/orders/histories/${id}/`);
  return res.data;
}
