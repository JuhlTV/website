import express from "express";
import dotenv from "dotenv";
import cors from "cors";
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
const apiBaseUrl = `${appDomain}/api`;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");

app.use(
  cors({
    origin: frontendOrigin
  })
);
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (req, res) => {
  res.json({ ok: true, service: "feuerwehr-checkliste-api" });
});

app.use("/api/auth", authRoutes);
app.use("/api/vehicles", vehicleRoutes);
app.use("/api/reports", reportRoutes);

if (process.env.NODE_ENV === "production") {
  app.use(express.static(frontendDistPath));

  app.get("*", (req, res) => {
    if (req.path.startsWith("/api/")) {
      return res.status(404).json({ message: "API route not found" });
    }
    return res.sendFile(path.join(frontendDistPath, "index.html"));
  });
}

async function start() {
  try {
    console.log("Starting Feuerwehr Checkliste Backend...");
    console.log(`API Base: ${apiBaseUrl}`);
    console.log(`CORS Origin: ${frontendOrigin}`);
    console.log(`App Domain: ${appDomain}`);

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
