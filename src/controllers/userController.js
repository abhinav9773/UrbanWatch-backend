import bcrypt from "bcryptjs";
import User from "../models/User.js";

export const createEngineer = async (req, res) => {
  try {
    const { name, email, password, wardId } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const hash = await bcrypt.hash(password, 10);

    const engineer = await User.create({
      name,
      email,
      passwordHash: hash,
      role: "ENGINEER",
      wardId: wardId || null,
    });

    return res.status(201).json({
      message: "Engineer created successfully",
      engineer: {
        id: engineer._id,
        name: engineer.name,
        email: engineer.email,
        role: engineer.role,
        wardId: engineer.wardId,
      },
    });
  } catch (err) {
    console.error("CREATE ENGINEER ERROR:", err);
    return res
      .status(500)
      .json({ message: err.message || "Failed to create engineer" });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const { role } = req.query;
    const filter = role ? { role } : {};
    const users = await User.find(filter)
      .select("-passwordHash")
      .populate("wardId", "name number area");
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ message: "Failed to fetch users" });
  }
};

// ✅ Update engineer's ward
export const updateUserWard = async (req, res) => {
  try {
    const { id } = req.params;
    const { wardId } = req.body;
    const user = await User.findByIdAndUpdate(
      id,
      { wardId },
      { new: true },
    ).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: "Failed to update ward" });
  }
};
