import express from "express";
import { getVehiclesWithChecklist } from "../config/vehicles.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, (req, res) => {
  return res.json({ vehicles: getVehiclesWithChecklist() });
});

export default router;
