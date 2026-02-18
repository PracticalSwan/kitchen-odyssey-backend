// Database seeding script - populates MongoDB with initial users, recipes, and images
/**
 * Seed script: populates MongoDB with initial data from localStorage seed data.
 *
 * Downloads real images from Unsplash, hashes passwords, and inserts
 * users, recipes, reviews, daily stats, and activity logs.
 *
 * Usage:
 *   node src/scripts/seed.js              # seed the database
 *   node src/scripts/seed.js --clean      # drop collections first, then seed
 */

import { writeFileSync, mkdirSync, existsSync, createWriteStream } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = resolve(__dirname, '../..');
const UPLOADS_DIR = resolve(BACKEND_ROOT, 'uploads');
const THUMBNAILS_DIR = resolve(UPLOADS_DIR, 'thumbnails');

// ── CLI args ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
const cleanFirst = args.includes('--clean');

// ── Load env (dotenv-free) ────────────────────────────────────────
import { readFileSync } from 'node:fs';
function loadEnv() {
  const envPath = resolve(BACKEND_ROOT, '.env');
  if (!existsSync(envPath)) {
    console.error('.env file not found at', envPath);
    process.exit(1);
  }
  const lines = readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnv();

// ── Image download ────────────────────────────────────────────────
const IMAGE_MAP = {
  'recipe-1': {
    url: 'https://images.unsplash.com/photo-1612874742237-6526221588e3?auto=format&fit=crop&q=80&w=800',
    filename: 'spaghetti-carbonara.jpg',
    alt: 'Classic Spaghetti Carbonara',
  },
  'recipe-2': {
    url: 'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&q=80&w=800',
    filename: 'fluffy-pancakes.jpg',
    alt: 'Fluffy Pancakes',
  },
  'recipe-3': {
    url: 'https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&q=80&w=800',
    filename: 'thai-green-curry.jpg',
    alt: 'Thai Green Curry',
  },
  'recipe-4': {
    url: 'https://images.unsplash.com/photo-1541519227354-08fa5d50c44d?auto=format&fit=crop&q=80&w=800',
    filename: 'avocado-toast.jpg',
    alt: 'Avocado Toast',
  },
  'recipe-5': {
    url: 'https://images.unsplash.com/photo-1624353365286-3f8d62daad51?auto=format&fit=crop&q=80&w=800',
    filename: 'chocolate-lava-cake.jpg',
    alt: 'Chocolate Lava Cake',
  },
  'recipe-7': {
    url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800',
    filename: 'classic-beef-burger.jpg',
    alt: 'Classic Beef Burger',
  },
  'recipe-8': {
    url: 'https://images.unsplash.com/photo-1596797038530-2c107229654b?auto=format&fit=crop&q=80&w=800',
    filename: 'mango-sticky-rice.jpg',
    alt: 'Mango Sticky Rice',
  },
  'recipe-9': {
    url: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&q=80&w=800',
    filename: 'lemon-garlic-salmon.jpg',
    alt: 'Lemon Garlic Salmon',
  },
  'recipe-10': {
    url: 'https://images.unsplash.com/photo-1523986371872-9d3ba2e2f642?auto=format&fit=crop&q=80&w=800',
    filename: 'chickpea-salad-wrap.jpg',
    alt: 'Chickpea Salad Wrap',
  },
  'recipe-11': {
    url: 'https://images.unsplash.com/photo-1502741126161-b048400dcca2?auto=format&fit=crop&q=80&w=800',
    filename: 'blueberry-overnight-oats.jpg',
    alt: 'Blueberry Overnight Oats',
  },
  'recipe-12': {
    url: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&q=80&w=800',
    filename: 'spicy-tofu-stir-fry.jpg',
    alt: 'Spicy Tofu Stir-Fry',
  },
  'recipe-13': {
    url: 'https://images.unsplash.com/photo-1476718406336-bb5a9690ee2a?auto=format&fit=crop&q=80&w=800',
    filename: 'tomato-basil-soup.jpg',
    alt: 'Tomato Basil Soup',
  },
  'recipe-14': {
    url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800',
    filename: 'crispy-fish-tacos.jpg',
    alt: 'Crispy Fish Tacos',
  },
};

// Avatar images mapped by user ID
const AVATAR_MAP = {
  'admin-1': { url: 'https://api.dicebear.com/7.x/avataaars/png?seed=admin&size=200', filename: 'avatar-admin-1.png' },
  'admin-2': { url: 'https://api.dicebear.com/7.x/avataaars/png?seed=olivia-admin&size=200', filename: 'avatar-admin-2.png' },
  'admin-3': { url: 'https://api.dicebear.com/7.x/avataaars/png?seed=marcus-admin&size=200', filename: 'avatar-admin-3.png' },
  'user-1': { url: 'https://api.dicebear.com/7.x/avataaars/png?seed=john&size=200', filename: 'avatar-user-1.png' },
  'user-2': { url: 'https://api.dicebear.com/7.x/avataaars/png?seed=maria&size=200', filename: 'avatar-user-2.png' },
  'user-3': { url: 'https://api.dicebear.com/7.x/avataaars/png?seed=tom&size=200', filename: 'avatar-user-3.png' },
  'user-4': { url: 'https://api.dicebear.com/7.x/avataaars/png?seed=amy&size=200', filename: 'avatar-user-4.png' },
  'user-5': { url: 'https://api.dicebear.com/7.x/avataaars/png?seed=kevin&size=200', filename: 'avatar-user-5.png' },
  'user-6': { url: 'https://api.dicebear.com/7.x/avataaars/png?seed=sarah&size=200', filename: 'avatar-user-6.png' },
  'user-7': { url: 'https://api.dicebear.com/7.x/avataaars/png?seed=daniel&size=200', filename: 'avatar-user-7.png' },
  'user-8': { url: 'https://api.dicebear.com/7.x/avataaars/png?seed=lina&size=200', filename: 'avatar-user-8.png' },
  'user-9': { url: 'https://api.dicebear.com/7.x/avataaars/png?seed=omar&size=200', filename: 'avatar-user-9.png' },
};

async function downloadImage(url, destPath) {
  if (existsSync(destPath)) {
    console.log(`   [skip] ${destPath} already exists`);
    return true;
  }
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const fileStream = createWriteStream(destPath);
    await pipeline(Readable.fromWeb(res.body), fileStream);
    return true;
  } catch (err) {
    console.error(`   [fail] ${url}: ${err.message}`);
    return false;
  }
}

