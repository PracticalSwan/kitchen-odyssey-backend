import mongoose from 'mongoose';

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

// Index for per-user lookups ordered by recency
searchHistorySchema.index({ userId: 1, createdAt: -1 });

searchHistorySchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const SearchHistory =
  mongoose.models.SearchHistory ||
  mongoose.model('SearchHistory', searchHistorySchema);

export default SearchHistory;
