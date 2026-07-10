import { Test } from '@nestjs/testing';
import request from 'supertest';
import { describe, it } from 'vitest';

import { AppModule } from '../src/app.module';
import { HealthService } from '../src/health.service';

describe('health endpoint', () => {
  it('reports that the API process is healthy', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HealthService)
      .useValue({ ready: () => Promise.resolve() })
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    const server = app.getHttpServer() as Parameters<typeof request>[0];

    await request(server)
      .get('/v1/health')
      .expect(200)
      .expect({ service: 'api', status: 'ok' });

    await request(server)
      .get('/v1/health/ready')
      .expect(200)
      .expect({
        checks: { database: 'ok', redis: 'ok' },
        service: 'api',
        status: 'ok',
      });

    await app.close();
  });

  it('fails readiness without leaking dependency details', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(HealthService)
      .useValue({
        ready: () => Promise.reject(new Error('redis password leaked')),
      })
      .compile();
    const app = moduleRef.createNestApplication();
    await app.init();

    await request(app.getHttpServer() as Parameters<typeof request>[0])
      .get('/v1/health/ready')
      .expect(503)
      .expect(({ body }: { body: { message: string } }) => {
        if (body.message !== 'Dependencies are not ready.') {
          throw new Error('Readiness response exposed an internal error.');
        }
      });

    await app.close();
  });
});
