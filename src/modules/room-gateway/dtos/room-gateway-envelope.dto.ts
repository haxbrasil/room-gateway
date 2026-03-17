import { IsDefined, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { RoomGatewayMessageType } from '../constants/room-gateway-message-type.const';

export class RoomGatewayEnvelopeDto {
  @IsEnum(RoomGatewayMessageType)
  type!: RoomGatewayMessageType;

  @IsOptional()
  @IsUUID()
  request_id?: string;

  @IsDefined()
  payload!: unknown;
}
