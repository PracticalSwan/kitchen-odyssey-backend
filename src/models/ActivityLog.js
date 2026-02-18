// Mongoose model for activity log entries with TTL auto-deletion

import mongoose from "mongoose";

// Define schema for activity log entries
const activityLogSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    type: { type: String, required: true, trim: true },
    message: { type: String, default: "", trim: true },
    userId: { type: String, default: null },
    targetId: { type: String, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    time: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
    _id: false,
  },
);

// Create indexes for efficient queries and automatic cleanup
// TTL index: auto-delete logs older than 90 days
activityLogSchema.index({ time: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });
activityLogSchema.index({ userId: 1 });
activityLogSchema.index({ type: 1 });

// Configure JSON output to exclude internal fields
activityLogSchema.set("toJSON", {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

// Create or retrieve model to prevent duplicate registration
const ActivityLog =
  mongoose.models.ActivityLog ||
  mongoose.model("ActivityLog", activityLogSchema);

export default ActivityLog;
