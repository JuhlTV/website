import { useEffect, useState } from "react";
import { apiRequest } from "../api/client";

export default function ReportsList({ user, refreshToken }) {
  const [reports, setReports] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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
    const input = window.prompt("Empfaenger (Komma-getrennt):", "geraetewart@example.org");
    if (!input) {
      return;
    }

    const recipients = input
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);

    if (recipients.length === 0) {
      setError("Keine gueltigen Empfaenger angegeben.");
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
    <div className="card">
      <div className="section-head">
        <h2>Berichte</h2>
        <span className="badge role">Rolle: {user.role}</span>
      </div>

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
  );
}
