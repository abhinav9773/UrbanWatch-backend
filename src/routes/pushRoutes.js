import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import PushSubscription from "../models/PushSubscription.js";
import webpush from "../utils/pushNotification.js";

const router = express.Router();

// Get VAPID public key (frontend needs this)
router.get("/vapid-key", (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// Save push subscription
router.post("/subscribe", protect, async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;

    // Upsert — avoid duplicates
    await PushSubscription.findOneAndUpdate(
      { userId, "subscription.endpoint": subscription.endpoint },
      { userId, subscription },
      { upsert: true, new: true },
    );

    res.json({ message: "Subscribed to push notifications" });
  } catch (err) {
    console.error("PUSH SUBSCRIBE ERROR:", err);
    res.status(500).json({ message: "Subscription failed" });
  }
});

// Unsubscribe
router.post("/unsubscribe", protect, async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.deleteOne({
      userId: req.user.id,
      "subscription.endpoint": endpoint,
    });
    res.json({ message: "Unsubscribed" });
  } catch (err) {
    res.status(500).json({ message: "Unsubscribe failed" });
  }
});

export default router;
