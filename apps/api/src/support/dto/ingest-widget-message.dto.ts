import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class IngestWidgetMessageDto {
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
