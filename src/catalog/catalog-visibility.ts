import { BOOKING_WINDOW_MS } from '../class-plans/booking-window.js';
import { Prisma } from '../generated/prisma/client.js';
import {
  ClassPlanStatus,
  PartnerStatus,
  SessionStatus,
  VenueStatus,
} from '../generated/prisma/enums.js';

// What a visitor without an account may see (spec 0004). Every catalog query
// filters with these, so a rule is written, and changed, in one place only.

// A session is on offer when it is still to come, inside the booking window,
// and nothing above it (plan, venue, class type, partner) is switched off.
export function visibleSessionWhere(now: Date): Prisma.ClassSessionWhereInput {
  return {
    status: SessionStatus.SCHEDULED,
    startAt: { gt: now, lte: new Date(now.getTime() + BOOKING_WINDOW_MS) },
    venue: { status: VenueStatus.ACTIVE },
    classPlan: {
      status: ClassPlanStatus.ACTIVE,
      classType: {
        isActive: true,
        partner: { status: PartnerStatus.ACTIVE },
      },
    },
  };
}

// A class is on offer when at least one of its sessions is. Only `classPlans` is
// set, so callers can safely add their own `id` or `partnerId` beside it.
export function visibleClassWhere(now: Date): Prisma.ClassTypeWhereInput {
  return {
    classPlans: {
      some: { classSessions: { some: visibleSessionWhere(now) } },
    },
  };
}
