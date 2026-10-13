import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateClassTypeDto } from './create-class-type.dto.js';

const CATEGORY_ID = '33333333-3333-4333-8333-333333333333';

async function parse(plain: Record<string, unknown>) {
  const dto = plainToInstance(CreateClassTypeDto, plain);
  return { dto, errors: await validate(dto) };
}

function failedProperties(errors: { property: string }[]) {
  return errors.map((error) => error.property);
}

describe('CreateClassTypeDto', () => {
  it('accepts a name and a categoryId', async () => {
    const { errors } = await parse({
      name: 'Puppy Yoga',
      categoryId: CATEGORY_ID,
    });

    expect(errors).toHaveLength(0);
  });

  it('accepts an optional description', async () => {
    const { errors } = await parse({
      name: 'Puppy Yoga',
      categoryId: CATEGORY_ID,
      description: 'Yoga with puppies.',
    });

    expect(errors).toHaveLength(0);
  });

  describe('name', () => {
    it('trims surrounding whitespace', async () => {
      const { dto, errors } = await parse({
        name: '  Puppy Yoga  ',
        categoryId: CATEGORY_ID,
      });

      expect(errors).toHaveLength(0);
      expect(dto.name).toBe('Puppy Yoga');
    });

    it.each([undefined, '', '   ', 42])('rejects %j', async (name) => {
      const { errors } = await parse({ name, categoryId: CATEGORY_ID });

      expect(failedProperties(errors)).toEqual(['name']);
    });

    it('accepts exactly 150 characters', async () => {
      const { errors } = await parse({
        name: 'a'.repeat(150),
        categoryId: CATEGORY_ID,
      });

      expect(errors).toHaveLength(0);
    });

    it('rejects 151 characters', async () => {
      const { errors } = await parse({
        name: 'a'.repeat(151),
        categoryId: CATEGORY_ID,
      });

      expect(failedProperties(errors)).toEqual(['name']);
    });

    it('counts length after trimming', async () => {
      const { errors } = await parse({
        name: ` ${'a'.repeat(150)} `,
        categoryId: CATEGORY_ID,
      });

      expect(errors).toHaveLength(0);
    });
  });

  describe('categoryId', () => {
    it.each([undefined, '', 'abc', 123])('rejects %j', async (categoryId) => {
      const { errors } = await parse({ name: 'Puppy Yoga', categoryId });

      expect(failedProperties(errors)).toEqual(['categoryId']);
    });
  });

  describe('description', () => {
    const base = { name: 'Puppy Yoga', categoryId: CATEGORY_ID };

    it('trims surrounding whitespace', async () => {
      const { dto, errors } = await parse({
        ...base,
        description: '  Yoga with puppies.  ',
      });

      expect(errors).toHaveLength(0);
      expect(dto.description).toBe('Yoga with puppies.');
    });

    it.each(['', '   ', '\n\t '])(
      'turns blank text %j into null',
      async (description) => {
        const { dto, errors } = await parse({ ...base, description });

        expect(errors).toHaveLength(0);
        expect(dto.description).toBeNull();
      },
    );

    it('leaves an omitted description undefined', async () => {
      const { dto, errors } = await parse(base);

      expect(errors).toHaveLength(0);
      expect(dto.description).toBeUndefined();
    });

    it('accepts an explicit null', async () => {
      const { dto, errors } = await parse({ ...base, description: null });

      expect(errors).toHaveLength(0);
      expect(dto.description).toBeNull();
    });

    it('accepts exactly 2000 characters', async () => {
      const { errors } = await parse({
        ...base,
        description: 'a'.repeat(2000),
      });

      expect(errors).toHaveLength(0);
    });

    it('rejects 2001 characters', async () => {
      const { errors } = await parse({
        ...base,
        description: 'a'.repeat(2001),
      });

      expect(failedProperties(errors)).toEqual(['description']);
    });

    it('counts length after trimming', async () => {
      const { errors } = await parse({
        ...base,
        description: ` ${'a'.repeat(2000)} `,
      });

      expect(errors).toHaveLength(0);
    });

    it('rejects a non-string', async () => {
      const { errors } = await parse({ ...base, description: 5 });

      expect(failedProperties(errors)).toEqual(['description']);
    });
  });
});
