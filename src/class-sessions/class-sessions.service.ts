import { Injectable } from '@nestjs/common';
import {
  addDaysToLocalDate,
  zonedDateTimeToInstant,
} from '../class-plans/zoned-time.js';
import { PrismaService } from '../lib/database/prisma.service.js';
import { VENUE_TIMEZONE } from '../venues/venue-timezone.js';
import { ClassSessionResponseDto } from './dto/class-session-response.dto.js';

@Injectable()
export class ClassSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByDate(
    partnerId: string,
    date: string,
  ): Promise<ClassSessionResponseDto[]> {
    // The MVP is Istanbul-only (spec 0003), so the day is read in that zone.
    // Istanbul has no daylight saving, but converting both midnights keeps this
    // correct if that ever changes.
    const dayStart = zonedDateTimeToInstant(date, '00:00', VENUE_TIMEZONE);
    const nextDayStart = zonedDateTimeToInstant(
      addDaysToLocalDate(date, 1),
      '00:00',
      VENUE_TIMEZONE,
    );

    const sessions = await this.prisma.classSession.findMany({
      where: {
        // A plan has no partnerId column; it belongs to its Class Type's partner.
        classPlan: { classType: { partnerId } },
        // Inclusive start, exclusive end.
        startAt: { gte: dayStart, lt: nextDayStart },
      },
      // id breaks ties so sessions starting together keep a stable order.
      orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        classPlanId: true,
        venueId: true,
        instructorId: true,
        startAt: true,
        endAt: true,
        totalCapacity: true,
        classistaCapacity: true,
        status: true,
        classPlan: {
          select: {
            title: true,
            description: true,
            classType: { select: { categoryId: true } },
          },
        },
        venue: { select: { name: true } },
        instructor: { select: { name: true } },
      },
    });

    return sessions.map((session) => ({
      id: session.id,
      classPlanId: session.classPlanId,
      venueId: session.venueId,
      instructorId: session.instructorId,
      startAt: session.startAt.toISOString(),
      endAt: session.endAt.toISOString(),
      totalCapacity: session.totalCapacity,
      classistaCapacity: session.classistaCapacity,
      status: session.status,
      title: session.classPlan.title,
      description: session.classPlan.description,
      categoryId: session.classPlan.classType.categoryId,
      venueName: session.venue.name,
      instructorName: session.instructor?.name ?? null,
    }));
  }
}
