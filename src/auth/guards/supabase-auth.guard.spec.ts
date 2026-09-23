import { Test, TestingModule } from '@nestjs/testing';
import { SupabaseAuthGuard } from './supabase-auth.guard.js';
import { SupabaseAuthService } from '../supabase-auth.service.js';

// Full coverage (missing, invalid, expired, and valid tokens) lands at
// Checkpoint 6; this just confirms the guard wires up correctly for now.
describe('SupabaseAuthGuard', () => {
  let guard: SupabaseAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseAuthGuard,
        { provide: SupabaseAuthService, useValue: {} },
      ],
    }).compile();

    guard = module.get<SupabaseAuthGuard>(SupabaseAuthGuard);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });
});
