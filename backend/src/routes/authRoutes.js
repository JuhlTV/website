import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";
import { findGeraetewartByPassword, findUserByUsername } from "../services/fileStore.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  return res.status(403).json({
    message:
      "Registrierung ist deaktiviert. Benutzer und Passwoerter werden nur per Script gesetzt."
  });
});

router.post("/guest", async (req, res) => {
  try {
    const guestId = crypto.randomUUID();
    const guestUser = {
      id: guestId,
      username: `gast-${guestId.slice(0, 8)}`,
      role: "benutzer"
    };

    const token = jwt.sign(guestUser, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || "12h"
    });

    return res.json({ token, user: guestUser });
  } catch (error) {
    return res.status(500).json({ message: "Gast-Login fehlgeschlagen", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!password) {
    return res.status(400).json({ message: "Passwort ist erforderlich" });
  }

  try {
    let user = null;

    if (username && String(username).trim()) {
      user = await findUserByUsername(String(username).trim());
      if (user) {
        const usernameMatch = await bcrypt.compare(password, user.passwordHash);
        if (!usernameMatch) {
          user = null;
        }
      }
    } else {
      user = await findGeraetewartByPassword(password);
    }

    if (!user) {
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
