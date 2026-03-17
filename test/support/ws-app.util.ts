import { io, Socket } from 'socket.io-client';
import { ROOM_GATEWAY_SERVER_MESSAGE_EVENT } from '../../src/modules/room-gateway/constants/room-gateway-message-type.const';
import { RoomGatewayStateService } from '../../src/modules/room-gateway/room-gateway-state.service';
import { RoomServerClaims } from '../../src/modules/room-gateway/types/room-server-claims.type';
import {
  roomServerClaimsFixture,
  RoomServerClaimsFixtureOverrides,
} from '../fixtures/room-gateway.fixture';
import {
  ServerHelloPayload,
  serverHelloEnvelopeFixture,
} from '../fixtures/ws-messages.fixture';
import { signGatewayToken } from '../fixtures/jwt.fixture';
import { getE2ERuntime } from './runtime';
import { waitFor } from './wait-for.util';

export type ConnectedRoomServer = {
  socket: Socket;
  claims: RoomServerClaims;
};

export function requireSocketId(socket: Socket): string {
  if (!socket.id) {
    throw new Error('Expected connected socket id');
  }

  return socket.id;
}

export function connectWsClient(token?: string): Promise<Socket> {
  const { port } = getE2ERuntime();

  return new Promise((resolve, reject) => {
    const socket = createWsClient(port, token);

    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (error) => reject(error));
  });
}

export function connectWsClientAllowFailure(token?: string): Promise<Socket> {
  const { port } = getE2ERuntime();

  return new Promise((resolve) => {
    const socket = createWsClient(port, token);
    const settle = () => {
      socket.off('connect', settle);
      socket.off('connect_error', settle);
      resolve(socket);
    };

    socket.on('connect', settle);
    socket.on('connect_error', settle);
  });
}

function createWsClient(port: number, token?: string): Socket {
  return io(`http://127.0.0.1:${port}`, {
    transports: ['websocket'],
    auth: token ? { token } : undefined,
    reconnection: false,
    timeout: 3_000,
  });
}

export async function connectRoomServerClient(
  overrides: RoomServerClaimsFixtureOverrides = {},
): Promise<ConnectedRoomServer> {
  const { jwtService } = getE2ERuntime();
  const claims = roomServerClaimsFixture(overrides);
  const token = signGatewayToken(jwtService, claims);
  const socket = await connectWsClient(token);

  return { socket, claims };
}

export function emitServerHello(
  socket: Socket,
  claims: RoomServerClaims,
  overrides: Partial<ServerHelloPayload> = {},
): void {
  socket.emit(
    ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
    serverHelloEnvelopeFixture({
      payload: {
        server_id: claims.server_id,
        ...overrides,
      },
    }),
  );
}

export async function emitServerHelloAndWait(
  connection: ConnectedRoomServer,
  overrides: Partial<ServerHelloPayload> = {},
): Promise<void> {
  const { app } = getE2ERuntime();
  const state = app.get(RoomGatewayStateService);
  const socketId = requireSocketId(connection.socket);

  emitServerHello(connection.socket, connection.claims, overrides);

  await waitFor(
    () => state.getSession(socketId),
    (session) => session !== null && session.supportedRoomTypes.size > 0,
    3_000,
    20,
    'Timed out waiting for room-server hello to be applied',
  );
}
