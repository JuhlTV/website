import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { requireAuth } from "../middleware/auth.js";
import { findUserByUsername } from "../services/fileStore.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  return res.status(403).json({
    message:
      "Registrierung ist deaktiviert. Benutzer und Passwoerter werden nur per Script gesetzt."
  });
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ message: "Benutzername und Passwort sind erforderlich" });
  }

  try {
    const user = await findUserByUsername(username);

    if (!user) {
      return res.status(401).json({ message: "Login fehlgeschlagen" });
    }

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) {
      return res.status(401).json({ message: "Login fehlgeschlagen" });
    }

    const token = jwt.sign(
      {
        id: String(user.id),
        username: user.username,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "12h" }
    );

    return res.json({
      token,
      user: {
        id: String(user.id),
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
