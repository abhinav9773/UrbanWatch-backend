import mongoose from "mongoose";

const updateSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    postedByName: { type: String },
  },
  { timestamps: true },
);

const issueSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },

    category: {
      type: String,
      enum: ["ROAD", "WATER", "LIGHTING", "SANITATION", "OTHER"],
      required: true,
    },

    severity: { type: Number, min: 1, max: 5, required: true },

    status: {
      type: String,
      enum: ["REPORTED", "IN_PROGRESS", "RESOLVED", "VERIFIED"],
      default: "REPORTED",
    },

    location: {
      type: { type: String, enum: ["Point"], required: true },
      coordinates: { type: [Number], required: true }, // [lng, lat]
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

    priorityScore: { type: Number, default: 0 },
    dueAt: { type: Date },

    // ✅ NEW: Photo URLs from Cloudinary
    photos: [{ type: String }],

    // ✅ NEW: Upvotes — array of user IDs who upvoted
    upvotes: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

    // ✅ NEW: Engineer progress updates
    updates: [updateSchema],
  },
  { timestamps: true },
);

issueSchema.index({ location: "2dsphere" });

export default mongoose.model("Issue", issueSchema);
