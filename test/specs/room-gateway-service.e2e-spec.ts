import {
  ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
  ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT,
  RoomGatewayMessageType,
} from '../../src/modules/room-gateway/constants/room-gateway-message-type.const';
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
  openRoomCommandFixture,
} from '../fixtures/room-gateway.fixture';
import {
  closeRoomResultEnvelopeFixture,
  openRoomResultEnvelopeFixture,
} from '../fixtures/ws-messages.fixture';
import { getE2ERuntime } from '../support/runtime';
import {
  expectNoSocketEvent,
  waitForSocketEvent,
} from '../support/socket-await.util';
import {
  connectRoomServerClient,
  emitServerHelloAndWait,
  requireSocketId,
} from '../support/ws-app.util';
import { Socket } from 'socket.io-client';

describe('RoomGatewayService (e2e)', () => {
  let sockets: Socket[];

  beforeEach(() => {
    sockets = [];
  });

  afterEach(() => {
    for (const socket of sockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }
  });

  it('returns no_server_for_tenant when the tenant has no connected servers', async () => {
    const { app } = getE2ERuntime();
    const service = app.get(RoomGatewayService);

    const result = await service.handleOpenRoomCommand(
      openRoomCommandFixture(),
    );

    expect(result).toEqual({
      state: OpenRoomCompletionState.FAILED,
      code: OpenRoomFailureCode.NO_SERVER_FOR_TENANT,
      message: undefined,
    });
  });

  it('returns unsupported_room_type when no connected server supports the room type', async () => {
    const { app } = getE2ERuntime();
    const service = app.get(RoomGatewayService);
    const connection = await connectRoomServerClient();
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection, {
      supported_room_types: ['futsal'],
    });

    const result = await service.handleOpenRoomCommand(
      openRoomCommandFixture(),
    );

    expect(result).toMatchObject({
      state: OpenRoomCompletionState.FAILED,
      code: OpenRoomFailureCode.UNSUPPORTED_ROOM_TYPE,
    });
  });

  it('returns no_capacity_available when all matching servers are full', async () => {
    const { app } = getE2ERuntime();
    const service = app.get(RoomGatewayService);
    const connection = await connectRoomServerClient();
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection, {
      capacity: {
        [RoomCapacityBucket.PUBLIC]: 0,
        [RoomCapacityBucket.PRIVATE]: 0,
      },
    });

    const result = await service.handleOpenRoomCommand(
      openRoomCommandFixture(),
    );

    expect(result).toMatchObject({
      state: OpenRoomCompletionState.FAILED,
      code: OpenRoomFailureCode.NO_CAPACITY_AVAILABLE,
    });
  });

  it('returns server_rejected when the room server sends an invalid open result payload', async () => {
    const { app } = getE2ERuntime();
    const service = app.get(RoomGatewayService);
    const connection = await connectRoomServerClient();
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection);

    const resultPromise = service.handleOpenRoomCommand(
      openRoomCommandFixture(),
    );

    const emittedCommand = await waitForSocketEvent<{
      request_id: string;
      type: RoomGatewayMessageType;
    }>(connection.socket, ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT);

    connection.socket.emit(ROOM_GATEWAY_SERVER_MESSAGE_EVENT, {
      type: RoomGatewayMessageType.OPEN_ROOM_RESULT,
      request_id: emittedCommand.request_id,
      payload: { accepted: true },
    });

    await expect(resultPromise).resolves.toEqual({
      state: OpenRoomCompletionState.FAILED,
      code: OpenRoomFailureCode.SERVER_REJECTED,
      message: 'Invalid open_room_result payload',
    });
  });

  it('returns open completion and stores the room route when opening succeeds', async () => {
    const { app } = getE2ERuntime();
    const service = app.get(RoomGatewayService);
    const state = app.get(RoomGatewayStateService);
    const connection = await connectRoomServerClient();
    const socketId = requireSocketId(connection.socket);
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection);

    const resultPromise = service.handleOpenRoomCommand(
      openRoomCommandFixture(),
    );

    const emittedCommand = await waitForSocketEvent<{
      request_id: string;
    }>(connection.socket, ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT);

    connection.socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      openRoomResultEnvelopeFixture({
        request_id: emittedCommand.request_id,
      }),
    );

    await expect(resultPromise).resolves.toEqual({
      state: OpenRoomCompletionState.OPEN,
      room_uuid: '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      invite: 'ABC123',
    });
    expect(
      state.findSessionByRoom(
        connection.claims.tenant,
        '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      )?.socket.id,
    ).toBe(socketId);
  });

  it('returns failed completion from the room server payload when opening fails', async () => {
    const { app } = getE2ERuntime();
    const service = app.get(RoomGatewayService);
    const connection = await connectRoomServerClient();
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection);

    const resultPromise = service.handleOpenRoomCommand(
      openRoomCommandFixture(),
    );

    const emittedCommand = await waitForSocketEvent<{
      request_id: string;
    }>(connection.socket, ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT);

    connection.socket.emit(ROOM_GATEWAY_SERVER_MESSAGE_EVENT, {
      type: RoomGatewayMessageType.OPEN_ROOM_RESULT,
      request_id: emittedCommand.request_id,
      payload: {
        state: OpenRoomCompletionState.FAILED,
        code: 'token_invalid',
        message: 'Invalid token',
      },
    });

    await expect(resultPromise).resolves.toEqual({
      state: OpenRoomCompletionState.FAILED,
      code: 'token_invalid',
      message: 'Invalid token',
    });
  });

  it('uses deterministic server_id tie-breaks when capacities are equal', async () => {
    const { app } = getE2ERuntime();
    const service = app.get(RoomGatewayService);
    const lower = await connectRoomServerClient({
      server_id: '00000000-0000-4000-8000-000000000001',
    });
    const higher = await connectRoomServerClient({
      server_id: '00000000-0000-4000-8000-000000000099',
    });
    sockets.push(lower.socket, higher.socket);

    await emitServerHelloAndWait(lower);
    await emitServerHelloAndWait(higher);

    const resultPromise = service.handleOpenRoomCommand(
      openRoomCommandFixture(),
    );

    const lowerCommand = await waitForSocketEvent<{
      request_id: string;
    }>(lower.socket, ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT);

    await expectNoSocketEvent(
      higher.socket,
      ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT,
    );

    lower.socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      openRoomResultEnvelopeFixture({
        request_id: lowerCommand.request_id,
      }),
    );

    await expect(resultPromise).resolves.toEqual(
      expect.objectContaining({
        state: OpenRoomCompletionState.OPEN,
      }),
    );
  });

  it('returns no_server_for_room when closing an unrouted room', async () => {
    const { app } = getE2ERuntime();
    const service = app.get(RoomGatewayService);

    const result = await service.handleCloseRoomCommand(
      closeRoomCommandFixture(),
    );

    expect(result).toEqual({
      state: CloseRoomCompletionState.FAILED,
      code: CloseRoomFailureCode.NO_SERVER_FOR_ROOM,
      message: undefined,
    });
  });

  it('returns server_rejected when the room server sends an invalid close result payload', async () => {
    const { app } = getE2ERuntime();
    const service = app.get(RoomGatewayService);
    const connection = await connectRoomServerClient();
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection, {
      active_rooms: ['5b89f2b8-d425-4b34-b57d-341e7e6010f8'],
    });

    const resultPromise = service.handleCloseRoomCommand(
      closeRoomCommandFixture(),
    );

    const emittedCommand = await waitForSocketEvent<{
      request_id: string;
    }>(connection.socket, ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT);

    connection.socket.emit(ROOM_GATEWAY_SERVER_MESSAGE_EVENT, {
      type: RoomGatewayMessageType.CLOSE_ROOM_RESULT,
      request_id: emittedCommand.request_id,
      payload: { state: 'invalid' },
    });

    await expect(resultPromise).resolves.toEqual({
      state: CloseRoomCompletionState.FAILED,
      code: CloseRoomFailureCode.SERVER_REJECTED,
      message: 'Invalid close_room_result payload',
    });
  });

  it('returns closed and clears the route when closing succeeds', async () => {
    const { app } = getE2ERuntime();
    const service = app.get(RoomGatewayService);
    const state = app.get(RoomGatewayStateService);
    const connection = await connectRoomServerClient();
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection, {
      active_rooms: ['5b89f2b8-d425-4b34-b57d-341e7e6010f8'],
    });

    const resultPromise = service.handleCloseRoomCommand(
      closeRoomCommandFixture(),
    );

    const emittedCommand = await waitForSocketEvent<{
      request_id: string;
    }>(connection.socket, ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT);

    connection.socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      closeRoomResultEnvelopeFixture({
        request_id: emittedCommand.request_id,
        payload: closeRoomResultAcceptedFixture(),
      }),
    );

    await expect(resultPromise).resolves.toEqual({
      state: CloseRoomCompletionState.CLOSED,
    });
    expect(
      state.findSessionByRoom(
        connection.claims.tenant,
        '5b89f2b8-d425-4b34-b57d-341e7e6010f8',
      ),
    ).toBeNull();
  });
});
