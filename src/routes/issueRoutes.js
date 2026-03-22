import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { upload } from "../utils/cloudinary.js";
import {
  createIssue,
  getIssues,
  getIssueById,
  updateIssueStatus,
  getIssueStatusHistory,
  assignEngineer,
  getIssuesAssignedToEngineer,
  autoAssign,
  getMyIssues,
  upvoteIssue,
  addIssueUpdate,
} from "../controllers/issueController.js";

const router = express.Router();

// 🔐 Specific protected routes FIRST (before /:id)
router.get("/engineers/me/issues", protect, getIssuesAssignedToEngineer);
router.get("/me", protect, getMyIssues);

// General routes
router.get("/", getIssues);
router.post("/", protect, upload.array("photos", 5), createIssue); // ✅ up to 5 photos

// Single issue
router.get("/:id", getIssueById);
router.patch("/:id/status", protect, updateIssueStatus);
router.get("/:id/history", getIssueStatusHistory);

// Assignment
router.post("/:id/assign", protect, assignEngineer);
router.post("/:id/auto-assign", protect, autoAssign);

// ✅ New features
router.post("/:id/upvote", protect, upvoteIssue);
router.post("/:id/updates", protect, addIssueUpdate);

export default router;
