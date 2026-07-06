import { IsString, Matches, MaxLength } from 'class-validator';

export class ConnectTelegramDto {
  @IsString()
  @MaxLength(100)
  @Matches(/^\d{6,15}:[A-Za-z0-9_-]{30,80}$/, {
    message: 'botToken must be a valid token copied from BotFather',
  })
  botToken!: string;
}
