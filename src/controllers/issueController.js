import Issue from "../models/Issue.js";
import IssueStatusLog from "../models/IssueStatusLog.js";
import Assignment from "../models/Assignment.js";
import mongoose from "mongoose";
import { createNotification } from "../utils/createNotification.js";
import { sendPushToUser } from "../utils/pushNotification.js";

// ── helper: safe ObjectId check ──────────────────────────────────────────────
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ── CREATE ────────────────────────────────────────────────────────────────────
export const createIssue = async (req, res) => {
  try {
    const body = req.body || {};
    const { title, description, category, severity, wardId, reportedBy } = body;

    let location = body.location;
    if (typeof location === "string") {
      try {
        location = JSON.parse(location);
      } catch {
        location = null;
      }
    }

    if (!title || !category || !severity || !location || !reportedBy) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // Validate reportedBy is a real ObjectId before hitting the DB
    if (!isValidObjectId(reportedBy)) {
      return res.status(400).json({ message: "Invalid reportedBy ID" });
    }

    let hoursToAdd = 72;
    if (severity == 5)      hoursToAdd = 24;
    else if (severity == 4) hoursToAdd = 48;
    else if (severity == 3) hoursToAdd = 72;
    else if (severity == 2) hoursToAdd = 96;
    else if (severity == 1) hoursToAdd = 120;

    const dueAt         = new Date(Date.now() + hoursToAdd * 60 * 60 * 1000);
    const priorityScore = Number(severity) * 10;
    const photos        = req.files ? req.files.map((f) => f.path) : [];

    const issue = await Issue.create({
      title,
      description,
      category,
      severity: Number(severity),
      location,
      // Only set wardId if it's a valid ObjectId — avoids CastError
      wardId: wardId && isValidObjectId(wardId) ? wardId : undefined,
      reportedBy,
      priorityScore,
      dueAt,
      photos,
    });

    // Notifications — fire and forget, never block the response
    createNotification(reportedBy, "Your issue has been successfully reported").catch(() => {});
    sendPushToUser(reportedBy, {
      title: "Issue Reported",
      body: `Your issue "${title}" has been submitted.`,
    }).catch(() => {});

    res.status(201).json(issue);
  } catch (error) {
    console.error("CREATE ISSUE ERROR:", error.message, error.stack);
    res.status(500).json({ message: "Failed to create issue", detail: error.message });
  }
};

// ── GET ALL (admin / engineer list) ──────────────────────────────────────────
export const getIssues = async (req, res) => {
  try {
    const { status, category, wardId } = req.query;
    const filter = {};

    if (status)   filter.status   = status;
    if (category) filter.category = category;

    // Guard against invalid wardId crashing the ObjectId cast
    if (wardId) {
      if (isValidObjectId(wardId)) {
        filter.wardId = wardId;
      } else {
        return res.status(400).json({ message: "Invalid wardId" });
      }
    }

    const issues = await Issue.find(filter)
      .sort({ priorityScore: -1, createdAt: -1 })
      .lean(); // plain JS objects — faster and avoids .toObject() issues

    // Batch-fetch all active assignments for these issues in one query
    const issueIds = issues.map((i) => i._id);

    const assignments = await Assignment.find({
      issueId: { $in: issueIds },
      isActive: true,
    })
      .populate("engineerId", "name email")
      .lean();

    // Build a lookup map: issueId string → engineer object
    const assignmentMap = {};
    for (const a of assignments) {
      if (a.issueId && a.engineerId) {
        assignmentMap[a.issueId.toString()] = a.engineerId;
      }
    }

    const issuesWithEngineer = issues.map((issue) => ({
      ...issue,
      assignedEngineer: assignmentMap[issue._id.toString()] || null,
    }));

    res.status(200).json(issuesWithEngineer);
  } catch (error) {
    console.error("GET ISSUES ERROR:", error.message, error.stack);
    res.status(500).json({ message: "Failed to fetch issues", detail: error.message });
  }
};

