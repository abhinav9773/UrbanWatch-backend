import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createWard,
  getWards,
  deleteWard,
} from "../controllers/wardController.js";

const router = express.Router();

router.get("/", getWards);
router.post("/", protect, createWard);
router.delete("/:id", protect, deleteWard);

export default router;
