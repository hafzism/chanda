import { IsBoolean } from 'class-validator';

export class SetDocumentEnabledDto {
  @IsBoolean()
  isEnabled!: boolean;
}
