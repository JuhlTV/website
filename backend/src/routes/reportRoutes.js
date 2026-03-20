import express from "express";
import dayjs from "dayjs";
import { mongoose } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { findVehicleByKey } from "../config/vehicles.js";
import { validateChecklistPayload } from "../utils/validators.js";
import { buildReportPdf } from "../services/pdfService.js";
import { sendReportEmail } from "../services/mailService.js";
import { Report } from "../models/Report.js";

const router = express.Router();

function canAccessReport(user, report) {
  return user.role === "geraetewart" || String(report.userId) === String(user.id);
}

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

  try {
    const checksPayload = checks.map((c) => ({
      itemKey: c.itemKey,
      itemLabel: c.itemLabel,
      status: c.status,
      commentText: c.comment || ""
    }));

    const defectsPayload = checks
      .filter((c) => c.status === "defekt")
      .map((c) => ({
        itemKey: c.itemKey,
        itemLabel: c.itemLabel,
        descriptionText: c.defectDescription,
        priority: c.defectPriority,
        timestamp: dayjs().toDate(),
        username
      }));

    const report = await Report.create({
      userId: req.user.id,
      username,
      vehicleKey: vehicle.key,
      vehicleName: vehicle.name,
      checks: checksPayload,
      defects: defectsPayload
    });

    return res.status(201).json({ message: "Bericht gespeichert", reportId: String(report._id) });
  } catch (error) {
    return res.status(500).json({ message: "Fehler beim Speichern", error: error.message });
  }
});

router.get("/", requireAuth, async (req, res) => {
  try {
    const query = req.user.role === "geraetewart" ? {} : { userId: req.user.id };
    const reports = await Report.find(query).sort({ createdAt: -1 }).lean();

    const mapped = reports.map((report) => ({
      id: String(report._id),
      username: report.username,
      vehicle_key: report.vehicleKey,
      vehicle_name: report.vehicleName,
      created_at: report.createdAt
    }));

    return res.json({ reports: mapped });
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
    const match = {};
    if (req.user.role !== "geraetewart") {
      match.userId = new mongoose.Types.ObjectId(req.user.id);
    }
    if (vehicleKey) {
      match.vehicleKey = String(vehicleKey);
    }

    const pipeline = [{ $match: match }, { $unwind: "$defects" }];
    if (priority) {
      pipeline.push({ $match: { "defects.priority": String(priority) } });
    }

    pipeline.push({
      $facet: {
        defects: [
          { $sort: { "defects.timestamp": -1 } },
          {
            $project: {
              _id: 0,
              id: { $toString: "$defects._id" },
              item_label: "$defects.itemLabel",
              description_text: "$defects.descriptionText",
              priority: "$defects.priority",
              timestamp: "$defects.timestamp",
              username: "$defects.username",
              report_id: { $toString: "$_id" },
              vehicle_key: "$vehicleKey",
              vehicle_name: "$vehicleName",
              report_created_at: "$createdAt"
            }
          }
        ],
        summary: [
          { $group: { _id: "$defects.priority", total: { $sum: 1 } } },
          { $project: { _id: 0, priority: "$_id", total: 1 } },
          { $sort: { priority: 1 } }
        ]
      }
    });

    const [result] = await Report.aggregate(pipeline);
    return res.json({ defects: result?.defects || [], summary: result?.summary || [] });
  } catch (error) {
    return res.status(500).json({ message: "Fehler beim Laden der Maengel", error: error.message });
  }
});

router.get("/history", requireAuth, async (req, res) => {
  const { vehicleKey } = req.query;

  try {
    const query = {};
    if (req.user.role !== "geraetewart") {
      query.userId = req.user.id;
    }
    if (vehicleKey) {
      query.vehicleKey = String(vehicleKey);
    }

    const reports = await Report.find(query).sort({ createdAt: -1 }).lean();
    const history = reports.map((report) => {
      const checks = report.checks || [];
      const defects = report.defects || [];

      return {
        id: String(report._id),
        vehicle_key: report.vehicleKey,
        vehicle_name: report.vehicleName,
        username: report.username,
        created_at: report.createdAt,
        total_checks: checks.length,
        defect_checks: checks.filter((check) => check.status === "defekt").length,
        defects_total: defects.length,
        defects_kritisch: defects.filter((defect) => defect.priority === "kritisch").length,
        defects_mittel: defects.filter((defect) => defect.priority === "mittel").length,
        defects_niedrig: defects.filter((defect) => defect.priority === "niedrig").length
      };
    });

    return res.json({ history });
  } catch (error) {
    return res.status(500).json({ message: "Fehler beim Laden des Verlaufs", error: error.message });
  }
});

router.get("/:id/pdf", requireAuth, async (req, res) => {
  const reportId = req.params.id;

  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    return res.status(400).json({ message: "Ungueltige Bericht-ID" });
  }

  try {
    const report = await Report.findById(reportId).lean();

    if (!report) {
      return res.status(404).json({ message: "Bericht nicht gefunden" });
    }

    if (!canAccessReport(req.user, report)) {
      return res.status(403).json({ message: "Kein Zugriff" });
    }

    const checks = (report.checks || []).map((check) => ({
      item_label: check.itemLabel,
      status: check.status,
      comment_text: check.commentText
    }));

    const defects = (report.defects || []).map((defect) => ({
      item_label: defect.itemLabel,
      description_text: defect.descriptionText,
      priority: defect.priority,
      timestamp: defect.timestamp,
      username: defect.username
    }));

    const pdfReport = {
      created_at: report.createdAt,
      vehicle_name: report.vehicleName,
      username: report.username
    };

    const pdf = await buildReportPdf({ report: pdfReport, checks, defects });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=bericht-${reportId}.pdf`);
    return res.send(pdf);
  } catch (error) {
    return res.status(500).json({ message: "PDF-Fehler", error: error.message });
  }
});

router.post("/:id/send-email", requireAuth, requireRole("geraetewart"), async (req, res) => {
  const reportId = req.params.id;
  const { recipients } = req.body;

  if (!mongoose.Types.ObjectId.isValid(reportId)) {
    return res.status(400).json({ message: "Ungueltige Bericht-ID" });
  }

  if (!Array.isArray(recipients) || recipients.length === 0) {
    return res.status(400).json({ message: "Mindestens ein Empfaenger erforderlich" });
  }

  try {
    const report = await Report.findById(reportId).lean();

    if (!report) {
      return res.status(404).json({ message: "Bericht nicht gefunden" });
    }

    const checks = (report.checks || []).map((check) => ({
      item_label: check.itemLabel,
      status: check.status,
      comment_text: check.commentText
    }));

    const defects = (report.defects || []).map((defect) => ({
      item_label: defect.itemLabel,
      description_text: defect.descriptionText,
      priority: defect.priority,
      timestamp: defect.timestamp,
      username: defect.username
    }));

    const pdfReport = {
      created_at: report.createdAt,
      vehicle_name: report.vehicleName,
      username: report.username
    };

    const pdf = await buildReportPdf({ report: pdfReport, checks, defects });

    await sendReportEmail({
      recipients,
      subject: `Feuerwehr Bericht ${report.vehicleName} (${reportId})`,
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
