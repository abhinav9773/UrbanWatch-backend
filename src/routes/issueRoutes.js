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

// Specific protected routes FIRST (before /:id)
router.get("/engineers/me/issues", protect, getIssuesAssignedToEngineer);
router.get("/me", protect, getMyIssues);

// General routes
router.get("/", protect, getIssues);   // ← added protect here
router.post("/", protect, (req, res, next) => {
  upload.array("photos", 5)(req, res, (err) => {
    if (err) {
      console.error("UPLOAD ERROR:", err.message);
      return res.status(500).json({ 
        message: "File upload failed", 
        detail: err.message 
      });
    }
    next();
  });
}, createIssue);

// Single issue
router.get("/:id", protect, getIssueById);
router.patch("/:id/status", protect, updateIssueStatus);
router.get("/:id/history", protect, getIssueStatusHistory);

// Assignment
router.post("/:id/assign", protect, assignEngineer);
router.post("/:id/auto-assign", protect, autoAssign);

// Features
router.post("/:id/upvote", protect, upvoteIssue);
router.post("/:id/updates", protect, addIssueUpdate);

export default router;