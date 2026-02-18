// Mongoose model for recipe reviews with ratings and user-per-recipe uniqueness

import mongoose from "mongoose";

// Define schema for recipe reviews
const reviewSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    recipeId: { type: String, required: true, ref: "Recipe" },
    userId: { type: String, required: true, ref: "User" },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2000,
    },
  },
  {
    timestamps: true,
    _id: false,
  },
);

// Create indexes for efficient queries and uniqueness constraint
// Compound unique: one review per user per recipe
reviewSchema.index({ recipeId: 1, userId: 1 }, { unique: true });
reviewSchema.index({ recipeId: 1 });
reviewSchema.index({ userId: 1 });

// Configure JSON output to exclude internal fields
reviewSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

// Create or retrieve model to prevent duplicate registration
const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);

export default Review;
