import { createContext, useContext, useEffect, useState } from "react";
import { apiRequest } from "../api/client.js";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bootstrap = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest("/auth/me");
        setUser(data.user);
      } catch (error) {
        localStorage.removeItem("token");
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, []);

  const login = async (payload) => {
    const data = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data.user;
  };

  const signup = async (payload) => {
    const data = await apiRequest("/auth/signup", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    localStorage.setItem("token", data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    apiRequest("/auth/logout", { method: "POST" }).catch(() => null);
    localStorage.removeItem("token");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        signup,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
