import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdatePartnerBusinessProfileDto } from './update-partner-business-profile.dto.js';

function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdatePartnerBusinessProfileDto, plain);
  return validate(dto);
}

const NULLABLE_FIELDS = [
  'description',
  'phone',
  'websiteUrl',
  'facebookUrl',
  'instagramHandle',
  'xHandle',
  'tiktokHandle',
] as const;

describe('UpdatePartnerBusinessProfileDto', () => {
  it('accepts an empty body (no fields is a valid partial update at the DTO level)', async () => {
    const errors = await validateDto({});

    expect(errors).toHaveLength(0);
  });

  it('accepts a full, valid business profile', async () => {
    const errors = await validateDto({
      name: 'Kadıköy Yoga Studio',
      description: 'A cozy studio.',
      phone: '+90 216 555 00 00',
      websiteUrl: 'https://kadikoyyoga.com',
      facebookUrl: 'https://facebook.com/kadikoyyoga',
      instagramHandle: 'kadikoyyoga',
      xHandle: 'kadikoyyoga',
      tiktokHandle: 'kadikoyyoga',
      bookingCutoffMinutes: 720,
    });

    expect(errors).toHaveLength(0);
  });

  it.each(NULLABLE_FIELDS)('allows %s to be explicitly set to null', async (field) => {
    const errors = await validateDto({ [field]: null });

    expect(errors).toHaveLength(0);
  });

  it('rejects an empty name', async () => {
    const errors = await validateDto({ name: '' });

    expect(errors.find((e) => e.property === 'name')).toBeDefined();
  });

  it('does not allow name to be null', async () => {
    const errors = await validateDto({ name: null });

    expect(errors.find((e) => e.property === 'name')).toBeDefined();
  });

  it.each(['not-a-url', 'ftp:/broken'])('rejects an invalid websiteUrl (%s)', async (value) => {
    const errors = await validateDto({ websiteUrl: value });

    expect(errors.find((e) => e.property === 'websiteUrl')).toBeDefined();
  });

  it.each(['not-a-url', 'ftp:/broken'])('rejects an invalid facebookUrl (%s)', async (value) => {
    const errors = await validateDto({ facebookUrl: value });

    expect(errors.find((e) => e.property === 'facebookUrl')).toBeDefined();
  });

  it.each([0, -1, -100])('rejects bookingCutoffMinutes below 1 (%d)', async (value) => {
    const errors = await validateDto({ bookingCutoffMinutes: value });

    expect(errors.find((e) => e.property === 'bookingCutoffMinutes')).toBeDefined();
  });

  it.each([12.5, 'not-a-number'])(
    'rejects a non-integer bookingCutoffMinutes (%s)',
    async (value) => {
      const errors = await validateDto({ bookingCutoffMinutes: value });

      expect(errors.find((e) => e.property === 'bookingCutoffMinutes')).toBeDefined();
    },
  );

  it('does not allow bookingCutoffMinutes to be null', async () => {
    const errors = await validateDto({ bookingCutoffMinutes: null });

    expect(errors.find((e) => e.property === 'bookingCutoffMinutes')).toBeDefined();
  });

  it('accepts a positive integer bookingCutoffMinutes', async () => {
    const errors = await validateDto({ bookingCutoffMinutes: 60 });

    expect(errors).toHaveLength(0);
  });
});
