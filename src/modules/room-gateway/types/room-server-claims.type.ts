import { RoomGatewayService } from '../enums/room-gateway-service.enum';

export type RoomServerClaims = {
  tenant: string;
  service: RoomGatewayService.ROOM_SERVER;
  server_id: string;
};
