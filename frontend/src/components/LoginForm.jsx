import { useState } from "react";
import { apiRequest } from "../api/client";

export default function LoginForm({ onLogin }) {
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
      setError(err.message || "Anmeldung fehlgeschlagen. Backend nicht erreichbar?");
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

        <label>
          Geraetewart-Passwort
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
          {loading ? "⏳ Anmeldung läuft..." : "Anmelden"}
        </button>
      </form>
    </div>
  );
}
