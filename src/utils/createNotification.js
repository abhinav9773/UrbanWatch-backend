import Notification from "../models/Notification.js";
import { getIO } from "./socket.js";

export const createNotification = async (userId, message) => {
  const notification = await Notification.create({ userId, message });
  const io = getIO();
  if (io) io.to(userId.toString()).emit("notification:new", notification);
  return notification;
};
