import { RoomInactiveReason } from '../enums/room-inactive-reason.enum';

export type RoomHeartbeatGatewayEvent = {
  event_id: string;
  tenant: string;
  room_uuid: string;
  timestamp: string;
};

export type RoomClosedGatewayEvent = {
  event_id: string;
  tenant: string;
  room_uuid: string;
  reason: RoomInactiveReason;
  timestamp: string;
  message?: string;
};
