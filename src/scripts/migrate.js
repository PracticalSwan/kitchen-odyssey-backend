/**
 * Migration utility: imports localStorage JSON snapshot into MongoDB.
 *
 * Usage:
 *   node src/scripts/migrate.js --file=snapshot.json           # dry-run by default
 *   node src/scripts/migrate.js --file=snapshot.json --commit  # actually write to DB
 *
 * The snapshot.json file should be a JSON object with keys matching
 * the localStorage keys: kitchen_odyssey_users, kitchen_odyssey_recipes, etc.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from '../lib/config.js';
import { User, Recipe, Review, SearchHistory, DailyStat, ActivityLog } from '../models/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── CLI args ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith('--file='));
const commit = args.includes('--commit');
const snapshotPath = fileArg ? resolve(fileArg.split('=')[1]) : null;

if (!snapshotPath) {
  console.error('Usage: node src/scripts/migrate.js --file=path/to/snapshot.json [--commit]');
  process.exit(1);
}

// ── Helpers ───────────────────────────────────────────────────────
function loadSnapshot(filePath) {
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function validateRefs(users, recipes, reviews) {
  const userIds = new Set(users.map((u) => u.id));
  const recipeIds = new Set(recipes.map((r) => r.id));
  const issues = [];

  for (const recipe of recipes) {
    if (!userIds.has(recipe.authorId)) {
      issues.push(`Recipe "${recipe.id}" references unknown authorId "${recipe.authorId}"`);
    }
  }
  for (const review of reviews) {
    if (!userIds.has(review.userId)) {
      issues.push(`Review "${review.id}" references unknown userId "${review.userId}"`);
    }
    if (!recipeIds.has(review.recipeId)) {
      issues.push(`Review "${review.id}" references unknown recipeId "${review.recipeId}"`);
    }
  }
  return issues;
}

async function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, 10);
}

function toDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// ── Transform functions ──────────────────────────────────────────
async function transformUsers(rawUsers) {
  const results = [];
  for (const u of rawUsers) {
    results.push({
      _id: u.id,
      username: u.username,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email.toLowerCase().trim(),
      passwordHash: await hashPassword(u.password),
      birthday: u.birthday || null,
      role: u.role || 'user',
      status: u.status || 'inactive',
      joinedDate: toDate(u.joinedDate) || new Date(),
      lastActive: toDate(u.lastActive),
      avatarUrl: u.avatar || null,
      avatarStoragePath: null,
      avatarThumbnailUrl: null,
      bio: u.bio || '',
      location: u.location || '',
      cookingLevel: u.cookingLevel || 'Beginner',
      favorites: u.favorites || [],
      viewedRecipes: u.viewedRecipes || [],
      tokenVersion: u.tokenVersion ?? 0,
    });
  }
  return results;
}

function transformRecipes(rawRecipes) {
  return rawRecipes.map((r) => ({
    _id: r.id,
    title: r.title,
    description: r.description,
    category: r.category,
    prepTime: Number(r.prepTime) || 0,
    cookTime: Number(r.cookTime) || 0,
    servings: Number(r.servings) || 1,
    difficulty: r.difficulty || 'Medium',
    ingredients: (r.ingredients || []).map((i) => ({
      name: i.name,
      quantity: String(i.quantity),
      unit: i.unit || '',
    })),
    instructions: r.instructions || [],
    images: r.images || [],
    imageUrl: r.images?.[0] || null,
    imageStoragePath: null,
    imageThumbnailUrl: null,
    imageAltText: r.title,
    authorId: r.authorId,
    status: r.status || 'pending',
    likedBy: r.likedBy || [],
    viewedBy: r.viewedBy || [],
    createdAt: toDate(r.createdAt) || new Date(),
  }));
}

function transformReviews(rawReviews) {
  return (rawReviews || []).map((r) => ({
    _id: r.id,
    recipeId: r.recipeId,
    userId: r.userId,
    rating: Math.min(5, Math.max(1, Number(r.rating) || 1)),
    comment: r.comment || '',
    createdAt: toDate(r.createdAt) || new Date(),
  }));
}

function transformSearchHistory(rawHistory) {
  return (rawHistory || []).map((h) => ({
    _id: h.id,
    userId: h.userId,
    query: h.query,
    createdAt: toDate(h.createdAt) || new Date(),
  }));
}

function transformDailyStats(rawStats) {
  if (!rawStats || typeof rawStats !== 'object') return [];
  return Object.entries(rawStats).map(([dateKey, day]) => ({
    _id: dateKey,
    newUsers: day.newUsers || [],
    newContributors: day.newContributors || [],
    activeUsers: day.activeUsers || [],
    views: (day.views || []).map((v) => ({
      viewerKey: v.viewerKey,
      viewerType: v.viewerType || 'user',
      recipeId: v.recipeId,
      viewedAt: toDate(v.viewedAt) || new Date(),
    })),
  }));
}

function transformActivityLogs(rawLogs) {
  return (rawLogs || []).map((a) => ({
    _id: a.id,
    type: a.type || 'unknown',
    message: a.message || '',
    userId: a.userId || null,
    targetId: a.targetId || null,
    metadata: a.metadata || {},
    time: toDate(a.time) || new Date(),
  }));
}

// ── Main ─────────────────────────────────────────────────────────
async function run() {
  console.log(`\n📦 Loading snapshot from: ${snapshotPath}`);
  const snapshot = loadSnapshot(snapshotPath);

  const rawUsers = snapshot.kitchen_odyssey_users || [];
  const rawRecipes = snapshot.kitchen_odyssey_recipes || [];
  const rawReviews = snapshot.kitchen_odyssey_reviews || [];
  const rawSearch = snapshot.kitchen_odyssey_search_history || [];
  const rawStats = snapshot.kitchen_odyssey_daily_stats || {};
  const rawActivity = snapshot.kitchen_odyssey_activity || [];

  // Validate referential integrity
  const refIssues = validateRefs(rawUsers, rawRecipes, rawReviews);
  if (refIssues.length > 0) {
    console.error('\n⚠️  Referential integrity issues:');
    refIssues.forEach((issue) => console.error(`   - ${issue}`));
    if (commit) {
      console.error('\nAborting. Fix integrity issues before committing.');
      process.exit(1);
    }
  }

  // Transform
  console.log('\n🔄 Transforming data...');
  const users = await transformUsers(rawUsers);
  const recipes = transformRecipes(rawRecipes);
  const reviews = transformReviews(rawReviews);
  const searchHistory = transformSearchHistory(rawSearch);
  const dailyStats = transformDailyStats(rawStats);
  const activityLogs = transformActivityLogs(rawActivity);

  // Summary
  console.log('\n📊 Migration summary:');
  console.log(`   Users:          ${users.length}`);
  console.log(`   Recipes:        ${recipes.length}`);
  console.log(`   Reviews:        ${reviews.length}`);
  console.log(`   Search History: ${searchHistory.length}`);
  console.log(`   Daily Stats:    ${dailyStats.length}`);
  console.log(`   Activity Logs:  ${activityLogs.length}`);

  if (!commit) {
    console.log('\n🔍 DRY-RUN mode — no data written. Add --commit to write to DB.');

    // Write rollback artifact even in dry-run for inspection
    const rollbackPath = resolve(__dirname, `../../migration-rollback-${Date.now()}.json`);
    const rollback = {
      batchId: `migration-${Date.now()}`,
      timestamp: new Date().toISOString(),
      mode: 'dry-run',
      counts: {
        users: users.length,
        recipes: recipes.length,
        reviews: reviews.length,
        searchHistory: searchHistory.length,
        dailyStats: dailyStats.length,
        activityLogs: activityLogs.length,
      },
      affectedIds: {
        users: users.map((u) => u._id),
        recipes: recipes.map((r) => r._id),
        reviews: reviews.map((r) => r._id),
        searchHistory: searchHistory.map((s) => s._id),
        dailyStats: dailyStats.map((d) => d._id),
        activityLogs: activityLogs.map((a) => a._id),
      },
    };
    writeFileSync(rollbackPath, JSON.stringify(rollback, null, 2));
    console.log(`   Rollback artifact: ${rollbackPath}`);
    return;
  }

  // Connect and write
  console.log('\n🔗 Connecting to MongoDB...');
  await mongoose.connect(config.mongodb.uri);
  console.log('   Connected.');

  const batchId = `migration-${Date.now()}`;
  const results = { inserted: {}, errors: [] };

  try {
    // Upsert users
    for (const user of users) {
      try {
        await User.findByIdAndUpdate(user._id, user, { upsert: true, new: true, runValidators: true });
      } catch (err) {
        results.errors.push(`User ${user._id}: ${err.message}`);
      }
    }
    results.inserted.users = users.length - results.errors.filter((e) => e.startsWith('User')).length;

    // Upsert recipes
    for (const recipe of recipes) {
      try {
        await Recipe.findByIdAndUpdate(recipe._id, recipe, { upsert: true, new: true, runValidators: true });
      } catch (err) {
        results.errors.push(`Recipe ${recipe._id}: ${err.message}`);
      }
    }
    results.inserted.recipes = recipes.length - results.errors.filter((e) => e.startsWith('Recipe')).length;

    // Upsert reviews
    for (const review of reviews) {
      try {
        await Review.findByIdAndUpdate(review._id, review, { upsert: true, new: true, runValidators: true });
      } catch (err) {
        results.errors.push(`Review ${review._id}: ${err.message}`);
      }
    }
    results.inserted.reviews = reviews.length - results.errors.filter((e) => e.startsWith('Review')).length;

    // Upsert search history
    for (const entry of searchHistory) {
      try {
        await SearchHistory.findByIdAndUpdate(entry._id, entry, { upsert: true, new: true, runValidators: true });
      } catch (err) {
        results.errors.push(`SearchHistory ${entry._id}: ${err.message}`);
      }
    }
    results.inserted.searchHistory = searchHistory.length - results.errors.filter((e) => e.startsWith('SearchHistory')).length;

    // Upsert daily stats
    for (const stat of dailyStats) {
      try {
        await DailyStat.findByIdAndUpdate(stat._id, stat, { upsert: true, new: true, runValidators: true });
      } catch (err) {
        results.errors.push(`DailyStat ${stat._id}: ${err.message}`);
      }
    }
    results.inserted.dailyStats = dailyStats.length - results.errors.filter((e) => e.startsWith('DailyStat')).length;

    // Upsert activity logs
    for (const log of activityLogs) {
      try {
        await ActivityLog.findByIdAndUpdate(log._id, log, { upsert: true, new: true, runValidators: true });
      } catch (err) {
        results.errors.push(`ActivityLog ${log._id}: ${err.message}`);
      }
    }
    results.inserted.activityLogs = activityLogs.length - results.errors.filter((e) => e.startsWith('ActivityLog')).length;

    // Write rollback artifact
    const rollbackPath = resolve(__dirname, `../../migration-rollback-${batchId}.json`);
    const rollback = {
      batchId,
      timestamp: new Date().toISOString(),
      mode: 'commit',
      counts: results.inserted,
      errors: results.errors,
      affectedIds: {
        users: users.map((u) => u._id),
        recipes: recipes.map((r) => r._id),
        reviews: reviews.map((r) => r._id),
        searchHistory: searchHistory.map((s) => s._id),
        dailyStats: dailyStats.map((d) => d._id),
        activityLogs: activityLogs.map((a) => a._id),
      },
    };
    writeFileSync(rollbackPath, JSON.stringify(rollback, null, 2));

    console.log('\n✅ Migration complete!');
    console.log(`   Inserted: ${JSON.stringify(results.inserted)}`);
    if (results.errors.length > 0) {
      console.log(`   Errors (${results.errors.length}):`);
      results.errors.forEach((e) => console.log(`     - ${e}`));
    }
    console.log(`   Rollback artifact: ${rollbackPath}`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
