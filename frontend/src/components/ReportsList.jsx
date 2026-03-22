import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";

const DEFECT_FILTER_DEFAULTS = {
  priority: "alle",
  status: "offen",
  vehicleKey: "alle"
};

const REPORTS_FILTER_STATE_KEY = "fw_reports_filter_state_v1";
const REPORTS_SAVED_FILTERS_KEY = "fw_saved_defect_filters_v1";

function loadStoredFilterState() {
  try {
    const raw = window.localStorage.getItem(REPORTS_FILTER_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      priority: parsed?.priority || DEFECT_FILTER_DEFAULTS.priority,
      status: parsed?.status || DEFECT_FILTER_DEFAULTS.status,
      vehicleKey: parsed?.vehicleKey || DEFECT_FILTER_DEFAULTS.vehicleKey,
      historyVehicleKey: parsed?.historyVehicleKey || "alle"
    };
  } catch {
    return null;
  }
}

function loadStoredSavedFilters() {
  try {
    const raw = window.localStorage.getItem(REPORTS_SAVED_FILTERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: item.id || `${Date.now()}-${Math.random()}`,
        name: item.name || "Unbenannter Filter",
        priority: item.priority || DEFECT_FILTER_DEFAULTS.priority,
        status: item.status || DEFECT_FILTER_DEFAULTS.status,
        vehicleKey: item.vehicleKey || DEFECT_FILTER_DEFAULTS.vehicleKey,
        isFavorite: Boolean(item.isFavorite)
      }));

    let favoriteAlreadySet = false;
    return normalized.map((item) => {
      if (item.isFavorite && !favoriteAlreadySet) {
        favoriteAlreadySet = true;
        return item;
      }

      return { ...item, isFavorite: false };
    });
  } catch {
    return [];
  }
}

function loadInitialFilterSetup() {
  const savedFilters = loadStoredSavedFilters();
  const storedState = loadStoredFilterState();
  const favoritePreset = savedFilters.find((item) => item.isFavorite);

  return {
    savedFilters,
    priority: favoritePreset?.priority || storedState?.priority || DEFECT_FILTER_DEFAULTS.priority,
    status: favoritePreset?.status || storedState?.status || DEFECT_FILTER_DEFAULTS.status,
    vehicleKey: favoritePreset?.vehicleKey || storedState?.vehicleKey || DEFECT_FILTER_DEFAULTS.vehicleKey,
    historyVehicleKey: storedState?.historyVehicleKey || "alle"
  };
}

function isTypingTarget(element) {
  if (!element) return false;
  const tag = element.tagName;
  return (
    element.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT"
  );
}

