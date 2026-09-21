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
    name: 'Sports & Movement',
    slug: 'sports-movement',
    children: [
      { name: 'Yoga', slug: 'yoga' },
      { name: 'Pilates', slug: 'pilates' },
      { name: 'CrossFit', slug: 'crossfit' },
      { name: 'Boxing', slug: 'boxing' },
      { name: 'Dance', slug: 'dance' },
    ],
  },
  {
    name: 'Arts & Creativity',
    slug: 'arts-creativity',
    children: [
      { name: 'Ceramics', slug: 'ceramics' },
      { name: 'Painting', slug: 'painting' },
      { name: 'Music', slug: 'music' },
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
