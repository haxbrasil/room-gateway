import { CloseRoomCompletionState } from '../../src/modules/room-gateway/enums/close-room-completion-state.enum';
import { OpenRoomCompletionState } from '../../src/modules/room-gateway/enums/open-room-completion-state.enum';
import { RoomGatewayService } from '../../src/modules/room-gateway/room-gateway.service';
import {
  CloseRoomCommand,
  CloseRoomCompletion,
  OpenRoomCommand,
  OpenRoomCompletion,
} from '../../src/modules/room-gateway/types/room-gateway-command.type';

type RoomGatewayServiceMock = Pick<
  RoomGatewayService,
  'handleOpenRoomCommand' | 'handleCloseRoomCommand'
>;

export function roomGatewayServiceMockFixture(): jest.Mocked<RoomGatewayServiceMock> {
  return {
    handleOpenRoomCommand: jest.fn<
      Promise<OpenRoomCompletion>,
      [OpenRoomCommand]
    >(() =>
      Promise.resolve({
        state: OpenRoomCompletionState.FAILED,
        code: 'not_implemented',
      }),
    ),
    handleCloseRoomCommand: jest.fn<
      Promise<CloseRoomCompletion>,
      [CloseRoomCommand]
    >(() =>
      Promise.resolve({
        state: CloseRoomCompletionState.FAILED,
        code: 'not_implemented',
      }),
    ),
  };
}
