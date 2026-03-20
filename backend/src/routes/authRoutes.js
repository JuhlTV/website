import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { pool } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Benutzername und Passwort sind erforderlich" });
  }

  if (password.length < 8) {
    return res.status(400).json({ message: "Passwort muss mindestens 8 Zeichen haben" });
  }

  const safeRole = "benutzer";

  try {
    const hash = await bcrypt.hash(password, 12);
    await pool.execute("INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)", [username, hash, safeRole]);
    return res.status(201).json({ message: "Benutzer erstellt" });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "Benutzername existiert bereits" });
    }
    return res.status(500).json({ message: "Fehler beim Erstellen", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Benutzername und Passwort sind erforderlich" });
  }

  try {
    const [rows] = await pool.execute("SELECT id, username, password_hash, role FROM users WHERE username = ?", [username]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ message: "Login fehlgeschlagen" });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: "Login fehlgeschlagen" });
    }

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
    );

    return res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "Login-Fehler", error: error.message });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  return res.json({ user: req.user });
});

export default router;
