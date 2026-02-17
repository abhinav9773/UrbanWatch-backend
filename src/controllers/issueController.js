import Issue from "../models/Issue.js";
import IssueStatusLog from "../models/IssueStatusLog.js";
import Assignment from "../models/Assignment.js";
import mongoose from "mongoose";

import { createNotification } from "../utils/createNotification.js";

// ============================
// CREATE ISSUE
// ============================
export const createIssue = async (req, res) => {
  try {
    console.log("CREATE ISSUE BODY >>>", req.body);
    const {
      title,
      description,
      category,
      severity,
      location,
      wardId,
      reportedBy,
    } = req.body;

    // Validation
    if (!title || !category || !severity || !location || !reportedBy) {
      return res.status(400).json({
        message: "Missing required fields",
      });
    }

    // ============================
    // SLA LOGIC
    // ============================
    let hoursToAdd = 72;

    if (severity === 5) hoursToAdd = 24;
    if (severity === 4) hoursToAdd = 48;
    if (severity === 3) hoursToAdd = 72;
    if (severity === 2) hoursToAdd = 96;
    if (severity === 1) hoursToAdd = 120;

    const dueAt = new Date(Date.now() + hoursToAdd * 60 * 60 * 1000);

    // Priority
    const priorityScore = severity * 10;

    // ============================
    // CREATE ISSUE
    // ============================
    const issue = await Issue.create({
      title,
      description,
      category,
      severity,
      location,
      wardId,
      reportedBy,
      priorityScore,
      dueAt,
    });

    // 🔔 Notify Citizen
    await createNotification(
      reportedBy,
      "📌 Your issue has been successfully reported",
    );

    res.status(201).json(issue);
  } catch (error) {
    console.error("CREATE ISSUE ERROR:", error);

    res.status(500).json({
      message: "Failed to create issue",
    });
  }
};

// ============================
// GET ISSUES
// ============================
export const getIssues = async (req, res) => {
  try {
    const { status, category, wardId } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (category) filter.category = category;
    if (wardId) filter.wardId = wardId;

    const issues = await Issue.find(filter).sort({
      priorityScore: -1,
      createdAt: -1,
    });

    res.status(200).json(issues);
  } catch (error) {
    console.error("GET ISSUES ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch issues",
    });
  }
};

// ============================
// UPDATE STATUS
// ============================
export const updateIssueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const allowedTransitions = {
      REPORTED: ["VERIFIED"],
      VERIFIED: ["IN_PROGRESS"],
      IN_PROGRESS: ["RESOLVED"],
      RESOLVED: [],
    };

    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({
        message: "Issue not found",
      });
    }

    const currentStatus = issue.status;

    if (
      !allowedTransitions[currentStatus] ||
      !allowedTransitions[currentStatus].includes(status)
    ) {
      return res.status(400).json({
        message: `Invalid status transition from ${currentStatus} to ${status}`,
      });
    }

    // Log history
    await IssueStatusLog.create({
      issueId: issue._id,
      fromStatus: currentStatus,
      toStatus: status,
      changedBy: req.user?.id || null,
    });

    issue.status = status;
    await issue.save();

    // 🔔 Notify Citizen
    await createNotification(
      issue.reportedBy,
      `✅ Your issue is now ${status}`,
    );

    res.status(200).json(issue);
  } catch (error) {
    console.error("UPDATE STATUS ERROR:", error);

    res.status(500).json({
      message: "Failed to update issue status",
    });
  }
};

// ============================
// STATUS HISTORY
// ============================
export const getIssueStatusHistory = async (req, res) => {
  try {
    const { id } = req.params;

    const history = await IssueStatusLog.find({
      issueId: id,
    }).sort({ createdAt: 1 });

    res.status(200).json(history);
  } catch (error) {
    console.error("STATUS HISTORY ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch status history",
    });
  }
};

// ============================
// ASSIGN ENGINEER
// ============================
export const assignEngineer = async (req, res) => {
  try {
    const { id } = req.params;
    const { engineerId } = req.body;

    if (!engineerId) {
      return res.status(400).json({
        message: "engineerId is required",
      });
    }

    const issue = await Issue.findById(id);

    if (!issue) {
      return res.status(404).json({
        message: "Issue not found",
      });
    }

    // Deactivate old
    await Assignment.updateMany(
      { issueId: id, isActive: true },
      { isActive: false },
    );

    const assignment = await Assignment.create({
      issueId: id,
      engineerId,
    });

    // 🔔 Notify Engineer
    await createNotification(
      engineerId,
      "🛠️ New issue has been assigned to you",
    );

    res.status(201).json(assignment);
  } catch (error) {
    console.error("ASSIGN ENGINEER ERROR:", error);

    res.status(500).json({
      message: "Failed to assign engineer",
    });
  }
};

// ============================
// ENGINEER DASHBOARD
// ============================
export const getIssuesAssignedToEngineer = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        message: "User not authenticated",
      });
    }

    const engineerId = new mongoose.Types.ObjectId(req.user.id);

    const assignments = await Assignment.find({
      engineerId,
      isActive: true,
    });

    const issueIds = assignments.map((a) => a.issueId);

    const issues = await Issue.find({
      _id: { $in: issueIds },
    });

    res.status(200).json(issues);
  } catch (error) {
    console.error("ENGINEER DASHBOARD ERROR:", error);

    res.status(500).json({
      message: "Failed to fetch assigned issues",
    });
  }
};

// ============================
// CITIZEN DASHBOARD
// ============================
export const getMyIssues = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const issues = await Issue.find({
      reportedBy: req.user.id,
    }).sort({ createdAt: -1 });

    res.json(issues);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to fetch your issues",
    });
  }
};

// ============================
// AUTO ASSIGN
// ============================
export const autoAssign = async (req, res) => {
  try {
    const { id } = req.params;

    const workload = await Assignment.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: "$engineerId",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: 1 } },
      { $limit: 1 },
    ]);

    if (!workload.length) {
      return res.status(400).json({
        message: "No engineers available",
      });
    }

    const engineerId = workload[0]._id;

    await Assignment.updateMany(
      { issueId: id, isActive: true },
      { isActive: false },
    );

    const assignment = await Assignment.create({
      issueId: id,
      engineerId,
    });

    await createNotification(engineerId, "🤖 Issue auto-assigned to you");

    res.json(assignment);
  } catch (error) {
    console.error("AUTO ASSIGN ERROR:", error);

    res.status(500).json({
      message: "Auto assign failed",
    });
  }
};
