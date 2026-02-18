// Mongoose model for user search query history with per-user cap

import mongoose from 'mongoose';

// Define schema for search history entries
const searchHistorySchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    userId: { type: String, required: true },
    query: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
  },
  {
    timestamps: true,
    _id: false,
  }
);

// Create index for per-user lookups ordered by recency
searchHistorySchema.index({ userId: 1, createdAt: -1 });

// Configure JSON output to exclude internal fields
searchHistorySchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

// Create or retrieve model to prevent duplicate registration
const SearchHistory =
  mongoose.models.SearchHistory ||
  mongoose.model('SearchHistory', searchHistorySchema);

export default SearchHistory;
