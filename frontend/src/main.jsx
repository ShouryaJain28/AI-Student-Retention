import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./styles/global.scss";

function getDefaultApiBaseUrl() {
  if (typeof window !== "undefined" && window?.location?.hostname) {
    const protocol = window.location.protocol || "http:";
    const hostname = window.location.hostname;
    const port = window.location.port;

    if (port === "5300" || port === "5173") {
      return `${protocol}//${hostname}:5000`;
    }

    return `${protocol}//${hostname}${port ? `:${port}` : ""}`;
  }
  return "http://127.0.0.1:5000";
}

// API base URL is configurable; fallback supports local and deployed runs.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || getDefaultApiBaseUrl()).replace(/\/$/, "");

const app = (
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <App />
          <Toaster position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

const root = createRoot(document.getElementById("root"));

async function bootstrap() {
  window.__SR_GOOGLE_ENABLED__ = false;
  window.__SR_BACKEND_UP__ = false;

  try {
    // Backend owns Google OAuth config so frontend env is optional.
    const response = await fetch(`${API_BASE_URL}/auth/google-config`);
    if (!response.ok) {
      throw new Error(`Backend responded with ${response.status}`);
    }
    const data = await response.json();
    const googleClientId = (data?.clientId || "").trim();

    window.__SR_BACKEND_UP__ = true;
    window.__SR_GOOGLE_ENABLED__ = Boolean(googleClientId);

    if (googleClientId) {
      // Render with Google provider only when backend has a valid client id.
      root.render(<GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>);
      return;
    }
  } catch {
    window.__SR_BACKEND_UP__ = false;
    window.__SR_GOOGLE_ENABLED__ = false;
  }

  root.render(app);
}

bootstrap();

