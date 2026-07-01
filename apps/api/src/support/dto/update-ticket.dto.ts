import { IsIn, IsOptional } from 'class-validator';

const priorities = ['low', 'normal', 'high', 'urgent'] as const;
const statuses = [
  'open',
  'escalated',
  'waiting_customer',
  'waiting_agent',
  'resolved',
  'closed',
] as const;

export class UpdateTicketDto {
  @IsOptional()
  @IsIn(priorities)
  priority?: (typeof priorities)[number];

  @IsOptional()
  @IsIn(statuses)
  status?: (typeof statuses)[number];
}
