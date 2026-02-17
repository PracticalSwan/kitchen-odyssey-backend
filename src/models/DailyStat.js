import mongoose from 'mongoose';

const viewEntrySchema = new mongoose.Schema(
  {
    viewerKey: { type: String, required: true },
    viewerType: { type: String, enum: ['user', 'guest'], default: 'user' },
    recipeId: { type: String, required: true },
    viewedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const dailyStatSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // YYYY-MM-DD date key
    newUsers: [{ type: String }],
    newContributors: [{ type: String }],
    activeUsers: [{ type: String }],
    views: [viewEntrySchema],
  },
  {
    timestamps: true,
    _id: false,
  }
);

dailyStatSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const DailyStat =
  mongoose.models.DailyStat || mongoose.model('DailyStat', dailyStatSchema);

export default DailyStat;
