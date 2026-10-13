import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateClassTypeDto } from './update-class-type.dto.js';

const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';

async function parse(plain: Record<string, unknown>) {
  const dto = plainToInstance(UpdateClassTypeDto, plain);
  return { dto, errors: await validate(dto) };
}

function failedProperties(errors: { property: string }[]) {
  return errors.map((error) => error.property);
}

describe('UpdateClassTypeDto', () => {
  it('accepts an empty body (the service rejects it with a clear 400)', async () => {
    const { errors } = await parse({});

    expect(errors).toHaveLength(0);
  });

  it('accepts each field on its own', async () => {
    expect((await parse({ name: 'Puppy Yoga' })).errors).toHaveLength(0);
    expect((await parse({ categoryId: CATEGORY_ID })).errors).toHaveLength(0);
    expect((await parse({ description: 'Text' })).errors).toHaveLength(0);
  });

  describe('name', () => {
    it('trims surrounding whitespace', async () => {
      const { dto, errors } = await parse({ name: '  Puppy Yoga  ' });

      expect(errors).toHaveLength(0);
      expect(dto.name).toBe('Puppy Yoga');
    });

    it.each([null, '', '   ', 42])('rejects %j', async (name) => {
      const { errors } = await parse({ name });

      expect(failedProperties(errors)).toEqual(['name']);
    });

    it('accepts 150 characters and rejects 151', async () => {
      expect((await parse({ name: 'a'.repeat(150) })).errors).toHaveLength(0);
      expect(
        failedProperties((await parse({ name: 'a'.repeat(151) })).errors),
      ).toEqual(['name']);
    });
  });

  describe('categoryId', () => {
    it.each([null, '', 'abc', 123])('rejects %j', async (categoryId) => {
      const { errors } = await parse({ categoryId });

      expect(failedProperties(errors)).toEqual(['categoryId']);
    });
  });

  describe('description', () => {
    it('trims surrounding whitespace', async () => {
      const { dto } = await parse({ description: '  Text  ' });

      expect(dto.description).toBe('Text');
    });

    it.each([null, '', '   '])(
      'clears with %j (stored as null)',
      async (description) => {
        const { dto, errors } = await parse({ description });

        expect(errors).toHaveLength(0);
        expect(dto.description).toBeNull();
      },
    );

    it('accepts 2000 characters and rejects 2001, counted after trimming', async () => {
      expect(
        (await parse({ description: ` ${'a'.repeat(2000)} ` })).errors,
      ).toHaveLength(0);
      expect(
        failedProperties(
          (await parse({ description: 'a'.repeat(2001) })).errors,
        ),
      ).toEqual(['description']);
    });
  });

  // Same options as configureApp(): unknown fields are rejected, not ignored.
  it.each(['partnerId', 'isActive'])(
    'rejects %s in the body through the app ValidationPipe',
    async (field) => {
      const pipe = new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      });

      await expect(
        pipe.transform(
          { name: 'Puppy Yoga', [field]: 'x' },
          { type: 'body', metatype: UpdateClassTypeDto },
        ),
      ).rejects.toThrow(BadRequestException);
    },
  );
});
