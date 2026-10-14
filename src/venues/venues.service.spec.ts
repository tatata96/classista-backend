import { Test } from '@nestjs/testing';
import { PrismaService } from '../lib/database/prisma.service.js';
import { CreateVenueDto } from './dto/create-venue.dto.js';
import { VenuesService } from './venues.service.js';

const PARTNER_ID = '11111111-1111-4111-8111-111111111111';

describe('VenuesService', () => {
  const prismaMock = {
    venue: { create: vi.fn() },
  };

  let service: VenuesService;

  beforeEach(async () => {
    prismaMock.venue.create.mockReset();

    const module = await Test.createTestingModule({
      providers: [
        VenuesService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(VenuesService);
  });

  describe('create', () => {
    it('sets the timezone to Europe/Istanbul and the partner from the caller', async () => {
      prismaMock.venue.create.mockResolvedValue({ id: 'venue-1' });
      const dto = {
        name: 'Kadıköy Studio',
        addressLine: 'Bahariye Caddesi 12',
        district: 'Kadıköy',
        city: 'Istanbul',
      } as CreateVenueDto;

      await service.create(PARTNER_ID, dto);

      expect(prismaMock.venue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            ...dto,
            partnerId: PARTNER_ID,
            timezone: 'Europe/Istanbul',
          },
        }),
      );
    });
  });
});
