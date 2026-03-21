import { useEffect, useMemo, useState } from "react";
import LoginForm from "./components/LoginForm";
import ChecklistForm from "./components/ChecklistForm";
import ReportsList from "./components/ReportsList";
import { apiRequest } from "./api/client";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState(getStoredUser);
  const [refreshToken, setRefreshToken] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [showGeraetewartLogin, setShowGeraetewartLogin] = useState(false);
  const [guestBootstrapping, setGuestBootstrapping] = useState(false);

  const rootClass = useMemo(() => (darkMode ? "app-root dark" : "app-root"), [darkMode]);

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
            <h1>Feuerwehr Checkliste System</h1>
            <p>Zugriff wird vorbereitet...</p>
            <button type="button" onClick={() => setShowGeraetewartLogin(true)}>
              Geraetewart-Login oeffnen
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
          <h1>Feuerwehr Checkliste System</h1>
          <p>Normaler Zugriff wird automatisch hergestellt.</p>
          <button type="button" onClick={() => setShowGeraetewartLogin(true)}>
            Geraetewart-Login oeffnen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={rootClass}>
      <header className="topbar">
        <div>
          <h1>Feuerwehr Checkliste System</h1>
          <p>Digitale Pruefprozesse fuer die Geraetewarte</p>
        </div>

        <div className="topbar-actions">
          {user.role !== "geraetewart" ? (
            <button type="button" onClick={openGeraetewartLogin}>
              Geraetewart-Login
            </button>
          ) : null}
          <label className="switch-wrap">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => setDarkMode(e.target.checked)}
            />
            <span>Dark Mode</span>
          </label>
          <button type="button" onClick={handleLogout}>
            Abmelden
          </button>
        </div>
      </header>

      <main className="layout-grid">
        <ChecklistForm
          user={user}
          onReportCreated={() => setRefreshToken((v) => v + 1)}
        />
        <ReportsList user={user} refreshToken={refreshToken} />
      </main>
    </div>
  );
}
