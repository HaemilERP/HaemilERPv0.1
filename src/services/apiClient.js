import axios from "axios";
import { API_BASE_URL, API_PATHS } from "../config/api";
import { isJwtExpired } from "../utils/jwt";

const ACCESS_KEY = "haemeel_access_token";
const REFRESH_KEY = "haemeel_refresh_token";

export function getStoredTokens() {
  return {
    access: localStorage.getItem(ACCESS_KEY),
    refresh: localStorage.getItem(REFRESH_KEY),
  };
}

export function storeTokens({ access, refresh }) {
  if (access) localStorage.setItem(ACCESS_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

let isRefreshing = false;
let refreshQueue = [];

function enqueueRefresh(cb) {
  refreshQueue.push(cb);
}
function flushQueue(newAccessToken) {
  refreshQueue.forEach((cb) => cb(newAccessToken));
  refreshQueue = [];
}

// ✅ refresh는 interceptor 재귀 방지 위해 axios로 직접 호출
async function refreshAccessToken(refresh) {
  const res = await axios.post(
    `${API_BASE_URL}${API_PATHS.refresh}`,
    { refresh },
    { headers: { "Content-Type": "application/json" } }
  );
  return res.data?.access;
}

api.interceptors.request.use(async (config) => {
  // ✅ headers가 undefined일 수 있으니 항상 보장
  config.headers = config.headers || {};

  const { access, refresh } = getStoredTokens();
  if (!access) return config;

  if (refresh && isJwtExpired(access)) {
    if (!isRefreshing) {
      isRefreshing = true;
      try {
        const newAccess = await refreshAccessToken(refresh);
        if (newAccess) {
          storeTokens({ access: newAccess });
          flushQueue(newAccess);
        } else {
          flushQueue(null);
        }
      } catch {
        flushQueue(null);
      } finally {
        isRefreshing = false;
      }
    }

    await new Promise((resolve) =>
      enqueueRefresh((newAccess) => {
        if (newAccess) config.headers.Authorization = `Bearer ${newAccess}`;
        resolve();
      })
    );

    return config;
  }

  config.headers.Authorization = `Bearer ${access}`;
  return config;
});
