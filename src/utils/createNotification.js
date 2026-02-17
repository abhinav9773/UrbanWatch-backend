import Notification from "../models/Notification.js";
import { io } from "../server.js";

export const createNotification = async (userId, message) => {
  // Save in DB
  const notification = await Notification.create({
    userId,
    message,
  });

  // Send realtime
  io.to(userId.toString()).emit("notification:new", notification);

  return notification;
};
