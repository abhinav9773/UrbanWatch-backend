import webpush from "web-push";
import PushSubscription from "../models/PushSubscription.js";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
);

export const sendPushToUser = async (userId, payload) => {
  try {
    const subscriptions = await PushSubscription.find({ userId });
    const message = JSON.stringify(payload);

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(sub.subscription, message);
      } catch (err) {
        // Remove expired subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    }
  } catch (err) {
    console.error("Push notification error:", err);
  }
};

export default webpush;
