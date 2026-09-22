import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/configure-app.js';

describe('Invalid requests (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Applies the same ValidationPipe + exception filter + CORS as main.ts,
    // so these tests exercise the real request pipeline, not a re-declared copy.
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /categories', () => {
    it('rejects an empty search value', async () => {
      const res = await request(app.getHttpServer()).get('/categories?search=').expect(400);

      expect(res.body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        path: '/categories?search=',
      });
      expect(res.body.message).toContain('search must be longer than or equal to 1 characters');
      expect(typeof res.body.timestamp).toBe('string');
    });

    it('rejects a search value over 100 characters', async () => {
      const tooLong = 'a'.repeat(101);

      const res = await request(app.getHttpServer())
        .get(`/categories?search=${tooLong}`)
        .expect(400);

      expect(res.body.message).toContain('search must be shorter than or equal to 100 characters');
    });

    it('rejects unknown query parameters', async () => {
      const res = await request(app.getHttpServer())
        .get('/categories?search=yoga&hacked=1')
        .expect(400);

      expect(res.body.message).toContain('property hacked should not exist');
    });
  });

  describe('unknown routes', () => {
    it('returns a consistently shaped 404', async () => {
      const res = await request(app.getHttpServer()).get('/does-not-exist').expect(404);

      expect(res.body).toMatchObject({
        statusCode: 404,
        error: 'Not Found',
        path: '/does-not-exist',
      });
      expect(typeof res.body.timestamp).toBe('string');
    });
  });
});
