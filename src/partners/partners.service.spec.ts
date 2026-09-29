import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../lib/database/prisma.service.js';
import type { OnboardPartnerDto } from './dto/onboard-partner.dto.js';
import { PartnersService } from './partners.service.js';

const PARTNER_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = 'user-alice';

const BUSINESS_PROFILE = {
  id: PARTNER_ID,
  name: 'Kadıköy Yoga Studio',
  description: 'A cozy studio.',
  phone: '+90 216 555 00 00',
  websiteUrl: 'https://kadikoyyoga.com',
  facebookUrl: 'https://facebook.com/kadikoyyoga',
  instagramHandle: 'kadikoyyoga',
  xHandle: 'kadikoyyoga',
  tiktokHandle: 'kadikoyyoga',
  bookingCutoffMinutes: 720,
};

const ONBOARD_DTO: OnboardPartnerDto = {
  partner: { name: 'Kadıköy Yoga Studio', description: 'A cozy studio.' },
  venue: {
    addressLine: 'Bahariye Caddesi 12',
    district: 'Kadıköy',
    city: 'Istanbul',
  },
} as OnboardPartnerDto;

describe('PartnersService', () => {
  // A tiny fake transactional client: $transaction just runs the callback
  // against this same mock, the way Prisma's interactive transactions do.
  const txMock = {
    partner: { create: vi.fn() },
    partnerMembership: { create: vi.fn() },
    venue: { create: vi.fn() },
  };

  const prismaMock = {
    partner: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    partnerMembership: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (callback: (tx: typeof txMock) => unknown) => callback(txMock)),
  };

  let service: PartnersService;

  beforeEach(async () => {
    prismaMock.partner.findUnique.mockReset();
    prismaMock.partner.update.mockReset();
    prismaMock.partnerMembership.findUnique.mockReset();
    prismaMock.$transaction.mockClear();
    txMock.partner.create.mockReset();
    txMock.partnerMembership.create.mockReset();
    txMock.venue.create.mockReset();

    const module = await Test.createTestingModule({
      providers: [PartnersService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(PartnersService);
  });

  describe('findBusinessProfile', () => {
    it('returns every business profile field for the partner', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(BUSINESS_PROFILE);

      const result = await service.findBusinessProfile(PARTNER_ID);

      expect(prismaMock.partner.findUnique).toHaveBeenCalledWith({
        where: { id: PARTNER_ID },
        select: {
          id: true,
          name: true,
          description: true,
          phone: true,
          websiteUrl: true,
          facebookUrl: true,
          instagramHandle: true,
          xHandle: true,
          tiktokHandle: true,
          bookingCutoffMinutes: true,
        },
      });
      expect(result).toEqual(BUSINESS_PROFILE);
    });

    // Documents that the schema default (see prisma/schema.prisma) is
    // surfaced as-is: this method does not compute or override the value.
    it('surfaces the schema default of 720 unchanged when the partner has not customized it', async () => {
      prismaMock.partner.findUnique.mockResolvedValue({
        ...BUSINESS_PROFILE,
        bookingCutoffMinutes: 720,
      });

      const result = await service.findBusinessProfile(PARTNER_ID);

      expect(result.bookingCutoffMinutes).toBe(720);
    });

    it('throws NotFoundException if the partner was deleted after the guard ran', async () => {
      prismaMock.partner.findUnique.mockResolvedValue(null);

      await expect(service.findBusinessProfile(PARTNER_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('updateBusinessProfile', () => {
    it('rejects an empty body without touching the database', async () => {
      await expect(service.updateBusinessProfile(PARTNER_ID, {})).rejects.toThrow(
        BadRequestException,
      );
      expect(prismaMock.partner.update).not.toHaveBeenCalled();
    });

    it('updates a single field without touching the others', async () => {
      const dto = { name: 'New Studio Name' };
      prismaMock.partner.update.mockResolvedValue({ ...BUSINESS_PROFILE, ...dto });

      await service.updateBusinessProfile(PARTNER_ID, dto);

      expect(prismaMock.partner.update).toHaveBeenCalledWith({
        where: { id: PARTNER_ID },
        data: dto,
        select: expect.objectContaining({ name: true, bookingCutoffMinutes: true }),
      });
    });

    it('updates multiple fields at once', async () => {
      const dto = { name: 'New Studio Name', phone: '+90 555 111 22 33', bookingCutoffMinutes: 60 };
      prismaMock.partner.update.mockResolvedValue({ ...BUSINESS_PROFILE, ...dto });

      await service.updateBusinessProfile(PARTNER_ID, dto);

      expect(prismaMock.partner.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: dto }),
      );
    });

    it('passes an explicit null through to clear an optional field', async () => {
      const dto = { description: null };
      prismaMock.partner.update.mockResolvedValue({ ...BUSINESS_PROFILE, description: null });

      await service.updateBusinessProfile(PARTNER_ID, dto);

      // Object.values(dto).every(v => v === undefined) must treat an explicit
      // null as "a field was provided", not as an absent field.
      expect(prismaMock.partner.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { description: null } }),
      );
    });

    it('returns the updated business profile', async () => {
      const updated = { ...BUSINESS_PROFILE, name: 'Renamed Studio' };
      prismaMock.partner.update.mockResolvedValue(updated);

      const result = await service.updateBusinessProfile(PARTNER_ID, { name: 'Renamed Studio' });

      expect(result).toEqual(updated);
    });

    it('throws NotFoundException if the partner was deleted after the guard ran', async () => {
      prismaMock.partner.update.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('Record to update not found.', {
          code: 'P2025',
          clientVersion: '7.10.0',
        }),
      );

      await expect(
        service.updateBusinessProfile(PARTNER_ID, { name: 'Anything' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('rethrows an unrelated database error', async () => {
      const dbError = new Error('connection lost');
      prismaMock.partner.update.mockRejectedValue(dbError);

      await expect(
        service.updateBusinessProfile(PARTNER_ID, { name: 'Anything' }),
      ).rejects.toThrow(dbError);
    });
  });

  describe('onboard', () => {
    it('rejects a user who already has a membership, without opening a transaction', async () => {
      prismaMock.partnerMembership.findUnique.mockResolvedValue({ id: 'existing-membership' });

      await expect(service.onboard(USER_ID, ONBOARD_DTO)).rejects.toThrow(ConflictException);
      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });

    it('creates the partner, an OWNER membership, and the venue in one transaction', async () => {
      prismaMock.partnerMembership.findUnique.mockResolvedValue(null);
      const createdPartner = { ...BUSINESS_PROFILE, id: PARTNER_ID };
      txMock.partner.create.mockResolvedValue(createdPartner);
      const createdVenue = { id: 'venue-1', name: 'Kadıköy Yoga Studio', timezone: 'Europe/Istanbul' };
      txMock.venue.create.mockResolvedValue(createdVenue);

      const result = await service.onboard(USER_ID, ONBOARD_DTO);

      expect(txMock.partner.create).toHaveBeenCalledWith({
        data: { name: ONBOARD_DTO.partner.name, description: ONBOARD_DTO.partner.description },
        select: expect.objectContaining({ id: true, name: true }),
      });
      expect(txMock.partnerMembership.create).toHaveBeenCalledWith({
        data: { userId: USER_ID, partnerId: PARTNER_ID, role: 'OWNER' },
      });
      expect(result).toEqual({ partner: createdPartner, venue: createdVenue });
    });

    it('falls back to the partner name when venue.name is omitted', async () => {
      prismaMock.partnerMembership.findUnique.mockResolvedValue(null);
      txMock.partner.create.mockResolvedValue({ ...BUSINESS_PROFILE, id: PARTNER_ID });
      txMock.venue.create.mockResolvedValue({ id: 'venue-1' });

      await service.onboard(USER_ID, ONBOARD_DTO);

      expect(txMock.venue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ name: ONBOARD_DTO.partner.name }),
        }),
      );
    });

    it('uses the provided venue.name when given, instead of the partner name', async () => {
      prismaMock.partnerMembership.findUnique.mockResolvedValue(null);
      txMock.partner.create.mockResolvedValue({ ...BUSINESS_PROFILE, id: PARTNER_ID });
      txMock.venue.create.mockResolvedValue({ id: 'venue-1' });
      const dto: OnboardPartnerDto = {
        partner: ONBOARD_DTO.partner,
        venue: { ...ONBOARD_DTO.venue, name: 'Main Studio' },
      } as OnboardPartnerDto;

      await service.onboard(USER_ID, dto);

      expect(txMock.venue.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ name: 'Main Studio' }) }),
      );
    });

    it('always sets the venue timezone to Europe/Istanbul server-side', async () => {
      prismaMock.partnerMembership.findUnique.mockResolvedValue(null);
      txMock.partner.create.mockResolvedValue({ ...BUSINESS_PROFILE, id: PARTNER_ID });
      txMock.venue.create.mockResolvedValue({ id: 'venue-1' });

      await service.onboard(USER_ID, ONBOARD_DTO);

      expect(txMock.venue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ timezone: 'Europe/Istanbul' }),
        }),
      );
    });

    it('links the venue to the partner created earlier in the same transaction', async () => {
      prismaMock.partnerMembership.findUnique.mockResolvedValue(null);
      txMock.partner.create.mockResolvedValue({ ...BUSINESS_PROFILE, id: PARTNER_ID });
      txMock.venue.create.mockResolvedValue({ id: 'venue-1' });

      await service.onboard(USER_ID, ONBOARD_DTO);

      expect(txMock.venue.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ partnerId: PARTNER_ID }) }),
      );
    });

    it('maps a concurrent duplicate-onboarding race (P2002) to ConflictException', async () => {
      prismaMock.partnerMembership.findUnique.mockResolvedValue(null);
      prismaMock.$transaction.mockRejectedValueOnce(
        new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
          code: 'P2002',
          clientVersion: '7.10.0',
        }),
      );

      await expect(service.onboard(USER_ID, ONBOARD_DTO)).rejects.toThrow(ConflictException);
    });

    it('rethrows an unrelated transaction error', async () => {
      prismaMock.partnerMembership.findUnique.mockResolvedValue(null);
      const dbError = new Error('connection lost');
      prismaMock.$transaction.mockRejectedValueOnce(dbError);

      await expect(service.onboard(USER_ID, ONBOARD_DTO)).rejects.toThrow(dbError);
    });
  });
});
