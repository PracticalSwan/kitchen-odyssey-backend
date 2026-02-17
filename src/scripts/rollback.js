/**
 * Rollback utility: reverses a migration batch using its rollback artifact.
 *
 * Usage:
 *   node src/scripts/rollback.js --file=migration-rollback-xxx.json           # dry-run
 *   node src/scripts/rollback.js --file=migration-rollback-xxx.json --commit  # actually delete
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import mongoose from 'mongoose';
import { config } from '../lib/config.js';
import { User, Recipe, Review, SearchHistory, DailyStat, ActivityLog } from '../models/index.js';

const args = process.argv.slice(2);
const fileArg = args.find((a) => a.startsWith('--file='));
const commit = args.includes('--commit');
const rollbackPath = fileArg ? resolve(fileArg.split('=')[1]) : null;

if (!rollbackPath) {
  console.error('Usage: node src/scripts/rollback.js --file=migration-rollback-xxx.json [--commit]');
  process.exit(1);
}

async function run() {
  console.log(`\n📄 Loading rollback artifact: ${rollbackPath}`);
  const raw = readFileSync(rollbackPath, 'utf-8');
  const rollback = JSON.parse(raw);

  console.log(`   Batch ID: ${rollback.batchId}`);
  console.log(`   Timestamp: ${rollback.timestamp}`);

  const ids = rollback.affectedIds;
  console.log('\n📊 Records to remove:');
  console.log(`   Users:          ${ids.users?.length || 0}`);
  console.log(`   Recipes:        ${ids.recipes?.length || 0}`);
  console.log(`   Reviews:        ${ids.reviews?.length || 0}`);
  console.log(`   Search History: ${ids.searchHistory?.length || 0}`);
  console.log(`   Daily Stats:    ${ids.dailyStats?.length || 0}`);
  console.log(`   Activity Logs:  ${ids.activityLogs?.length || 0}`);

  if (!commit) {
    console.log('\n🔍 DRY-RUN mode — no data deleted. Add --commit to execute.');
    return;
  }

  console.log('\n🔗 Connecting to MongoDB...');
  await mongoose.connect(config.mongodb.uri);

  const summary = {};

  try {
    if (ids.activityLogs?.length) {
      const r = await ActivityLog.deleteMany({ _id: { $in: ids.activityLogs } });
      summary.activityLogs = r.deletedCount;
    }
    if (ids.dailyStats?.length) {
      const r = await DailyStat.deleteMany({ _id: { $in: ids.dailyStats } });
      summary.dailyStats = r.deletedCount;
    }
    if (ids.searchHistory?.length) {
      const r = await SearchHistory.deleteMany({ _id: { $in: ids.searchHistory } });
      summary.searchHistory = r.deletedCount;
    }
    if (ids.reviews?.length) {
      const r = await Review.deleteMany({ _id: { $in: ids.reviews } });
      summary.reviews = r.deletedCount;
    }
    if (ids.recipes?.length) {
      const r = await Recipe.deleteMany({ _id: { $in: ids.recipes } });
      summary.recipes = r.deletedCount;
    }
    if (ids.users?.length) {
      const r = await User.deleteMany({ _id: { $in: ids.users } });
      summary.users = r.deletedCount;
    }

    console.log('\n✅ Rollback complete!');
    console.log(`   Deleted: ${JSON.stringify(summary)}`);
  } finally {
    await mongoose.disconnect();
  }
}

run().catch((err) => {
  console.error('Rollback failed:', err);
  process.exit(1);
});
