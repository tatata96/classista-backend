import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller.js';
import { SupabaseAuthGuard } from './guards/supabase-auth.guard.js';

// Full coverage (401 on missing/invalid/expired, 200 with a valid token)
// lands at Checkpoint 6; this just confirms the controller wires up correctly.
describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
    })
      .overrideGuard(SupabaseAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
