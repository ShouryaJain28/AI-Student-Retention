import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { GoogleOAuthProvider } from "@react-oauth/google";
import App from "./App.jsx";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import "./styles/global.scss";

// API base URL is configurable; fallback supports local backend runs.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000").replace(/\/$/, "");

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
  try {
    // Backend owns Google OAuth config so frontend env is optional.
    const response = await fetch(`${API_BASE_URL}/auth/google-config`);
    const data = await response.json();
    const googleClientId = (data?.clientId || "").trim();

    window.__SR_GOOGLE_ENABLED__ = Boolean(googleClientId);

    if (googleClientId) {
      // Render with Google provider only when backend has a valid client id.
      root.render(<GoogleOAuthProvider clientId={googleClientId}>{app}</GoogleOAuthProvider>);
      return;
    }
  } catch {
    window.__SR_GOOGLE_ENABLED__ = false;
  }

  root.render(app);
}

bootstrap();

