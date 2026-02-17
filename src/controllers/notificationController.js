import Notification from "../models/Notification.js";

// Get My Notifications
export const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      userId: req.user.id,
    }).sort({ createdAt: -1 });

    res.json(notifications);
  } catch (error) {
    res.status(500).json({
      message: "Failed to load notifications",
    });
  }
};

// Mark as Read
export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    await Notification.findByIdAndUpdate(id, {
      isRead: true,
    });

    res.json({ message: "Marked as read" });
  } catch (error) {
    res.status(500).json({
      message: "Update failed",
    });
  }
};
