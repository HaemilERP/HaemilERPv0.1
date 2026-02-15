import { api } from "./apiClient";
import { unwrapList } from "../utils/helpers";

/**
 * Accounting/기초정보 공통 API
 * - 백엔드가 배열([]) 또는 {results: []} 형태로 반환할 수 있어 방어 처리
 */
const asList = unwrapList;

// Farms
export async function listFarms() {
  const res = await api.get("/farms/");
  return asList(res.data);
}
export async function createFarm(payload) {
  const res = await api.post("/farms/", payload);
  return res.data;
}
export async function patchFarm(id, payload) {
  const res = await api.patch(`/farms/${id}/`, payload);
  return res.data;
}
export async function deleteFarm(id) {
  const res = await api.delete(`/farms/${id}/`);
  return res.data;
}

// Customers
export async function listCustomers() {
  const res = await api.get("/customers/");
  return asList(res.data);
}
export async function createCustomer(payload) {
  const res = await api.post("/customers/", payload);
  return res.data;
}
export async function patchCustomer(id, payload) {
  const res = await api.patch(`/customers/${id}/`, payload);
  return res.data;
}
export async function deleteCustomer(id) {
  const res = await api.delete(`/customers/${id}/`);
  return res.data;
}

// Products
export async function listProducts() {
  const res = await api.get("/products/");
  return asList(res.data);
}
export async function createProduct(payload) {
  const res = await api.post("/products/", payload);
  return res.data;
}
export async function patchProduct(id, payload) {
  const res = await api.patch(`/products/${id}/`, payload);
  return res.data;
}
export async function deleteProduct(id) {
  const res = await api.delete(`/products/${id}/`);
  return res.data;
}
