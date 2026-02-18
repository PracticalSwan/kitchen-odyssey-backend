// Mongoose model for users with authentication, profile, and engagement data

import mongoose from "mongoose";

// Define schema for user accounts
const userSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    firstName: { type: String, required: true, trim: true, maxlength: 50 },
    lastName: { type: String, required: true, trim: true, maxlength: 50 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },
    passwordHash: { type: String, required: true },
    birthday: { type: String, default: null },
    role: {
      type: String,
      enum: ["admin", "user"],
      default: "user",
    },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended", "pending"],
      default: "inactive",
    },
    joinedDate: { type: Date, default: Date.now },
    lastActive: { type: Date, default: null },
    avatarUrl: { type: String, default: null },
    avatarStoragePath: { type: String, default: null },
    avatarThumbnailUrl: { type: String, default: null },
    bio: { type: String, default: "", maxlength: 500 },
    location: { type: String, default: "", maxlength: 100 },
    cookingLevel: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced", "Professional"],
      default: "Beginner",
    },
    favorites: [{ type: String, ref: "Recipe" }],
    viewedRecipes: [{ type: String, ref: "Recipe" }],
    tokenVersion: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    _id: false,
  },
);

// Create indexes for efficient queries
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ joinedDate: -1 });
userSchema.index({ lastActive: -1 });

// Virtual field for full name
userSchema.virtual("fullName").get(function () {
  return `${this.firstName} ${this.lastName}`;
});

// Strip sensitive fields from JSON output
userSchema.set("toJSON", {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.passwordHash;
    delete ret.__v;
    return ret;
  },
});

// Create or retrieve model to prevent duplicate registration
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;
