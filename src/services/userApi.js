import { api } from "./apiClient";
import { API_PATHS } from "../config/api";

export async function signupUser(payload) {
  const res = await api.post(API_PATHS.signup, payload);
  return res.data;
}
