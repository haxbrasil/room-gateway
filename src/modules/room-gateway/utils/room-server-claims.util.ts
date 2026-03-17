import { isObjectWithFields } from '../../../common/data/object-field.util';
import { RoomGatewayService } from '../enums/room-gateway-service.enum';
import { RoomServerClaims } from '../types/room-server-claims.type';

const ROOM_SERVER_SERVICE = 'room-server';

export function parseRoomServerClaims(value: unknown): RoomServerClaims | null {
  if (
    !isObjectWithFields(value, 'tenant', 'service', 'server_id') ||
    typeof value.tenant !== 'string' ||
    typeof value.service !== 'string' ||
    typeof value.server_id !== 'string'
  ) {
    return null;
  }

  if (value.service !== ROOM_SERVER_SERVICE) {
    return null;
  }

  return {
    tenant: value.tenant,
    service: RoomGatewayService.ROOM_SERVER,
    server_id: value.server_id,
  };
}
