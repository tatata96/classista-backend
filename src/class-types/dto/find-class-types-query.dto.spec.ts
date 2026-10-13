import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindClassTypesQueryDto } from './find-class-types-query.dto.js';

async function parse(plain: Record<string, unknown>) {
  const dto = plainToInstance(FindClassTypesQueryDto, plain);
  return { dto, errors: await validate(dto) };
}

describe('FindClassTypesQueryDto', () => {
  it('leaves isActive undefined when omitted (the service defaults to active)', async () => {
    const { dto, errors } = await parse({});

    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBeUndefined();
  });

  it('parses "true" to true', async () => {
    const { dto, errors } = await parse({ isActive: 'true' });

    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(true);
  });

  it('parses "false" to false, not true', async () => {
    const { dto, errors } = await parse({ isActive: 'false' });

    expect(errors).toHaveLength(0);
    expect(dto.isActive).toBe(false);
  });

  it.each(['yes', '1', '', 'TRUE'])('rejects %j', async (value) => {
    const { errors } = await parse({ isActive: value });

    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('isActive');
  });
});
