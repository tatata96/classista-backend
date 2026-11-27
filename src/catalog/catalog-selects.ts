import { Prisma } from '../generated/prisma/client.js';
import { CatalogClassListItemDto } from './dto/catalog-class-response.dto.js';

// Explicit selects: a new database column stays private until someone adds it
// here on purpose.
export const CLASS_LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  category: { select: { id: true, name: true } },
  partner: { select: { id: true, name: true } },
} as const satisfies Prisma.ClassTypeSelect;

type ClassListRow = Prisma.ClassTypeGetPayload<{
  select: typeof CLASS_LIST_SELECT;
}>;

// The database calls it a partner; the public API calls it a business.
export function toClassListItem({
  partner,
  ...classType
}: ClassListRow): CatalogClassListItemDto {
  return { ...classType, business: partner };
}
