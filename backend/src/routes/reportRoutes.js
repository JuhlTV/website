import express from "express";
import crypto from "crypto";
import dayjs from "dayjs";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { findVehicleByKey } from "../config/vehicles.js";
import { validateChecklistPayload } from "../utils/validators.js";
import { buildReportPdf } from "../services/pdfService.js";
import { sendReportEmail } from "../services/mailService.js";
import {
  createReport,
  findReportById,
  getPdfFileName,
  listReportsByUser,
  readPdfFile,
  savePdfFile,
  updateReport
} from "../services/fileStore.js";

const router = express.Router();

const reportCreateLimiter = createRateLimiter({
  windowMs: Number(process.env.REPORT_CREATE_RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.REPORT_CREATE_RATE_LIMIT_MAX || 20),
  message: "Zu viele Berichte in kurzer Zeit. Bitte kurz warten.",
  keyPrefix: "report-create",
  keyGenerator: (req) => req.user?.id || req.user?.username || req.ip
});

const reportEmailLimiter = createRateLimiter({
  windowMs: Number(process.env.REPORT_EMAIL_RATE_LIMIT_WINDOW_MS || 60_000),
  max: Number(process.env.REPORT_EMAIL_RATE_LIMIT_MAX || 6),
  message: "Zu viele E-Mail-Versuche in kurzer Zeit. Bitte kurz warten.",
  keyPrefix: "report-email",
  keyGenerator: (req) => req.user?.id || req.user?.username || req.ip
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getDefectId(reportId, defect) {
  if (defect?.id) {
    return defect.id;
  }
  return `${reportId}-${defect.itemKey}-${new Date(defect.timestamp).getTime()}`;
}

function normalizeRecipients(inputRecipients) {
  if (!Array.isArray(inputRecipients)) {
    return [];
  }

  const sanitized = inputRecipients
    .map((value) => String(value || "").trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(sanitized)];
}

function buildPdfPayloadFromReport(report) {
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
    username: defect.username,
    resolved_at: defect.resolvedAt || null,
    resolved_by: defect.resolvedBy || null
  }));

  const pdfReport = {
    created_at: report.createdAt,
    vehicle_name: report.vehicleName,
    username: report.username,
    signature_data_url: report.signatureDataUrl || ""
  };

  return { report: pdfReport, checks, defects };
}

async function getOrCreateReportPdf(report) {
  if (report.pdfFileName) {
    try {
      const pdfBuffer = await readPdfFile(report.pdfFileName);
      return { pdfBuffer, fileName: report.pdfFileName };
    } catch {
      // If persisted file is missing, regenerate from report payload.
    }
  }

  const pdfBuffer = await buildReportPdf(buildPdfPayloadFromReport(report));
  const fileName = getPdfFileName(report.id);
  await savePdfFile(fileName, pdfBuffer);
  await updateReport(report.id, { pdfFileName: fileName });
  return { pdfBuffer, fileName };
}

function canAccessReport(user, report) {
  return user.role === "geraetewart" || report.userId === user.id;
}

function resolveReportUsername(reqUser, payloadUsername) {
  const tokenUsername = String(reqUser?.username || "").trim();
  if (tokenUsername) {
    return tokenUsername;
  }

  const fallback = String(payloadUsername || "").trim();
  return fallback || "unbekannt";
}

function resolveReportUserId(reqUser) {
  const tokenUserId = String(reqUser?.id || "").trim();
  if (tokenUserId) {
    return tokenUserId;
  }

  return `guest-${dayjs().valueOf()}`;
}

function validateChecksAgainstVehicle(checks, vehicle) {
  const vehicleChecklist = Array.isArray(vehicle?.checklist) ? vehicle.checklist : [];
  const allowedKeys = new Set(vehicleChecklist.map((item) => item.key));
  const seenKeys = new Set();

  for (const check of checks) {
    const key = String(check?.itemKey || "");

    if (!allowedKeys.has(key)) {
      return `Ungültiger Prüfpunktschlüssel: ${key || "(leer)"}`;
    }

    if (seenKeys.has(key)) {
      return `Doppelter Prüfpunktschlüssel: ${key}`;
    }

    seenKeys.add(key);
  }

  return null;
}

