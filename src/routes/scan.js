const express = require("express");
const router = express.Router();
const scanController = require("../controllers/scan.controller");
const auth = require("../middlewares/auth");
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/");
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    },
});

const upload = multer({ storage });

router.post("/analyze", auth, upload.single("image"), scanController.analyzeImage);
router.post("/save", auth, scanController.saveConfirmedScan);
router.get("/daily", auth, scanController.getDailyIntake);
router.get("/history", auth, scanController.getScanHistory);

module.exports = router;
