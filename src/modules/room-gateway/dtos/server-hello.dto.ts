import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ServerHelloCapacityDto {
  @IsInt()
  @Min(0)
  public!: number;

  @IsInt()
  @Min(0)
  private!: number;
}

export class ServerHelloLocationDto {
  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @Type(() => Number)
  @Min(-90)
  @Max(90)
  lat?: number;

  @IsOptional()
  @Type(() => Number)
  @Min(-180)
  @Max(180)
  lon?: number;
}

export class ServerHelloDto {
  @IsUUID()
  server_id!: string;

  @IsArray()
  @IsString({ each: true })
  supported_room_types!: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  active_rooms?: string[];

  @ValidateNested()
  @Type(() => ServerHelloCapacityDto)
  capacity!: ServerHelloCapacityDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ServerHelloLocationDto)
  location?: ServerHelloLocationDto;
}
