import Issue from "../models/Issue.js";
import IssueStatusLog from "../models/IssueStatusLog.js";
import Assignment from "../models/Assignment.js";
import mongoose from "mongoose";
import { createNotification } from "../utils/createNotification.js";
import { sendPushToUser } from "../utils/pushNotification.js";

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

    let hoursToAdd = 72;
    if (severity == 5) hoursToAdd = 24;
    else if (severity == 4) hoursToAdd = 48;
    else if (severity == 3) hoursToAdd = 72;
    else if (severity == 2) hoursToAdd = 96;
    else if (severity == 1) hoursToAdd = 120;

    const dueAt = new Date(Date.now() + hoursToAdd * 60 * 60 * 1000);
    const priorityScore = Number(severity) * 10;
    const photos = req.files ? req.files.map((f) => f.path) : [];

    const issue = await Issue.create({
      title,
      description,
      category,
      severity: Number(severity),
      location,
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
    try {
      await sendPushToUser(reportedBy, {
        title: "Issue Reported",
        body: `Your issue "${title}" has been submitted.`,
      });
    } catch {}

    res.status(201).json(issue);
  } catch (error) {
    console.error("CREATE ISSUE ERROR:", error);
    res.status(500).json({ message: "Failed to create issue" });
  }
};

// ✅ Get issues with assigned engineer populated
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

    // For each issue, find the active assignment and populate engineer
    const issueIds = issues.map((i) => i._id);
    const assignments = await Assignment.find({
      issueId: { $in: issueIds },
      isActive: true,
    }).populate("engineerId", "name email");

    // Map assignments by issueId
    const assignmentMap = {};
    for (const a of assignments) {
      assignmentMap[a.issueId.toString()] = a.engineerId;
    }

    const issuesWithEngineer = issues.map((issue) => ({
      ...issue.toObject(),
      assignedEngineer: assignmentMap[issue._id.toString()] || null,
    }));

    res.status(200).json(issuesWithEngineer);
  } catch (error) {
    console.error("GET ISSUES ERROR:", error);
    res.status(500).json({ message: "Failed to fetch issues" });
  }
};

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
    if (!allowedTransitions[issue.status]?.includes(status)) {
      return res
        .status(400)
        .json({ message: `Invalid transition: ${issue.status} to ${status}` });
    }
    await IssueStatusLog.create({
      issueId: issue._id,
      fromStatus: issue.status,
      toStatus: status,
      changedBy: req.user?.id || null,
    });
    issue.status = status;
    await issue.save();
    await createNotification(
      issue.reportedBy,
      `✅ Your issue is now ${status}`,
    );
    try {
      await sendPushToUser(issue.reportedBy, {
        title: "Issue Update",
        body: `Your issue "${issue.title}" is now ${status}.`,
      });
    } catch {}
    res.status(200).json(issue);
  } catch (error) {
    res.status(500).json({ message: "Failed to update status" });
  }
};

export const getIssueStatusHistory = async (req, res) => {
  try {
    const history = await IssueStatusLog.find({ issueId: req.params.id }).sort({
      createdAt: 1,
    });
    res.status(200).json(history);
  } catch {
    res.status(500).json({ message: "Failed to fetch history" });
  }
};

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
    try {
      await sendPushToUser(engineerId, {
        title: "New Assignment",
        body: `Issue "${issue.title}" assigned to you.`,
      });
    } catch {}
    res.status(201).json(assignment);
  } catch (error) {
    res.status(500).json({ message: "Failed to assign engineer" });
  }
};

export const getIssuesAssignedToEngineer = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    const engineerId = new mongoose.Types.ObjectId(req.user.id);
    const assignments = await Assignment.find({ engineerId, isActive: true });
    const issueIds = assignments.map((a) => a.issueId);
    const issues = await Issue.find({ _id: { $in: issueIds } });
    res.status(200).json(issues);
  } catch {
    res.status(500).json({ message: "Failed to fetch assigned issues" });
  }
};

export const getMyIssues = async (req, res) => {
  try {
    if (!req.user?.id) return res.status(401).json({ message: "Unauthorized" });
    const issues = await Issue.find({ reportedBy: req.user.id }).sort({
      createdAt: -1,
    });
    res.json(issues);
  } catch {
    res.status(500).json({ message: "Failed to fetch your issues" });
  }
};

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
    try {
      await sendPushToUser(engineerId, {
        title: "Auto Assignment",
        body: `Issue "${issue?.title}" auto-assigned.`,
      });
    } catch {}
    res.json(assignment);
  } catch {
    res.status(500).json({ message: "Auto assign failed" });
  }
};

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
      issue.upvotes = issue.upvotes.filter((uid) => uid.toString() !== userId);
    } else {
      issue.upvotes.push(userId);
      issue.priorityScore = issue.severity * 10 + issue.upvotes.length * 2;
    }
    await issue.save();
    res.json({ upvotes: issue.upvotes.length, upvoted: !alreadyUpvoted });
  } catch {
    res.status(500).json({ message: "Upvote failed" });
  }
};

export const addIssueUpdate = async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    const userId = req.user.id;
    if (!message) return res.status(400).json({ message: "Message required" });
    const issue = await Issue.findById(id);
    if (!issue) return res.status(404).json({ message: "Issue not found" });
    issue.updates.push({
      message,
      postedBy: userId,
      postedByName: req.user.name || req.user.email || "Engineer",
    });
    await issue.save();
    await createNotification(
      issue.reportedBy,
      `💬 Update on "${issue.title}": ${message}`,
    );
    try {
      await sendPushToUser(issue.reportedBy, {
        title: `Update: ${issue.title}`,
        body: message,
      });
    } catch {}
    res.json(issue.updates[issue.updates.length - 1]);
  } catch {
    res.status(500).json({ message: "Failed to add update" });
  }
};

export const getIssueById = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id).populate(
      "updates.postedBy",
      "name email",
    );
    if (!issue) return res.status(404).json({ message: "Issue not found" });
    const assignment = await Assignment.findOne({
      issueId: issue._id,
      isActive: true,
    }).populate("engineerId", "name email");
    res.json({
      ...issue.toObject(),
      assignedEngineer: assignment?.engineerId || null,
    });
  } catch {
    res.status(500).json({ message: "Failed to fetch issue" });
  }
};