async function createThumbnail(srcPath, destPath) {
  if (existsSync(destPath)) return true;
  try {
    const sharp = (await import('sharp')).default;
    await sharp(srcPath).resize(300, 200, { fit: 'cover' }).jpeg({ quality: 70 }).toFile(destPath);
    return true;
  } catch (err) {
    console.error(`   [thumb-fail] ${srcPath}: ${err.message}`);
    return false;
  }
}

// ── Seed Data ─────────────────────────────────────────────────────
const PUBLIC_URL_BASE = process.env.IMAGE_PUBLIC_URL_BASE || 'http://localhost:3000/uploads';

function getImageUrl(filename) {
  return `${PUBLIC_URL_BASE}/${filename}`;
}
function getThumbnailUrl(filename) {
  const name = filename.replace(/\.[^.]+$/, '-thumb.jpg');
  return `${PUBLIC_URL_BASE}/thumbnails/${name}`;
}

const SEED_USERS = [
  {
    _id: 'admin-1', username: 'Admin User', firstName: 'Admin', lastName: 'User',
    email: 'admin@kitchenodyssey.com', password: 'admin', birthday: '1990-01-01',
    role: 'admin', status: 'inactive', joinedDate: new Date('2025-01-01'),
    lastActive: null, bio: 'System Administrator', location: 'Server Room',
    cookingLevel: 'Professional', favorites: [], viewedRecipes: [],
  },
  {
    _id: 'admin-2', username: 'Olivia Admin', firstName: 'Olivia', lastName: 'Nguyen',
    email: 'olivia@kitchenodyssey.com', password: 'admin', birthday: '1986-04-12',
    role: 'admin', status: 'inactive', joinedDate: new Date('2025-09-01'),
    lastActive: null, bio: 'Content moderation lead.', location: 'Boston',
    cookingLevel: 'Advanced', favorites: [], viewedRecipes: [],
  },
  {
    _id: 'admin-3', username: 'Marcus Admin', firstName: 'Marcus', lastName: 'Lee',
    email: 'marcus@kitchenodyssey.com', password: 'admin', birthday: '1983-11-22',
    role: 'admin', status: 'inactive', joinedDate: new Date('2025-10-05'),
    lastActive: null, bio: 'Operations admin.', location: 'Seattle',
    cookingLevel: 'Intermediate', favorites: [], viewedRecipes: [],
  },
  {
    _id: 'user-1', username: 'John Doe', firstName: 'John', lastName: 'Doe',
    email: 'user@kitchenodyssey.com', password: 'user', birthday: '1995-06-15',
    role: 'user', status: 'inactive', joinedDate: new Date('2025-06-15'),
    lastActive: null, bio: 'Love cooking italian food!', location: 'New York',
    cookingLevel: 'Intermediate', favorites: ['recipe-3'], viewedRecipes: ['recipe-1', 'recipe-3'],
  },
  {
    _id: 'user-2', username: 'Maria Garcia', firstName: 'Maria', lastName: 'Garcia',
    email: 'maria@kitchenodyssey.com', password: 'maria123', birthday: '1988-03-20',
    role: 'user', status: 'inactive', joinedDate: new Date('2025-03-20'),
    lastActive: new Date(Date.now() - 86400000 * 7), bio: 'Professional chef specializing in Mediterranean cuisine.',
    location: 'Los Angeles', cookingLevel: 'Professional', favorites: ['recipe-1'],
    viewedRecipes: ['recipe-1', 'recipe-4'],
  },
  {
    _id: 'user-3', username: 'Tom Baker', firstName: 'Tom', lastName: 'Baker',
    email: 'tom@kitchenodyssey.com', password: 'tom123', birthday: '1992-08-01',
    role: 'user', status: 'suspended', joinedDate: new Date('2025-08-01'),
    lastActive: new Date(Date.now() - 86400000 * 30), bio: 'Passionate about baking and desserts!',
    location: 'Chicago', cookingLevel: 'Intermediate', favorites: ['recipe-1', 'recipe-5'],
    viewedRecipes: ['recipe-1', 'recipe-5'],
  },
  {
    _id: 'user-4', username: 'Amy Wilson', firstName: 'Amy', lastName: 'Wilson',
    email: 'amy@kitchenodyssey.com', password: 'amy123', birthday: '1998-11-10',
    role: 'user', status: 'pending', joinedDate: new Date('2025-11-10'),
    lastActive: null, bio: 'New to the platform.', location: 'Denver',
    cookingLevel: 'Beginner', favorites: [], viewedRecipes: [],
  },
  {
    _id: 'user-5', username: 'Kevin Tran', firstName: 'Kevin', lastName: 'Tran',
    email: 'kevin@kitchenodyssey.com', password: 'kevin123', birthday: '1996-02-18',
    role: 'user', status: 'pending', joinedDate: new Date('2026-01-20'),
    lastActive: null, bio: 'Here to learn quick meals.', location: 'Austin',
    cookingLevel: 'Beginner', favorites: [], viewedRecipes: [],
  },
  {
    _id: 'user-6', username: 'Sarah Kim', firstName: 'Sarah', lastName: 'Kim',
    email: 'sarah@kitchenodyssey.com', password: 'sarah123', birthday: '1991-07-09',
    role: 'user', status: 'inactive', joinedDate: new Date('2025-12-28'),
    lastActive: null, bio: 'Healthy meal prep enthusiast.', location: 'San Diego',
    cookingLevel: 'Intermediate', favorites: ['recipe-1', 'recipe-3'],
    viewedRecipes: ['recipe-1', 'recipe-3', 'recipe-8'],
  },
  {
    _id: 'user-7', username: 'Daniel Rivera', firstName: 'Daniel', lastName: 'Rivera',
    email: 'daniel@kitchenodyssey.com', password: 'daniel123', birthday: '1989-05-30',
    role: 'user', status: 'inactive', joinedDate: new Date('2025-12-05'),
    lastActive: null, bio: 'Street food lover.', location: 'Miami',
    cookingLevel: 'Advanced', favorites: ['recipe-5'],
    viewedRecipes: ['recipe-5', 'recipe-7'],
  },
  {
    _id: 'user-8', username: 'Lina Patel', firstName: 'Lina', lastName: 'Patel',
    email: 'lina@kitchenodyssey.com', password: 'lina123', birthday: '2000-09-14',
    role: 'user', status: 'inactive', joinedDate: new Date('2025-11-01'),
    lastActive: new Date(Date.now() - 86400000 * 10), bio: 'Baking beginner.',
    location: 'Portland', cookingLevel: 'Beginner', favorites: [],
    viewedRecipes: ['recipe-2'],
  },
  {
    _id: 'user-9', username: 'Omar Hassan', firstName: 'Omar', lastName: 'Hassan',
    email: 'omar@kitchenodyssey.com', password: 'omar123', birthday: '1993-03-03',
    role: 'user', status: 'pending', joinedDate: new Date('2026-01-21'),
    lastActive: null, bio: 'Trying new cuisines.', location: 'Phoenix',
    cookingLevel: 'Beginner', favorites: [], viewedRecipes: [],
  },
];

