import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { OpenRoomCompletionState } from '../enums/open-room-completion-state.enum';

export class OpenRoomResultDto {
  @IsEnum(OpenRoomCompletionState)
  state!: OpenRoomCompletionState;

  @IsOptional()
  @IsUUID()
  room_uuid?: string;

  @IsOptional()
  @IsString()
  invite?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  message?: string;
}
