import { Server } from "socket.io";

let io;

export const initSocket = (server) => {
  io = new Server(server, {
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
    socket.on("disconnect", () =>
      console.log("Socket disconnected:", socket.id),
    );
  });

  return io;
};

export const getIO = () => io;