const SEED_RECIPES = [
  {
    _id: 'recipe-1', title: 'Classic Spaghetti Carbonara',
    description: 'A traditional Italian pasta dish from Rome with creamy egg sauce and crispy pancetta.',
    category: 'Italian', prepTime: 15, cookTime: 20, servings: 4, difficulty: 'Medium',
    ingredients: [
      { name: 'Spaghetti', quantity: '400', unit: 'g' },
      { name: 'Eggs', quantity: '4', unit: '' },
      { name: 'Pancetta', quantity: '200', unit: 'g' },
      { name: 'Parmesan', quantity: '100', unit: 'g' },
    ],
    instructions: ['Boil water and cook pasta al dente', 'Fry pancetta until crispy', 'Mix eggs with grated parmesan', 'Combine hot pasta with egg mixture off heat', 'Add pancetta and serve immediately'],
    authorId: 'user-1', status: 'published', createdAt: new Date('2025-12-01'),
    likedBy: ['user-2', 'user-3'], viewedBy: ['user-1', 'user-2', 'user-3'],
  },
  {
    _id: 'recipe-2', title: 'Fluffy Pancakes',
    description: 'Light and fluffy pancakes perfect for a weekend breakfast.',
    category: 'Breakfast', prepTime: 10, cookTime: 15, servings: 2, difficulty: 'Easy',
    ingredients: [
      { name: 'Flour', quantity: '200', unit: 'g' },
      { name: 'Milk', quantity: '250', unit: 'ml' },
      { name: 'Eggs', quantity: '2', unit: '' },
      { name: 'Sugar', quantity: '2', unit: 'tbsp' },
    ],
    instructions: ['Mix dry ingredients', 'Add wet ingredients and whisk', 'Cook on medium heat until bubbles form', 'Flip and cook other side'],
    authorId: 'user-1', status: 'pending', createdAt: new Date('2026-01-15'),
    likedBy: [], viewedBy: [],
  },
  {
    _id: 'recipe-3', title: 'Thai Green Curry',
    description: 'Aromatic and spicy Thai green curry with vegetables and coconut milk.',
    category: 'Asian', prepTime: 20, cookTime: 25, servings: 4, difficulty: 'Medium',
    ingredients: [
      { name: 'Green curry paste', quantity: '3', unit: 'tbsp' },
      { name: 'Coconut milk', quantity: '400', unit: 'ml' },
      { name: 'Chicken breast', quantity: '500', unit: 'g' },
      { name: 'Thai basil', quantity: '1', unit: 'bunch' },
    ],
    instructions: ['Fry curry paste in oil', 'Add coconut milk and bring to simmer', 'Add chicken and vegetables', 'Cook until chicken is done', 'Garnish with Thai basil'],
    authorId: 'user-2', status: 'published', createdAt: new Date('2025-11-20'),
    likedBy: ['user-1'], viewedBy: ['user-1'],
  },
  {
    _id: 'recipe-4', title: 'Avocado Toast',
    description: 'Simple yet delicious avocado toast with poached eggs and chili flakes.',
    category: 'Breakfast', prepTime: 5, cookTime: 10, servings: 2, difficulty: 'Easy',
    ingredients: [
      { name: 'Avocado', quantity: '2', unit: '' },
      { name: 'Sourdough bread', quantity: '4', unit: 'slices' },
      { name: 'Eggs', quantity: '4', unit: '' },
      { name: 'Chili flakes', quantity: '1', unit: 'tsp' },
    ],
    instructions: ['Toast the bread until golden', 'Mash avocado and season', 'Poach eggs in simmering water', 'Spread avocado on toast', 'Top with poached eggs and chili'],
    authorId: 'user-2', status: 'published', createdAt: new Date('2025-10-15'),
    likedBy: [], viewedBy: ['user-2'],
  },
  {
    _id: 'recipe-5', title: 'Chocolate Lava Cake',
    description: 'Decadent chocolate cake with a molten center. Perfect for dessert lovers.',
    category: 'Dessert', prepTime: 15, cookTime: 12, servings: 4, difficulty: 'Hard',
    ingredients: [
      { name: 'Dark chocolate', quantity: '200', unit: 'g' },
      { name: 'Butter', quantity: '100', unit: 'g' },
      { name: 'Eggs', quantity: '4', unit: '' },
      { name: 'Sugar', quantity: '100', unit: 'g' },
    ],
    instructions: ['Melt chocolate and butter together', 'Whisk eggs and sugar until fluffy', 'Fold chocolate into egg mixture', 'Pour into ramekins', 'Bake at 200C for 12 minutes'],
    authorId: 'user-3', status: 'published', createdAt: new Date('2025-09-05'),
    likedBy: ['user-3'], viewedBy: ['user-3'],
  },
  {
    _id: 'recipe-7', title: 'Classic Beef Burger',
    description: 'Juicy homemade beef burger with all the fixings.',
    category: 'Dinner', prepTime: 20, cookTime: 15, servings: 4, difficulty: 'Medium',
    ingredients: [
      { name: 'Ground beef', quantity: '500', unit: 'g' },
      { name: 'Burger buns', quantity: '4', unit: '' },
      { name: 'Cheese slices', quantity: '4', unit: '' },
      { name: 'Lettuce', quantity: '4', unit: 'leaves' },
    ],
    instructions: ['Form beef into patties', 'Season with salt and pepper', 'Grill or pan-fry for 4-5 min per side', 'Toast buns', 'Assemble with toppings'],
    authorId: 'user-3', status: 'published', createdAt: new Date('2025-08-10'),
    likedBy: ['user-1', 'user-2', 'user-3'], viewedBy: ['user-1', 'user-2', 'user-3'],
  },
  {
    _id: 'recipe-8', title: 'Mango Sticky Rice',
    description: 'Traditional Thai dessert with sweet coconut sticky rice and fresh mango.',
    category: 'Dessert', prepTime: 30, cookTime: 25, servings: 4, difficulty: 'Medium',
    ingredients: [
      { name: 'Sticky rice', quantity: '300', unit: 'g' },
      { name: 'Coconut milk', quantity: '400', unit: 'ml' },
      { name: 'Ripe mango', quantity: '2', unit: '' },
      { name: 'Palm sugar', quantity: '100', unit: 'g' },
    ],
    instructions: ['Soak sticky rice overnight', 'Steam rice until tender', 'Heat coconut milk with sugar', 'Pour half over rice', 'Serve with sliced mango and remaining sauce'],
    authorId: 'user-2', status: 'published', createdAt: new Date('2025-07-25'),
    likedBy: ['user-2'], viewedBy: ['user-2'],
  },
  {
    _id: 'recipe-9', title: 'Lemon Garlic Salmon',
    description: 'Oven-baked salmon with lemon, garlic, and fresh herbs.',
    category: 'Dinner', prepTime: 10, cookTime: 18, servings: 2, difficulty: 'Easy',
    ingredients: [
      { name: 'Salmon fillets', quantity: '2', unit: '' },
      { name: 'Lemon', quantity: '1', unit: '' },
      { name: 'Garlic', quantity: '3', unit: 'cloves' },
      { name: 'Olive oil', quantity: '2', unit: 'tbsp' },
    ],
    instructions: ['Preheat oven to 200C', 'Season salmon with garlic, lemon, and oil', 'Bake for 15-18 minutes', 'Serve with herbs'],
    authorId: 'user-6', status: 'published', createdAt: new Date('2026-01-05'),
    likedBy: ['user-1'], viewedBy: ['user-1', 'user-6'],
  },
  {
    _id: 'recipe-10', title: 'Chickpea Salad Wrap',
    description: 'Fresh and crunchy chickpea salad wrapped in a tortilla.',
    category: 'Lunch', prepTime: 12, cookTime: 0, servings: 2, difficulty: 'Easy',
    ingredients: [
      { name: 'Chickpeas', quantity: '200', unit: 'g' },
      { name: 'Greek yogurt', quantity: '3', unit: 'tbsp' },
      { name: 'Celery', quantity: '2', unit: 'stalks' },
      { name: 'Tortillas', quantity: '2', unit: '' },
    ],
    instructions: ['Mash chickpeas lightly', 'Mix with yogurt and chopped celery', 'Wrap in tortilla and serve'],
    authorId: 'user-7', status: 'published', createdAt: new Date('2025-12-12'),
    likedBy: ['user-2', 'user-6'], viewedBy: ['user-2', 'user-6', 'user-7'],
  },
  {
    _id: 'recipe-11', title: 'Blueberry Overnight Oats',
    description: 'No-cook breakfast with oats, yogurt, and blueberries.',
    category: 'Breakfast', prepTime: 8, cookTime: 0, servings: 1, difficulty: 'Easy',
    ingredients: [
      { name: 'Rolled oats', quantity: '50', unit: 'g' },
      { name: 'Greek yogurt', quantity: '120', unit: 'ml' },
      { name: 'Blueberries', quantity: '80', unit: 'g' },
      { name: 'Honey', quantity: '1', unit: 'tsp' },
    ],
    instructions: ['Mix oats and yogurt', 'Top with blueberries', 'Chill overnight', 'Drizzle honey before serving'],
    authorId: 'user-6', status: 'pending', createdAt: new Date('2026-01-18'),
    likedBy: [], viewedBy: [],
  },
  {
    _id: 'recipe-12', title: 'Spicy Tofu Stir-Fry',
    description: 'Quick stir-fry with tofu, bell peppers, and spicy sauce.',
    category: 'Asian', prepTime: 15, cookTime: 10, servings: 3, difficulty: 'Medium',
    ingredients: [
      { name: 'Tofu', quantity: '400', unit: 'g' },
      { name: 'Bell peppers', quantity: '2', unit: '' },
      { name: 'Soy sauce', quantity: '2', unit: 'tbsp' },
      { name: 'Chili sauce', quantity: '1', unit: 'tbsp' },
    ],
    instructions: ['Press and cube tofu', 'Stir-fry tofu until golden', 'Add peppers and sauce', 'Serve hot'],
    authorId: 'user-7', status: 'rejected', createdAt: new Date('2025-11-22'),
    likedBy: [], viewedBy: ['user-7'],
  },
  {
    _id: 'recipe-13', title: 'Tomato Basil Soup',
    description: 'Creamy tomato soup with fresh basil and croutons.',
    category: 'Dinner', prepTime: 10, cookTime: 25, servings: 4, difficulty: 'Easy',
    ingredients: [
      { name: 'Tomatoes', quantity: '800', unit: 'g' },
      { name: 'Onion', quantity: '1', unit: '' },
      { name: 'Cream', quantity: '100', unit: 'ml' },
      { name: 'Basil', quantity: '1', unit: 'bunch' },
    ],
    instructions: ['Saute onion', 'Add tomatoes and simmer', 'Blend and add cream', 'Garnish with basil'],
    authorId: 'user-1', status: 'published', createdAt: new Date('2025-10-30'),
    likedBy: ['user-3'], viewedBy: ['user-1', 'user-3', 'user-6'],
  },
  {
    _id: 'recipe-14', title: 'Crispy Fish Tacos',
    description: 'Crispy fish with slaw and lime crema in warm tortillas.',
    category: 'Dinner', prepTime: 20, cookTime: 15, servings: 3, difficulty: 'Medium',
    ingredients: [
      { name: 'White fish', quantity: '400', unit: 'g' },
      { name: 'Tortillas', quantity: '6', unit: '' },
      { name: 'Cabbage', quantity: '150', unit: 'g' },
      { name: 'Lime', quantity: '1', unit: '' },
    ],
    instructions: ['Season and fry fish', 'Prepare slaw', 'Assemble tacos', 'Serve with lime crema'],
    authorId: 'user-7', status: 'published', createdAt: new Date('2026-01-10'),
    likedBy: ['user-2', 'user-6'], viewedBy: ['user-2', 'user-6', 'user-7'],
  },
];

