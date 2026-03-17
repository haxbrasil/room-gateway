export const ROOM_GATEWAY_SERVER_MESSAGE_EVENT = 'server_message';
export const ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT = 'gateway_message';

export enum RoomGatewayMessageType {
  SERVER_HELLO = 'server_hello',
  CAPACITY_UPDATE = 'capacity_update',
  SUPPORTED_ROOM_TYPES_UPDATE = 'supported_room_types_update',
  ROOM_HEARTBEAT = 'room_heartbeat',
  ROOM_CLOSED = 'room_closed',
  OPEN_ROOM_RESULT = 'open_room_result',
  CLOSE_ROOM_RESULT = 'close_room_result',
  OPEN_ROOM_COMMAND = 'open_room',
  CLOSE_ROOM_COMMAND = 'close_room',
}
