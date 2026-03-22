import bcrypt from "bcryptjs";
import User from "../models/User.js";

/* ============================
   CREATE ENGINEER (ADMIN)
============================ */
export const createEngineer = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        message: "All fields required",
      });
    }

    const exists = await User.findOne({ email });

    if (exists) {
      return res.status(400).json({
        message: "User already exists",
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const engineer = await User.create({
      name,
      email,
      password: hash,
      role: "ENGINEER",
    });

    return res.status(201).json({
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

    return res.status(500).json({
      message: err.message || "Failed to create engineer",
    });
  }
};

/* ============================
   GET ALL USERS (ADMIN)
============================ */
export const getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");

    return res.json(users);
  } catch (err) {
    console.error("GET USERS ERROR:", err);

    return res.status(500).json({
      message: "Failed to fetch users",
    });
  }
};
