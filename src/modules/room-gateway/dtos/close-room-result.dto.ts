import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CloseRoomResultDto {
  @IsBoolean()
  accepted!: boolean;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
