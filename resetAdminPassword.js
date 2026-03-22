import bcryptjs from "bcryptjs";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

const db = mongoose.connection.db;
const newPassword = "Admin@1234";
const hashed = await bcryptjs.hash(newPassword, 10);

await db
  .collection("users")
  .updateOne({ role: "ADMIN" }, { $set: { passwordHash: hashed } });

const admin = await db.collection("users").findOne({ role: "ADMIN" });
console.log("✅ Admin password reset to:", newPassword);
console.log("Admin email:", admin?.email);

await mongoose.disconnect();
// ```

// Run it and you should see:
// ```
// ✅ Admin password reset to: Admin@1234
// Admin email: admin@test.com
