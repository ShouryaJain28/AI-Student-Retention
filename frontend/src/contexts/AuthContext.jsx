import { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { authApi } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("sr_token"));
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("sr_user");
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        localStorage.removeItem("sr_user");
      }
    }
  }, []);

  const saveSession = (sessionToken, sessionUser) => {
    if (!sessionToken || !sessionUser) {
      throw new Error("Invalid authentication response from server");
    }
    setToken(sessionToken);
    setUser(sessionUser);
    localStorage.setItem("sr_token", sessionToken);
    localStorage.setItem("sr_user", JSON.stringify(sessionUser));
  };

  const resolveAuthError = (error, fallbackMessage) => {
    const apiMessage = error?.response?.data?.error;
    if (apiMessage) return apiMessage;

    if (error?.code === "ERR_NETWORK") {
      return "Cannot reach backend API. Start backend on http://127.0.0.1:5000 and try again.";
    }

    return error?.message || fallbackMessage;
  };

  const login = async (payload) => {
    setLoading(true);
    try {
      const res = await authApi.login(payload);
      saveSession(res.data.token, res.data.user);
      toast.success("Welcome back");
      return true;
    } catch (error) {
      toast.error(resolveAuthError(error, "Login failed"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (payload) => {
    setLoading(true);
    try {
      const res = await authApi.signup(payload);
      saveSession(res.data.token, res.data.user);
      toast.success("Account created");
      return true;
    } catch (error) {
      toast.error(resolveAuthError(error, "Signup failed"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async (payload) => {
    setLoading(true);
    try {
      const res = await authApi.googleLogin(payload);
      saveSession(res.data.token, res.data.user);
      toast.success("Signed in with Google");
      return true;
    } catch (error) {
      toast.error(resolveAuthError(error, "Google login failed"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (payload) => {
    setLoading(true);
    try {
      const res = await authApi.updateProfile(payload);
      saveSession(res.data.token, res.data.user);
      toast.success(res.data.message || "Profile updated");
      return true;
    } catch (error) {
      toast.error(resolveAuthError(error, "Profile update failed"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = async (payload) => {
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(payload);
      toast.success(res.data?.message || "Password reset successful");
      return true;
    } catch (error) {
      toast.error(resolveAuthError(error, "Password reset failed"));
      return false;
    } finally {
      setLoading(false);
    }
  };

  const refreshProfile = async () => {
    try {
      const res = await authApi.getProfile();
      const profileUser = res?.data?.user;
      if (!profileUser) return null;
      setUser(profileUser);
      localStorage.setItem("sr_user", JSON.stringify(profileUser));
      return profileUser;
    } catch {
      return null;
    }
  };

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem("sr_token");
    localStorage.removeItem("sr_user");
    toast.success("Logged out");
  };

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      signup,
      loginWithGoogle,
      updateProfile,
      forgotPassword,
      refreshProfile,
      logout,
      isAuthenticated: Boolean(token),
    }),
    [user, token, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
