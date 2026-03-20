import express from "express";
import dayjs from "dayjs";
import { pool } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { findVehicleByKey } from "../config/vehicles.js";
import { validateChecklistPayload } from "../utils/validators.js";
import { buildReportPdf } from "../services/pdfService.js";
import { sendReportEmail } from "../services/mailService.js";

const router = express.Router();

router.post("/", requireAuth, async (req, res) => {
  const validationError = validateChecklistPayload(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const { vehicleKey, checks, username } = req.body;
  const vehicle = findVehicleByKey(vehicleKey);

  if (!vehicle) {
    return res.status(404).json({ message: "Fahrzeug nicht gefunden" });
  }

  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [reportResult] = await connection.execute(
      "INSERT INTO reports (user_id, username, vehicle_key, vehicle_name) VALUES (?, ?, ?, ?)",
      [req.user.id, username, vehicle.key, vehicle.name]
    );

    const reportId = reportResult.insertId;

    for (const c of checks) {
      await connection.execute(
        "INSERT INTO checklist_results (report_id, item_key, item_label, status, comment_text) VALUES (?, ?, ?, ?, ?)",
        [reportId, c.itemKey, c.itemLabel, c.status, c.comment || null]
      );

      if (c.status === "defekt") {
        await connection.execute(
          "INSERT INTO defects (report_id, item_key, item_label, description_text, priority, timestamp, username) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            reportId,
            c.itemKey,
            c.itemLabel,
            c.defectDescription,
            c.defectPriority,
            dayjs().format("YYYY-MM-DD HH:mm:ss"),
            username
          ]
        );
      }
    }

    await connection.commit();
    return res.status(201).json({ message: "Bericht gespeichert", reportId });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: "Fehler beim Speichern", error: error.message });
  } finally {
    connection.release();
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    let sql = "SELECT id, username, vehicle_key, vehicle_name, created_at FROM reports ORDER BY created_at DESC";
    const params = [];

    if (req.user.role !== "geraetewart") {
      sql = "SELECT id, username, vehicle_key, vehicle_name, created_at FROM reports WHERE user_id = ? ORDER BY created_at DESC";
      params.push(req.user.id);
    }

    const [rows] = await pool.execute(sql, params);
    return res.json({ reports: rows });
  } catch (error) {
    return res.status(500).json({ message: "Fehler beim Laden", error: error.message });
  }
});

