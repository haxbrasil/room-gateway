import {
  ROOM_GATEWAY_HEARTBEAT_EVENT_JOB,
  ROOM_GATEWAY_ROOM_CLOSED_EVENT_JOB,
} from '../../src/modules/room-gateway/constants/room-gateway-queue.const';
import {
  ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
  RoomGatewayMessageType,
} from '../../src/modules/room-gateway/constants/room-gateway-message-type.const';
import { RoomInactiveReason } from '../../src/modules/room-gateway/enums/room-inactive-reason.enum';
import { RoomGatewayStateService } from '../../src/modules/room-gateway/room-gateway-state.service';
import {
  capacityUpdateEnvelopeFixture,
  roomClosedEnvelopeFixture,
  roomHeartbeatEnvelopeFixture,
  supportedTypesUpdateEnvelopeFixture,
} from '../fixtures/ws-messages.fixture';
import { waitForWaitingJobs } from '../support/queue-await.util';
import { getE2ERuntime } from '../support/runtime';
import { waitForSocketDisconnect } from '../support/socket-await.util';
import {
  connectRoomServerClient,
  connectWsClientAllowFailure,
  emitServerHelloAndWait,
  requireSocketId,
} from '../support/ws-app.util';
import { waitFor } from '../support/wait-for.util';
import { Socket } from 'socket.io-client';

