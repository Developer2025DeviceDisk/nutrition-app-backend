const express = require("express");
const router = express.Router();

const authRouter = require("./auth");
const userRouter = require("./user");
const petRouter = require("./pet");
const chatRouter = require("./chat");
const scanRouter = require("./scan");

// Mount routes
router.use("/auth", authRouter);
router.use("/user", userRouter);
router.use("/pet", petRouter);
router.use("/chat", chatRouter);
router.use("/scan", scanRouter);

module.exports = router;