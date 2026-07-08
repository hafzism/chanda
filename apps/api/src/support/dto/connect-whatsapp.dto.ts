import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ConnectWhatsAppDto {
  @IsString()
  @MinLength(20)
  @MaxLength(512)
  accessToken!: string;

  @IsString()
  @Matches(/^[a-fA-F0-9]{32}$/, {
    message: 'appSecret must be the 32-character secret from Meta App settings',
  })
  appSecret!: string;

  @IsString()
  @Matches(/^\d{5,30}$/, {
    message: 'phoneNumberId must be the numeric ID from WhatsApp API Setup',
  })
  phoneNumberId!: string;
}