describe('RoomGatewayWsGateway (e2e)', () => {
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

  it('disconnects clients without token', async () => {
    const { app } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const socket = await connectWsClientAllowFailure();
    sockets.push(socket);

    await waitFor(
      () => socket.connected,
      (connected) => connected === false,
      3_000,
      20,
      'Timed out waiting for unauthenticated socket disconnect',
    );

    expect(state.listTenantSessions('tenant-a')).toHaveLength(0);
  });

  it('disconnects clients with invalid token', async () => {
    const { app } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const socket = await connectWsClientAllowFailure('invalid-token');
    sockets.push(socket);

    await waitFor(
      () => socket.connected,
      (connected) => connected === false,
      3_000,
      20,
      'Timed out waiting for invalid-token disconnect',
    );

    expect(state.listTenantSessions('tenant-a')).toHaveLength(0);
  });

  it('registers session on a valid room-server token', async () => {
    const { app } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const connection = await connectRoomServerClient();
    const socketId = requireSocketId(connection.socket);
    sockets.push(connection.socket);

    const session = await waitFor(
      () => state.getSession(socketId),
      (value) => value !== null,
      3_000,
      20,
      'Timed out waiting for registered session',
    );

    expect(session).not.toBeNull();
    expect(session?.tenant).toBe(connection.claims.tenant);
    expect(session?.serverId).toBe(connection.claims.server_id);
  });

  it('disconnects when server_hello server_id does not match token claims', async () => {
    const { app } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const connection = await connectRoomServerClient();
    const socketId = requireSocketId(connection.socket);
    sockets.push(connection.socket);

    connection.socket.emit(ROOM_GATEWAY_SERVER_MESSAGE_EVENT, {
      type: RoomGatewayMessageType.SERVER_HELLO,
      payload: {
        server_id: '00000000-0000-4000-8000-000000000999',
        supported_room_types: ['5v5'],
        active_rooms: [],
        capacity: { public: 1, private: 1 },
        location: {
          region: 'sa-east-1',
          lat: -23.55,
          lon: -46.63,
        },
      },
    });

    await waitForSocketDisconnect(connection.socket);
    expect(state.getSession(socketId)).toBeNull();
  });

  it('updates supported types, capacity, location, and active routes from server_hello', async () => {
    const { app } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const connection = await connectRoomServerClient();
    const socketId = requireSocketId(connection.socket);
    sockets.push(connection.socket);

    await emitServerHelloAndWait(connection, {
      supported_room_types: ['5v5', 'futsal'],
      active_rooms: ['986e7556-c699-4f2e-89ca-f8ffb79f66c4'],
      capacity: { public: 2, private: 1 },
      location: {
        region: 'sa-east-1',
        lat: -23.55,
        lon: -46.63,
      },
    });

    const session = await waitFor(
      () => state.getSession(socketId),
      (value) =>
        value !== null &&
        value.supportedRoomTypes.size === 2 &&
        value.location !== null,
      3_000,
      20,
      'Timed out waiting for server_hello state update',
    );

    expect(session?.supportedRoomTypes).toEqual(new Set(['5v5', 'futsal']));
    expect(session?.capacity).toEqual({ public: 2, private: 1 });
    expect(session?.location).toEqual({
      region: 'sa-east-1',
      lat: -23.55,
      lon: -46.63,
    });
    expect(
      state.findSessionByRoom(
        connection.claims.tenant,
        '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      )?.socket.id,
    ).toBe(socketId);
  });

  it('applies capacity_update messages', async () => {
    const { app } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const connection = await connectRoomServerClient();
    const socketId = requireSocketId(connection.socket);
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection);

    connection.socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      capacityUpdateEnvelopeFixture(),
    );

    const session = await waitFor(
      () => state.getSession(socketId),
      (value) =>
        value !== null &&
        value.capacity.public === 6 &&
        value.capacity.private === 4,
      3_000,
      20,
      'Timed out waiting for capacity update',
    );

    expect(session?.capacity).toEqual({
      public: 6,
      private: 4,
    });
  });

  it('applies supported_room_types_update messages', async () => {
    const { app } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const connection = await connectRoomServerClient();
    const socketId = requireSocketId(connection.socket);
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection);

    connection.socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      supportedTypesUpdateEnvelopeFixture(),
    );

    const session = await waitFor(
      () => state.getSession(socketId),
      (value) =>
        value !== null &&
        value.supportedRoomTypes.has('7v7') &&
        value.supportedRoomTypes.size === 2,
      3_000,
      20,
      'Timed out waiting for supported room types update',
    );

    expect(session?.supportedRoomTypes).toEqual(new Set(['5v5', '7v7']));
  });

  it('publishes room-heartbeat jobs to Redis and updates the room route', async () => {
    const { app, eventsQueue } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const connection = await connectRoomServerClient();
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection);

    connection.socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      roomHeartbeatEnvelopeFixture(),
    );

    const jobs = await waitForWaitingJobs(eventsQueue);

    expect(jobs[0].name).toBe(ROOM_GATEWAY_HEARTBEAT_EVENT_JOB);
    expect(jobs[0].data).toEqual(
      expect.objectContaining({
        tenant: connection.claims.tenant,
        room_uuid: '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      }),
    );
    expect(
      state.findSessionByRoom(
        connection.claims.tenant,
        '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      ),
    ).not.toBeNull();
  });

  it('publishes room-closed jobs to Redis and removes the room route', async () => {
    const { app, eventsQueue } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const connection = await connectRoomServerClient();
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection, {
      active_rooms: ['986e7556-c699-4f2e-89ca-f8ffb79f66c4'],
    });

    await waitFor(
      () =>
        state.findSessionByRoom(
          connection.claims.tenant,
          '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
        ),
      (value) => value !== null,
      3_000,
      20,
      'Timed out waiting for active room route before close event',
    );

    connection.socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      roomClosedEnvelopeFixture(),
    );

    const jobs = await waitForWaitingJobs(eventsQueue);

    expect(jobs[0].name).toBe(ROOM_GATEWAY_ROOM_CLOSED_EVENT_JOB);
    expect(jobs[0].data).toEqual(
      expect.objectContaining({
        tenant: connection.claims.tenant,
        room_uuid: '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
        reason: RoomInactiveReason.CLOSED,
      }),
    );
    expect(
      state.findSessionByRoom(
        connection.claims.tenant,
        '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      ),
    ).toBeNull();
  });
});
