import Assignment from "../models/Assignment.js";
import mongoose from "mongoose";
import { io } from "../server.js"; // 🔥 Socket.IO (future-ready)

// ============================
// ASSIGNMENT HISTORY (ADMIN)
// ============================
export const getAssignmentHistory = async (req, res) => {
  try {
    const history = await Assignment.find()
      .populate("issueId", "title status")
      .populate("engineerId", "email")
      .sort({ createdAt: -1 });

    res.json(history);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to fetch history",
    });
  }
};

// ============================
// ENGINEER WORKLOAD (ADMIN)
// ============================
export const getEngineerWorkload = async (req, res) => {
  try {
    const workload = await Assignment.aggregate([
      { $match: { isActive: true } },

      {
        $group: {
          _id: "$engineerId",
          activeCount: { $sum: 1 },
        },
      },

      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "engineer",
        },
      },

      { $unwind: "$engineer" },

      {
        $project: {
          engineerId: "$_id",
          email: "$engineer.email",
          activeCount: 1,
        },
      },
    ]);

    res.json(workload);
  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Failed to load workload",
    });
  }
};
