import { Inject, Injectable } from '@nestjs/common';

import type { AnalyticsRepository } from './analytics.types';

export const ANALYTICS_REPOSITORY = Symbol('ANALYTICS_REPOSITORY');

@Injectable()
export class AnalyticsService {
  constructor(
    @Inject(ANALYTICS_REPOSITORY)
    private readonly repository: AnalyticsRepository,
  ) {}

  overview(workspaceId: string) {
    return this.repository.overview(workspaceId);
  }
}