// Sample reviews to seed
const SEED_REVIEWS = [
  { _id: 'review-1', recipeId: 'recipe-1', userId: 'user-2', rating: 5, comment: 'Absolutely authentic! Tastes like Rome.', createdAt: new Date('2025-12-05') },
  { _id: 'review-2', recipeId: 'recipe-1', userId: 'user-6', rating: 4, comment: 'Great recipe, very easy to follow.', createdAt: new Date('2025-12-10') },
  { _id: 'review-3', recipeId: 'recipe-3', userId: 'user-1', rating: 5, comment: 'Best green curry I have ever made at home!', createdAt: new Date('2025-11-25') },
  { _id: 'review-4', recipeId: 'recipe-5', userId: 'user-7', rating: 4, comment: 'Incredible molten center. Will make again.', createdAt: new Date('2025-09-15') },
  { _id: 'review-5', recipeId: 'recipe-7', userId: 'user-1', rating: 5, comment: 'Perfect burger. Juicy and flavorful.', createdAt: new Date('2025-08-20') },
  { _id: 'review-6', recipeId: 'recipe-7', userId: 'user-2', rating: 4, comment: 'Simple and delicious. Kids loved it.', createdAt: new Date('2025-08-25') },
  { _id: 'review-7', recipeId: 'recipe-9', userId: 'user-1', rating: 5, comment: 'So easy and tastes amazing.', createdAt: new Date('2026-01-08') },
  { _id: 'review-8', recipeId: 'recipe-10', userId: 'user-6', rating: 4, comment: 'Light and healthy lunch option.', createdAt: new Date('2025-12-15') },
  { _id: 'review-9', recipeId: 'recipe-13', userId: 'user-3', rating: 4, comment: 'Comforting soup, perfect for winter.', createdAt: new Date('2025-11-05') },
  { _id: 'review-10', recipeId: 'recipe-14', userId: 'user-2', rating: 5, comment: 'Restaurant-quality tacos at home!', createdAt: new Date('2026-01-15') },
  { _id: 'review-11', recipeId: 'recipe-4', userId: 'user-6', rating: 4, comment: 'Quick and satisfying breakfast.', createdAt: new Date('2025-10-20') },
  { _id: 'review-12', recipeId: 'recipe-8', userId: 'user-7', rating: 5, comment: 'Authentic Thai flavor. Loved it.', createdAt: new Date('2025-08-01') },
];

