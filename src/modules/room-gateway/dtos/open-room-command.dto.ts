import { Type } from 'class-transformer';
import {
  IsEnum,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { RoomInactiveReason } from '../enums/room-inactive-reason.enum';

class OpenRoomGeoDto {
  @IsString()
  code!: string;

  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  lon!: number;
}

class OpenRoomPropertiesDto {
  @IsString()
  name!: string;

  @ValidateNested()
  @Type(() => OpenRoomGeoDto)
  geo!: OpenRoomGeoDto;

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  max_player_count!: number;

  @IsBoolean()
  show_in_room_list!: boolean;

  @IsOptional()
  @IsString()
  password?: string | null;

  @IsBoolean()
  no_player!: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  player_count?: number | null;

  @IsBoolean()
  unlimited_player_count!: boolean;

  @IsOptional()
  @IsBoolean()
  fake_password?: boolean | null;
}

export class OpenRoomCommandDto {
  @IsString()
  tenant!: string;

  @IsString()
  room_type!: string;

  @ValidateNested()
  @Type(() => OpenRoomPropertiesDto)
  room_properties!: OpenRoomPropertiesDto;

  @IsOptional()
  @IsString()
  token?: string;
}

export class CloseRoomCommandDto {
  @IsString()
  tenant!: string;

  @IsUUID()
  room_uuid!: string;

  @IsEnum(RoomInactiveReason)
  reason!: RoomInactiveReason;
}
