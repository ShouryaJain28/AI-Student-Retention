import axios from "axios";

function getDefaultApiBaseUrl() {
  if (typeof window !== "undefined" && window?.location?.hostname) {
    const protocol = window.location.protocol || "http:";
    const hostname = window.location.hostname;
    const port = window.location.port;

    // Local Vite dev -> backend stays on 5000.
    if (port === "5300" || port === "5173") {
      return `${protocol}//${hostname}:5000`;
    }

    // Production/same-origin fallback.
    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }
  return "http://127.0.0.1:5000";
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || getDefaultApiBaseUrl()).replace(/\/$/, "");
const SESSION_RESET_ROUTES = ["/auth/login", "/auth/signup", "/auth/google", "/auth/forgot-password", "/auth/google-config"];

function clearSessionAndRedirectToLogin() {
  if (typeof window === "undefined") return;

  localStorage.removeItem("sr_token");
  localStorage.removeItem("sr_user");

  const isAlreadyOnLogin = window.location.pathname.startsWith("/login");
  if (!isAlreadyOnLogin) {
    window.location.replace("/login?session=expired");
  }
}

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("sr_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const requestUrl = String(error?.config?.url || "");
    const shouldIgnoreSessionReset = SESSION_RESET_ROUTES.some((route) => requestUrl.includes(route));

    if ((status === 401 || status === 422) && !shouldIgnoreSessionReset) {
      clearSessionAndRedirectToLogin();
    }

    return Promise.reject(error);
  }
);

export const authApi = {
  signup: (payload) => api.post("/auth/signup", payload),
  login: (payload) => api.post("/auth/login", payload),
  googleLogin: (payload) => api.post("/auth/google", payload),
  forgotPassword: (payload) => api.post("/auth/forgot-password", payload),
  getProfile: () => api.get("/auth/profile"),
  updateProfile: (payload) => api.put("/auth/profile", payload),
  listDocuments: () => api.get("/auth/profile/documents"),
  uploadDocument: (formData) =>
    api.post("/auth/profile/documents", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  deleteDocument: (documentId) => api.delete(`/auth/profile/documents/${documentId}`),
};

export const studentsApi = {
  list: (params) => api.get("/students", { params }),
  getById: (studentId) => api.get(`/students/${studentId}`),
  create: (payload) => api.post("/students", payload),
  uploadCsv: (formData) =>
    api.post("/upload-csv", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  exportCsv: () => api.get("/students/export", { responseType: "blob" }),
};

export const analyticsApi = {
  get: () => api.get("/analytics"),
};

export const predictionApi = {
  predict: (payload) => api.post("/predict", payload),
};

export const chatApi = {
  listMessages: () => api.get("/chat/messages"),
  sendMessage: (payload) => api.post("/chat/messages", payload),
  markImportantSeen: () => api.post("/chat/mark-important-seen"),
};
