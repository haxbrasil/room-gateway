import {
  ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
  ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT,
  RoomGatewayMessageType,
} from '../../src/modules/room-gateway/constants/room-gateway-message-type.const';
import { RoomGatewayStateService } from '../../src/modules/room-gateway/room-gateway-state.service';
import { openRoomResultEnvelopeFixture } from '../fixtures/ws-messages.fixture';
import {
  connectRoomServerClient,
  emitServerHelloAndWait,
  requireSocketId,
} from '../support/ws-app.util';
import {
  waitForSocketDisconnect,
  waitForSocketEvent,
} from '../support/socket-await.util';
import { getE2ERuntime } from '../support/runtime';
import { waitFor } from '../support/wait-for.util';
import { Socket } from 'socket.io-client';

describe('RoomGatewayStateService (e2e)', () => {
  let sockets: Socket[];

  beforeEach(() => {
    sockets = [];
  });

  afterEach(async () => {
    for (const socket of sockets) {
      if (socket.connected) {
        socket.disconnect();
      }
    }

    const { app } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);

    await waitFor(
      () => state.listTenantSessions('tenant-a').length,
      (count) => count === 0,
      3_000,
      20,
      'Timed out waiting for tenant-a sessions to clear',
    ).catch(() => undefined);
  });

  it('registers and retrieves a real room-server session', async () => {
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

  it('unregisters a disconnected session and clears active room routes', async () => {
    const { app } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const connection = await connectRoomServerClient();
    const socketId = requireSocketId(connection.socket);
    sockets.push(connection.socket);

    await emitServerHelloAndWait(connection, {
      active_rooms: ['986e7556-c699-4f2e-89ca-f8ffb79f66c4'],
    });

    await waitFor(
      () => state.findRoomRoute('986e7556-c699-4f2e-89ca-f8ffb79f66c4'),
      (value) => value !== null,
      3_000,
      20,
      'Timed out waiting for active room route',
    );

    connection.socket.disconnect();

    await waitFor(
      () => state.getSession(socketId),
      (value) => value === null,
      3_000,
      20,
      'Timed out waiting for session unregister',
    );

    expect(
      state.findRoomRoute('986e7556-c699-4f2e-89ca-f8ffb79f66c4'),
    ).toBeNull();
  });

  it('lists sessions by tenant for real connected clients', async () => {
    const { app } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const tenantA = await connectRoomServerClient();
    const tenantB = await connectRoomServerClient({
      tenant: 'tenant-b',
      server_id: '00000000-0000-4000-8000-000000000002',
    });
    sockets.push(tenantA.socket, tenantB.socket);

    await waitFor(
      () => state.listTenantSessions('tenant-a').length,
      (count) => count === 1,
      3_000,
      20,
      'Timed out waiting for tenant-a session',
    );
    await waitFor(
      () => state.listTenantSessions('tenant-b').length,
      (count) => count === 1,
      3_000,
      20,
      'Timed out waiting for tenant-b session',
    );

    expect(state.listTenantSessions('tenant-a')).toHaveLength(1);
    expect(state.listTenantSessions('tenant-b')).toHaveLength(1);
    expect(state.listTenantSessions('tenant-c')).toHaveLength(0);
  });

  it('finds routed sessions with tenant isolation after server_hello', async () => {
    const { app } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const connection = await connectRoomServerClient();
    const socketId = requireSocketId(connection.socket);
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
      'Timed out waiting for routed session',
    );

    expect(
      state.findSessionByRoom(
        connection.claims.tenant,
        '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      )?.socket.id,
    ).toBe(socketId);
    expect(
      state.findSessionByRoom(
        'tenant-b',
        '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      ),
    ).toBeNull();
  });

  it('dispatches commands to a real socket and resolves when the result arrives', async () => {
    const { app } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const connection = await connectRoomServerClient();
    const socketId = requireSocketId(connection.socket);
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection);

    const session = await waitFor(
      () => state.getSession(socketId),
      (value) => value !== null,
      3_000,
      20,
      'Timed out waiting for session before dispatch',
    );

    if (!session) {
      throw new Error('Expected registered session before dispatch');
    }

    const pending = state.dispatchCommand(
      session,
      RoomGatewayMessageType.OPEN_ROOM_COMMAND,
      { room_type: '5v5' },
      1_000,
    );

    const emittedCommand = await waitForSocketEvent<{
      request_id: string;
      type: RoomGatewayMessageType;
    }>(connection.socket, ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT);

    expect(emittedCommand.type).toBe(RoomGatewayMessageType.OPEN_ROOM_COMMAND);

    connection.socket.emit(
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

  it('rejects pending commands when the room server disconnects', async () => {
    const { app } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const connection = await connectRoomServerClient();
    const socketId = requireSocketId(connection.socket);
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection);

    const session = await waitFor(
      () => state.getSession(socketId),
      (value) => value !== null,
      3_000,
      20,
      'Timed out waiting for session before pending command test',
    );

    if (!session) {
      throw new Error(
        'Expected registered session before pending command test',
      );
    }

    const pending = state.dispatchCommand(
      session,
      RoomGatewayMessageType.OPEN_ROOM_COMMAND,
      { room_type: '5v5' },
      1_000,
    );

    await waitForSocketEvent(
      connection.socket,
      ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT,
    );

    connection.socket.disconnect();
    await expect(pending).rejects.toThrow('Room server disconnected');
  });

  it('fails dispatch immediately when the room server socket is disconnected', async () => {
    const { app } = getE2ERuntime();
    const state = app.get(RoomGatewayStateService);
    const connection = await connectRoomServerClient();
    const socketId = requireSocketId(connection.socket);
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection);

    const session = await waitFor(
      () => state.getSession(socketId),
      (value) => value !== null,
      3_000,
      20,
      'Timed out waiting for session before disconnect test',
    );

    if (!session) {
      throw new Error('Expected registered session before disconnect test');
    }

    const disconnectPromise = waitForSocketDisconnect(connection.socket);
    connection.socket.disconnect();
    await disconnectPromise;
    await waitFor(
      () => state.getSession(socketId),
      (value) => value === null,
      3_000,
      20,
      'Timed out waiting for disconnected session to unregister',
    );

    await expect(
      state.dispatchCommand(
        session,
        RoomGatewayMessageType.OPEN_ROOM_COMMAND,
        {},
        100,
      ),
    ).rejects.toThrow('Room server is disconnected');
  });
});
