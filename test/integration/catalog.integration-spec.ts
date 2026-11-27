// What a visitor without an account can see. The rules are database filters, so
// mocked Prisma cannot prove them. Runs against the local test database only
// (see test-database.ts).
import { CatalogClassesService } from '../../src/catalog/catalog-classes.service.js';
import { PrismaService } from '../../src/lib/database/prisma.service.js';
import { seedOffer } from './catalog-seed.js';
import { createTestPrisma, resetDatabase } from './test-database.js';

// The services take "now" as an argument, so these dates never go stale.
const NOW = new Date('2026-12-01T09:00:00.000Z');
const WINDOW_END = new Date('2026-12-31T09:00:00.000Z'); // NOW + 30 days

type Offer = Awaited<ReturnType<typeof seedOffer>>;

describe('public catalog (real database)', () => {
  let prisma: PrismaService;
  let service: CatalogClassesService;

  beforeAll(async () => {
    prisma = await createTestPrisma();
    service = new CatalogClassesService(prisma);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(prisma);
  });

  const ids = async () =>
    (await service.findPage(1, 20, NOW)).items.map((c) => c.id);

  const addSession = (
    offer: Offer,
    startAt: string,
    status: 'SCHEDULED' | 'CANCELLED' = 'SCHEDULED',
  ) =>
    prisma.classSession.create({
      data: {
        classPlanId: offer.plan.id,
        venueId: offer.venue.id,
        startAt: new Date(startAt),
        endAt: new Date(new Date(startAt).getTime() + 60 * 60_000),
        totalCapacity: 30,
        classistaCapacity: 20,
        status,
      },
    });

  describe('class list', () => {
    it('lists a visible class with exactly the public fields', async () => {
      const { classType, category, partner } = await seedOffer(prisma);

      expect(await service.findPage(1, 20, NOW)).toEqual({
        total: 1,
        page: 1,
        limit: 20,
        items: [
          {
            id: classType.id,
            name: classType.name,
            description: classType.description,
            category: { id: category.id, name: category.name },
            business: { id: partner.id, name: partner.name },
          },
        ],
      });
    });

    // One row per rule. Each changes one thing on a visible offer.
    it.each<[string, (offer: Offer) => Promise<unknown>]>([
      [
        'the session is cancelled',
        ({ session }) =>
          prisma.classSession.update({
            where: { id: session.id },
            data: { status: 'CANCELLED' },
          }),
      ],
      [
        'the session is completed',
        ({ session }) =>
          prisma.classSession.update({
            where: { id: session.id },
            data: { status: 'COMPLETED' },
          }),
      ],
      [
        'the session starts exactly now',
        ({ session }) =>
          prisma.classSession.update({
            where: { id: session.id },
            data: { startAt: NOW },
          }),
      ],
      [
        'the session starts after the window',
        ({ session }) =>
          prisma.classSession.update({
            where: { id: session.id },
            data: { startAt: new Date(WINDOW_END.getTime() + 1) },
          }),
      ],
      [
        'the plan is paused',
        ({ plan }) =>
          prisma.classPlan.update({
            where: { id: plan.id },
            data: { status: 'PAUSED' },
          }),
      ],
      [
        'the venue is archived',
        ({ venue }) =>
          prisma.venue.update({
            where: { id: venue.id },
            data: { status: 'ARCHIVED' },
          }),
      ],
      [
        'the class type is archived',
        ({ classType }) =>
          prisma.classType.update({
            where: { id: classType.id },
            data: { isActive: false },
          }),
      ],
      [
        'the partner is inactive',
        ({ partner }) =>
          prisma.partner.update({
            where: { id: partner.id },
            data: { status: 'INACTIVE' },
          }),
      ],
    ])('hides a class when %s', async (_label, hide) => {
      const offer = await seedOffer(prisma);
      expect(await ids()).toEqual([offer.classType.id]);

      await hide(offer);

      expect(await ids()).toEqual([]);
      expect((await service.findPage(1, 20, NOW)).total).toBe(0);
    });

    it('includes a session exactly at the end of the window', async () => {
      const { classType } = await seedOffer(prisma, { startAt: WINDOW_END });

      expect(await ids()).toEqual([classType.id]);
    });

    it('lists a class once when it has several sessions', async () => {
      const offer = await seedOffer(prisma);
      await addSession(offer, '2026-12-03T09:00:00.000Z');
      await addSession(offer, '2026-12-04T09:00:00.000Z', 'CANCELLED');

      const result = await service.findPage(1, 20, NOW);

      expect(result.items.map((c) => c.id)).toEqual([offer.classType.id]);
      expect(result.total).toBe(1);
    });

    it('orders by name and pages', async () => {
      await seedOffer(prisma, { name: 'C' });
      await seedOffer(prisma, { name: 'A' });
      await seedOffer(prisma, { name: 'B' });
      const names = async (page: number) =>
        (await service.findPage(page, 2, NOW)).items.map((c) => c.name);

      expect(await names(1)).toEqual(['A', 'B']);
      expect(await names(2)).toEqual(['C']);
      expect((await service.findPage(2, 2, NOW)).total).toBe(3);
    });

    it('returns no items past the last page with the true total', async () => {
      await seedOffer(prisma);

      expect(await service.findPage(5, 20, NOW)).toEqual({
        items: [],
        total: 1,
        page: 5,
        limit: 20,
      });
    });
  });
});