router.post("/", optionalAuth, reportCreateLimiter, async (req, res) => {
  const validationError = validateChecklistPayload(req.body);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const { vehicleKey, checks, username, signatureDataUrl } = req.body;
  const vehicle = findVehicleByKey(vehicleKey);
  const resolvedUsername = resolveReportUsername(req.user, username);
  const resolvedUserId = resolveReportUserId(req.user);

  if (!vehicle) {
    return res.status(404).json({ message: "Fahrzeug nicht gefunden" });
  }

  const vehicleValidationError = validateChecksAgainstVehicle(checks, vehicle);
  if (vehicleValidationError) {
    return res.status(400).json({ message: vehicleValidationError });
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
        id: crypto.randomUUID(),
        itemKey: c.itemKey,
        itemLabel: c.itemLabel,
        descriptionText: c.defectDescription,
        priority: c.defectPriority,
        timestamp: dayjs().toDate(),
        username: resolvedUsername,
        resolvedAt: null,
        resolvedBy: null
      }));

    const report = await createReport({
      userId: resolvedUserId,
      username: resolvedUsername,
      vehicleKey: vehicle.key,
      vehicleName: vehicle.name,
      checks: checksPayload,
      defects: defectsPayload,
      signatureDataUrl,
      pdfFileName: null
    });

    const pdf = await buildReportPdf({
      report: {
        created_at: report.createdAt,
        vehicle_name: report.vehicleName,
        username: report.username,
        signature_data_url: report.signatureDataUrl || ""
      },
      checks: checksPayload.map((check) => ({
        item_label: check.itemLabel,
        status: check.status,
        comment_text: check.commentText
      })),
      defects: defectsPayload.map((defect) => ({
        item_label: defect.itemLabel,
        description_text: defect.descriptionText,
        priority: defect.priority,
        timestamp: defect.timestamp,
        username: defect.username,
        resolved_at: defect.resolvedAt || null,
        resolved_by: defect.resolvedBy || null
      }))
    });

    const pdfFileName = getPdfFileName(report.id);
    await savePdfFile(pdfFileName, pdf);
    await updateReport(report.id, { pdfFileName });

    return res.status(201).json({ message: "Bericht gespeichert", reportId: report.id });
  } catch (error) {
    return res.status(500).json({ message: "Fehler beim Speichern", error: error.message });
  }
});

