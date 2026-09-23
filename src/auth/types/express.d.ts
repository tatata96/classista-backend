import type { JWTPayload } from 'jose';

declare global {
  namespace Express {
    interface Request {
      supabaseUser?: JWTPayload;
    }
  }
}

export {};
