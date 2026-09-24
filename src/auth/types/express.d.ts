import type { AuthenticatedUser } from '../auth.service.js';
import type { PartnerContext } from '../../partners/types/partner-context.js';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      partnerContext?: PartnerContext;
    }
  }
}

export {};