// Sample activity logs
const SEED_ACTIVITY = [
  { _id: 'activity-seed-1', type: 'recipe_created', message: 'John Doe created "Classic Spaghetti Carbonara"', userId: 'user-1', targetId: 'recipe-1', time: new Date('2025-12-01') },
  { _id: 'activity-seed-2', type: 'recipe_created', message: 'Maria Garcia created "Thai Green Curry"', userId: 'user-2', targetId: 'recipe-3', time: new Date('2025-11-20') },
  { _id: 'activity-seed-3', type: 'recipe_created', message: 'Tom Baker created "Chocolate Lava Cake"', userId: 'user-3', targetId: 'recipe-5', time: new Date('2025-09-05') },
  { _id: 'activity-seed-4', type: 'user_registered', message: 'Amy Wilson joined the platform', userId: 'user-4', time: new Date('2025-11-10') },
  { _id: 'activity-seed-5', type: 'recipe_liked', message: 'Maria Garcia liked "Classic Spaghetti Carbonara"', userId: 'user-2', targetId: 'recipe-1', time: new Date('2025-12-02') },
  { _id: 'activity-seed-6', type: 'review_added', message: 'Maria Garcia reviewed "Classic Spaghetti Carbonara"', userId: 'user-2', targetId: 'recipe-1', time: new Date('2025-12-05') },
  { _id: 'activity-seed-7', type: 'recipe_created', message: 'Daniel Rivera created "Crispy Fish Tacos"', userId: 'user-7', targetId: 'recipe-14', time: new Date('2026-01-10') },
  { _id: 'activity-seed-8', type: 'recipe_created', message: 'Sarah Kim created "Lemon Garlic Salmon"', userId: 'user-6', targetId: 'recipe-9', time: new Date('2026-01-05') },
];

