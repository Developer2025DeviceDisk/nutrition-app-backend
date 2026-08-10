require("dotenv").config();
const mongoose = require("mongoose");
const express = require("express");
const cors = require("cors");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./src/config/db.js");
const indexRouter = require("./src/routes/index");
const Message = require("./src/models/message");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/ping", (req, res) => {
  res.status(200).json({ message: "ping" });
});

connectDB();
app.use("/api", indexRouter);

// Socket.io Connection
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  socket.on("join_room", (matchId) => {
    socket.join(matchId);
    console.log(`User ${socket.id} joined room ${matchId}`);
  });

  socket.on("send_message", async (data) => {
    try {
      // data: { matchId, senderId, content, mediaUrl?, mediaType? }
      const { matchId, senderId, content, mediaUrl, mediaType } = data;

      // Save message to database
      const newMessage = new Message({
        match: matchId,
        sender: senderId,
        content: content || "",
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
      });
      await newMessage.save();

      // Broadcast with saved message data (includes timestamps)
      io.to(matchId).emit("receive_message", {
        _id: newMessage._id,
        matchId: matchId,
        senderId: senderId,
        content: content || "",
        mediaUrl: mediaUrl || null,
        mediaType: mediaType || null,
        clientId: data.clientId,
        createdAt: newMessage.createdAt,
      });
    } catch (error) {
      console.error("Error saving message:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);
