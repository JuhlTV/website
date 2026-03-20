import { useMemo, useState } from "react";
import LoginForm from "./components/LoginForm";
import ChecklistForm from "./components/ChecklistForm";
import ReportsList from "./components/ReportsList";

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

  const rootClass = useMemo(() => (darkMode ? "app-root dark" : "app-root"), [darkMode]);

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
  }

  if (!user) {
    return <LoginForm onLogin={setUser} />;
  }

  return (
    <div className={rootClass}>
      <header className="topbar">
        <div>
          <h1>Feuerwehr Checkliste System</h1>
          <p>Digitale Pruefprozesse fuer die Geraetewarte</p>
        </div>

        <div className="topbar-actions">
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
