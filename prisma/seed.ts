import 'dotenv/config';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is missing');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Classista-managed categories.
// Partners create ClassTypes (e.g. Puppy Yoga), not categories.
const categories = [
  {
    name: 'Sport & Movement',
    slug: 'sports-movement',
    children: [
      { name: 'Yoga', slug: 'yoga' },
      { name: 'Pilates', slug: 'pilates' },
      { name: 'Fitness', slug: 'fitness' },
      { name: 'Strength Training', slug: 'strength-training' },
      { name: 'Functional Training', slug: 'functional-training' },
      { name: 'CrossFit', slug: 'crossfit' },
      { name: 'HIIT', slug: 'hiit' },
      { name: 'Calisthenics', slug: 'calisthenics' },
      { name: 'Barre', slug: 'barre' },
      { name: 'Dance', slug: 'dance' },
      { name: 'Boxing', slug: 'boxing' },
      { name: 'Martial Arts', slug: 'martial-arts' },
      { name: 'Self-Defense', slug: 'self-defense' },
      { name: 'Tennis', slug: 'tennis' },
      { name: 'Padel', slug: 'padel' },
      { name: 'Badminton', slug: 'badminton' },
      { name: 'Table Tennis', slug: 'table-tennis' },
      { name: 'Basketball', slug: 'basketball' },
      { name: 'Volleyball', slug: 'volleyball' },
      { name: 'Football', slug: 'football' },
      { name: 'Water Sports', slug: 'water-sports' },
      { name: 'Cycling', slug: 'cycling' },
      { name: 'Running', slug: 'running' },
      { name: 'Hiking & Trekking', slug: 'hiking-trekking' },
      { name: 'Climbing & Bouldering', slug: 'climbing-bouldering' },
      { name: 'Gymnastics', slug: 'gymnastics' },
      { name: 'Horse Riding', slug: 'horse-riding' },
      { name: 'Archery', slug: 'archery' },
      { name: 'Skateboarding', slug: 'skateboarding' },
      { name: 'Meditation', slug: 'meditation' },
      { name: 'Stretching & Mobility', slug: 'stretching-mobility' },
    ],
  },
  {
    name: 'Arts & Creativity',
    slug: 'arts-creativity',
    children: [
      { name: 'Pottery', slug: 'pottery' },
      { name: 'Painting', slug: 'painting' },
      { name: 'Illustration', slug: 'illustration' },
      { name: 'Sculpture', slug: 'sculpture' },
      { name: 'Mosaic Art', slug: 'mosaic-art' },
      { name: 'Stone Carving', slug: 'stone-carving' },
      { name: 'Glass Art', slug: 'glass-art' },
      { name: 'Jewelry Making', slug: 'jewelry-making' },
      { name: 'Metalworking', slug: 'metalworking' },
      { name: 'Woodworking', slug: 'woodworking' },
      { name: 'Leather Craft', slug: 'leather-craft' },
      { name: 'Sewing', slug: 'sewing' },
      { name: 'Embroidery', slug: 'embroidery' },
      { name: 'Knitting', slug: 'knitting' },
      { name: 'Macramé', slug: 'macrame' },
      { name: 'Weaving', slug: 'weaving' },
      { name: 'Tufting', slug: 'tufting' },
      { name: 'Textile Design', slug: 'textile-design' },
      { name: 'Candle Making', slug: 'candle-making' },
      { name: 'Soap Making', slug: 'soap-making' },
      { name: 'Perfume Making', slug: 'perfume-making' },
      { name: 'Resin Art', slug: 'resin-art' },
      { name: 'Ebru', slug: 'ebru' },
      { name: 'Calligraphy', slug: 'calligraphy' },
      { name: 'Traditional Arts', slug: 'traditional-arts' },
      { name: 'Terrarium Making', slug: 'terrarium-making' },
      { name: 'Bonsai', slug: 'bonsai' },
      { name: 'Music', slug: 'music' },
      { name: 'Singing', slug: 'singing' },
      { name: 'Theater & Acting', slug: 'theater-acting' },
      { name: 'Photography', slug: 'photography' },
      { name: 'Filmmaking', slug: 'filmmaking' },
      { name: 'Digital Art', slug: 'digital-art' },
      { name: 'Creative Writing', slug: 'creative-writing' },
      { name: 'Cooking', slug: 'cooking' },
      { name: 'Baking & Pastry', slug: 'baking-pastry' },
      { name: 'Coffee & Barista', slug: 'coffee-barista' },
    ],
  },
];

async function main() {
  for (const category of categories) {
    // Create or update the main category.
    const parent = await prisma.category.upsert({
      where: { slug: category.slug },
      update: {
        name: category.name,
        parentId: null,
      },
      create: {
        name: category.name,
        slug: category.slug,
      },
    });

    // Link each subcategory to its parent.
    for (const child of category.children) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: {
          name: child.name,
          parentId: parent.id,
        },
        create: {
          name: child.name,
          slug: child.slug,
          parentId: parent.id,
        },
      });
    }
  }

  console.log('Categories seeded successfully!');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
