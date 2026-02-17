import Issue from "../models/Issue.js";

export const getStats = async (req, res) => {
  try {
    const total = await Issue.countDocuments();

    const resolved = await Issue.countDocuments({
      status: "RESOLVED",
    });

    const inProgress = await Issue.countDocuments({
      status: "IN_PROGRESS",
    });

    const byCategory = await Issue.aggregate([
      {
        $group: {
          _id: "$category",
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({
      total,
      resolved,
      inProgress,
      byCategory,
    });
  } catch {
    res.status(500).json({ message: "Stats failed" });
  }
};
