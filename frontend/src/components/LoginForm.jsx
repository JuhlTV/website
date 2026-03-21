import { useState } from "react";
import { apiRequest } from "../api/client";

export default function LoginForm({ onLogin, onBackToGuest }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  function validateForm() {
    const errors = {};
    if (!password) errors.password = "Passwort erforderlich";
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validateForm()) return;

    setError("");
    setLoading(true);

    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify({ password })
      });

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));
      onLogin(data.user);
    } catch (err) {
      const fallback = "Anmeldung fehlgeschlagen. Bitte pruefen Sie das Geraetewart-Passwort.";
      setError(err.message || fallback);
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-shell">
      <form className="card login-card" onSubmit={handleSubmit}>
        <h1>Feuerwehr Checkliste System</h1>
        <p>Digitale Fahrzeugpruefung fuer die Freiwillige Feuerwehr</p>

        <p style={{ margin: "0.25rem 0 0.75rem" }}>
          Geraetewart-Login: Zugriff auf alle Eintraege (passwortgeschuetzt).
        </p>

        {/* Hidden username input keeps password form autofill/accessibility happy. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value="geraetewart"
          onChange={() => {}}
          style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px" }}
          tabIndex={-1}
          aria-hidden="true"
        />

        <label>
          Passwort
          <input
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setValidationErrors((prev) => ({ ...prev, password: "" }));
            }}
            autoComplete="current-password"
            aria-invalid={!!validationErrors.password}
            placeholder="Passwort eingeben"
            disabled={loading}
            required
          />
          {validationErrors.password && (
            <small style={{ color: "var(--danger)" }}>{validationErrors.password}</small>
          )}
        </label>

        {error && (
          <div className="error-box" role="alert" style={{ marginTop: "1rem" }}>
            ⚠️ {error}
          </div>
        )}

        <button type="submit" disabled={loading} style={{ opacity: loading ? 0.7 : 1 }}>
          {loading ? "⏳ Anmeldung läuft..." : "Als Geraetewart anmelden"}
        </button>

        {onBackToGuest ? (
          <button
            type="button"
            onClick={onBackToGuest}
            disabled={loading}
            style={{ marginTop: "0.5rem" }}
          >
            Zurueck zum normalen Zugriff
          </button>
        ) : null}
      </form>
    </div>
  );
}
