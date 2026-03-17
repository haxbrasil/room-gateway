import { Socket } from 'socket.io-client';
import {
  RoomGatewayMessageType,
  ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
  ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT,
} from '../../src/modules/room-gateway/constants/room-gateway-message-type.const';
import { RoomInactiveReason } from '../../src/modules/room-gateway/enums/room-inactive-reason.enum';
import { roomServerClaimsFixture } from '../fixtures/room-gateway.fixture';
import {
  capacityUpdateEnvelopeFixture,
  closeRoomResultEnvelopeFixture,
  openRoomResultEnvelopeFixture,
  roomClosedEnvelopeFixture,
  roomHeartbeatEnvelopeFixture,
  serverHelloEnvelopeFixture,
  supportedTypesUpdateEnvelopeFixture,
} from '../fixtures/ws-messages.fixture';
import {
  sleep,
  waitForSocketDisconnect,
  waitForSocketEvent,
} from '../support/socket-await.util';
import {
  connectWsClient,
  createRoomGatewayWsTestRuntime,
  RoomGatewayWsTestRuntime,
} from '../support/ws-app.util';

describe('RoomGatewayWsGateway (e2e)', () => {
  let runtime: RoomGatewayWsTestRuntime;
  let sockets: Socket[];

  beforeEach(async () => {
    runtime = await createRoomGatewayWsTestRuntime();
    sockets = [];

    runtime.authServiceMock.validateAccessToken.mockImplementation((token) => {
      if (token === 'valid-token') {
        return roomServerClaimsFixture();
      }

      return null;
    });
  });

  afterEach(async () => {
    for (const socket of sockets) {
      socket.disconnect();
    }

    await runtime.app.close();
  });

  async function connectValidClient(): Promise<Socket> {
    const socket = await connectWsClient(runtime.port, 'valid-token');
    sockets.push(socket);
    return socket;
  }

  function requireSocketId(socket: Socket): string {
    if (!socket.id) {
      throw new Error('Expected connected socket id');
    }

    return socket.id;
  }

  it('disconnects clients without token', async () => {
    const socket = await connectWsClient(runtime.port);
    sockets.push(socket);

    await sleep(50);
    expect(socket.connected).toBe(false);
    expect(runtime.stateService.listTenantSessions('tenant-a')).toHaveLength(0);
  });

  it('disconnects clients with invalid token', async () => {
    const socket = await connectWsClient(runtime.port, 'invalid-token');
    sockets.push(socket);

    await sleep(50);
    expect(socket.connected).toBe(false);
    expect(runtime.stateService.listTenantSessions('tenant-a')).toHaveLength(0);
  });

  it('registers session on valid token', async () => {
    const socket = await connectValidClient();
    const socketId = requireSocketId(socket);

    expect(runtime.stateService.getSession(socketId)).not.toBeNull();
    expect(runtime.authServiceMock.validateAccessToken).toHaveBeenCalledWith(
      'valid-token',
    );
  });

  it('disconnects when server_hello server_id does not match token claims', async () => {
    const socket = await connectValidClient();
    const socketId = requireSocketId(socket);
    const mismatchedHello = serverHelloEnvelopeFixture({
      payload: {
        ...serverHelloEnvelopeFixture().payload,
        server_id: '00000000-0000-4000-8000-000000000999',
      },
    });

    socket.emit(ROOM_GATEWAY_SERVER_MESSAGE_EVENT, mismatchedHello);

    await waitForSocketDisconnect(socket);
    expect(runtime.stateService.getSession(socketId)).toBeNull();
  });

  it('updates supported types, capacity, location, and active routes from server_hello', async () => {
    const socket = await connectValidClient();

    socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      serverHelloEnvelopeFixture(),
    );
    await sleep(20);

    const session = runtime.stateService.getSession(requireSocketId(socket));

    expect(session?.supportedRoomTypes).toEqual(new Set(['5v5', 'futsal']));
    expect(session?.capacity).toEqual({ public: 2, private: 1 });
    expect(session?.location).toEqual({
      region: 'sa-east-1',
      lat: -23.55,
      lon: -46.63,
    });
    expect(
      runtime.stateService.findSessionByRoom(
        'tenant-a',
        '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      ),
    ).toEqual(session);
  });

  it('applies capacity_update messages', async () => {
    const socket = await connectValidClient();
    socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      serverHelloEnvelopeFixture(),
    );
    await sleep(10);

    socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      capacityUpdateEnvelopeFixture(),
    );
    await sleep(10);

    expect(
      runtime.stateService.getSession(requireSocketId(socket))?.capacity,
    ).toEqual({
      public: 6,
      private: 4,
    });
  });

  it('applies supported_room_types_update messages', async () => {
    const socket = await connectValidClient();
    socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      serverHelloEnvelopeFixture(),
    );
    await sleep(10);

    socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      supportedTypesUpdateEnvelopeFixture(),
    );
    await sleep(10);

    expect(
      runtime.stateService.getSession(requireSocketId(socket))
        ?.supportedRoomTypes,
    ).toEqual(new Set(['5v5', '7v7']));
  });

  it('publishes heartbeat events and updates room route', async () => {
    const socket = await connectValidClient();
    socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      serverHelloEnvelopeFixture(),
    );
    await sleep(10);

    socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      roomHeartbeatEnvelopeFixture(),
    );
    await sleep(20);

    expect(
      runtime.eventsPublisherMock.publishRoomHeartbeat,
    ).toHaveBeenCalledTimes(1);
    expect(
      runtime.eventsPublisherMock.publishRoomHeartbeat,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: 'tenant-a',
        room_uuid: '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      }),
    );
    expect(
      runtime.stateService.findSessionByRoom(
        'tenant-a',
        '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      ),
    ).not.toBeNull();
  });

  it('publishes room_closed events and removes room route', async () => {
    const socket = await connectValidClient();
    socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      serverHelloEnvelopeFixture(),
    );
    await sleep(10);

    socket.emit(ROOM_GATEWAY_SERVER_MESSAGE_EVENT, roomClosedEnvelopeFixture());
    await sleep(20);

    expect(runtime.eventsPublisherMock.publishRoomClosed).toHaveBeenCalledTimes(
      1,
    );
    expect(runtime.eventsPublisherMock.publishRoomClosed).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant: 'tenant-a',
        room_uuid: '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
        reason: RoomInactiveReason.CLOSED,
      }),
    );
    expect(
      runtime.stateService.findSessionByRoom(
        'tenant-a',
        '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      ),
    ).toBeNull();
  });

  it('defaults room_closed reason to CLOSED when missing', async () => {
    const socket = await connectValidClient();
    socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      serverHelloEnvelopeFixture(),
    );
    await sleep(10);

    socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      roomClosedEnvelopeFixture({
        payload: {
          room_uuid: '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
          timestamp: '2026-03-16T23:00:01.000Z',
        },
      }),
    );
    await sleep(20);

    expect(runtime.eventsPublisherMock.publishRoomClosed).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: RoomInactiveReason.CLOSED,
      }),
    );
  });

  it('resolves pending open_room command on open_room_result message', async () => {
    const socket = await connectValidClient();
    socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      serverHelloEnvelopeFixture(),
    );
    await sleep(10);

    const session = runtime.stateService.getSession(requireSocketId(socket));

    if (!session) {
      throw new Error('Expected registered session');
    }

    const pending = runtime.stateService.dispatchCommand(
      session,
      RoomGatewayMessageType.OPEN_ROOM_COMMAND,
      { room_type: '5v5' },
      1_000,
    );

    const emittedCommand = await waitForSocketEvent<{ request_id: string }>(
      socket,
      ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT,
    );

    socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      openRoomResultEnvelopeFixture({
        request_id: emittedCommand.request_id,
      }),
    );

    await expect(pending).resolves.toEqual(
      expect.objectContaining({
        state: 'open',
      }),
    );
  });

  it('resolves pending close_room command on close_room_result message', async () => {
    const socket = await connectValidClient();
    socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      serverHelloEnvelopeFixture(),
    );
    await sleep(10);

    const session = runtime.stateService.getSession(requireSocketId(socket));

    if (!session) {
      throw new Error('Expected registered session');
    }

    const pending = runtime.stateService.dispatchCommand(
      session,
      RoomGatewayMessageType.CLOSE_ROOM_COMMAND,
      { room_uuid: '986e7556-c699-4f2e-89ca-f8ffb79f66c4' },
      1_000,
    );

    const emittedCommand = await waitForSocketEvent<{ request_id: string }>(
      socket,
      ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT,
    );

    socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      closeRoomResultEnvelopeFixture({
        request_id: emittedCommand.request_id,
      }),
    );

    await expect(pending).resolves.toEqual(
      expect.objectContaining({
        accepted: true,
      }),
    );
  });

  it('ignores invalid envelopes without publishing events', async () => {
    const socket = await connectValidClient();

    socket.emit(ROOM_GATEWAY_SERVER_MESSAGE_EVENT, {
      type: RoomGatewayMessageType.ROOM_HEARTBEAT,
      payload: {
        room_uuid: 'invalid-uuid',
      },
    });

    await sleep(20);

    expect(
      runtime.eventsPublisherMock.publishRoomHeartbeat,
    ).not.toHaveBeenCalled();
    expect(
      runtime.eventsPublisherMock.publishRoomClosed,
    ).not.toHaveBeenCalled();
  });
});
