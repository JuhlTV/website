import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const storageDir = path.resolve(__dirname, "../../storage");
const usersFilePath = path.join(storageDir, "users.json");
const reportsFilePath = path.join(storageDir, "reports.json");
const pdfDirPath = path.join(storageDir, "pdf");

function createId() {
  return crypto.randomUUID();
}

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function ensureJsonFile(filePath, defaultValue) {
  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 2), "utf8");
  }
}

async function readJson(filePath, defaultValue) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    if (!content.trim()) {
      return defaultValue;
    }
    return JSON.parse(content);
  } catch {
    return defaultValue;
  }
}

async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function initializeFileStore() {
  await ensureDir(storageDir);
  await ensureDir(pdfDirPath);
  await ensureJsonFile(usersFilePath, []);
  await ensureJsonFile(reportsFilePath, []);

  const users = await readUsers();
  const hasGeraetewart = users.some((user) => user.role === "geraetewart");

  if (!hasGeraetewart) {
    const username = (process.env.GERAETEWART_USERNAME || "geraetewart").trim() || "geraetewart";
    const password =
      (process.env.GERAETEWART_PASSWORD || process.env.ADMIN_PASSWORD || "admin1234").trim()
      || "admin1234";

    await upsertUserWithPassword({ username, password, role: "geraetewart" });
    console.log(`Geraetewart-Benutzer initialisiert: ${username}`);
  }
}

export async function cleanupExpiredReports(maxAgeDays = 30) {
  const reports = await readReports();
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
  const keptReports = [];

  for (const report of reports) {
    const createdAtMs = new Date(report.createdAt).getTime();
    const isExpired = Number.isFinite(createdAtMs) && now - createdAtMs > maxAgeMs;

    if (isExpired) {
      if (report.pdfFileName) {
        const pdfPath = path.join(pdfDirPath, report.pdfFileName);
        try {
          await fs.unlink(pdfPath);
        } catch {
          // Ignore missing files during cleanup.
        }
      }
      continue;
    }

    keptReports.push(report);
  }

  if (keptReports.length !== reports.length) {
    await writeReports(keptReports);
  }
}

export function getPdfFilePath(fileName) {
  return path.join(pdfDirPath, fileName);
}

export function getPdfFileName(reportId) {
  return `bericht-${reportId}.pdf`;
}

export async function savePdfFile(fileName, buffer) {
  await ensureDir(pdfDirPath);
  await fs.writeFile(getPdfFilePath(fileName), buffer);
}

export async function readPdfFile(fileName) {
  return fs.readFile(getPdfFilePath(fileName));
}

export async function readUsers() {
  return readJson(usersFilePath, []);
}

export async function writeUsers(users) {
  await writeJson(usersFilePath, users);
}

export async function findUserByUsername(username) {
  const users = await readUsers();
  return users.find((user) => user.username === username) || null;
}

export async function findGeraetewartByPassword(password) {
  const users = await readUsers();
  const candidates = users.filter((user) => user.role === "geraetewart");

  for (const user of candidates) {
    const match = await bcrypt.compare(password, user.passwordHash);
    if (match) {
      return user;
    }
  }

  return null;
}

export async function createUser({ username, passwordHash, role = "benutzer" }) {
  const users = await readUsers();
  const exists = users.some((user) => user.username === username);

  if (exists) {
    const error = new Error("Benutzername existiert bereits");
    error.code = "DUPLICATE_USER";
    throw error;
  }

  const user = {
    id: createId(),
    username,
    passwordHash,
    role,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  await writeUsers(users);
  return user;
}

export async function upsertUserWithPassword({ username, password, role = "benutzer" }) {
  const users = await readUsers();
  const passwordHash = await bcrypt.hash(password, 12);
  const existingIndex = users.findIndex((user) => user.username === username);

  if (existingIndex !== -1) {
    users[existingIndex] = {
      ...users[existingIndex],
      passwordHash,
      role
    };
    await writeUsers(users);
    return { user: users[existingIndex], created: false };
  }

  const user = {
    id: createId(),
    username,
    passwordHash,
    role,
    createdAt: new Date().toISOString()
  };

  users.push(user);
  await writeUsers(users);
  return { user, created: true };
}

export async function readReports() {
  return readJson(reportsFilePath, []);
}

export async function writeReports(reports) {
  await writeJson(reportsFilePath, reports);
}

export async function createReport(reportPayload) {
  const reports = await readReports();
  const report = {
    id: createId(),
    ...reportPayload,
    createdAt: new Date().toISOString()
  };

  reports.push(report);
  await writeReports(reports);
  return report;
}

export async function updateReport(reportId, patch) {
  const reports = await readReports();
  const index = reports.findIndex((report) => report.id === reportId);

  if (index === -1) {
    return null;
  }

  reports[index] = {
    ...reports[index],
    ...patch
  };

  await writeReports(reports);
  return reports[index];
}

export async function findReportById(reportId) {
  const reports = await readReports();
  return reports.find((report) => report.id === reportId) || null;
}

export async function listReportsByUser(user) {
  const reports = await readReports();
  if (user.role === "geraetewart") {
    return reports;
  }
  return reports.filter((report) => report.userId === user.id);
}
