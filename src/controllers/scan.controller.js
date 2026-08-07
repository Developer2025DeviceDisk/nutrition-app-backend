const Scan = require("../models/scan");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const fs = require("fs");
const path = require("path");

// Initialize Gemini AI client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Converts a local file to a Gemini-compatible inlineData part.
 */
function fileToGenerativePart(filePath, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(filePath)).toString("base64"),
            mimeType,
        },
    };
}

/**
 * Determines MIME type from file extension.
 */
function getMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".gif": "image/gif",
        ".heic": "image/heic",
        ".heif": "image/heif",
    };
    return mimeTypes[ext] || "image/jpeg";
}

exports.analyzeImage = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Image is required" });
        }

        const filePath = req.file.path;
        const mimeType = getMimeType(filePath);

        // Initialize Gemini 3.5 Flash model
        const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

        const prompt = `You are a professional nutritionist and food analyst. Analyze this food image carefully.

Identify ALL visible food items in the image. For each food item, provide accurate nutritional information based on the estimated portion/serving size you can see.

Return ONLY a valid JSON object (no markdown, no explanation, no code blocks) in this exact format:
{
  "items": [
    {
      "name": "Food Item Name",
      "quantity": 1,
      "servingSize": "1 piece / 100g / 1 cup (describe the serving)",
      "nutrition": {
        "calories": 250,
        "protein": 8,
        "carbs": 35,
        "fat": 7,
        "fiber": 2,
        "sugar": 5,
        "sodium": 120
      }
    }
  ]
}

Rules:
- "quantity" should be the number of visible units (e.g., 2 rotis, 1 bowl of dal)
- Nutrition values should be for ONE unit (one serving) of that item
- Be realistic and accurate — use standard Indian/international nutrition databases
- If you see a full plate meal, list each component separately
- If you cannot identify food clearly, make your best estimation
- All numeric values should be integers or floats (no strings)
- Return ONLY the JSON, nothing else`;

        const imagePart = fileToGenerativePart(filePath, mimeType);

        const result = await model.generateContent([prompt, imagePart]);
        const responseText = result.response.text().trim();

        // Parse the JSON response from Gemini
        let parsedData;
        try {
            // Strip any accidental markdown code blocks if Gemini wraps it
            const cleanJson = responseText
                .replace(/^```json\s*/i, "")
                .replace(/^```\s*/i, "")
                .replace(/\s*```$/i, "")
                .trim();

            parsedData = JSON.parse(cleanJson);
        } catch (parseError) {
            console.error("Gemini JSON parse error:", parseError.message);
            console.error("Raw Gemini response:", responseText);
            return res.status(500).json({
                success: false,
                message: "Failed to parse food analysis results. Please try a clearer image.",
            });
        }

        const items = parsedData.items || [];

        if (items.length === 0) {
            return res.status(200).json({
                success: false,
                message: "No food items detected in the image. Please try a clearer photo of your food.",
            });
        }

        // Ensure all items have the correct structure
        const validatedItems = items.map((item) => ({
            name: item.name || "Unknown Food",
            quantity: item.quantity || 1,
            servingSize: item.servingSize || "1 serving",
            nutrition: {
                calories: Math.round(item.nutrition?.calories || 0),
                protein: parseFloat((item.nutrition?.protein || 0).toFixed(1)),
                carbs: parseFloat((item.nutrition?.carbs || 0).toFixed(1)),
                fat: parseFloat((item.nutrition?.fat || 0).toFixed(1)),
                fiber: parseFloat((item.nutrition?.fiber || 0).toFixed(1)),
                sugar: parseFloat((item.nutrition?.sugar || 0).toFixed(1)),
                sodium: Math.round(item.nutrition?.sodium || 0),
            },
        }));

        res.status(200).json({
            success: true,
            message: "Image analyzed successfully",
            imagePath: `/uploads/${req.file.filename}`,
            items: validatedItems,
        });
    } catch (error) {
        console.error("Gemini Analysis Error:", error.message);

        // Handle specific Gemini API errors
        if (error.message?.includes("API_KEY_INVALID") || error.message?.includes("API key")) {
            return res.status(500).json({
                success: false,
                message: "Invalid Gemini API key. Please check your configuration.",
            });
        }

        if (error.message?.includes("quota") || error.message?.includes("RESOURCE_EXHAUSTED")) {
            return res.status(429).json({
                success: false,
                message: "API quota exceeded. Please try again later.",
            });
        }

        res.status(500).json({ success: false, message: error.message });
    }
};

exports.saveConfirmedScan = async (req, res) => {
    try {
        const userId = req.user.id;
        const { image, items } = req.body;

        if (!image || !items || !Array.isArray(items)) {
            return res.status(400).json({ success: false, message: "Invalid data" });
        }

        // Calculate total nutrition (quantity × per-unit nutrition)
        let totalCalories = 0,
            totalProtein = 0,
            totalCarbs = 0,
            totalFat = 0,
            totalFiber = 0;

        items.forEach((item) => {
            const q = item.quantity || 1;
            totalCalories += (item.nutrition?.calories || 0) * q;
            totalProtein += (item.nutrition?.protein || 0) * q;
            totalCarbs += (item.nutrition?.carbs || 0) * q;
            totalFat += (item.nutrition?.fat || 0) * q;
            totalFiber += (item.nutrition?.fiber || 0) * q;
        });

        const scan = new Scan({
            user: userId,
            image: image,
            foodName: items.map((i) => i.name).join(", ") || "Scanned Meal",
            items: items,
            nutrition: {
                calories: Math.round(totalCalories),
                protein: parseFloat(totalProtein.toFixed(1)),
                carbs: parseFloat(totalCarbs.toFixed(1)),
                fat: parseFloat(totalFat.toFixed(1)),
                fiber: parseFloat(totalFiber.toFixed(1)),
            },
        });

        await scan.save();

        res.status(201).json({
            success: true,
            message: "Scan saved successfully",
            scan,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getDailyIntake = async (req, res) => {
    try {
        const userId = req.user.id;

        // Get start and end of today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);

        const scans = await Scan.find({
            user: userId,
            createdAt: { $gte: startOfDay, $lte: endOfDay },
        });

        let dailyCalories = 0,
            dailyProtein = 0,
            dailyCarbs = 0,
            dailyFat = 0,
            dailyFiber = 0;

        scans.forEach((scan) => {
            dailyCalories += scan.nutrition?.calories || 0;
            dailyProtein += scan.nutrition?.protein || 0;
            dailyCarbs += scan.nutrition?.carbs || 0;
            dailyFat += scan.nutrition?.fat || 0;
            dailyFiber += scan.nutrition?.fiber || 0;
        });

        res.status(200).json({
            success: true,
            totals: {
                calories: Math.round(dailyCalories),
                protein: parseFloat(dailyProtein.toFixed(1)),
                carbs: parseFloat(dailyCarbs.toFixed(1)),
                fat: parseFloat(dailyFat.toFixed(1)),
                fiber: parseFloat(dailyFiber.toFixed(1)),
            },
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getScanHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const scans = await Scan.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(8);

        res.status(200).json({
            success: true,
            scans,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
