import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateInboxNoteDto {
  @IsString()
  @MinLength(1)
  @MaxLength(4_000)
  body!: string;
}
