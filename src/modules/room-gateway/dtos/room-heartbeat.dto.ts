import { Type } from 'class-transformer';
import { IsDate, IsOptional, IsUUID } from 'class-validator';

export class RoomHeartbeatDto {
  @IsUUID()
  room_uuid!: string;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  timestamp?: Date;
}
