import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";
import { findGeraetewartByPassword, findUserByUsername } from "../services/fileStore.js";

const router = express.Router();

function getPasswordCandidates(input) {
  const raw = String(input || "");
  const trimmed = raw.trim();
  if (!trimmed || trimmed === raw) {
    return raw ? [raw] : [];
  }
  return [raw, trimmed];
}

router.post("/register", async (req, res) => {
  return res.status(403).json({
    message:
      "Registrierung ist deaktiviert. Benutzer und Passwörter werden nur per Script gesetzt."
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
  const passwordCandidates = getPasswordCandidates(password);

  if (passwordCandidates.length === 0) {
    return res.status(400).json({ message: "Passwort ist erforderlich" });
  }

  try {
    let user = null;

    if (username && String(username).trim()) {
      user = await findUserByUsername(String(username).trim());
      if (user) {
        let usernameMatch = false;
        for (const candidatePassword of passwordCandidates) {
          // Support accidental whitespace in pasted passwords without breaking valid logins.
          const match = await bcrypt.compare(candidatePassword, user.passwordHash);
          if (match) {
            usernameMatch = true;
            break;
          }
        }
        if (!usernameMatch) {
          user = null;
        }
      }
    } else {
      for (const candidatePassword of passwordCandidates) {
        user = await findGeraetewartByPassword(candidatePassword);
        if (user) {
          break;
        }
      }

      if (!user) {
        const envPassword =
          (process.env.GERAETEWART_PASSWORD || process.env.ADMIN_PASSWORD || "").trim();
        const envPasswordHash = (process.env.GERAETEWART_PASSWORD_HASH || "").trim();

        const plainPasswordMatch =
          Boolean(envPassword)
          && passwordCandidates.some((candidatePassword) => candidatePassword === envPassword);

        let hashPasswordMatch = false;
        if (!plainPasswordMatch && envPasswordHash) {
          for (const candidatePassword of passwordCandidates) {
            const match = await bcrypt.compare(candidatePassword, envPasswordHash);
            if (match) {
              hashPasswordMatch = true;
              break;
            }
          }
        }

        if (plainPasswordMatch || hashPasswordMatch) {
          user = {
            id: "geraetewart-env",
            username: (process.env.GERAETEWART_USERNAME || "geraetewart").trim() || "geraetewart",
            role: "geraetewart"
          };
        }
      }
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
