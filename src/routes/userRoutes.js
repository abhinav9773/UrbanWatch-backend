import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import {
  createEngineer,
  getAllUsers,
  updateUserWard,
} from "../controllers/userController.js";

const router = express.Router();

router.get("/", protect, getAllUsers);
router.post("/create-engineer", protect, createEngineer);
router.patch("/:id/ward", protect, updateUserWard); // ✅ assign ward to engineer

export default router;
