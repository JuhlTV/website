import { useEffect, useMemo, useState } from "react";
import LoginForm from "./components/LoginForm";
import ChecklistForm from "./components/ChecklistForm";
import ReportsList from "./components/ReportsList";
import { apiRequest } from "./api/client";

const DARKMODE_STORAGE_KEY = "darkMode";

function isStoredTokenUsable(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) {
      return false;
    }

    const payloadSegment = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const normalizedPayload = payloadSegment.padEnd(payloadSegment.length + ((4 - (payloadSegment.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(normalizedPayload));

    if (!payload || typeof payload.exp !== "number") {
      return true;
    }

    // Treat tokens that are effectively expired (30s skew) as invalid.
    const nowSeconds = Math.floor(Date.now() / 1000);
    return payload.exp > nowSeconds + 30;
  } catch {
    return false;
  }
}

function getStoredUser() {
  try {
    const token = localStorage.getItem("token");
    if (!token || !token.trim() || !isStoredTokenUsable(token)) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return null;
    }

    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getInitialDarkMode() {
  try {
    const stored = localStorage.getItem(DARKMODE_STORAGE_KEY);
    if (stored === "true") {
      return true;
    }
    if (stored === "false") {
      return false;
    }
  } catch {
    // Ignore storage errors and fallback to system preference.
  }

  return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export default function App() {
  const [user, setUser] = useState(getStoredUser);
  const [refreshToken, setRefreshToken] = useState(0);
  const [darkMode, setDarkMode] = useState(getInitialDarkMode);
  const [showGeraetewartLogin, setShowGeraetewartLogin] = useState(false);
  const [guestBootstrapping, setGuestBootstrapping] = useState(false);

  const rootClass = useMemo(() => (darkMode ? "app-root dark" : "app-root"), [darkMode]);

  // Handle stale/expired tokens: auto-clear and re-bootstrap guest session.
  useEffect(() => {
    let debounceTimer = null;
    function handleUnauthorized() {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setUser(null);
        setShowGeraetewartLogin(false);
      }, 50);
    }
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
    };
  }, []);

  useEffect(() => {
    if (user || showGeraetewartLogin || guestBootstrapping) {
      return;
    }

    async function bootstrapGuestAccess() {
      setGuestBootstrapping(true);
      try {
        const data = await apiRequest("/auth/guest", { method: "POST" });
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setUser(data.user);
      } catch {
        // If guest bootstrap fails, keep login screen available.
      } finally {
        setGuestBootstrapping(false);
      }
    }

    bootstrapGuestAccess();
  }, [user, showGeraetewartLogin, guestBootstrapping]);

  useEffect(() => {
    localStorage.setItem(DARKMODE_STORAGE_KEY, darkMode ? "true" : "false");
    document.documentElement.classList.toggle("theme-dark", darkMode);
    document.documentElement.style.colorScheme = darkMode ? "dark" : "light";
  }, [darkMode]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setShowGeraetewartLogin(false);
  }

  function openGeraetewartLogin() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setShowGeraetewartLogin(true);
  }

  function backToGuestAccess() {
    setShowGeraetewartLogin(false);
  }

  if (!user) {
    if (guestBootstrapping && !showGeraetewartLogin) {
      return (
        <div className="login-shell">
          <div className="card login-card">
            <div className="topbar-emblem" style={{ marginBottom: "0.8rem", width: 52, height: 52, fontSize: "0.7rem" }}>FW<br/>REL</div>
            <h1>Feuerwehr Checkliste</h1>
            <p style={{ margin: "0.3rem 0 1rem" }}>Zugriff wird vorbereitet...</p>
            <button type="button" onClick={() => setShowGeraetewartLogin(true)}>
              Gerätewart-Login öffnen
            </button>
          </div>
        </div>
      );
    }

    if (showGeraetewartLogin) {
      return <LoginForm onLogin={setUser} onBackToGuest={backToGuestAccess} />;
    }

    return (
      <div className="login-shell">
        <div className="card login-card">
          <div className="topbar-emblem" style={{ marginBottom: "0.8rem", width: 52, height: 52, fontSize: "0.7rem" }}>FW<br/>REL</div>
          <h1>Feuerwehr Checkliste</h1>
          <p style={{ margin: "0.3rem 0 1rem" }}>Normaler Zugriff wird automatisch hergestellt.</p>
          <button type="button" onClick={() => setShowGeraetewartLogin(true)}>
            Gerätewart-Login öffnen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-emblem">FW<br/>REL</div>
          <div>
            <h1>Feuerwehr Checkliste</h1>
            <p>Digitale Fahrzeugprüfung</p>
          </div>
        </div>

        <div className="topbar-actions">
          {user.role !== "geraetewart" ? (
            <button type="button" onClick={openGeraetewartLogin}>
              Gerätewart-Login
            </button>
          ) : null}
          <label className="switch-wrap">
            <input
              type="checkbox"
              name="darkMode"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
            />
            <span className="switch-slider" aria-hidden="true" />
            <span className="switch-text">Dark</span>
          </label>
          {user.role === "geraetewart" ? (
            <button type="button" className="btn-ghost" onClick={handleLogout}>
              Abmelden
            </button>
          ) : null}
        </div>
      </header>

      <div className="content-wrap">
        <main className="layout-grid">
          <section className="layout-zone vehicle-bay-panel">
            <ChecklistForm
              user={user}
              onReportCreated={() => setRefreshToken((v) => v + 1)}
            />
          </section>

          <section className="layout-zone operator-bay-panel">
            {user.role === "geraetewart" ? (
              <ReportsList user={user} refreshToken={refreshToken} />
            ) : (
              <section className="card">
                <div className="card-header">Hinweis</div>
                <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginTop: "0.5rem" }}>
                  Berichte, Mängelübersicht und Historie sind nur für Gerätewarte sichtbar.
                  Bitte oben rechts einloggen.
                </p>
              </section>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}
