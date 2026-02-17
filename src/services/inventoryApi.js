import { api } from "./apiClient";
import { unwrapList } from "../utils/helpers";

/**
 * Inventory/재고 API
 * - 백엔드가 배열([]) 또는 {results: []} 형태로 반환할 수 있어 방어 처리
 */
const asList = unwrapList;

// EggLot
export async function listEggLots() {
  const res = await api.get("/inventory/egglots/");
  return asList(res.data);
}

export async function createEggLot(payload) {
  const res = await api.post("/inventory/egglots/", payload);
  return res.data;
}

export async function patchEggLot(id, payload) {
  const res = await api.patch(`/inventory/egglots/${id}/`, payload);
  return res.data;
}

export async function deleteEggLot(id) {
  const res = await api.delete(`/inventory/egglots/${id}/`);
  return res.data;
}

// EggLotHistory
export async function listEggLotHistories() {
  const res = await api.get("/inventory/egglot-histories/");
  return asList(res.data);
}

export async function patchEggLotHistory(id, payload) {
  const res = await api.patch(`/inventory/egglot-histories/${id}/`, payload);
  return res.data;
}

// ProductLot
export async function listProductLots() {
  const res = await api.get("/inventory/productlots/");
  return asList(res.data);
}

export async function createProductLot(payload) {
  const res = await api.post("/inventory/productlots/", payload);
  return res.data;
}

export async function patchProductLot(id, payload) {
  const res = await api.patch(`/inventory/productlots/${id}/`, payload);
  return res.data;
}

export async function deleteProductLot(id) {
  const res = await api.delete(`/inventory/productlots/${id}/`);
  return res.data;
}

// ProductLotHistory
export async function listProductLotHistories() {
  const res = await api.get("/inventory/productlot-histories/");
  return asList(res.data);
}

export async function patchProductLotHistory(id, payload) {
  const res = await api.patch(`/inventory/productlot-histories/${id}/`, payload);
  return res.data;
}
