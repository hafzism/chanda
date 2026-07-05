import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateEvaluationCaseDto {
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  question!: string;

  @IsUUID()
  expectedDocumentId!: string;
}
