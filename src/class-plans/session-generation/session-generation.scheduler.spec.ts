import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { SessionGenerationScheduler } from './session-generation.scheduler.js';
import { SessionGenerationService } from './session-generation.service.js';

describe('SessionGenerationScheduler', () => {
  const generationMock = { generateForActivePlans: vi.fn() };

  let scheduler: SessionGenerationScheduler;

  beforeEach(async () => {
    generationMock.generateForActivePlans
      .mockReset()
      .mockResolvedValue({ plans: 2, sessionsCreated: 8, failedPlans: 0 });
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    const module = await Test.createTestingModule({
      providers: [
        SessionGenerationScheduler,
        { provide: SessionGenerationService, useValue: generationMock },
      ],
    }).compile();

    scheduler = module.get(SessionGenerationScheduler);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('runs generation for all active plans on the daily job', async () => {
    await scheduler.handleDailyRun();

    expect(generationMock.generateForActivePlans).toHaveBeenCalledTimes(1);
  });

  it('runs a catch-up generation on startup', async () => {
    scheduler.onApplicationBootstrap();

    expect(generationMock.generateForActivePlans).toHaveBeenCalledTimes(1);
  });

  it('does not block startup while generation is still running', () => {
    generationMock.generateForActivePlans.mockReturnValue(
      new Promise(() => {}),
    );

    // Returns immediately (void) even though the promise never settles.
    expect(scheduler.onApplicationBootstrap()).toBeUndefined();
  });

  it('logs and swallows a failure instead of throwing', async () => {
    generationMock.generateForActivePlans.mockRejectedValue(
      new Error('db down'),
    );

    await expect(scheduler.handleDailyRun()).resolves.toBeUndefined();
    expect(Logger.prototype.error).toHaveBeenCalledWith(
      'daily job failed',
      expect.any(String),
    );
  });
});
