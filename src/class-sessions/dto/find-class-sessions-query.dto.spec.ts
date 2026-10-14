import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { FindClassSessionsQueryDto } from './find-class-sessions-query.dto.js';

async function errorsFor(plain: Record<string, unknown>) {
  return validate(plainToInstance(FindClassSessionsQueryDto, plain));
}

describe('FindClassSessionsQueryDto', () => {
  it('accepts a real YYYY-MM-DD date', async () => {
    expect(await errorsFor({ date: '2026-10-14' })).toHaveLength(0);
  });

  it('accepts a leap day only in a leap year', async () => {
    expect(await errorsFor({ date: '2028-02-29' })).toHaveLength(0);
    expect(await errorsFor({ date: '2026-02-29' })).toHaveLength(1);
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['not a date', 'tomorrow'],
    ['wrong order', '14-10-2026'],
    ['slashes', '2026/10/14'],
    ['no zero padding', '2026-1-4'],
    ['month 13', '2026-13-01'],
    ['an impossible day', '2026-02-30'],
    ['a timestamp', '2026-10-14T00:00:00Z'],
    ['padded with whitespace', ' 2026-10-14'],
    ['repeated (array)', ['2026-10-14', '2026-10-15']],
  ])('rejects a date that is %s', async (_label, date) => {
    expect(await errorsFor({ date })).toHaveLength(1);
  });
});
