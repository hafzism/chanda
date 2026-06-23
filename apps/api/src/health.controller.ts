import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@suppline/contracts';

@Controller('v1/health')
export class HealthController {
  @Get()
  read(): HealthResponse {
    return {
      service: 'api',
      status: 'ok',
    };
  }
}
