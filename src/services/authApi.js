import { api, storeTokens, clearTokens, getStoredTokens } from "./apiClient";
import { API_PATHS } from "../config/api";
import { safeDecodeJwt } from "../utils/jwt";

export async function loginRequest({ username, password }) {
  const res = await api.post(API_PATHS.login, { username, password });
  const { access, refresh } = res.data || {};
  if (!access) throw new Error("No access token returned from server.");
  storeTokens({ access, refresh });
  return res.data;
}

export function logoutRequest() {
  clearTokens();
}

export function getInitialAuthState() {
  const { access } = getStoredTokens();
  if (!access) return { isAuthenticated: false, user: null };

  const claims = safeDecodeJwt(access);
  const role = claims?.role ? String(claims.role).toUpperCase() : undefined;

  return {
    isAuthenticated: true,
    user: {
      username: claims?.username || "user",
      role,
      isAdmin: role === "ADMIN",
      claims,
    },
  };
}
