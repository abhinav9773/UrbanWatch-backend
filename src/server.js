import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import notificationRoutes from "./routes/notificationRoutes.js";
import connectDB from "./config/db.js";
import "./jobs/slaMonitor.js";
import issueRoutes from "./routes/issueRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import assignmentRoutes from "./routes/assignmentRoutes.js";
import statsRoutes from "./routes/statsRoutes.js";

dotenv.config();
connectDB();

const app = express();

// 🔥 Create HTTP server
const server = http.createServer(app);

// 🔥 Setup Socket.IO
export const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST", "PATCH"],
    credentials: true,
  },
});

// Socket connection
io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join", ({ userId, role }) => {
    socket.join(userId);
    socket.join(role);

    console.log("User joined:", userId, role);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});

// Middleware
app.use(
  cors({
    origin: "*", // later restrict to frontend url
  }),
);
app.use(express.json());

// Routes
app.use("/api/assignments", assignmentRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/issues", issueRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.get("/", (req, res) => {
  res.send("UrbanWatch backend running");
});

// 🔥 IMPORTANT: use server.listen, NOT app.listen
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
