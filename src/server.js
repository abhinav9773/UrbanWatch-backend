import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { initSocket } from "./utils/socket.js";
import connectDB from "./config/db.js";
import "./jobs/slaMonitor.js";

import issueRoutes from "./routes/issueRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import pushRoutes from "./routes/pushRoutes.js";
import wardRoutes from "./routes/wardRoutes.js"; // ✅ NEW

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);
initSocket(server);

app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/api/assignments", assignmentRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/push", pushRoutes);
app.use("/api/wards", wardRoutes); // ✅ NEW

app.get("/", (req, res) => res.send("UrbanWatch backend running"));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
