import { api, storeTokens, clearTokens, getStoredTokens } from "./apiClient";
import { API_PATHS } from "../config/api";
import { safeDecodeJwt } from "../utils/jwt";

export async function loginRequest({ username, password }) {
  const res = await api.post(API_PATHS.login, { username, password });
  const { access, refresh } = res.data || {};
  if (!access) throw new Error("No access token returned from server.");
  storeTokens({ access, refresh });

  const meRes = await api.get(API_PATHS.me);
  const user = meRes.data;
  return { user: { ...user, isAdmin: user?.role === "ADMIN" } };
}

export function logoutRequest() { clearTokens(); }

export function getInitialAuthState() {
  const { access } = getStoredTokens();
  if (!access) return { isAuthenticated: false, user: null };
  const claims = safeDecodeJwt(access);
  return { isAuthenticated: true, user: { username: claims?.username || "user", role: claims?.role, isAdmin: claims?.role === "ADMIN", claims } };
}
