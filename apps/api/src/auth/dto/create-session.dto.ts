import { IsString, MinLength } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  @MinLength(20)
  idToken!: string;
}
