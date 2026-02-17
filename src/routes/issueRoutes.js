import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { autoAssign } from "../controllers/issueController.js";
import { getMyIssues } from "../controllers/issueController.js";
import {
  createIssue,
  getIssues,
  updateIssueStatus,
  getIssueStatusHistory,
  assignEngineer,
  getIssuesAssignedToEngineer,
} from "../controllers/issueController.js";

const router = express.Router();

// 🔐 Protected route FIRST
router.get("/engineers/me/issues", protect, getIssuesAssignedToEngineer);

// Public / param routes AFTER
router.get("/engineers/:engineerId/issues", getIssuesAssignedToEngineer);
router.post("/:id/auto-assign", autoAssign);
router.post("/:id/assign", assignEngineer);
router.get("/:id/history", getIssueStatusHistory);
router.post("/", protect, createIssue);
router.get("/", getIssues);
router.patch("/:id/status", updateIssueStatus);
router.get("/me", protect, getMyIssues);

export default router;
