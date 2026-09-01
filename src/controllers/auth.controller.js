const User = require("../models/user.js");
const { generateToken } = require("../utils/jwt");

// 🔐 Generate Random 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// 🧪 Test number that always receives a fixed OTP (for testing purposes only)
const TEST_PHONE = "9555942520";
const TEST_OTP   = "123456";

// Returns fixed OTP for the test number, random OTP for everyone else
const getOTP = (phone) => {
  if (phone === TEST_PHONE) return TEST_OTP;
  return generateOTP();
};

// ================= REGISTER / LOGIN (Unified) =================
exports.register = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number is required" });
    }

    let user = await User.findOne({ phone });

    if (!user) {
      user = await User.create({ phone });
    }

    // Generate OTP (fixed OTP for test number, random for all others)
    const otp = getOTP(phone);
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // In a real app, send OTP via SMS/Email. 
    // Here, we return it in the response for the app to display.
    res.status(200).json({
      success: true,
      message: "OTP generated successfully",
      otp: otp, // RETURNED FOR TESTING
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= LOGIN (Legacy endpoint, same logic) =================
exports.login = exports.register;

// ================= VERIFY OTP =================
exports.verifyOtp = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const user = await User.findOne({
      phone,
      otp,
      otpExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Clear OTP after verification
    user.otp = undefined;
    user.otpExpires = undefined;
    user.isVerified = true;
    await user.save();

    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= RESEND OTP =================
exports.resendOtp = async (req, res) => {
  try {
    const { phone } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const otp = getOTP(phone); // fixed OTP for test number, random for all others
    user.otp = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    res.status(200).json({
      success: true,
      message: "OTP resent successfully",
      otp: otp,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ================= DELETE ACCOUNT =================
exports.deleteAccount = async (req, res) => {
  try {
    // req.user is set by the auth middleware
    await User.findByIdAndDelete(req.user._id);

    res.status(200).json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};