// ── Main ─────────────────────────────────────────────────────────
async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is not set. Check your .env file.');
    process.exit(1);
  }

  // Ensure upload directories exist
  mkdirSync(UPLOADS_DIR, { recursive: true });
  mkdirSync(THUMBNAILS_DIR, { recursive: true });

  // 1. Download recipe images
  console.log('\n1. Downloading recipe images...');
  for (const [recipeId, img] of Object.entries(IMAGE_MAP)) {
    const destPath = join(UPLOADS_DIR, img.filename);
    const ok = await downloadImage(img.url, destPath);
    if (ok) {
      const thumbDest = join(THUMBNAILS_DIR, img.filename.replace(/\.[^.]+$/, '-thumb.jpg'));
      await createThumbnail(destPath, thumbDest);
    }
  }

  // 2. Download avatar images
  console.log('\n2. Downloading avatar images...');
  for (const [userId, avatar] of Object.entries(AVATAR_MAP)) {
    const destPath = join(UPLOADS_DIR, avatar.filename);
    await downloadImage(avatar.url, destPath);
  }

  // 3. Connect to MongoDB
  console.log('\n3. Connecting to MongoDB...');
  await mongoose.connect(uri);
  console.log('   Connected to', uri.replace(/\/\/[^:]+:[^@]+@/, '//<credentials>@'));

  // Import models after connection is ready
  const { default: User } = await import('../models/User.js');
  const { default: Recipe } = await import('../models/Recipe.js');
  const { default: Review } = await import('../models/Review.js');
  const { default: DailyStat } = await import('../models/DailyStat.js');
  const { default: ActivityLog } = await import('../models/ActivityLog.js');

  try {
    // 4. Optionally clean existing data
    if (cleanFirst) {
      console.log('\n4. Cleaning existing collections...');
      await User.deleteMany({});
      await Recipe.deleteMany({});
      await Review.deleteMany({});
      await DailyStat.deleteMany({});
      await ActivityLog.deleteMany({});
      console.log('   All collections cleared.');
    } else {
      console.log('\n4. Skipping clean (use --clean to drop existing data first).');
    }

    // 5. Hash passwords and insert users
    console.log('\n5. Seeding users...');
    let userCount = 0;
    for (const u of SEED_USERS) {
      const avatarInfo = AVATAR_MAP[u._id];
      const avatarUrl = avatarInfo ? getImageUrl(avatarInfo.filename) : null;
      const avatarStoragePath = avatarInfo ? avatarInfo.filename : null;

      const doc = {
        _id: u._id,
        username: u.username,
        firstName: u.firstName,
        lastName: u.lastName,
        email: u.email,
        passwordHash: await bcrypt.hash(u.password, 10),
        birthday: u.birthday,
        role: u.role,
        status: u.status,
        joinedDate: u.joinedDate,
        lastActive: u.lastActive,
        avatarUrl,
        avatarStoragePath,
        avatarThumbnailUrl: null,
        bio: u.bio,
        location: u.location,
        cookingLevel: u.cookingLevel,
        favorites: u.favorites,
        viewedRecipes: u.viewedRecipes,
        tokenVersion: 0,
      };
      await User.findByIdAndUpdate(doc._id, doc, { upsert: true, runValidators: true });
      userCount++;
    }
    console.log(`   Inserted ${userCount} users.`);

    // 6. Insert recipes with local image paths
    console.log('\n6. Seeding recipes...');
    let recipeCount = 0;
    for (const r of SEED_RECIPES) {
      const imgInfo = IMAGE_MAP[r._id];
      const imageUrl = imgInfo ? getImageUrl(imgInfo.filename) : null;
      const imageStoragePath = imgInfo ? imgInfo.filename : null;
      const imageThumbnailUrl = imgInfo ? getThumbnailUrl(imgInfo.filename) : null;
      const imageAltText = imgInfo ? imgInfo.alt : r.title;

      const doc = {
        _id: r._id,
        title: r.title,
        description: r.description,
        category: r.category,
        prepTime: r.prepTime,
        cookTime: r.cookTime,
        servings: r.servings,
        difficulty: r.difficulty,
        ingredients: r.ingredients,
        instructions: r.instructions,
        images: imageUrl ? [imageUrl] : [],
        imageUrl,
        imageStoragePath,
        imageThumbnailUrl,
        imageAltText,
        authorId: r.authorId,
        status: r.status,
        likedBy: r.likedBy,
        viewedBy: r.viewedBy,
        createdAt: r.createdAt,
      };
      await Recipe.findByIdAndUpdate(doc._id, doc, { upsert: true, runValidators: true });
      recipeCount++;
    }
    console.log(`   Inserted ${recipeCount} recipes.`);

    // 7. Insert reviews
    console.log('\n7. Seeding reviews...');
    let reviewCount = 0;
    for (const r of SEED_REVIEWS) {
      await Review.findByIdAndUpdate(r._id, r, { upsert: true, runValidators: true });
      reviewCount++;
    }
    console.log(`   Inserted ${reviewCount} reviews.`);

    // 8. Insert activity logs
    console.log('\n8. Seeding activity logs...');
    let activityCount = 0;
    for (const a of SEED_ACTIVITY) {
      await ActivityLog.findByIdAndUpdate(a._id, a, { upsert: true, runValidators: true });
      activityCount++;
    }
    console.log(`   Inserted ${activityCount} activity logs.`);

    // 9. Summary
    console.log('\n--- Seed Summary ---');
    console.log(`Users:          ${await User.countDocuments()}`);
    console.log(`Recipes:        ${await Recipe.countDocuments()}`);
    console.log(`Reviews:        ${await Review.countDocuments()}`);
    console.log(`Activity Logs:  ${await ActivityLog.countDocuments()}`);
    console.log('\nSeed completed successfully!');
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
