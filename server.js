import express from "express";
import "dotenv/config";
import cors from "cors";
import http from "http";
import helmet from "helmet";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { connectDB } from "./lib/db.js";
import userRouter from "./routes/userRoutes.js";
import oauthRouter from "./routes/oauthRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import { Server } from "socket.io";
import path from "path";
import { setIO } from "./lib/socketIO.js";
import { clearAuthCookie, setAuthCookie } from "./lib/utils.js";
import jwt from "jsonwebtoken";

const app = express();
const server = http.createServer(app);

const cleanOrigin = (origin) =>
  typeof origin === "string" ? origin.replace(/\/+$/, "").trim() : origin;

const rawOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(",").map((o) => cleanOrigin(o))
  : [
      process.env.FRONTEND_URL,
      process.env.OAUTH_SUCCESS_REDIRECT,
      "http://localhost:5173",
      "http://localhost:3000",
    ]
      .filter(Boolean)
      .map((o) => cleanOrigin(o));

const corsOrigins = rawOrigins.length > 0 ? Array.from(new Set(rawOrigins)) : true;

const socketOrigins = process.env.SOCKET_ORIGINS
  ? process.env.SOCKET_ORIGINS.split(",").map((origin) => cleanOrigin(origin))
  : corsOrigins;

export const io = new Server(server, {
  cors: {
    origin: socketOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  },
});

setIO(io);

export const userSocketMap = {};
const emitOnlineUsers = () => {
  io.emit("getOnlineUsers", Object.keys(userSocketMap));
};

io.on("connection", (socket) => {
  const userId = socket.handshake.query.userId;
  if (userId) {
    userSocketMap[userId] = socket.id;
    socket.join(userId.toString());
    emitOnlineUsers();
  }

  socket.on("call:request", ({ to, type, callerName }) => {
    const toSocketId = userSocketMap[to];
    if (toSocketId) {
      io.to(toSocketId).emit("call:incoming", {
        from: userId,
        type: type || "video",
        callerName: callerName || "Someone",
      });
    }
  });

  socket.on("call:accept", ({ to }) => {
    const toSocketId = userSocketMap[to];
    if (toSocketId) io.to(toSocketId).emit("call:accepted", { from: userId });
  });

  socket.on("call:reject", ({ to }) => {
    const toSocketId = userSocketMap[to];
    if (toSocketId) io.to(toSocketId).emit("call:rejected");
  });

  socket.on("call:end", ({ to }) => {
    const toSocketId = userSocketMap[to];
    if (toSocketId) io.to(toSocketId).emit("call:ended");
  });

  socket.on("webrtc:signal", ({ to, signal }) => {
    const toSocketId = userSocketMap[to];
    if (toSocketId)
      io.to(toSocketId).emit("webrtc:signal", { from: userId, signal });
  });

  socket.on("disconnect", () => {
    if (userId) {
      delete userSocketMap[userId];
      emitOnlineUsers();
    }
  });
});

const parseCookies = (cookieHeader) => {
  const cookies = {};
  if (!cookieHeader) return cookies;
  cookieHeader.split(";").forEach((pair) => {
    const [name, ...rest] = pair.trim().split("=");
    if (name) {
      try {
        cookies[name.trim()] = decodeURIComponent(rest.join("="));
      } catch {
        cookies[name.trim()] = rest.join("=");
      }
    }
  });
  return cookies;
};

app.use(cors({ origin: corsOrigins, credentials: true }));
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
}));
app.use(compression({ level: 6, threshold: "1kb" }));
app.use(express.json({ limit: "4mb" }));
app.use((req, res, next) => {
  req.cookies = parseCookies(req.headers.cookie);
  next();
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
app.use("/api/", apiLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/signup", authLimiter);
app.use("/api/auth/forgot-password", authLimiter);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), {
  maxAge: "7d",
  immutable: true,
}));

app.get("/", (req, res) => {
  res.send("API is running...");
});

app.use("/api/status", (req, res) => res.send("Server is live"));

app.post("/api/auth/migrate-token", (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token) {
      return res.json({ success: false, message: "No token provided" });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.userId) {
      return res.json({ success: false, message: "Invalid token" });
    }
    setAuthCookie(res, token);
    return res.json({ success: true });
  } catch (err) {
    clearAuthCookie(res);
    return res.json({ success: false, message: err.message || "Migration failed" });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: "Logged out" });
});

app.use("/api/auth", userRouter);
app.use("/api/auth", oauthRouter);
app.use("/api/messages", messageRouter);

// Connect to MongoDB
await connectDB();

const isVercelRuntime =
  process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);

if (!isVercelRuntime) {
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () =>
    console.log("🚀 Server is running on PORT: " + PORT),
  );
}

// Export server for Vercel
export default server;
