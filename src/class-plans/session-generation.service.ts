import { Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client.js';
import { ClassPlanStatus, RecurrenceType } from '../generated/prisma/enums.js';
import { PrismaService } from '../lib/database/prisma.service.js';
import {
  addDaysToLocalDate,
  addMinutes,
  dbDateToLocalDate,
  dbTimeToLocalTime,
  getIsoWeekday,
  instantToLocalDate,
  zonedDateTimeToInstant,
} from './zoned-time.js';

// Recurring plans only get sessions starting within the next 30 x 24 hours.
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

// A plan together with its venue's timezone, which is what turns the plan's
// wall-clock date and time into the exact instant of a session.
export type PlanForGeneration = Prisma.ClassPlanGetPayload<{
  include: { venue: { select: { timezone: true } } };
}>;

interface GenerationOptions {
  db?: Prisma.TransactionClient;
  now?: Date;
}

@Injectable()
export class SessionGenerationService {
  constructor(private readonly prisma: PrismaService) {}

  // Creates the sessions a plan is missing and returns how many it created.
  // `db` is the Prisma client to write with. Creating a plan passes its
  // transaction client here, so the plan and its sessions succeed or fail
  // together; without it, the service writes with the normal client.
  // `now` is only passed by tests, to make the window predictable.
  async generateForPlan(
    plan: PlanForGeneration,
    { db = this.prisma, now = new Date() }: GenerationOptions = {},
  ): Promise<number> {
    // Paused plans do not generate sessions.
    if (plan.status !== ClassPlanStatus.ACTIVE) {
      return 0;
    }

    const startTimes =
      plan.recurrenceType === RecurrenceType.RECURRING
        ? this.getRecurringStartTimes(plan, now)
        : [this.getStartTime(plan, dbDateToLocalDate(plan.startDate))];

    if (startTimes.length === 0) {
      return 0;
    }

    // skipDuplicates makes this safe to repeat: the unique key
    // (classPlanId, startAt) means an existing session is left alone.
    const result = await db.classSession.createMany({
      data: startTimes.map((startAt) => ({
        classPlanId: plan.id,
        venueId: plan.venueId,
        instructorId: plan.instructorId,
        startAt,
        endAt: addMinutes(startAt, plan.durationMinutes),
        totalCapacity: plan.totalCapacity,
        classistaCapacity: plan.classistaCapacity,
      })),
      skipDuplicates: true,
    });

    return result.count;
  }

  // The exact instant the plan's class starts on one local date.
  private getStartTime(plan: PlanForGeneration, localDate: string): Date {
    return zonedDateTimeToInstant(
      localDate,
      dbTimeToLocalTime(plan.startTime),
      plan.venue.timezone,
    );
  }

  // Every matching weekday from the plan's start date up to the earlier of its
  // end date and the end of the window, keeping only starts in
  // (now, now + 30 days]. The window is measured in instants; the venue's
  // timezone only decides which local dates to walk through.
  private getRecurringStartTimes(plan: PlanForGeneration, now: Date): Date[] {
    const windowEnd = new Date(now.getTime() + WINDOW_MS);
    const timeZone = plan.venue.timezone;

    // 'YYYY-MM-DD' strings sort chronologically, so max/min are plain comparisons.
    const planStart = dbDateToLocalDate(plan.startDate);
    const today = instantToLocalDate(now, timeZone);
    const firstDate = planStart > today ? planStart : today;

    const windowLastDate = instantToLocalDate(windowEnd, timeZone);
    // The end date is inclusive, so a plan ending today still counts today.
    const planEnd = plan.endDate ? dbDateToLocalDate(plan.endDate) : null;
    const lastDate =
      planEnd && planEnd < windowLastDate ? planEnd : windowLastDate;

    const startTimes: Date[] = [];
    for (
      let date = firstDate;
      date <= lastDate;
      date = addDaysToLocalDate(date, 1)
    ) {
      if (!plan.weekdays.includes(getIsoWeekday(date))) {
        continue;
      }

      const startAt = this.getStartTime(plan, date);
      // Today's class may have already started, and the last day's class may
      // fall just outside the window.
      if (startAt > now && startAt <= windowEnd) {
        startTimes.push(startAt);
      }
    }

    return startTimes;
  }
}
