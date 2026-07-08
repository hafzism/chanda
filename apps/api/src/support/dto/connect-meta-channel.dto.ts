import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class ConnectMetaChannelDto {
  @IsString()
  @Matches(/^\d{5,40}$/, {
    message: 'assetId must be the numeric Page or Instagram account ID',
  })
  assetId!: string;

  @IsString()
  @Matches(/^[a-fA-F0-9]{32}$/, {
    message: 'appSecret must be the 32-character secret from Meta App settings',
  })
  appSecret!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(512)
  pageAccessToken!: string;
}
