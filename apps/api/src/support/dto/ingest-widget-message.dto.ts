import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Matches,
  MinLength,
} from 'class-validator';

export class IngestWidgetMessageDto {
  @Matches(/^[A-Za-z0-9_-]{43}$/)
  conversationToken!: string;

  @IsUUID()
  visitorId!: string;

  @IsUUID()
  threadId!: string;

  @IsUUID()
  messageId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(4_000)
  body!: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string;
}
