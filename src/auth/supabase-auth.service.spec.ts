import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SupabaseAuthService } from './supabase-auth.service.js';

// Full verification coverage (valid, invalid, expired tokens) lands at
// Checkpoint 6; this just confirms the service wires up correctly for now.
describe('SupabaseAuthService', () => {
  let service: SupabaseAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseAuthService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'https://project-ref.supabase.co' },
        },
      ],
    }).compile();

    service = module.get<SupabaseAuthService>(SupabaseAuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
