import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";

export default function ReportsList({ user, refreshToken }) {
  const [reports, setReports] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [defects, setDefects] = useState([]);
  const [defectSummary, setDefectSummary] = useState([]);
  const [history, setHistory] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState("alle");
  const [defectVehicleFilter, setDefectVehicleFilter] = useState("alle");
  const [historyVehicleFilter, setHistoryVehicleFilter] = useState("alle");
  const [reportError, setReportError] = useState("");
  const [defectError, setDefectError] = useState("");
  const [historyError, setHistoryError] = useState("");
  const [loading, setLoading] = useState(true);
  const [emailTarget, setEmailTarget] = useState(null); // { reportId, input, sending, error }

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
  }, [refreshToken, priorityFilter, defectVehicleFilter]);

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

        <div className="inline-fields">
          <label>
            Priorität
            <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
              <option value="alle">Alle</option>
              <option value="kritisch">Kritisch</option>
              <option value="mittel">Mittel</option>
              <option value="niedrig">Niedrig</option>
            </select>
          </label>

          <label>
            Fahrzeug
            <select
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
                <span className={`badge priority-${defect.priority}`}>{defect.priority}</span>
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

        {emailTarget ? (
          <div className="email-panel">
            <div className="email-panel-head">
              Bericht #{emailTarget.reportId} versenden
              <button type="button" className="btn-ghost" style={{ padding: "0.2rem 0.5rem", fontSize: "0.78rem" }} onClick={() => setEmailTarget(null)}>✕</button>
            </div>
            <label>
              Empfänger (Komma-getrennt)
              <input
                type="text"
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
              <button type="button" className="btn-ghost" onClick={() => setEmailTarget(null)} disabled={emailTarget.sending}>
                Abbrechen
              </button>
            </div>
          </div>
        ) : null}
