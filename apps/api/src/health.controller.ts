import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import type { HealthResponse, ReadinessResponse } from '@suppline/contracts';

import { HealthService } from './health.service';

@Controller('v1/health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  read(): HealthResponse {
    return {
      service: 'api',
      status: 'ok',
    };
  }

  @Get('ready')
  async ready(): Promise<ReadinessResponse> {
    try {
      await this.health.ready();
    } catch {
      throw new ServiceUnavailableException('Dependencies are not ready.');
    }
    return {
      checks: { database: 'ok', redis: 'ok' },
      service: 'api',
      status: 'ok',
    };
  }
}
