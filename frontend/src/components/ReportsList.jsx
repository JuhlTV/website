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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadVehicles() {
      try {
        const data = await apiRequest("/vehicles");
        setVehicles(data.vehicles || []);
      } catch (err) {
        setError(err.message);
      }
    }

    loadVehicles();
  }, []);

  useEffect(() => {
    async function loadReports() {
      setError("");
      setLoading(true);
      try {
        const data = await apiRequest("/reports");
        setReports(data.reports);
      } catch (err) {
        setError(err.message);
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
        setError(err.message);
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
        setError(err.message);
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
      setError(err.message);
    }
  }

  async function sendEmail(reportId) {
    const input = window.prompt("Empfänger (Komma-getrennt):", "geraetewart@example.org");
    if (!input) {
      return;
    }

    const recipients = input
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      setError("Keine gültigen Empfänger angegeben.");
      return;
    }

    try {
      await apiRequest(`/reports/${reportId}/send-email`, {
        method: "POST",
        body: JSON.stringify({ recipients })
      });
      window.alert("Bericht versendet.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="panel-stack">
      <div className="card">
        <div className="section-head">
          <h2>Berichte</h2>
          <span className="badge role">Rolle: {user.role}</span>
        </div>

        {user.role === "geraetewart" ? (
          <div className="success-box">Gerätewart-Zugriff aktiv: Sie sehen alle Einträge.</div>
        ) : null}

        {error ? <div className="error-box">{error}</div> : null}

        {loading ? <div>Lade Berichte...</div> : null}

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
        <div className="section-head">
          <h2>Mängelübersicht</h2>
        </div>

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
                <span className="badge">{defect.priority}</span>
                <button type="button" onClick={() => downloadPdf(defect.report_id)}>
                  Bericht
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="section-head">
          <h2>Fahrzeughistorie</h2>
        </div>

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
                <span className="badge">kritisch: {item.defects_kritisch}</span>
                <span className="badge">mittel: {item.defects_mittel}</span>
                <span className="badge">niedrig: {item.defects_niedrig}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
