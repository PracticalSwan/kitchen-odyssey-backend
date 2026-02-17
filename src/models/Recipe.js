import mongoose from 'mongoose';

const ingredientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: String, required: true, trim: true },
    unit: { type: String, default: '', trim: true },
  },
  { _id: false }
);

const recipeSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    prepTime: { type: Number, required: true, min: 0 },
    cookTime: { type: Number, required: true, min: 0 },
    servings: { type: Number, required: true, min: 1 },
    difficulty: {
      type: String,
      enum: ['Easy', 'Medium', 'Hard'],
      required: true,
    },
    ingredients: {
      type: [ingredientSchema],
      validate: {
        validator: (v) => v.length > 0,
        message: 'At least one ingredient is required',
      },
    },
    instructions: {
      type: [String],
      validate: {
        validator: (v) => v.length > 0,
        message: 'At least one instruction step is required',
      },
    },
    images: [{ type: String }],
    imageUrl: { type: String, default: null },
    imageStoragePath: { type: String, default: null },
    imageThumbnailUrl: { type: String, default: null },
    imageAltText: { type: String, default: null },
    authorId: { type: String, required: true, ref: 'User' },
    status: {
      type: String,
      enum: ['published', 'pending', 'rejected', 'draft'],
      default: 'pending',
    },
    likedBy: [{ type: String, ref: 'User' }],
    viewedBy: [{ type: String, ref: 'User' }],
  },
  {
    timestamps: true,
    _id: false,
  }
);

// Indexes
recipeSchema.index({ authorId: 1 });
recipeSchema.index({ status: 1 });
recipeSchema.index({ category: 1 });
recipeSchema.index({ createdAt: -1 });
recipeSchema.index({ title: 'text', description: 'text' });

// Virtual for like count
recipeSchema.virtual('likeCount').get(function () {
  return this.likedBy?.length || 0;
});

// Virtual for view count
recipeSchema.virtual('viewCount').get(function () {
  return this.viewedBy?.length || 0;
});

recipeSchema.set('toJSON', {
  virtuals: true,
  transform(_doc, ret) {
    delete ret.__v;
    return ret;
  },
});

const Recipe = mongoose.models.Recipe || mongoose.model('Recipe', recipeSchema);

export default Recipe;
