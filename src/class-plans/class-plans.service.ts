import { BadRequestException, Injectable } from '@nestjs/common';
import { ClassPlan } from '../generated/prisma/client.js';
import { RecurrenceType, VenueStatus } from '../generated/prisma/enums.js';
import { PrismaService } from '../lib/database/prisma.service.js';
import { ClassPlanResponseDto } from './dto/class-plan-response.dto.js';
import { CreateClassPlanDto } from './dto/create-class-plan.dto.js';
import { SessionGenerationService } from './session-generation/session-generation.service.js';
import {
  dbDateToLocalDate,
  dbTimeToLocalTime,
  localDateToDbDate,
  localTimeToDbTime,
  zonedDateTimeToInstant,
} from './zoned-time.js';

// Every method takes the verified partnerId from @CurrentPartner(), never a
// value from the URL or body, and every query is scoped by it.
@Injectable()
export class ClassPlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionGeneration: SessionGenerationService,
  ) {}

  // A plan has no partnerId column; it belongs to the partner that owns its
  // Class Type (create() checks the venue and instructor belong to them too).
  async findAll(partnerId: string): Promise<ClassPlanResponseDto[]> {
    const plans = await this.prisma.classPlan.findMany({
      where: { classType: { partnerId } },
      orderBy: [{ startDate: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
    });

    return plans.map((plan) => this.toResponse(plan));
  }

  async create(
    partnerId: string,
    dto: CreateClassPlanDto,
  ): Promise<ClassPlanResponseDto> {
    const classType = await this.getActiveClassType(partnerId, dto.classTypeId);
    const venue = await this.getActiveVenue(partnerId, dto.venueId);
    // Omitted or null both mean "no instructor": nothing to look up.
    const instructorId = dto.instructorId ?? null;
    if (instructorId !== null) {
      await this.assertActiveInstructor(partnerId, instructorId);
    }

    // A one-time class has a single exact start, so it can be checked against
    // the clock now. (Recurring plans may start today: generation simply skips
    // the occurrences that have already passed.)
    if (dto.recurrenceType === RecurrenceType.ONE_TIME) {
      const startAt = zonedDateTimeToInstant(
        dto.startDate,
        dto.startTime,
        venue.timezone,
      );
      if (startAt <= new Date()) {
        throw new BadRequestException(
          'A one-time class must start in the future',
        );
      }
    }

    // One transaction: the plan and its first sessions are saved together, so
    // if generation fails the plan is not created either.
    const plan = await this.prisma.$transaction(async (tx) => {
      const created = await tx.classPlan.create({
        data: {
          classTypeId: dto.classTypeId,
          venueId: dto.venueId,
          instructorId,
          // Copied now, so renaming the Class Type later does not rename the plan.
          title: classType.name,
          description: dto.description,
          recurrenceType: dto.recurrenceType,
          startDate: localDateToDbDate(dto.startDate),
          endDate: dto.endDate ? localDateToDbDate(dto.endDate) : null,
          weekdays: [...(dto.weekdays ?? [])].sort((a, b) => a - b),
          startTime: localTimeToDbTime(dto.startTime),
          durationMinutes: dto.durationMinutes,
          totalCapacity: dto.totalCapacity,
          classistaCapacity: dto.classistaCapacity,
        },
        include: { venue: { select: { timezone: true } } },
      });

      await this.sessionGeneration.generateForPlan(created, { db: tx });

      return created;
    });

    return this.toResponse(plan);
  }

  // The three lookups below filter by partnerId, so another partner's id gets
  // the exact same error as an id that does not exist. They are 400s, not 404s:
  // the id is in the body, not in the URL being requested.
  private async getActiveClassType(partnerId: string, classTypeId: string) {
    const classType = await this.prisma.classType.findFirst({
      where: { id: classTypeId, partnerId },
      select: { name: true, isActive: true },
    });

    if (!classType) {
      throw new BadRequestException('Class Type not found');
    }
    // Spec 0002: archived Class Types cannot be used for new Class Plans.
    if (!classType.isActive) {
      throw new BadRequestException('Class Type is archived');
    }

    return classType;
  }

  private async getActiveVenue(partnerId: string, venueId: string) {
    const venue = await this.prisma.venue.findFirst({
      where: { id: venueId, partnerId },
      select: { status: true, timezone: true },
    });

    if (!venue) {
      throw new BadRequestException('Venue not found');
    }
    if (venue.status !== VenueStatus.ACTIVE) {
      throw new BadRequestException('Venue is archived');
    }

    return venue;
  }

  private async assertActiveInstructor(
    partnerId: string,
    instructorId: string,
  ): Promise<void> {
    const instructor = await this.prisma.instructor.findFirst({
      where: { id: instructorId, partnerId },
      select: { isActive: true },
    });

    if (!instructor) {
      throw new BadRequestException('Instructor not found');
    }
    if (!instructor.isActive) {
      throw new BadRequestException('Instructor is inactive');
    }
  }

  // Dates and times go back out as the same text the client sent in.
  private toResponse(plan: ClassPlan): ClassPlanResponseDto {
    return {
      id: plan.id,
      classTypeId: plan.classTypeId,
      venueId: plan.venueId,
      instructorId: plan.instructorId,
      title: plan.title,
      description: plan.description,
      recurrenceType: plan.recurrenceType,
      startDate: dbDateToLocalDate(plan.startDate),
      endDate: plan.endDate ? dbDateToLocalDate(plan.endDate) : null,
      weekdays: plan.weekdays,
      startTime: dbTimeToLocalTime(plan.startTime),
      durationMinutes: plan.durationMinutes,
      totalCapacity: plan.totalCapacity,
      classistaCapacity: plan.classistaCapacity,
      status: plan.status,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
