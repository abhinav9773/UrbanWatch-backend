import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createWard,
  getWards,
  deleteWard,
  detectWardFromLocation,
} from "../controllers/wardController.js";

const router = express.Router();

router.get("/", getWards);
router.get("/detect", detectWardFromLocation); // ✅ auto-detect from GPS
router.post("/", protect, createWard);
router.delete("/:id", protect, deleteWard);

export default router;
