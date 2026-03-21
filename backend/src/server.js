import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import authRoutes from "./routes/authRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import { cleanupExpiredReports, initializeFileStore } from "./services/fileStore.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const appDomain = (process.env.APP_DOMAIN || "https://website-production-17fc.up.railway.app").replace(/\/+$/, "");
const frontendOrigin = (process.env.FRONTEND_ORIGIN || appDomain).replace(/\/+$/, "");
const configuredOrigins = (process.env.FRONTEND_ORIGINS || "")
  .split(",")
  .map((value) => value.trim().replace(/\/+$/, ""))
  .filter(Boolean);
const allowedOrigins = new Set([frontendOrigin, appDomain, ...configuredOrigins]);

if (process.env.NODE_ENV !== "production") {
  allowedOrigins.add("http://localhost:5173");
  allowedOrigins.add("http://127.0.0.1:5173");
}

const apiBaseUrl = `${appDomain}/api`;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolveFrontendDistPath() {
  const candidates = [
    path.resolve(__dirname, "../../frontend/dist"),
    path.resolve(__dirname, "../frontend/dist"),
    path.resolve(process.cwd(), "frontend/dist"),
    path.resolve(process.cwd(), "../frontend/dist"),
    path.resolve(process.cwd(), "dist")
  ];

  for (const candidate of candidates) {
    const indexPath = path.join(candidate, "index.html");
    if (fs.existsSync(indexPath)) {
      return candidate;
    }
  }

  // Keep the default candidate so logs and sendFile errors still point to a deterministic path.
  return candidates[0];
}

const frontendDistPath = resolveFrontendDistPath();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      const normalizedOrigin = origin.replace(/\/+$/, "");
      if (allowedOrigins.has(normalizedOrigin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS blocked for origin"), false);
    }
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "feuerwehr-checkliste-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/reports", reportRoutes);

// Serve frontend build for all non-API routes (works in any NODE_ENV).
app.use(express.static(frontendDistPath));

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ message: "API route not found" });
  }
  return res.sendFile(path.join(frontendDistPath, "index.html"));
});

async function start() {
  try {
    console.log("Starting Feuerwehr Checkliste Backend...");
    console.log(`API Base: ${apiBaseUrl}`);
    console.log(`CORS Origin: ${frontendOrigin}`);
    console.log(`CORS Allowed Origins: ${Array.from(allowedOrigins).join(", ")}`);
    console.log(`App Domain: ${appDomain}`);
    console.log(`Frontend dist path: ${frontendDistPath}`);
    console.log(`Frontend index exists: ${fs.existsSync(path.join(frontendDistPath, "index.html"))}`);

    console.log("\nInitializing local file store...");
    await initializeFileStore();
    await cleanupExpiredReports(30);

    const cleanupIntervalMs = 60 * 60 * 1000;
    setInterval(() => {
      cleanupExpiredReports(30).catch((error) => {
        console.error("Cleanup failed:", error.message);
      });
    }, cleanupIntervalMs);

    app.listen(port, () => {
      console.log(`\nServer listening on port ${port}`);
      console.log("\n📋 Available endpoints:");
      console.log(`   GET  /api/health`);
      console.log(`   POST /api/auth/register`);
      console.log(`   POST /api/auth/login`);
      console.log(`   GET  /api/vehicles`);
      console.log(`   POST /api/reports`);
      console.log(`   GET  /api/reports`);
      console.log(`   GET  /api/reports/defects`);
      console.log(`   GET  /api/reports/history`);
      console.log(`\nTest URL: ${apiBaseUrl}/health\n`);
    });
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

start();
