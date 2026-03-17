import { RoomGatewayMessageType } from '../../src/modules/room-gateway/constants/room-gateway-message-type.const';
import { RoomInactiveReason } from '../../src/modules/room-gateway/enums/room-inactive-reason.enum';
import { roomServerCapacityFixture } from './room-gateway.fixture';

export type WsEnvelope<TPayload> = {
  type: RoomGatewayMessageType;
  request_id?: string;
  payload: TPayload;
};

type WsEnvelopeOverrides<TPayload> = {
  type?: RoomGatewayMessageType;
  request_id?: string;
  payload?: Partial<TPayload>;
};

export type ServerHelloPayload = {
  server_id: string;
  supported_room_types: string[];
  active_rooms: string[];
  capacity: {
    public: number;
    private: number;
  };
  location: {
    region: string;
    lat: number;
    lon: number;
  };
};

export function serverHelloEnvelopeFixture(
  overrides: WsEnvelopeOverrides<ServerHelloPayload> = {},
): WsEnvelope<ServerHelloPayload> {
  return {
    type: overrides.type ?? RoomGatewayMessageType.SERVER_HELLO,
    request_id: overrides.request_id,
    payload: {
      server_id:
        overrides.payload?.server_id ?? '00000000-0000-4000-8000-000000000001',
      supported_room_types: overrides.payload?.supported_room_types ?? [
        '5v5',
        'futsal',
      ],
      active_rooms: overrides.payload?.active_rooms ?? [
        '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      ],
      capacity: overrides.payload?.capacity ?? roomServerCapacityFixture(),
      location: overrides.payload?.location ?? {
        region: 'sa-east-1',
        lat: -23.55,
        lon: -46.63,
      },
    },
  };
}

export function capacityUpdateEnvelopeFixture(
  overrides: WsEnvelopeOverrides<{ public: number; private: number }> = {},
): WsEnvelope<{ public: number; private: number }> {
  return {
    type: overrides.type ?? RoomGatewayMessageType.CAPACITY_UPDATE,
    request_id: overrides.request_id,
    payload: {
      public: overrides.payload?.public ?? 6,
      private: overrides.payload?.private ?? 4,
    },
  };
}

export function supportedTypesUpdateEnvelopeFixture(
  overrides: WsEnvelopeOverrides<{ supported_room_types: string[] }> = {},
): WsEnvelope<{ supported_room_types: string[] }> {
  return {
    type: overrides.type ?? RoomGatewayMessageType.SUPPORTED_ROOM_TYPES_UPDATE,
    request_id: overrides.request_id,
    payload: {
      supported_room_types: overrides.payload?.supported_room_types ?? [
        '5v5',
        '7v7',
      ],
    },
  };
}

export function roomHeartbeatEnvelopeFixture(
  overrides: WsEnvelopeOverrides<{
    room_uuid: string;
    timestamp: string;
  }> = {},
): WsEnvelope<{ room_uuid: string; timestamp: string }> {
  return {
    type: overrides.type ?? RoomGatewayMessageType.ROOM_HEARTBEAT,
    request_id: overrides.request_id,
    payload: {
      room_uuid:
        overrides.payload?.room_uuid ?? '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      timestamp: overrides.payload?.timestamp ?? '2026-03-16T23:00:00.000Z',
    },
  };
}

export function roomClosedEnvelopeFixture(
  overrides: WsEnvelopeOverrides<{
    room_uuid: string;
    reason: RoomInactiveReason;
    timestamp: string;
    message: string;
  }> = {},
): WsEnvelope<{
  room_uuid: string;
  reason: RoomInactiveReason;
  timestamp: string;
  message: string;
}> {
  return {
    type: overrides.type ?? RoomGatewayMessageType.ROOM_CLOSED,
    request_id: overrides.request_id,
    payload: {
      room_uuid:
        overrides.payload?.room_uuid ?? '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      reason: overrides.payload?.reason ?? RoomInactiveReason.CLOSED,
      timestamp: overrides.payload?.timestamp ?? '2026-03-16T23:00:01.000Z',
      message: overrides.payload?.message ?? 'Normal closure',
    },
  };
}

export function openRoomResultEnvelopeFixture(
  overrides: WsEnvelopeOverrides<{
    state: 'open';
    room_uuid: string;
    invite: string;
  }> = {},
): WsEnvelope<{ state: 'open'; room_uuid: string; invite: string }> {
  return {
    type: overrides.type ?? RoomGatewayMessageType.OPEN_ROOM_RESULT,
    request_id: overrides.request_id ?? '90ecee6d-2ee1-4605-bf13-dd7f6fb6e8fb',
    payload: {
      state: overrides.payload?.state ?? 'open',
      room_uuid:
        overrides.payload?.room_uuid ?? '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      invite: overrides.payload?.invite ?? 'ABC123',
    },
  };
}

export function closeRoomResultEnvelopeFixture(
  overrides: WsEnvelopeOverrides<{ accepted: boolean }> = {},
): WsEnvelope<{ accepted: boolean }> {
  return {
    type: overrides.type ?? RoomGatewayMessageType.CLOSE_ROOM_RESULT,
    request_id: overrides.request_id ?? '90ecee6d-2ee1-4605-bf13-dd7f6fb6e8fb',
    payload: {
      accepted: overrides.payload?.accepted ?? true,
    },
  };
}