router.get("/", requireAuth, requireRole("geraetewart"), async (req, res) => {
  try {
    const reports = (await listReportsByUser(req.user)).sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    const mapped = reports.map((report) => ({
      id: report.id,
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

router.get("/defects", requireAuth, requireRole("geraetewart"), async (req, res) => {
  const { priority, vehicleKey, status } = req.query;

  if (priority && !["niedrig", "mittel", "kritisch"].includes(String(priority))) {
    return res.status(400).json({ message: "Ungültige Priorität" });
  }

  if (status && !["alle", "offen", "behoben"].includes(String(status))) {
    return res.status(400).json({ message: "Ungültiger Mängelstatus" });
  }

  try {
    const reports = await listReportsByUser(req.user);
    const filteredReports = reports.filter(
      (report) => !vehicleKey || report.vehicleKey === String(vehicleKey)
    );

    const defects = [];

    for (const report of filteredReports) {
      for (const defect of report.defects || []) {
        if (priority && defect.priority !== String(priority)) {
          continue;
        }

        const isResolved = Boolean(defect.resolvedAt);
        if (status === "offen" && isResolved) {
          continue;
        }
        if (status === "behoben" && !isResolved) {
          continue;
        }

        defects.push({
          id: getDefectId(report.id, defect),
          item_label: defect.itemLabel,
          description_text: defect.descriptionText,
          priority: defect.priority,
          timestamp: defect.timestamp,
          username: defect.username,
          resolved_at: defect.resolvedAt || null,
          resolved_by: defect.resolvedBy || null,
          report_id: report.id,
          vehicle_key: report.vehicleKey,
          vehicle_name: report.vehicleName,
          report_created_at: report.createdAt
        });
      }
    }

    defects.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const summaryMap = new Map();
    for (const defect of defects) {
      summaryMap.set(defect.priority, (summaryMap.get(defect.priority) || 0) + 1);
    }

    const summary = Array.from(summaryMap.entries())
      .map(([priorityValue, total]) => ({ priority: priorityValue, total }))
      .sort((a, b) => a.priority.localeCompare(b.priority));

    return res.json({ defects, summary });
  } catch (error) {
    return res.status(500).json({ message: "Fehler beim Laden der Mängel", error: error.message });
  }
});

router.get("/history", requireAuth, requireRole("geraetewart"), async (req, res) => {
  const { vehicleKey } = req.query;

  try {
    const reports = (await listReportsByUser(req.user))
      .filter((report) => !vehicleKey || report.vehicleKey === String(vehicleKey))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const history = reports.map((report) => {
      const checks = report.checks || [];
      const defects = report.defects || [];

      return {
        id: report.id,
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

router.patch("/defects/:defectId/resolve", requireAuth, requireRole("geraetewart"), async (req, res) => {
  const defectId = String(req.params.defectId || "").trim();
  const resolve = req.body?.resolve !== false;

  if (!defectId) {
    return res.status(400).json({ message: "Ungültige Mängel-ID" });
  }

  try {
    const reports = await listReportsByUser(req.user);
    for (const report of reports) {
      const defects = Array.isArray(report.defects) ? report.defects : [];
      const targetIndex = defects.findIndex((defect) => getDefectId(report.id, defect) === defectId);
      if (targetIndex === -1) {
        continue;
      }

      const nextDefects = defects.map((defect, index) => {
        if (index !== targetIndex) {
          return defect;
        }

        const stableId = getDefectId(report.id, defect);
        if (!resolve) {
          return {
            ...defect,
            id: stableId,
            resolvedAt: null,
            resolvedBy: null
          };
        }

        return {
          ...defect,
          id: stableId,
          resolvedAt: new Date().toISOString(),
          resolvedBy: String(req.user?.username || "geraetewart")
        };
      });

      await updateReport(report.id, {
        defects: nextDefects,
        // Regenerate PDF on next download to reflect defect status updates.
        pdfFileName: null
      });

      return res.json({
        message: resolve ? "Mangel als behoben markiert" : "Mangel wieder als offen markiert",
        defectId,
        resolve
      });
    }

    return res.status(404).json({ message: "Mangel nicht gefunden" });
  } catch (error) {
    return res.status(500).json({ message: "Statusänderung fehlgeschlagen", error: error.message });
  }
});

router.get("/:id/pdf", requireAuth, async (req, res) => {
  const reportId = req.params.id;

  if (!reportId || typeof reportId !== "string") {
    return res.status(400).json({ message: "Ungültige Bericht-ID" });
  }

  try {
    const report = await findReportById(reportId);

    if (!report) {
      return res.status(404).json({ message: "Bericht nicht gefunden" });
    }

    if (!canAccessReport(req.user, report)) {
      return res.status(403).json({ message: "Kein Zugriff" });
    }

    const { pdfBuffer } = await getOrCreateReportPdf(report);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=bericht-${reportId}.pdf`);
    return res.send(pdfBuffer);
  } catch (error) {
    return res.status(500).json({ message: "PDF-Fehler", error: error.message });
  }
});

router.post(
  "/:id/send-email",
  requireAuth,
  requireRole("geraetewart"),
  reportEmailLimiter,
  async (req, res) => {
    const reportId = req.params.id;
    const recipients = normalizeRecipients(req.body?.recipients);

    if (!reportId || typeof reportId !== "string") {
      return res.status(400).json({ message: "Ungültige Bericht-ID" });
    }

    if (recipients.length === 0) {
      return res.status(400).json({ message: "Mindestens ein Empfänger erforderlich" });
    }

    const invalidRecipients = recipients.filter((email) => !EMAIL_PATTERN.test(email));
    if (invalidRecipients.length > 0) {
      return res.status(400).json({ message: "Ungültige Empfänger-Adresse enthalten" });
    }

    try {
      const report = await findReportById(reportId);

      if (!report) {
        return res.status(404).json({ message: "Bericht nicht gefunden" });
      }

      const { pdfBuffer } = await getOrCreateReportPdf(report);

      await sendReportEmail({
        recipients,
        subject: `Feuerwehr Bericht ${report.vehicleName} (${reportId})`,
        text: "Anbei der automatisch generierte Prüfbericht.",
        pdfBuffer,
        fileName: `bericht-${reportId}.pdf`
      });

      return res.json({ message: "Bericht erfolgreich versendet" });
    } catch (error) {
      return res.status(500).json({ message: "E-Mail-Versand fehlgeschlagen", error: error.message });
    }
  }
);

export default router;