// ── UPDATE STATUS ─────────────────────────────────────────────────────────────
export const updateIssueStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid issue ID" });
    }

    const allowedTransitions = {
      REPORTED:    ["VERIFIED"],
      VERIFIED:    ["IN_PROGRESS"],
      IN_PROGRESS: ["RESOLVED"],
      RESOLVED:    [],
    };

    const issue = await Issue.findById(id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    if (!allowedTransitions[issue.status]?.includes(status)) {
      return res.status(400).json({
        message: `Invalid transition: ${issue.status} → ${status}`,
      });
    }

    await IssueStatusLog.create({
      issueId:   issue._id,
      fromStatus: issue.status,
      toStatus:   status,
      changedBy:  req.user?.id || null,
    });

    issue.status = status;
    await issue.save();

    // Notifications — never block the response
    createNotification(issue.reportedBy, `Your issue is now ${status}`).catch(() => {});
    sendPushToUser(issue.reportedBy, {
      title: "Issue Update",
      body:  `Your issue "${issue.title}" is now ${status}.`,
    }).catch(() => {});

    res.status(200).json(issue);
  } catch (error) {
    console.error("UPDATE STATUS ERROR:", error.message, error.stack);
    res.status(500).json({ message: "Failed to update status", detail: error.message });
  }
};

// ── STATUS HISTORY ────────────────────────────────────────────────────────────
export const getIssueStatusHistory = async (req, res) => {
  try {
    const history = await IssueStatusLog.find({ issueId: req.params.id })
      .sort({ createdAt: 1 })
      .lean();
    res.status(200).json(history);
  } catch (error) {
    console.error("STATUS HISTORY ERROR:", error.message);
    res.status(500).json({ message: "Failed to fetch history" });
  }
};

// ── MANUAL ASSIGN ─────────────────────────────────────────────────────────────
export const assignEngineer = async (req, res) => {
  try {
    const { id } = req.params;
    const { engineerId } = req.body;

    if (!engineerId) {
      return res.status(400).json({ message: "engineerId required" });
    }
    if (!isValidObjectId(id) || !isValidObjectId(engineerId)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const issue = await Issue.findById(id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    // Deactivate any existing assignment
    await Assignment.updateMany(
      { issueId: id, isActive: true },
      { isActive: false },
    );

    const assignment = await Assignment.create({ issueId: id, engineerId });

    createNotification(engineerId, "New issue has been assigned to you").catch(() => {});
    sendPushToUser(engineerId, {
      title: "New Assignment",
      body:  `Issue "${issue.title}" assigned to you.`,
    }).catch(() => {});

    res.status(201).json(assignment);
  } catch (error) {
    console.error("ASSIGN ENGINEER ERROR:", error.message, error.stack);
    res.status(500).json({ message: "Failed to assign engineer", detail: error.message });
  }
};

// ── GET ENGINEER'S OWN ISSUES ─────────────────────────────────────────────────
export const getIssuesAssignedToEngineer = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (!isValidObjectId(req.user.id)) {
      return res.status(400).json({ message: "Invalid user ID in token" });
    }

    const engineerId = new mongoose.Types.ObjectId(req.user.id);

    const assignments = await Assignment.find({ engineerId, isActive: true }).lean();
    const issueIds    = assignments.map((a) => a.issueId);

    const issues = await Issue.find({ _id: { $in: issueIds } })
      .sort({ priorityScore: -1, createdAt: -1 })
      .lean();

    res.status(200).json(issues);
  } catch (error) {
    console.error("GET ENGINEER ISSUES ERROR:", error.message, error.stack);
    res.status(500).json({ message: "Failed to fetch assigned issues", detail: error.message });
  }
};

// ── GET CITIZEN'S OWN ISSUES ──────────────────────────────────────────────────
export const getMyIssues = async (req, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const issues = await Issue.find({ reportedBy: req.user.id })
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json(issues);
  } catch (error) {
    console.error("GET MY ISSUES ERROR:", error.message, error.stack);
    res.status(500).json({ message: "Failed to fetch your issues", detail: error.message });
  }
};

