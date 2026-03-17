import { RoomGatewayMessageType } from '../../src/modules/room-gateway/constants/room-gateway-message-type.const';
import { RoomGatewayStateService } from '../../src/modules/room-gateway/room-gateway-state.service';
import { RoomServerSession } from '../../src/modules/room-gateway/types/room-server-session.type';

type RoomGatewayStateServiceMock = Pick<
  RoomGatewayStateService,
  | 'listTenantSessions'
  | 'dispatchCommand'
  | 'setRoomRoute'
  | 'findSessionByRoom'
  | 'removeRoomRoute'
>;

export function roomGatewayStateServiceMockFixture(
  sessions: RoomServerSession[] = [],
): jest.Mocked<RoomGatewayStateServiceMock> {
  return {
    listTenantSessions: jest.fn((_tenant: string) => sessions),
    dispatchCommand: jest.fn(
      async (
        _session: RoomServerSession,
        _type: RoomGatewayMessageType,
        payload: unknown,
        _timeoutMs: number,
      ) => payload,
    ),
    setRoomRoute: jest.fn(
      (_roomUuid: string, _tenant: string, _socketId: string) => undefined,
    ),
    findSessionByRoom: jest.fn((_tenant: string, _roomUuid: string) => null),
    removeRoomRoute: jest.fn((_roomUuid: string) => undefined),
  };
}
