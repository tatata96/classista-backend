import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// GET /partner/business-profile and PATCH's Prisma call both just surface
// whatever the database returns for bookingCutoffMinutes (see
// partners.service.spec.ts). The "defaults to 720 for a newly created
// partner" behavior is actually enforced by Postgres via this schema default,
// applied through migrations/20260928174858_add_partner_business_profile_fields.
// A mocked-Prisma unit test cannot prove a database default is applied, so
// this test asserts the schema declares it instead.
const schemaPath = fileURLToPath(new URL('./schema.prisma', import.meta.url));

describe('Partner.bookingCutoffMinutes default', () => {
  it('defaults to 720 minutes (12 hours) for a newly created partner', () => {
    const schema = readFileSync(schemaPath, 'utf-8');

    expect(schema).toMatch(/bookingCutoffMinutes\s+Int\s+@default\(720\)/);
  });
});
