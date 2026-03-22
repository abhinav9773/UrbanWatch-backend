import Issue from "../models/Issue.js";
import IssueStatusLog from "../models/IssueStatusLog.js";
import Assignment from "../models/Assignment.js";
import mongoose from "mongoose";
import { createNotification } from "../utils/createNotification.js";
import { sendPushToUser } from "../utils/pushNotification.js";

// ============================
// CREATE ISSUE (with photos)
// ============================
export const createIssue = async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      severity,
      location,
      wardId,
      reportedBy,
    } = req.body;

    if (!title || !category || !severity || !location || !reportedBy) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    let hoursToAdd = 72;
    if (severity == 5) hoursToAdd = 24;
    else if (severity == 4) hoursToAdd = 48;
    else if (severity == 3) hoursToAdd = 72;
    else if (severity == 2) hoursToAdd = 96;
    else if (severity == 1) hoursToAdd = 120;

    const dueAt = new Date(Date.now() + hoursToAdd * 60 * 60 * 1000);
    const priorityScore = severity * 10;

    // ✅ Handle uploaded photos from Cloudinary
    const photos = req.files ? req.files.map((f) => f.path) : [];

    // Parse location if it came as a string (multipart form)
    let parsedLocation = location;
    if (typeof location === "string") {
      parsedLocation = JSON.parse(location);
    }

    const issue = await Issue.create({
      title,
      description,
      category,
      severity,
      location: parsedLocation,
      wardId,
      reportedBy,
      priorityScore,
      dueAt,
      photos,
    });

    await createNotification(
      reportedBy,
      "📌 Your issue has been successfully reported",
    );
    await sendPushToUser(reportedBy, {
      title: "Issue Reported",
      body: `Your issue "${title}" has been submitted.`,
    });

    res.status(201).json(issue);
  } catch (error) {
    console.error("CREATE ISSUE ERROR:", error);
    res.status(500).json({ message: "Failed to create issue" });
  }
};

// ============================
// GET ISSUES (with ward filter)
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
    res.status(500).json({ message: "Failed to fetch issues" });
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
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    const currentStatus = issue.status;
    if (!allowedTransitions[currentStatus]?.includes(status)) {
      return res
        .status(400)
        .json({ message: `Invalid transition: ${currentStatus} → ${status}` });
    }

    await IssueStatusLog.create({
      issueId: issue._id,
      fromStatus: currentStatus,
      toStatus: status,
      changedBy: req.user?.id || null,
    });

    issue.status = status;
    await issue.save();

    await createNotification(
      issue.reportedBy,
      `✅ Your issue is now ${status}`,
    );
    await sendPushToUser(issue.reportedBy, {
      title: "Issue Update",
      body: `Your issue "${issue.title}" is now ${status}.`,
    });

    res.status(200).json(issue);
  } catch (error) {
    console.error("UPDATE STATUS ERROR:", error);
    res.status(500).json({ message: "Failed to update status" });
  }
};

// ============================
// STATUS HISTORY
// ============================
export const getIssueStatusHistory = async (req, res) => {
  try {
    const history = await IssueStatusLog.find({ issueId: req.params.id }).sort({
      createdAt: 1,
    });
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch history" });
  }
};

// ============================
// ASSIGN ENGINEER
// ============================
export const assignEngineer = async (req, res) => {
  try {
    const { id } = req.params;
    const { engineerId } = req.body;

    if (!engineerId)
      return res.status(400).json({ message: "engineerId required" });

    const issue = await Issue.findById(id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    await Assignment.updateMany(
      { issueId: id, isActive: true },
      { isActive: false },
    );
    const assignment = await Assignment.create({ issueId: id, engineerId });

    await createNotification(
      engineerId,
      "🛠️ New issue has been assigned to you",
    );
    await sendPushToUser(engineerId, {
      title: "New Assignment",
      body: `Issue "${issue.title}" has been assigned to you.`,
    });

    res.status(201).json(assignment);
  } catch (error) {
    console.error("ASSIGN ERROR:", error);
    res.status(500).json({ message: "Failed to assign engineer" });
  }
};

// ============================
// ENGINEER DASHBOARD
// ============================
export const getIssuesAssignedToEngineer = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });

    const engineerId = new mongoose.Types.ObjectId(req.user.id);
    const assignments = await Assignment.find({ engineerId, isActive: true });
    const issueIds = assignments.map((a) => a.issueId);
    const issues = await Issue.find({ _id: { $in: issueIds } });

    res.status(200).json(issues);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch assigned issues" });
  }
};

// ============================
// CITIZEN DASHBOARD
// ============================
export const getMyIssues = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    const issues = await Issue.find({ reportedBy: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(issues);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch your issues" });
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
      { $group: { _id: "$engineerId", count: { $sum: 1 } } },
      { $sort: { count: 1 } },
      { $limit: 1 },
    ]);

    if (!workload.length)
      return res.status(400).json({ message: "No engineers available" });

    const engineerId = workload[0]._id;
    await Assignment.updateMany(
      { issueId: id, isActive: true },
      { isActive: false },
    );
    const assignment = await Assignment.create({ issueId: id, engineerId });

    const issue = await Issue.findById(id);
    await createNotification(engineerId, "🤖 Issue auto-assigned to you");
    await sendPushToUser(engineerId, {
      title: "Auto Assignment",
      body: `Issue "${issue?.title}" has been auto-assigned to you.`,
    });

    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: "Auto assign failed" });
  }
};

// ============================
// ✅ UPVOTE ISSUE
// ============================
export const upvoteIssue = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const issue = await Issue.findById(id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    const alreadyUpvoted = issue.upvotes.some(
      (uid) => uid.toString() === userId,
    );

    if (alreadyUpvoted) {
      // Toggle off
      issue.upvotes = issue.upvotes.filter((uid) => uid.toString() !== userId);
    } else {
      issue.upvotes.push(userId);
      // Bump priority if upvotes are high
      issue.priorityScore = issue.severity * 10 + issue.upvotes.length * 2;
    }

    await issue.save();
    res.json({ upvotes: issue.upvotes.length, upvoted: !alreadyUpvoted });
  } catch (error) {
    console.error("UPVOTE ERROR:", error);
    res.status(500).json({ message: "Upvote failed" });
  }
};

// ============================
// ✅ ADD UPDATE / COMMENT
// ============================
export const addIssueUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user.id;

    if (!message) return res.status(400).json({ message: "Message required" });

    const issue = await Issue.findById(id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });

    const update = {
      message,
      postedBy: userId,
      postedByName: req.user.name || req.user.email || "Engineer",
    };

    issue.updates.push(update);
    await issue.save();

    // Notify the citizen who reported this
    await createNotification(
      issue.reportedBy,
      `💬 Update on your issue "${issue.title}": ${message}`,
    );
    await sendPushToUser(issue.reportedBy, {
      title: `Update: ${issue.title}`,
      body: message,
    });

    res.json(issue.updates[issue.updates.length - 1]);
  } catch (error) {
    console.error("ADD UPDATE ERROR:", error);
    res.status(500).json({ message: "Failed to add update" });
  }
};

// ============================
// ✅ GET SINGLE ISSUE (with updates)
// ============================
export const getIssueById = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id).populate(
      "updates.postedBy",
      "name email",
    );
    if (!issue) return res.status(404).json({ message: "Issue not found" });
    res.json(issue);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch issue" });
  }
};