router.get("/defects", requireAuth, async (req, res) => {
  const { priority, vehicleKey } = req.query;

  if (priority && !["niedrig", "mittel", "kritisch"].includes(String(priority))) {
    return res.status(400).json({ message: "Ungueltige Prioritaet" });
  }

  try {
    const clauses = [];
    const params = [];

    if (req.user.role !== "geraetewart") {
      clauses.push("r.user_id = ?");
      params.push(req.user.id);
    }

    if (priority) {
      clauses.push("d.priority = ?");
      params.push(String(priority));
    }

    if (vehicleKey) {
      clauses.push("r.vehicle_key = ?");
      params.push(String(vehicleKey));
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const [defects] = await pool.execute(
      `SELECT
        d.id,
        d.item_label,
        d.description_text,
        d.priority,
        d.timestamp,
        d.username,
        r.id AS report_id,
        r.vehicle_key,
        r.vehicle_name,
        r.created_at AS report_created_at
      FROM defects d
      INNER JOIN reports r ON r.id = d.report_id
      ${where}
      ORDER BY d.timestamp DESC`,
      params
    );

    const [summary] = await pool.execute(
      `SELECT d.priority, COUNT(*) AS total
      FROM defects d
      INNER JOIN reports r ON r.id = d.report_id
      ${where}
      GROUP BY d.priority`,
      params
    );

    return res.json({ defects, summary });
  } catch (error) {
    return res.status(500).json({ message: "Fehler beim Laden der Maengel", error: error.message });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  const { vehicleKey } = req.query;

  try {
    const clauses = [];
    const params = [];

    if (req.user.role !== "geraetewart") {
      clauses.push("r.user_id = ?");
      params.push(req.user.id);
    }

    if (vehicleKey) {
      clauses.push("r.vehicle_key = ?");
      params.push(String(vehicleKey));
    }

    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";

    const [history] = await pool.execute(
      `SELECT
        r.id,
        r.vehicle_key,
        r.vehicle_name,
        r.username,
        r.created_at,
        COALESCE(cr.total_checks, 0) AS total_checks,
        COALESCE(cr.defect_checks, 0) AS defect_checks,
        COALESCE(df.defects_total, 0) AS defects_total,
        COALESCE(df.defects_kritisch, 0) AS defects_kritisch,
        COALESCE(df.defects_mittel, 0) AS defects_mittel,
        COALESCE(df.defects_niedrig, 0) AS defects_niedrig
      FROM reports r
      LEFT JOIN (
        SELECT report_id, COUNT(*) AS total_checks, SUM(CASE WHEN status = 'defekt' THEN 1 ELSE 0 END) AS defect_checks
        FROM checklist_results
        GROUP BY report_id
      ) cr ON cr.report_id = r.id
      LEFT JOIN (
        SELECT
          report_id,
          COUNT(*) AS defects_total,
          SUM(CASE WHEN priority = 'kritisch' THEN 1 ELSE 0 END) AS defects_kritisch,
          SUM(CASE WHEN priority = 'mittel' THEN 1 ELSE 0 END) AS defects_mittel,
          SUM(CASE WHEN priority = 'niedrig' THEN 1 ELSE 0 END) AS defects_niedrig
        FROM defects
        GROUP BY report_id
      ) df ON df.report_id = r.id
      ${where}
      ORDER BY r.created_at DESC`,
      params
    );

    return res.json({ history });
  } catch (error) {
    return res.status(500).json({ message: "Fehler beim Laden des Verlaufs", error: error.message });
  }
});

router.get("/:id/pdf", requireAuth, async (req, res) => {
  const reportId = Number(req.params.id);

  try {
    const [reportRows] = await pool.execute("SELECT * FROM reports WHERE id = ?", [reportId]);
    const report = reportRows[0];

    if (!report) {
      return res.status(404).json({ message: "Bericht nicht gefunden" });
    }

    if (req.user.role !== "geraetewart" && report.user_id !== req.user.id) {
      return res.status(403).json({ message: "Kein Zugriff" });
    }

    const [checks] = await pool.execute(
      "SELECT item_label, status, comment_text FROM checklist_results WHERE report_id = ? ORDER BY id ASC",
      [reportId]
    );

    const [defects] = await pool.execute(
      "SELECT item_label, description_text, priority, timestamp, username FROM defects WHERE report_id = ? ORDER BY id ASC",
      [reportId]
    );

    const pdf = await buildReportPdf({ report, checks, defects });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=bericht-${reportId}.pdf`);
    return res.send(pdf);
  } catch (error) {
    return res.status(500).json({ message: "PDF-Fehler", error: error.message });
  }
});

router.post("/:id/send-email", requireAuth, requireRole("geraetewart"), async (req, res) => {
  const reportId = Number(req.params.id);
  const { recipients } = req.body;

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ message: "Mindestens ein Empfaenger erforderlich" });
  }

  try {
    const [reportRows] = await pool.execute("SELECT * FROM reports WHERE id = ?", [reportId]);
    const report = reportRows[0];

    if (!report) {
      return res.status(404).json({ message: "Bericht nicht gefunden" });
    }

    const [checks] = await pool.execute(
      "SELECT item_label, status, comment_text FROM checklist_results WHERE report_id = ? ORDER BY id ASC",
      [reportId]
    );

    const [defects] = await pool.execute(
      "SELECT item_label, description_text, priority, timestamp, username FROM defects WHERE report_id = ? ORDER BY id ASC",
      [reportId]
    );

    const pdf = await buildReportPdf({ report, checks, defects });

    await sendReportEmail({
      recipients,
      subject: `Feuerwehr Bericht ${report.vehicle_name} (${reportId})`,
      text: "Anbei der automatisch generierte Pruefbericht.",
      pdfBuffer: pdf,
      fileName: `bericht-${reportId}.pdf`
    });

    return res.json({ message: "Bericht erfolgreich versendet" });
  } catch (error) {
    return res.status(500).json({ message: "E-Mail-Versand fehlgeschlagen", error: error.message });
  }
});

export default router;
