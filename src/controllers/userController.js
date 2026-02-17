import User from "../models/User.js";
import bcrypt from "bcryptjs";

// ============================
// ADMIN → CREATE ENGINEER
// ============================
export const createEngineer = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Validate
    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields required",
      });
    }

    // Check if exists
    const exists = await User.findOne({ email });

    if (exists) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Create engineer
    const engineer = await User.create({
      name,
      email,
      passwordHash: hash,
      role: "ENGINEER",
    });

    res.status(201).json({
      message: "Engineer created successfully",
      engineer: {
        id: engineer._id,
        name: engineer.name,
        email: engineer.email,
        role: engineer.role,
      },
    });
  } catch (err) {
    console.error("CREATE ENGINEER ERROR:", err);

    res.status(500).json({
      message: "Failed to create engineer",
    });
  }
};

// ============================
// GET ALL USERS (ADMIN)
// ============================
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-passwordHash");

    res.json(users);
  } catch {
    res.status(500).json({
      message: "Failed to fetch users",
    });
  }
};
