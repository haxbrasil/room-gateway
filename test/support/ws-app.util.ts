import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { io, Socket } from 'socket.io-client';
import { RoomGatewayAuthService } from '../../src/modules/room-gateway/room-gateway-auth.service';
import { RoomGatewayEventsPublisherService } from '../../src/modules/room-gateway/room-gateway-events-publisher.service';
import { RoomGatewayStateService } from '../../src/modules/room-gateway/room-gateway-state.service';
import { RoomGatewayWsGateway } from '../../src/modules/room-gateway/room-gateway.ws-gateway';

type Claims = {
  tenant: string;
  service: 'room-server';
  server_id: string;
};

export type RoomGatewayWsTestRuntime = {
  app: INestApplication;
  port: number;
  stateService: RoomGatewayStateService;
  authServiceMock: {
    validateAccessToken: jest.Mock<Claims | null, [string]>;
  };
  eventsPublisherMock: {
    publishRoomHeartbeat: jest.Mock<Promise<void>, [Record<string, unknown>]>;
    publishRoomClosed: jest.Mock<Promise<void>, [Record<string, unknown>]>;
  };
};

export async function createRoomGatewayWsTestRuntime(): Promise<RoomGatewayWsTestRuntime> {
  const authServiceMock = {
    validateAccessToken: jest
      .fn<Claims | null, [string]>()
      .mockReturnValue(null),
  };

  const eventsPublisherMock = {
    publishRoomHeartbeat: jest
      .fn<Promise<void>, [Record<string, unknown>]>()
      .mockResolvedValue(),
    publishRoomClosed: jest
      .fn<Promise<void>, [Record<string, unknown>]>()
      .mockResolvedValue(),
  };

  const moduleRef = await Test.createTestingModule({
    providers: [
      RoomGatewayWsGateway,
      RoomGatewayStateService,
      {
        provide: RoomGatewayAuthService,
        useValue: authServiceMock,
      },
      {
        provide: RoomGatewayEventsPublisherService,
        useValue: eventsPublisherMock,
      },
    ],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0, '127.0.0.1');
  const appUrl = await app.getUrl();
  const parsedUrl = new URL(appUrl);
  const port = Number(parsedUrl.port);

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('Unable to resolve test app port');
  }

  return {
    app,
    port,
    stateService: app.get(RoomGatewayStateService),
    authServiceMock,
    eventsPublisherMock,
  };
}

export function connectWsClient(port: number, token?: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      auth: token ? { token } : undefined,
      reconnection: false,
      timeout: 3_000,
    });

    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', (error) => reject(error));
  });
}
