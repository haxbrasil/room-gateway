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
    listTenantSessions: jest.fn((tenant: string) => {
      void tenant;
      return sessions;
    }),
    dispatchCommand: jest.fn(
      (
        session: RoomServerSession,
        type: RoomGatewayMessageType,
        payload: unknown,
        timeoutMs: number,
      ) => {
        void session;
        void type;
        void timeoutMs;
        return Promise.resolve(payload);
      },
    ),
    setRoomRoute: jest.fn(
      (roomUuid: string, tenant: string, socketId: string) => {
        void roomUuid;
        void tenant;
        void socketId;
      },
    ),
    findSessionByRoom: jest.fn((tenant: string, roomUuid: string) => {
      void tenant;
      void roomUuid;
      return null;
    }),
    removeRoomRoute: jest.fn((roomUuid: string) => {
      void roomUuid;
    }),
  };
}
