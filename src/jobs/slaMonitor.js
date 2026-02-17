import cron from "node-cron";
import Issue from "../models/Issue.js";
import { createNotification } from "../utils/createNotification.js";

// Runs every 5 minutes
cron.schedule("*/5 * * * *", async () => {
  try {
    console.log("⏱️ SLA Monitor running...");

    const now = new Date();

    const overdueIssues = await Issue.find({
      dueAt: { $lt: now },
      status: { $in: ["REPORTED", "VERIFIED", "IN_PROGRESS"] },
    });

    for (const issue of overdueIssues) {
      // Notify engineer (if assigned)
      if (issue.assignedTo) {
        await createNotification(
          issue.assignedTo,
          `🚨 SLA Breached for issue: ${issue.title}`,
        );
      }

      // Notify admin
      await createNotification(
        "ADMIN",
        `🚨 SLA Breach: ${issue.title} (${issue._id})`,
      );
    }

    if (overdueIssues.length) {
      console.log(`⚠️ ${overdueIssues.length} overdue issues found`);
    }
  } catch (err) {
    console.error("SLA Monitor Error:", err);
  }
});
