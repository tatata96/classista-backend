import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OnboardPartnerDto } from './onboard-partner.dto.js';

function validateDto(plain: Record<string, unknown>) {
  const dto = plainToInstance(OnboardPartnerDto, plain);
  return validate(dto, { whitelist: true, forbidNonWhitelisted: true });
}

const VALID_VENUE = {
  addressLine: 'Bahariye Caddesi 12',
  district: 'Kadıköy',
  city: 'Istanbul',
};

const VALID_BODY = {
  partner: { name: 'Kadıköy Yoga Studio' },
  venue: VALID_VENUE,
};

describe('OnboardPartnerDto', () => {
  it('accepts a valid body with venue.name omitted', async () => {
    const errors = await validateDto(VALID_BODY);

    expect(errors).toHaveLength(0);
  });

  it('accepts a valid body with venue.name provided', async () => {
    const errors = await validateDto({
      ...VALID_BODY,
      venue: { ...VALID_VENUE, name: 'Main Studio' },
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts an optional partner.description', async () => {
    const errors = await validateDto({
      partner: { name: 'Kadıköy Yoga Studio', description: 'A cozy studio.' },
      venue: VALID_VENUE,
    });

    expect(errors).toHaveLength(0);
  });

  it('rejects a missing partner.name', async () => {
    const errors = await validateDto({ partner: {}, venue: VALID_VENUE });

    const partnerError = errors.find((e) => e.property === 'partner');
    expect(partnerError?.children?.some((c) => c.property === 'name')).toBe(true);
  });

  it('rejects an empty venue.name when one is provided', async () => {
    const errors = await validateDto({
      ...VALID_BODY,
      venue: { ...VALID_VENUE, name: '' },
    });

    const venueError = errors.find((e) => e.property === 'venue');
    expect(venueError?.children?.some((c) => c.property === 'name')).toBe(true);
  });

  it('rejects a missing required venue field (addressLine)', async () => {
    const { addressLine: _addressLine, ...venueWithoutAddress } = VALID_VENUE;
    const errors = await validateDto({ partner: { name: 'Studio' }, venue: venueWithoutAddress });

    const venueError = errors.find((e) => e.property === 'venue');
    expect(venueError?.children?.some((c) => c.property === 'addressLine')).toBe(true);
  });

  // timezone is deliberately not part of OnboardPartnerVenueDto: onboarding
  // sets it server-side (Europe/Istanbul), never from the client.
  it('rejects venue.timezone as an unrecognized field', async () => {
    const errors = await validateDto({
      partner: { name: 'Studio' },
      venue: { ...VALID_VENUE, timezone: 'Europe/Istanbul' },
    });

    const venueError = errors.find((e) => e.property === 'venue');
    expect(
      venueError?.children?.some(
        (c) => c.property === 'timezone' && 'whitelistValidation' in (c.constraints ?? {}),
      ),
    ).toBe(true);
  });

  it('rejects a missing partner object', async () => {
    const errors = await validateDto({ venue: VALID_VENUE });

    expect(errors.some((e) => e.property === 'partner')).toBe(true);
  });

  it('rejects a missing venue object', async () => {
    const errors = await validateDto({ partner: { name: 'Studio' } });

    expect(errors.some((e) => e.property === 'venue')).toBe(true);
  });

  // Guards against ever accepting these from the client: they must be
  // derived/hardcoded server-side (see PartnersService.onboard).
  it('rejects a client-supplied userId, partnerId, or role', async () => {
    const errors = await validateDto({
      ...VALID_BODY,
      userId: 'user-1',
      partnerId: 'partner-1',
      role: 'OWNER',
    });

    const topLevelUnknown = errors.filter((e) =>
      ['userId', 'partnerId', 'role'].includes(e.property),
    );
    expect(topLevelUnknown.length).toBeGreaterThan(0);
  });
});
