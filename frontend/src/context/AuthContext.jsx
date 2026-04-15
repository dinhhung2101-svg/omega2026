import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    return saved ? JSON.parse(saved) : null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (username, password) => {
    setLoading(true);
    setError(null);
    try {
      const tokenData = await api.login(username, password);
      localStorage.setItem("token", tokenData.access_token);
      const userData = await api.getMe();
      localStorage.setItem("user", JSON.stringify(userData));
      setUser(userData);
      return userData;
    } catch (err) {
      const isNetwork =
        err?.message === "Failed to fetch" ||
        err?.name === "TypeError" ||
        (typeof err?.message === "string" && err.message.includes("NetworkError"));
      const message = isNetwork
        ? "Không kết nối được backend (cổng 8000). Hãy chạy backend trước: từ thư mục dự án `./start.sh` hoặc `cd backend && source venv/bin/activate && python main.py`"
        : err.message;
      setError(message);
      throw new Error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}