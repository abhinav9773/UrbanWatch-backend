import express from "express";
import { getAllUsers, createEngineer } from "../controllers/userController.js";

import { protect, adminOnly } from "../middleware/authMiddleware.js";

const router = express.Router();

// Admin: get all users
router.get("/", protect, adminOnly, getAllUsers);

// Admin: create engineer
router.post("/create-engineer", protect, adminOnly, createEngineer);

export default router;
