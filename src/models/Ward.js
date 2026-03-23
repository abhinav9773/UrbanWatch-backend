import mongoose from "mongoose";

const wardSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    number: { type: Number, required: true, unique: true },
    area: { type: String, trim: true },
    city: { type: String, default: "Delhi", trim: true },
  },
  { timestamps: true },
);

export default mongoose.model("Ward", wardSchema);
