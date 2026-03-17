import { RoomGatewayMessageType } from '../../src/modules/room-gateway/constants/room-gateway-message-type.const';
import { CloseRoomCompletionState } from '../../src/modules/room-gateway/enums/close-room-completion-state.enum';
import { CloseRoomFailureCode } from '../../src/modules/room-gateway/enums/close-room-failure-code.enum';
import { OpenRoomCompletionState } from '../../src/modules/room-gateway/enums/open-room-completion-state.enum';
import { OpenRoomFailureCode } from '../../src/modules/room-gateway/enums/open-room-failure-code.enum';
import { RoomCapacityBucket } from '../../src/modules/room-gateway/enums/room-capacity-bucket.enum';
import { RoomGatewayStateService } from '../../src/modules/room-gateway/room-gateway-state.service';
import { RoomGatewayService } from '../../src/modules/room-gateway/room-gateway.service';
import {
  closeRoomCommandFixture,
  closeRoomResultAcceptedFixture,
  closeRoomResultRejectedFixture,
  openRoomCommandFixture,
  openRoomResultFailedFixture,
  openRoomResultOpenFixture,
  roomServerSessionFixture,
  roomServerSocketFixture,
} from '../fixtures/room-gateway.fixture';

describe('RoomGatewayService (e2e)', () => {
  let state: RoomGatewayStateService;
  let service: RoomGatewayService;

  beforeEach(() => {
    state = new RoomGatewayStateService();
    service = new RoomGatewayService(state);
  });

  it('returns no_server_for_tenant when tenant has no connected servers', async () => {
    const result = await service.handleOpenRoomCommand(
      openRoomCommandFixture(),
    );

    expect(result).toEqual({
      state: OpenRoomCompletionState.FAILED,
      code: OpenRoomFailureCode.NO_SERVER_FOR_TENANT,
      message: undefined,
    });
  });

  it('returns unsupported_room_type when no server supports requested room type', async () => {
    state.registerSession(
      roomServerSessionFixture({
        supportedRoomTypes: new Set(['futsal']),
      }),
    );

    const result = await service.handleOpenRoomCommand(
      openRoomCommandFixture(),
    );

    expect(result).toMatchObject({
      state: OpenRoomCompletionState.FAILED,
      code: OpenRoomFailureCode.UNSUPPORTED_ROOM_TYPE,
    });
  });

  it('returns no_capacity_available when all matching servers are full', async () => {
    state.registerSession(
      roomServerSessionFixture({
        capacity: {
          [RoomCapacityBucket.PUBLIC]: 0,
          [RoomCapacityBucket.PRIVATE]: 0,
        },
      }),
    );

    const result = await service.handleOpenRoomCommand(
      openRoomCommandFixture(),
    );

    expect(result).toMatchObject({
      state: OpenRoomCompletionState.FAILED,
      code: OpenRoomFailureCode.NO_CAPACITY_AVAILABLE,
    });
  });

  it('returns dispatch_timeout when room command dispatch fails', async () => {
    const session = roomServerSessionFixture();
    state.registerSession(session);
    jest
      .spyOn(state, 'dispatchCommand')
      .mockRejectedValue(new Error('timeout'));

    const result = await service.handleOpenRoomCommand(
      openRoomCommandFixture(),
    );

    expect(result).toMatchObject({
      state: OpenRoomCompletionState.FAILED,
      code: OpenRoomFailureCode.DISPATCH_TIMEOUT,
    });
  });

  it('returns server_rejected when open result payload is invalid', async () => {
    state.registerSession(roomServerSessionFixture());
    jest.spyOn(state, 'dispatchCommand').mockResolvedValue({ accepted: true });

    const result = await service.handleOpenRoomCommand(
      openRoomCommandFixture(),
    );

    expect(result).toEqual({
      state: OpenRoomCompletionState.FAILED,
      code: OpenRoomFailureCode.SERVER_REJECTED,
      message: 'Invalid open_room_result payload',
    });
  });

  it('returns open completion and stores route when open succeeds', async () => {
    const session = roomServerSessionFixture();
    state.registerSession(session);
    jest
      .spyOn(state, 'dispatchCommand')
      .mockResolvedValue(openRoomResultOpenFixture());

    const result = await service.handleOpenRoomCommand(
      openRoomCommandFixture(),
    );

    expect(result).toEqual({
      state: OpenRoomCompletionState.OPEN,
      room_uuid: '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      invite: 'ABC123',
    });
    expect(
      state.findSessionByRoom(
        'tenant-a',
        '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      ),
    ).toBe(session);
  });

  it('returns failed completion from server payload when open fails', async () => {
    state.registerSession(roomServerSessionFixture());
    jest.spyOn(state, 'dispatchCommand').mockResolvedValue(
      openRoomResultFailedFixture({
        code: 'token_invalid',
        message: 'Invalid token',
      }),
    );

    const result = await service.handleOpenRoomCommand(
      openRoomCommandFixture(),
    );

    expect(result).toEqual({
      state: OpenRoomCompletionState.FAILED,
      code: 'token_invalid',
      message: 'Invalid token',
    });
  });

  it('uses deterministic tie-breaker by server id when capacities are equal', async () => {
    const lowerServer = roomServerSessionFixture({
      serverId: '00000000-0000-4000-8000-000000000001',
      socket: roomServerSocketFixture({ id: 'lower' }),
    });
    const higherServer = roomServerSessionFixture({
      serverId: '00000000-0000-4000-8000-000000000099',
      socket: roomServerSocketFixture({ id: 'higher' }),
    });
    state.registerSession(higherServer);
    state.registerSession(lowerServer);

    const dispatchSpy = jest
      .spyOn(state, 'dispatchCommand')
      .mockResolvedValue(openRoomResultOpenFixture());

    await service.handleOpenRoomCommand(openRoomCommandFixture());

    expect(dispatchSpy).toHaveBeenCalledWith(
      lowerServer,
      RoomGatewayMessageType.OPEN_ROOM_COMMAND,
      expect.any(Object),
      15_000,
    );
  });

  it('returns no_server_for_room when closing an unrouted room', async () => {
    const result = await service.handleCloseRoomCommand(
      closeRoomCommandFixture(),
    );

    expect(result).toEqual({
      state: CloseRoomCompletionState.FAILED,
      code: CloseRoomFailureCode.NO_SERVER_FOR_ROOM,
      message: undefined,
    });
  });

  it('returns dispatch_timeout when close command dispatch fails', async () => {
    const session = roomServerSessionFixture();
    state.registerSession(session);
    state.setRoomRoute(
      '5b89f2b8-d425-4b34-b57d-341e7e6010f8',
      'tenant-a',
      session.socket.id,
    );
    jest
      .spyOn(state, 'dispatchCommand')
      .mockRejectedValue(new Error('timeout'));

    const result = await service.handleCloseRoomCommand(
      closeRoomCommandFixture(),
    );

    expect(result).toMatchObject({
      state: CloseRoomCompletionState.FAILED,
      code: CloseRoomFailureCode.DISPATCH_TIMEOUT,
    });
  });

  it('returns server_rejected when close result payload is invalid', async () => {
    const session = roomServerSessionFixture();
    state.registerSession(session);
    state.setRoomRoute(
      '5b89f2b8-d425-4b34-b57d-341e7e6010f8',
      'tenant-a',
      session.socket.id,
    );
    jest.spyOn(state, 'dispatchCommand').mockResolvedValue({ invalid: true });

    const result = await service.handleCloseRoomCommand(
      closeRoomCommandFixture(),
    );

    expect(result).toEqual({
      state: CloseRoomCompletionState.FAILED,
      code: CloseRoomFailureCode.SERVER_REJECTED,
      message: 'Invalid close_room_result payload',
    });
  });

  it('returns close failure payload when server rejects close', async () => {
    const session = roomServerSessionFixture();
    state.registerSession(session);
    state.setRoomRoute(
      '5b89f2b8-d425-4b34-b57d-341e7e6010f8',
      'tenant-a',
      session.socket.id,
    );
    jest
      .spyOn(state, 'dispatchCommand')
      .mockResolvedValue(closeRoomResultRejectedFixture());

    const result = await service.handleCloseRoomCommand(
      closeRoomCommandFixture(),
    );

    expect(result).toEqual({
      state: CloseRoomCompletionState.FAILED,
      code: 'already_closed',
      message: 'Room already closed',
    });
  });

  it('returns closed and clears route when close succeeds', async () => {
    const session = roomServerSessionFixture();
    state.registerSession(session);
    state.setRoomRoute(
      '5b89f2b8-d425-4b34-b57d-341e7e6010f8',
      'tenant-a',
      session.socket.id,
    );
    jest
      .spyOn(state, 'dispatchCommand')
      .mockResolvedValue(closeRoomResultAcceptedFixture());

    const result = await service.handleCloseRoomCommand(
      closeRoomCommandFixture(),
    );

    expect(result).toEqual({
      state: CloseRoomCompletionState.CLOSED,
    });
    expect(
      state.findSessionByRoom(
        'tenant-a',
        '5b89f2b8-d425-4b34-b57d-341e7e6010f8',
      ),
    ).toBeNull();
  });
});
