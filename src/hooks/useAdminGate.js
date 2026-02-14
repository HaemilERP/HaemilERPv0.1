
import { useEffect, useState } from "react";
import { api } from "../services/apiClient";
import { API_PATHS } from "../config/api";

export default function useAdminGate() {
  const [checking, setChecking] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const run = async () => {
      try {
        const res = await api.get(API_PATHS.me);
        const role = res.data?.role;
        if (!mounted) return;
        setIsAdmin(role === "ADMIN");
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.detail || e?.message || "권한 확인 실패");
        setIsAdmin(false);
      } finally {
        if (mounted) setChecking(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, []);

  return { checking, isAdmin, error };
}
