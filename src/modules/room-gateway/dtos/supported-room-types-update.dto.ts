import { IsArray, IsString } from 'class-validator';

export class SupportedRoomTypesUpdateDto {
  @IsArray()
  @IsString({ each: true })
  supported_room_types!: string[];
}
