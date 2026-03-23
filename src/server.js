import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import connectDB from "./config/db.js"; // ← removed ./src/
import "./jobs/slaMonitor.js"; // ← removed ./src/

import issueRoutes from "./routes/issueRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import pushRoutes from "./routes/pushRoutes.js";

dotenv.config();
connectDB();

const app = express();
const server = http.createServer(app);

export const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "https://urban-watch-frontend.vercel.app",
      "https://urban-watch-frontend-99hv4w9yt.vercel.app",
    ],
    methods: ["GET", "POST", "PATCH"],
    credentials: true,
  },
});

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);
  socket.on("join", ({ userId, role }) => {
    socket.join(userId);
    socket.join(role);
    console.log("User joined:", userId, role);
  });
  socket.on("disconnect", () => console.log("Socket disconnected:", socket.id));
});

app.use(cors({ origin: "*" }));
app.use(express.json());

app.use("/api/assignments", assignmentRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/push", pushRoutes);

app.get("/", (req, res) => res.send("UrbanWatch backend running"));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
