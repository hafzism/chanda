import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateInboxReplyDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4_000)
  body!: string;

  @IsOptional()
  @IsUUID()
  draftId?: string;
}
