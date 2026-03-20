import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bcrypt from "bcryptjs";
import path from "path";
import { fileURLToPath } from "url";
import { connectDatabase } from "./db.js";
import { User } from "./models/User.js";
import authRoutes from "./routes/authRoutes.js";
import vehicleRoutes from "./routes/vehicleRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const frontendDistPath = path.resolve(__dirname, "../../frontend/dist");

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:5173"
  })
);
app.use(express.json({ limit: "1mb" }));

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

async function ensureAdminUser() {
  const existingUser = await User.findOne({ username: "admin" }).select("_id").lean();
  if (existingUser) {
    return;
  }

  const hash = await bcrypt.hash("admin12345", 12);
  await User.create({ username: "admin", passwordHash: hash, role: "geraetewart" });
  console.log("Seed user created: admin / admin12345");
}

async function start() {
  try {
    console.log("🚀 Starting Feuerwehr Checkliste Backend...");
    console.log(`📡 API Base: http://localhost:${port}/api`);
    console.log(`🌐 CORS Origin: ${process.env.FRONTEND_ORIGIN || "http://localhost:5173"}`);
    
    console.log("\n🔗 Connecting to MongoDB...");
    await connectDatabase();
    console.log("✅ MongoDB connected successfully");
    console.log("\n👤 Setting up admin user...");
    await ensureAdminUser();

    app.listen(port, () => {
      console.log(`\n✨ Server running on http://localhost:${port}`);
      console.log("\n📋 Available endpoints:");
      console.log(`   GET  /api/health`);
      console.log(`   POST /api/auth/register`);
      console.log(`   POST /api/auth/login`);
      console.log(`   GET  /api/vehicles`);
      console.log(`   POST /api/reports`);
      console.log(`   GET  /api/reports`);
      console.log(`   GET  /api/reports/defects`);
      console.log(`   GET  /api/reports/history`);
      console.log(`\n🎯 Test: curl http://localhost:${port}/api/health\n`);
    });
  } catch (error) {
    console.error("Startup failed:", error.message);
    process.exit(1);
  }
}

start();
