import { ArrayMaxSize, IsArray, IsString, MaxLength } from 'class-validator';

export class UpdateWidgetOriginsDto {
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(2_048, { each: true })
  origins!: string[];
}
