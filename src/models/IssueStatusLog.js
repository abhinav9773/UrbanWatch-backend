import mongoose from "mongoose";

const issueStatusLogSchema = new mongoose.Schema(
  {
    issueId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Issue",
      required: true,
    },

    fromStatus: {
      type: String,
      enum: ["REPORTED", "IN_PROGRESS", "RESOLVED", "VERIFIED"],
      required: true,
    },

    toStatus: {
      type: String,
      enum: ["REPORTED", "IN_PROGRESS", "RESOLVED", "VERIFIED"],
      required: true,
    },

    changedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const IssueStatusLog = mongoose.model("IssueStatusLog", issueStatusLogSchema);

export default IssueStatusLog;
