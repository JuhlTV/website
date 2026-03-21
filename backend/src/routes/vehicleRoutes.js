import express from "express";
import { getVehiclesWithChecklist } from "../config/vehicles.js";

const router = express.Router();

router.get("/", (req, res) => {
  return res.json({ vehicles: getVehiclesWithChecklist() });
});

export default router;
