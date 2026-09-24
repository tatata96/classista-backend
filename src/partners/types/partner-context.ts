import type { PartnerRole } from '../../generated/prisma/enums.js';

/**
 * The partner a request has been *verified* to act for.
 *
 * Only PartnerAccessGuard creates this, after checking the database.
 * Controllers and services must use this instead of reading partnerId
 * from the URL or body, because those values are just client claims.
 */
export interface PartnerContext {
  partnerId: string;
  /** Kept for future role-specific rules. OWNER and STAFF are equal in the MVP. */
  membershipRole: PartnerRole;
}
