import { RoomInactiveReason } from '../../src/modules/room-gateway/enums/room-inactive-reason.enum';
import { RoomGatewayService as RoomGatewayServiceEnum } from '../../src/modules/room-gateway/enums/room-gateway-service.enum';
import { OpenRoomCompletionState } from '../../src/modules/room-gateway/enums/open-room-completion-state.enum';
import { RoomCapacityBucket } from '../../src/modules/room-gateway/enums/room-capacity-bucket.enum';
import {
  CloseRoomCommand,
  OpenRoomCommand,
  RoomGeo,
  RoomProperties,
} from '../../src/modules/room-gateway/types/room-gateway-command.type';
import {
  RoomServerCapacity,
  RoomServerSession,
  RoomServerSocket,
} from '../../src/modules/room-gateway/types/room-server-session.type';
import { RoomServerClaims } from '../../src/modules/room-gateway/types/room-server-claims.type';

type RoomGeoOverrides = Partial<RoomGeo>;
type RoomPropertiesOverrides = Partial<RoomProperties>;
type OpenRoomCommandOverrides = Partial<OpenRoomCommand>;
type CloseRoomCommandOverrides = Partial<CloseRoomCommand>;
type RoomServerCapacityOverrides = Partial<RoomServerCapacity>;
export type RoomServerClaimsFixtureOverrides = Partial<RoomServerClaims>;

export function roomGeoFixture(overrides: RoomGeoOverrides = {}): RoomGeo {
  return {
    code: 'BR',
    lat: -23.55,
    lon: -46.63,
    ...overrides,
  };
}

export function roomPropertiesFixture(
  overrides: RoomPropertiesOverrides = {},
): RoomProperties {
  return {
    name: 'Arena 1',
    geo: roomGeoFixture(),
    max_player_count: 10,
    show_in_room_list: true,
    password: null,
    no_player: false,
    player_count: null,
    unlimited_player_count: false,
    fake_password: null,
    ...overrides,
  };
}

export function openRoomCommandFixture(
  overrides: OpenRoomCommandOverrides = {},
): OpenRoomCommand {
  return {
    tenant: 'tenant-a',
    room_type: '5v5',
    room_properties: roomPropertiesFixture(),
    ...overrides,
  };
}

export function openRoomCommandWithoutFakePasswordFixture(): Record<
  string,
  unknown
> {
  return {
    tenant: 'tenant-a',
    room_type: '5v5',
    room_properties: {
      name: 'Arena 1',
      geo: roomGeoFixture(),
      max_player_count: 10,
      show_in_room_list: true,
      password: null,
      no_player: false,
      player_count: null,
      unlimited_player_count: false,
    },
  };
}

export function closeRoomCommandFixture(
  overrides: CloseRoomCommandOverrides = {},
): CloseRoomCommand {
  return {
    tenant: 'tenant-a',
    room_uuid: '5b89f2b8-d425-4b34-b57d-341e7e6010f8',
    reason: RoomInactiveReason.MANUAL,
    ...overrides,
  };
}

export function roomServerCapacityFixture(
  overrides: RoomServerCapacityOverrides = {},
): RoomServerCapacity {
  return {
    [RoomCapacityBucket.PUBLIC]: 2,
    [RoomCapacityBucket.PRIVATE]: 1,
    ...overrides,
  };
}

export function roomServerSocketFixture(
  overrides: Partial<MockRoomServerSocket> = {},
): MockRoomServerSocket {
  return {
    id: 'socket-1',
    connected: true,
    emit: jest.fn<boolean, [string, unknown]>(() => true),
    ...overrides,
  };
}

export type MockRoomServerSocket = RoomServerSocket & {
  emit: jest.Mock<boolean, [string, unknown]>;
};

export function roomServerSessionFixture(
  overrides: Partial<RoomServerSession> = {},
): RoomServerSession {
  return {
    socket: roomServerSocketFixture(),
    tenant: 'tenant-a',
    serverId: '00000000-0000-4000-8000-000000000001',
    supportedRoomTypes: new Set(['5v5']),
    capacity: roomServerCapacityFixture(),
    location: {
      region: 'sa-east-1',
      lat: -23.55,
      lon: -46.63,
    },
    ...overrides,
  };
}

export function roomServerClaimsFixture(
  overrides: RoomServerClaimsFixtureOverrides = {},
): RoomServerClaims {
  return {
    tenant: 'tenant-a',
    service: RoomGatewayServiceEnum.ROOM_SERVER,
    server_id: '00000000-0000-4000-8000-000000000001',
    ...overrides,
  };
}

export function openRoomResultOpenFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    state: OpenRoomCompletionState.OPEN,
    room_uuid: '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
    invite: 'ABC123',
    ...overrides,
  };
}

export function openRoomResultFailedFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    state: OpenRoomCompletionState.FAILED,
    code: 'server_rejected',
    message: 'Cannot open room',
    ...overrides,
  };
}

export function closeRoomResultAcceptedFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    accepted: true,
    ...overrides,
  };
}

export function closeRoomResultRejectedFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    accepted: false,
    code: 'already_closed',
    message: 'Room already closed',
    ...overrides,
  };
}
