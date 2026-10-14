import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { CreateVenueDto } from './create-venue.dto.js';
import { UpdateVenueDto } from './update-venue.dto.js';

const VALID_VENUE = {
  name: 'Kadıköy Studio',
  addressLine: 'Bahariye Caddesi 12',
  district: 'Kadıköy',
  city: 'Istanbul',
};

// Same options as configureApp(), the pipe the real app applies globally.
const pipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
});

describe('venue request DTOs', () => {
  it('accepts a valid create body without a timezone', async () => {
    await expect(
      pipe.transform(VALID_VENUE, { type: 'body', metatype: CreateVenueDto }),
    ).resolves.toBeInstanceOf(CreateVenueDto);
  });

  it('rejects a timezone on create with 400', async () => {
    await expect(
      pipe.transform(
        { ...VALID_VENUE, timezone: 'Europe/Istanbul' },
        { type: 'body', metatype: CreateVenueDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a timezone on update with 400', async () => {
    await expect(
      pipe.transform(
        { timezone: 'Europe/Istanbul' },
        { type: 'body', metatype: UpdateVenueDto },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
