import cron from "node-cron";
import Issue from "../models/Issue.js";
import User from "../models/User.js";
import { createNotification } from "../utils/createNotification.js";

cron.schedule("*/5 * * * *", async () => {
  try {
    console.log("⏱️ SLA Monitor running...");

    const now = new Date();
    const admin = await User.findOne({ role: "admin" });

    const overdueIssues = await Issue.find({
      dueAt: { $lt: now },
      status: { $in: ["REPORTED", "VERIFIED", "IN_PROGRESS"] },
    });

    for (const issue of overdueIssues) {
      if (issue.assignedTo) {
        await createNotification(
          issue.assignedTo,
          `🚨 SLA Breached for issue: ${issue.title}`,
        );
      }

      if (admin) {
        await createNotification(
          admin._id,
          `🚨 SLA Breach: ${issue.title} (${issue._id})`,
        );
      }
    }

    if (overdueIssues.length) {
      console.log(`⚠️ ${overdueIssues.length} overdue issues found`);
    }
  } catch (err) {
    console.error("SLA Monitor Error:", err);
  }
});
