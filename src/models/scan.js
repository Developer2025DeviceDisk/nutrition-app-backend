const mongoose = require("mongoose");

const scanSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    image: {
      type: String,
      required: true,
    },
    foodName: {
      type: String,
      default: "Scanned Meal",
    },
    items: [
      {
        name: String,
        quantity: Number,
        nutrition: {
          calories: Number,
          protein: Number,
          carbs: Number,
          fat: Number,
        }
      }
    ],
    nutrition: {
        calories: { type: Number, default: 0 },
        protein: { type: Number, default: 0 },
        carbs: { type: Number, default: 0 },
        fat: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Scan", scanSchema);
