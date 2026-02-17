import mongoose from "mongoose";

const issueSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    category: {
      type: String,
      enum: ["ROAD", "WATER", "LIGHTING", "SANITATION", "OTHER"],
      required: true,
    },

    severity: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },

    status: {
      type: String,
      enum: ["REPORTED", "IN_PROGRESS", "RESOLVED", "VERIFIED"],
      default: "REPORTED",
    },

    location: {
      type: {
        type: String,
        enum: ["Point"],
        required: true,
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    wardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ward",
      required: false,
    },

    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    priorityScore: {
      type: Number,
      default: 0,
    },
    dueAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  },
);

// 🔥 Geo index (VERY IMPORTANT)
issueSchema.index({ location: "2dsphere" });

const Issue = mongoose.model("Issue", issueSchema);

export default Issue;