export default function ReportsList({ user, refreshToken }) {
  const [initialFilterSetup] = useState(() => loadInitialFilterSetup());
  const [reports, setReports] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [defects, setDefects] = useState([]);
  const [defectSummary, setDefectSummary] = useState([]);
  const [history, setHistory] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState(
    initialFilterSetup.priority
  );
  const [defectStatusFilter, setDefectStatusFilter] = useState(
    initialFilterSetup.status
  );
  const [defectVehicleFilter, setDefectVehicleFilter] = useState(
    initialFilterSetup.vehicleKey
  );
  const [historyVehicleFilter, setHistoryVehicleFilter] = useState(
    initialFilterSetup.historyVehicleKey
  );
  const [savedFilters, setSavedFilters] = useState(initialFilterSetup.savedFilters);
  const [reportError, setReportError] = useState("");
  const [defectError, setDefectError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [loading, setLoading] = useState(true);
  const [emailTarget, setEmailTarget] = useState(null); // { reportId, input, sending, error }
  const [resolvingDefectId, setResolvingDefectId] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [exportingDefectsPdf, setExportingDefectsPdf] = useState(false);
  const [exportingDefectsCsv, setExportingDefectsCsv] = useState(false);

  const currentDefectFilters = {
    priority: priorityFilter,
    status: defectStatusFilter,
    vehicleKey: defectVehicleFilter
  };

  function applyDefectFilters(filters) {
    setPriorityFilter(filters.priority || DEFECT_FILTER_DEFAULTS.priority);
    setDefectStatusFilter(filters.status || DEFECT_FILTER_DEFAULTS.status);
    setDefectVehicleFilter(filters.vehicleKey || DEFECT_FILTER_DEFAULTS.vehicleKey);
  }

  function resetAllFilters() {
    applyDefectFilters(DEFECT_FILTER_DEFAULTS);
    setHistoryVehicleFilter("alle");
  }

  function saveCurrentFilterPreset() {
    const name = window.prompt("Namen für den Filter eingeben", "Mein Filter");
    if (!name) return;

    const trimmedName = name.trim();
    if (!trimmedName) return;

    const next = [
      {
        id: `${Date.now()}-${Math.random()}`,
        name: trimmedName,
        ...currentDefectFilters,
        isFavorite: false
      },
      ...savedFilters
    ].slice(0, 8);

    setSavedFilters(next);
  }

  function renameSavedFilterPreset(id) {
    const target = savedFilters.find((item) => item.id === id);
    if (!target) return;

    const nextName = window.prompt("Neuen Namen für das Preset eingeben", target.name);
    if (!nextName) return;

    const trimmedName = nextName.trim();
    if (!trimmedName) return;

    setSavedFilters((prev) =>
      prev.map((item) => (item.id === id ? { ...item, name: trimmedName } : item))
    );
  }

  function setFavoriteFilterPreset(id) {
    setSavedFilters((prev) =>
      prev.map((item) => ({
        ...item,
        isFavorite: item.id === id
      }))
    );
  }

  function removeSavedFilterPreset(id) {
    setSavedFilters((prev) => prev.filter((item) => item.id !== id));
  }

  useEffect(() => {
    function onKeyDown(event) {
      if (event.defaultPrevented) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if ((event.key || "").toLowerCase() !== "r") return;
      if (isTypingTarget(document.activeElement)) return;

      event.preventDefault();
      resetAllFilters();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(REPORTS_SAVED_FILTERS_KEY, JSON.stringify(savedFilters));
    } catch {
      // Non-critical persistence.
    }
  }, [savedFilters]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        REPORTS_FILTER_STATE_KEY,
        JSON.stringify({
          priority: priorityFilter,
          status: defectStatusFilter,
          vehicleKey: defectVehicleFilter,
          historyVehicleKey: historyVehicleFilter
        })
      );
    } catch {
      // Non-critical persistence.
    }
  }, [priorityFilter, defectStatusFilter, defectVehicleFilter, historyVehicleFilter]);

  useEffect(() => {
    async function loadVehicles() {
      try {
        const data = await apiRequest("/vehicles");
        setVehicles(data.vehicles || []);
      } catch {
        // Non-critical; vehicle filter falls back to empty.
      }
    }

    loadVehicles();
  }, []);

  useEffect(() => {
    async function loadDashboard() {
      try {
        const data = await apiRequest("/reports/dashboard");
        setDashboard(data);
      } catch {
        // Non-critical dashboard data.
      }
    }

    loadDashboard();
  }, [refreshToken]);

  useEffect(() => {
    async function loadReports() {
      setReportError("");
      setLoading(true);
      try {
        const data = await apiRequest("/reports");
        setReports(data.reports);
      } catch (err) {
        setReportError(err.message);
      } finally {
        setLoading(false);
      }
    }

    loadReports();
  }, [refreshToken]);

  useEffect(() => {
    async function loadDefects() {
      try {
        const params = new URLSearchParams();
        if (priorityFilter !== "alle") {
          params.set("priority", priorityFilter);
        }
        if (defectStatusFilter !== "alle") {
          params.set("status", defectStatusFilter);
        }
        if (defectVehicleFilter !== "alle") {
          params.set("vehicleKey", defectVehicleFilter);
        }

        const query = params.toString() ? `?${params.toString()}` : "";
        const data = await apiRequest(`/reports/defects${query}`);
        setDefects(data.defects || []);
        setDefectSummary(data.summary || []);
      } catch (err) {
        setDefectError(err.message);
      }
    }

    loadDefects();
  }, [refreshToken, priorityFilter, defectStatusFilter, defectVehicleFilter]);

  async function toggleDefectResolve(defect) {
    const shouldResolve = !defect.resolved_at;
    setResolvingDefectId(defect.id);
    setDefectError("");
    try {
      await apiRequest(`/reports/defects/${encodeURIComponent(defect.id)}/resolve`, {
        method: "PATCH",
        body: JSON.stringify({ resolve: shouldResolve })
      });

      const params = new URLSearchParams();
      if (priorityFilter !== "alle") params.set("priority", priorityFilter);
      if (defectStatusFilter !== "alle") params.set("status", defectStatusFilter);
      if (defectVehicleFilter !== "alle") params.set("vehicleKey", defectVehicleFilter);
      const query = params.toString() ? `?${params.toString()}` : "";
      const data = await apiRequest(`/reports/defects${query}`);
      setDefects(data.defects || []);
      setDefectSummary(data.summary || []);
    } catch (err) {
      setDefectError(err.message);
    } finally {
      setResolvingDefectId("");
    }
  }

  useEffect(() => {
    async function loadHistory() {
      try {
        const params = new URLSearchParams();
        if (historyVehicleFilter !== "alle") {
          params.set("vehicleKey", historyVehicleFilter);
        }

        const query = params.toString() ? `?${params.toString()}` : "";
        const data = await apiRequest(`/reports/history${query}`);
        setHistory(data.history || []);
      } catch (err) {
        setHistoryError(err.message);
      }
    }

    loadHistory();
  }, [refreshToken, historyVehicleFilter]);

  async function exportDefectsPdf() {
    setDefectError("");
    setExportingDefectsPdf(true);
    try {
      const params = new URLSearchParams();
      if (priorityFilter !== "alle") params.set("priority", priorityFilter);
      if (defectStatusFilter !== "alle") params.set("status", defectStatusFilter);
      if (defectVehicleFilter !== "alle") params.set("vehicleKey", defectVehicleFilter);
      if (defectStatusFilter === "behoben") params.set("resolvedSinceHours", "24");

      const query = params.toString() ? `?${params.toString()}` : "";
      const blob = await apiRequest(`/reports/defects/export-pdf${query}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `maengel-sammeluebersicht-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDefectError(err.message);
    } finally {
      setExportingDefectsPdf(false);
    }
  }

  async function exportDefectsCsv() {
    setDefectError("");
    setExportingDefectsCsv(true);
    try {
      const params = new URLSearchParams();
      if (priorityFilter !== "alle") params.set("priority", priorityFilter);
      if (defectStatusFilter !== "alle") params.set("status", defectStatusFilter);
      if (defectVehicleFilter !== "alle") params.set("vehicleKey", defectVehicleFilter);
      if (defectStatusFilter === "behoben") params.set("resolvedSinceHours", "24");

      const query = params.toString() ? `?${params.toString()}` : "";
      const blob = await apiRequest(`/reports/defects/export-csv${query}`, {
        headers: { Accept: "text/csv" }
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `maengel-uebersicht-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setDefectError(err.message || "CSV-Export fehlgeschlagen");
    } finally {
      setExportingDefectsCsv(false);
    }
  }

  async function downloadPdf(reportId) {
    try {
      const blob = await apiRequest(`/reports/${reportId}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bericht-${reportId}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setReportError(err.message);
    }
  }

  async function sendEmail(reportId) {
    setEmailTarget({ reportId, input: "", sending: false, error: "", success: "" });
  }

  async function submitEmail() {
    if (!emailTarget) return;
    const recipients = emailTarget.input
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    if (recipients.length === 0) {
      setEmailTarget((prev) => ({ ...prev, error: "Bitte mindestens eine E-Mail-Adresse eingeben." }));
      return;
    }
    setEmailTarget((prev) => ({ ...prev, sending: true, error: "" }));
    try {
      await apiRequest(`/reports/${emailTarget.reportId}/send-email`, {
        method: "POST",
        body: JSON.stringify({ recipients })
      });
      setEmailTarget((prev) => ({ ...prev, sending: false, success: "Bericht erfolgreich versendet." }));
      setTimeout(() => setEmailTarget(null), 3000);
    } catch (err) {
      setEmailTarget((prev) => ({ ...prev, sending: false, error: err.message }));
    }
  }

  return (
    <div className="panel-stack">
      <div className="card">
        <div className="card-header">Gerätewart Übersicht</div>
        <div className="dashboard-grid dashboard-grid-main">
          <div className="dashboard-kpi">
            <strong>{dashboard?.critical_open_today ?? "-"}</strong>
            <span>Heute fällige kritische offene Mängel</span>
          </div>
          <div className="dashboard-kpi warning">
            <strong>{dashboard?.critical_open_overdue_24h ?? "-"}</strong>
            <span>Kritische offene Mängel über 24h (überfällig)</span>
          </div>
          <div className="dashboard-kpi warning-urgent">
            <strong>{dashboard?.critical_open_overdue_48h ?? "-"}</strong>
            <span>Kritisch offen &gt; 48h (dringend)</span>
          </div>
          <div className="dashboard-kpi warning-immediate">
            <strong>{dashboard?.critical_open_overdue_72h ?? "-"}</strong>
            <span>Kritisch offen &gt; 72h (sofort handeln)</span>
          </div>
          <div className="dashboard-kpi">
            <strong>{dashboard?.vehicles_without_open_defects_total ?? "-"}</strong>
            <span>Fahrzeuge ohne offenen Mangel</span>
          </div>
          <div className="dashboard-kpi">
            <strong>{dashboard?.resolved_last_24h ?? "-"}</strong>
            <span>Behoben in den letzten 24h</span>
          </div>
        </div>
        {dashboard?.critical_open_overdue_72h_vehicles?.length ? (
          <p className="dashboard-warning-text immediate">
            Sofort handeln (72h+): {dashboard.critical_open_overdue_72h_vehicles.join(", ")}
          </p>
        ) : null}
        {dashboard?.critical_open_overdue_48h_vehicles?.length ? (
          <p className="dashboard-warning-text urgent">
            Dringend (48h+): {dashboard.critical_open_overdue_48h_vehicles.join(", ")}
          </p>
        ) : null}
        {dashboard?.critical_open_overdue_24h_vehicles?.length ? (
          <p className="dashboard-warning-text">
            Überfällig kritisch: {dashboard.critical_open_overdue_24h_vehicles.join(", ")}
          </p>
        ) : null}
        {dashboard?.vehicles_without_open_defects?.length ? (
          <p style={{ marginTop: "0.8rem", color: "var(--muted)" }}>
            Ohne offene Mängel: {dashboard.vehicles_without_open_defects.map((v) => v.name).join(", ")}
          </p>
        ) : null}
      </div>

      <div className="card">
        <div className="card-header">Berichte</div>
        <div className="section-head" style={{ marginTop: "0.8rem" }}>
          <h2>Alle Einträge</h2>
          <span className="badge role">Gerätewart</span>
        </div>

        {reportError ? <div className="error-box">{reportError}</div> : null}

        {loading ? (
          <div><span className="loading-spinner" aria-hidden="true" />Lade Berichte...</div>
        ) : null}

        {!loading && reports.length === 0 ? <div>Noch keine Berichte vorhanden.</div> : null}

        {emailTarget ? (
          <div className="email-panel">
            <div className="email-panel-head">
              Bericht #{emailTarget.reportId} versenden
              <button
                type="button"
                className="btn-ghost"
                style={{ padding: "0.2rem 0.5rem", fontSize: "0.78rem" }}
                onClick={() => setEmailTarget(null)}
              >
                X
              </button>
            </div>
            <label>
              Empfänger (Komma-getrennt)
              <input
                type="text"
                name="emailRecipients"
                value={emailTarget.input}
                onChange={(e) => setEmailTarget((prev) => ({ ...prev, input: e.target.value }))}
                placeholder="z.B. max@fw-rellingen.de, eva@fw-rellingen.de"
                disabled={emailTarget.sending}
              />
            </label>
            {emailTarget.error ? <div className="error-box">{emailTarget.error}</div> : null}
            {emailTarget.success ? <div className="success-box">{emailTarget.success}</div> : null}
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" onClick={submitEmail} disabled={emailTarget.sending}>
                {emailTarget.sending ? "Sende..." : "Versenden"}
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setEmailTarget(null)}
                disabled={emailTarget.sending}
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : null}

        <div className="reports-list">
          {reports.map((report) => (
            <article key={report.id} className="report-item">
              <div>
                <strong>{report.vehicle_name}</strong>
                <p>
                  ID {report.id} | {new Date(report.created_at).toLocaleString("de-DE")}
                </p>
                <p>Benutzer: {report.username}</p>
              </div>

              <div className="report-actions">
                <button type="button" onClick={() => downloadPdf(report.id)}>
                  PDF
                </button>

                {user.role === "geraetewart" ? (
                  <button type="button" onClick={() => sendEmail(report.id)}>
                    Bericht senden
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">Mängelübersicht</div>
        {defectError ? <div className="error-box" style={{ marginTop: "0.8rem" }}>{defectError}</div> : null}

        <div className="quick-actions quick-actions-compact">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setPriorityFilter("kritisch");
              setDefectStatusFilter("offen");
            }}
          >
            Nur kritische offene Mängel
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              setPriorityFilter("alle");
              setDefectStatusFilter("behoben");
            }}
          >
            Behobene letzte 24h
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={exportingDefectsPdf}
            onClick={exportDefectsPdf}
          >
            {exportingDefectsPdf ? "Export läuft..." : "PDF-Sammel-Export"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={exportingDefectsCsv}
            onClick={exportDefectsCsv}
          >
            {exportingDefectsCsv ? "CSV läuft..." : "CSV-Export"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={resetAllFilters}
          >
            Filter zurücksetzen
          </button>
        </div>
        <p className="saved-filter-hint">Tastenkürzel: R setzt alle Filter sofort zurück.</p>

        <div className="inline-fields defect-filter-grid">
          <label>
            Priorität
            <select
              name="priorityFilter"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="alle">Alle</option>
              <option value="kritisch">Kritisch</option>
              <option value="mittel">Mittel</option>
              <option value="niedrig">Niedrig</option>
            </select>
          </label>

          <label>
            Status
            <select
              name="defectStatusFilter"
              value={defectStatusFilter}
              onChange={(e) => setDefectStatusFilter(e.target.value)}
            >
              <option value="offen">Offen</option>
              <option value="behoben">Behoben</option>
              <option value="alle">Alle</option>
            </select>
          </label>

          <label>
            Fahrzeug
            <select
              name="defectVehicleFilter"
              value={defectVehicleFilter}
              onChange={(e) => setDefectVehicleFilter(e.target.value)}
            >
              <option value="alle">Alle Fahrzeuge</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.key} value={vehicle.key}>
                  {vehicle.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="saved-filter-row">
          <button
            type="button"
            className="btn-ghost"
            onClick={saveCurrentFilterPreset}
          >
            Aktuellen Filter speichern
          </button>
          {savedFilters.length === 0 ? (
            <span className="saved-filter-hint">Noch keine gespeicherten Filter.</span>
          ) : (
            <div className="saved-filter-list">
              {savedFilters.map((preset) => {
                const isActive =
                  preset.priority === currentDefectFilters.priority &&
                  preset.status === currentDefectFilters.status &&
                  preset.vehicleKey === currentDefectFilters.vehicleKey;

                return (
                  <div key={preset.id} className="saved-filter-item">
                    <button
                      type="button"
                      className={`btn-ghost saved-filter-load ${isActive ? "is-active" : ""}`}
                      onClick={() => applyDefectFilters(preset)}
                    >
                      {preset.isFavorite ? `★ ${preset.name}` : preset.name}
                    </button>
                    <button
                      type="button"
                      className={`btn-ghost saved-filter-action ${preset.isFavorite ? "is-favorite" : ""}`}
                      onClick={() => setFavoriteFilterPreset(preset.id)}
                      aria-label={
                        preset.isFavorite
                          ? `Preset ${preset.name} ist Standard`
                          : `Preset ${preset.name} als Standard festlegen`
                      }
                    >
                      {preset.isFavorite ? "Standard" : "Als Standard"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost saved-filter-action"
                      onClick={() => renameSavedFilterPreset(preset.id)}
                      aria-label={`Filter ${preset.name} umbenennen`}
                    >
                      Umbenennen
                    </button>
                    <button
                      type="button"
                      className="btn-ghost saved-filter-delete"
                      onClick={() => removeSavedFilterPreset(preset.id)}
                      aria-label={`Filter ${preset.name} löschen`}
                    >
                      X
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="summary-row">
          <span className="badge">Gesamt: {defects.length}</span>
          {defectSummary.map((item) => (
            <span key={item.priority} className="badge">
              {item.priority}: {item.total}
            </span>
          ))}
        </div>

        <div className="reports-list">
          {defects.length === 0 ? <div>Keine Mängel für den aktuellen Filter.</div> : null}
          {defects.map((defect) => (
            <article key={defect.id} className="report-item defect-item">
              <div>
                <strong>{defect.vehicle_name}</strong>
                <p>{defect.item_label}</p>
                <p>{defect.description_text}</p>
                <p>
                  {new Date(defect.timestamp).toLocaleString("de-DE")} | {defect.username}
                </p>
              </div>
              <div className="report-actions">
                {defect.escalation_level === "sofort_handeln" ? (
                  <span className="badge escalation immediate">Sofort handeln</span>
                ) : null}
                {defect.escalation_level === "dringend" ? (
                  <span className="badge escalation urgent">Dringend</span>
                ) : null}
                {defect.resolved_at ? (
                  <span className="badge defect-status behoben">Behoben</span>
                ) : (
                  <span className="badge defect-status offen">Offen</span>
                )}
                <span className={`badge priority-${defect.priority}`}>{defect.priority}</span>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={resolvingDefectId === defect.id}
                  onClick={() => toggleDefectResolve(defect)}
                >
                  {resolvingDefectId === defect.id
                    ? "Speichere..."
                    : defect.resolved_at
                    ? "Wieder öffnen"
                    : "Als behoben"}
                </button>
                <button type="button" onClick={() => downloadPdf(defect.report_id)}>
                  Bericht
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header">Fahrzeughistorie</div>
        {historyError ? <div className="error-box" style={{ marginTop: "0.8rem" }}>{historyError}</div> : null}

        <label>
          Fahrzeugfilter
          <select
            name="historyVehicleFilter"
            value={historyVehicleFilter}
            onChange={(e) => setHistoryVehicleFilter(e.target.value)}
          >
            <option value="alle">Alle Fahrzeuge</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.key} value={vehicle.key}>
                {vehicle.name}
              </option>
            ))}
          </select>
        </label>

        <div className="reports-list">
          {history.length === 0 ? <div>Keine Verlaufseinträge vorhanden.</div> : null}
          {history.map((item) => (
            <article key={item.id} className="report-item history-item">
              <div>
                <strong>{item.vehicle_name}</strong>
                <p>
                  Bericht {item.id} | {new Date(item.created_at).toLocaleString("de-DE")}
                </p>
                <p>Prüfer: {item.username}</p>
                <p>
                  Prüfpunkte: {item.total_checks} | Defekt markiert: {item.defect_checks}
                </p>
              </div>
              <div className="history-priority">
                <span className="badge priority-kritisch">kritisch: {item.defects_kritisch}</span>
                <span className="badge priority-mittel">mittel: {item.defects_mittel}</span>
                <span className="badge priority-niedrig">niedrig: {item.defects_niedrig}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
