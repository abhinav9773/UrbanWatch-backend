import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Ward from "../models/Ward.js";

const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN,
  });
};

// ✅ Helper: detect ward from lat/lng via Nominatim
const detectWardFromCoords = async (lat, lng) => {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      { headers: { "User-Agent": "UrbanWatch/1.0" } },
    );
    const data = await res.json();
    const address = data.address || {};

    const possibleNames = [
      address.suburb,
      address.neighbourhood,
      address.quarter,
      address.city_district,
      address.county,
      address.district,
    ]
      .filter(Boolean)
      .map((n) => n.toLowerCase());

    const wards = await Ward.find();
    for (const ward of wards) {
      const wardName = ward.name.toLowerCase();
      const wardArea = ward.area?.toLowerCase() || "";
      for (const name of possibleNames) {
        if (
          wardName.includes(name) ||
          name.includes(wardName) ||
          wardArea.includes(name) ||
          name.includes(wardArea)
        ) {
          return ward._id;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid credentials" });

    const token = generateToken(user);

    res.status(200).json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        wardId: user.wardId,
      },
      token,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Login failed" });
  }
};

export const register = async (req, res) => {
  try {
    const { name, email, password, role, lat, lng } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields required" });
    }

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "User already exists" });

    const hashed = await bcrypt.hash(password, 10);

    // ✅ Auto-detect ward if coordinates provided
    let wardId = null;
    if (lat && lng) {
      wardId = await detectWardFromCoords(lat, lng);
    }

    const user = await User.create({
      name,
      email,
      passwordHash: hashed,
      role: role || "CITIZEN",
      wardId,
    });

    res.status(201).json({
      message: "Registered successfully",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
        wardId: user.wardId,
      },
    });
  } catch (err) {
    console.error("REGISTER ERROR:", err);
    res.status(500).json({ message: "Registration failed" });
  }
};
