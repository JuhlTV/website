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
    let sql = "SELECT id, username, vehicle_name, created_at FROM reports ORDER BY created_at DESC";
    const params = [];

    if (req.user.role !== "geraetewart") {
      sql = "SELECT id, username, vehicle_name, created_at FROM reports WHERE user_id = ? ORDER BY created_at DESC";
      params.push(req.user.id);
    }

    const [rows] = await pool.execute(sql, params);
    return res.json({ reports: rows });
  } catch (error) {
    return res.status(500).json({ message: "Fehler beim Laden", error: error.message });
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
