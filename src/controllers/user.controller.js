const User = require("../models/user");
const Match = require("../models/match");
const Pet = require("../models/pet");
const Message = require("../models/message");

// Update User Profile (Owner Details)
exports.updateProfile = async (req, res) => {
    try {
        const { fullName, email, state, city, age, gender, height, weight, phone } = req.body;
        const userId = req.user.id;

        const updateData = {
            fullName,
            email,
            state,
            city,
            age,
            gender,
            height,
            weight,
            phone
        };

        if (req.file) {
            updateData.profileImage = `/uploads/${req.file.filename}`;
        }

        const user = await User.findByIdAndUpdate(userId, updateData, { new: true });

        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user,
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Get current user profile
exports.getProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.status(200).json({ success: true, user });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

// Get user's matches
exports.getMatches = async (req, res) => {
    try {
        const matches = await Match.find({
            users: req.user._id
        })
            .populate("users", "fullName profileImage")
            .populate("pets", "petName images breed owner")
            .lean(); // Use lean to freely modify the result objects

        // Fetch the last message for each match
        const matchesWithMessages = await Promise.all(matches.map(async (match) => {
            const lastMessage = await Message.findOne({ match: match._id })
                .sort({ createdAt: -1 }) // Get the newest message
                .select("content createdAt sender")
                .lean();

            return {
                ...match,
                lastMessage: lastMessage || null
            };
        }));

        res.status(200).json({ success: true, matches: matchesWithMessages });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
