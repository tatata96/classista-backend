import {
  localDateToDbDate,
  localTimeToDbTime,
} from '../../src/class-plans/zoned-time.js';
import { PrismaService } from '../../src/lib/database/prisma.service.js';

let counter = 0;

/**
 * Creates one class a visitor can see: an active partner, venue, class type and
 * plan, with one scheduled session. A test hides it by changing a single thing.
 */
export async function seedOffer(
  prisma: PrismaService,
  options: { name?: string; startAt?: Date } = {},
) {
  counter += 1;
  const startAt = options.startAt ?? new Date('2026-12-02T09:00:00.000Z');

  const partner = await prisma.partner.create({
    data: { name: `Partner ${counter}` },
  });
  const category = await prisma.category.create({
    data: { name: `Category ${counter}`, slug: `catalog-category-${counter}` },
  });
  const classType = await prisma.classType.create({
    data: {
      partnerId: partner.id,
      categoryId: category.id,
      name: options.name ?? `Class ${counter}`,
      description: 'A relaxed class',
    },
  });
  const venue = await prisma.venue.create({
    data: {
      partnerId: partner.id,
      name: `Venue ${counter}`,
      addressLine: 'Bahariye Caddesi 12',
      district: 'Kadıköy',
      city: 'Istanbul',
      timezone: 'Europe/Istanbul',
    },
  });
  const plan = await prisma.classPlan.create({
    data: {
      classTypeId: classType.id,
      venueId: venue.id,
      title: classType.name,
      recurrenceType: 'RECURRING',
      startDate: localDateToDbDate('2026-12-01'),
      weekdays: [1, 2, 3, 4, 5, 6, 7],
      startTime: localTimeToDbTime('12:00'),
      durationMinutes: 60,
      totalCapacity: 30,
      classistaCapacity: 20,
    },
  });
  const session = await prisma.classSession.create({
    data: {
      classPlanId: plan.id,
      venueId: venue.id,
      startAt,
      endAt: new Date(startAt.getTime() + 60 * 60_000),
      totalCapacity: 30,
      classistaCapacity: 20,
    },
  });

  return { partner, category, classType, venue, plan, session };
}