// ── AUTO ASSIGN ───────────────────────────────────────────────────────────────
export const autoAssign = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid issue ID" });
    }

    // Find the engineer with the least active assignments
    const workload = await Assignment.aggregate([
      { $match: { isActive: true } },
      { $group: { _id: "$engineerId", count: { $sum: 1 } } },
      { $sort: { count: 1 } },
      { $limit: 1 },
    ]);

    if (!workload.length) {
      return res.status(400).json({ message: "No engineers available" });
    }

    const engineerId = workload[0]._id;

    await Assignment.updateMany(
      { issueId: id, isActive: true },
      { isActive: false },
    );

    const assignment = await Assignment.create({ issueId: id, engineerId });

    const issue = await Issue.findById(id).lean();

    createNotification(engineerId, "Issue auto-assigned to you").catch(() => {});
    sendPushToUser(engineerId, {
      title: "Auto Assignment",
      body:  `Issue "${issue?.title ?? "Unknown"}" auto-assigned.`,
    }).catch(() => {});

    res.status(200).json(assignment);
  } catch (error) {
    console.error("AUTO ASSIGN ERROR:", error.message, error.stack);
    res.status(500).json({ message: "Auto assign failed", detail: error.message });
  }
};

// ── UPVOTE ────────────────────────────────────────────────────────────────────
export const upvoteIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const userId  = req.user?.id;

    if (!userId)              return res.status(401).json({ message: "Unauthorized" });
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid issue ID" });

    const issue = await Issue.findById(id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    const alreadyUpvoted = issue.upvotes.some((uid) => uid.toString() === userId);

    if (alreadyUpvoted) {
      issue.upvotes = issue.upvotes.filter((uid) => uid.toString() !== userId);
    } else {
      issue.upvotes.push(userId);
    }

    // Recalculate priority score either way
    issue.priorityScore = issue.severity * 10 + issue.upvotes.length * 2;
    await issue.save();

    res.status(200).json({ upvotes: issue.upvotes.length, upvoted: !alreadyUpvoted });
  } catch (error) {
    console.error("UPVOTE ERROR:", error.message, error.stack);
    res.status(500).json({ message: "Upvote failed", detail: error.message });
  }
};

// ── ADD UPDATE / COMMENT ──────────────────────────────────────────────────────
export const addIssueUpdate = async (req, res) => {
  try {
    const { id }      = req.params;
    const { message } = req.body;
    const userId      = req.user?.id;

    if (!userId)              return res.status(401).json({ message: "Unauthorized" });
    if (!message?.trim())     return res.status(400).json({ message: "Message required" });
    if (!isValidObjectId(id)) return res.status(400).json({ message: "Invalid issue ID" });

    const issue = await Issue.findById(id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    issue.updates.push({
      message:      message.trim(),
      postedBy:     userId,
      postedByName: req.user.name || req.user.email || "Engineer",
    });

    await issue.save();

    const newUpdate = issue.updates[issue.updates.length - 1];

    createNotification(
      issue.reportedBy,
      `Update on "${issue.title}": ${message}`,
    ).catch(() => {});

    sendPushToUser(issue.reportedBy, {
      title: `Update: ${issue.title}`,
      body:  message,
    }).catch(() => {});

    res.status(200).json(newUpdate);
  } catch (error) {
    console.error("ADD UPDATE ERROR:", error.message, error.stack);
    res.status(500).json({ message: "Failed to add update", detail: error.message });
  }
};

// ── GET SINGLE ISSUE ──────────────────────────────────────────────────────────
export const getIssueById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid issue ID" });
    }

    const issue = await Issue.findById(id)
      .populate("updates.postedBy", "name email")
      .lean();

    if (!issue) return res.status(404).json({ message: "Issue not found" });

    const assignment = await Assignment.findOne({
      issueId:  issue._id,
      isActive: true,
    })
      .populate("engineerId", "name email")
      .lean();

    res.status(200).json({
      ...issue,
      assignedEngineer: assignment?.engineerId || null,
    });
  } catch (error) {
    console.error("GET ISSUE BY ID ERROR:", error.message, error.stack);
    res.status(500).json({ message: "Failed to fetch issue", detail: error.message });
  }
};