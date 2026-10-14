import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VENUE_TIMEZONE } from '../venues/venue-timezone.js';
import { SessionGenerationService } from './session-generation.service.js';

// Decides WHEN generation runs; SessionGenerationService decides WHAT it does.
// Keeping them apart means the logic can be tested without waiting for a clock.
@Injectable()
export class SessionGenerationScheduler implements OnApplicationBootstrap {
  private readonly logger = new Logger(SessionGenerationScheduler.name);

  constructor(private readonly sessionGeneration: SessionGenerationService) {}

  // Catch-up: if the app was down at 03:00 (or never ran the job), the window
  // is topped up as soon as it starts. Not awaited, so a slow or failing run
  // never delays or blocks startup.
  onApplicationBootstrap(): void {
    void this.run('startup catch-up');
  }

  // Every day at 03:00 Venue time (every MVP venue is in VENUE_TIMEZONE).
  @Cron('0 3 * * *', { timeZone: VENUE_TIMEZONE })
  handleDailyRun(): Promise<void> {
    return this.run('daily job');
  }

  // Never throws: a scheduled task that throws would only be an unhandled
  // rejection. The failure is logged instead.
  private async run(trigger: string): Promise<void> {
    try {
      const summary = await this.sessionGeneration.generateForActivePlans();
      this.logger.log(
        `${trigger}: ${summary.sessionsCreated} sessions created for ${summary.plans} plans (${summary.failedPlans} failed)`,
      );
    } catch (error) {
      this.logger.error(
        `${trigger} failed`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
