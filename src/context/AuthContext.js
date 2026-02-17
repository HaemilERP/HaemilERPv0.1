import { createContext, useContext, useMemo, useState, useEffect } from "react";
import { getInitialAuthState, loginRequest, logoutRequest } from "../services/authApi";
import { getApiErrorMessage } from "../utils/helpers";
import { api } from "../services/apiClient";
import { API_PATHS } from "../config/api";

const AuthContext = createContext();

const normalizeUser = (me) => {
  if (!me) return null;
  const role = me?.role ? String(me.role).toUpperCase() : me?.role;
  return { ...me, role, isAdmin: role === "ADMIN" };
};

export const AuthProvider = ({ children }) => {
  const initial = useMemo(() => getInitialAuthState(), []);

  const [isAuthenticated, setIsAuthenticated] = useState(initial.isAuthenticated);
  const [user, setUser] = useState(initial.user);
  const [authLoading, setAuthLoading] = useState(false);

  // ✅ 토큰이 있으면 /me로 role 확정 (새로고침/직접 URL 진입에도 ADMIN 유지)
  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      if (!initial.isAuthenticated) return;

      setAuthLoading(true);
      try {
        const meRes = await api.get(API_PATHS.me);
        if (!mounted) return;
        setUser(normalizeUser(meRes.data));
        setIsAuthenticated(true);
      } catch (e) {
        // 토큰이 유효하지 않으면 로그아웃 처리
        logoutRequest();
        if (!mounted) return;
        setUser(null);
        setIsAuthenticated(false);
      } finally {
        if (mounted) setAuthLoading(false);
      }
    };

    boot();
    return () => {
      mounted = false;
    };
  }, [initial.isAuthenticated]);

  // ✅ 로그인 직후에도 무조건 /me로 유저 확정
  const login = async ({ username, password }) => {
    setAuthLoading(true);
    try {
      await loginRequest({ username, password });

      const meRes = await api.get(API_PATHS.me);
      setUser(normalizeUser(meRes.data));
      setIsAuthenticated(true);

      return { ok: true };
    } catch (e) {
      setUser(null);
      setIsAuthenticated(false);
      return {
        ok: false,
        message: getApiErrorMessage(e, e?.message || "Login failed"),
      };
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    logoutRequest();
    setUser(null);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, authLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
