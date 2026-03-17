import { Type } from 'class-transformer';
import { IsDate, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { RoomInactiveReason } from '../enums/room-inactive-reason.enum';

export class RoomClosedDto {
  @IsUUID()
  room_uuid!: string;

  @IsEnum(RoomInactiveReason)
  reason!: RoomInactiveReason;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  timestamp?: Date;

  @IsOptional()
  @IsString()
  message?: string;
}
