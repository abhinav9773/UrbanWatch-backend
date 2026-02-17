import express from "express";
import {
  getAssignmentHistory,
  getEngineerWorkload,
} from "../controllers/assignmentController.js";

import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin only
router.get("/history", protect, adminOnly, getAssignmentHistory);

router.get("/workload", protect, adminOnly, getEngineerWorkload);

export default router;
