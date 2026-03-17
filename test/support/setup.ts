import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { Queue, QueueEvents } from 'bullmq';
import { AppModule } from '../../src/app.module';
import { buildRedisConnectionFromUrl } from '../../src/common/queue/redis-connection.util';
import {
  ROOM_GATEWAY_COMMANDS_QUEUE,
  ROOM_GATEWAY_EVENTS_QUEUE,
} from '../../src/modules/room-gateway/constants/room-gateway-queue.const';
import {
  CloseRoomCommand,
  OpenRoomCommand,
} from '../../src/modules/room-gateway/types/room-gateway-command.type';
import {
  RoomClosedGatewayEvent,
  RoomHeartbeatGatewayEvent,
} from '../../src/modules/room-gateway/types/room-gateway-event.type';
import { clearE2ERuntime, getE2ERuntime, setE2ERuntime } from './runtime';

jest.setTimeout(30_000);

type QueueCleanupStatus =
  | 'completed'
  | 'failed'
  | 'paused'
  | 'wait'
  | 'delayed'
  | 'prioritized';

function getPortFromAppUrl(appUrl: string): number {
  const parsedUrl = new URL(appUrl);
  const port = Number(parsedUrl.port);

  if (!Number.isFinite(port) || port <= 0) {
    throw new Error('Unable to resolve E2E app port');
  }

  return port;
}

function getRedisUrl(): string {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    throw new Error('Missing REDIS_URL for E2E tests');
  }

  return redisUrl;
}

async function clearQueue<TData, TResult>(
  queue: Queue<TData, TResult, string>,
): Promise<void> {
  await queue.drain();

  const cleanupStatuses: QueueCleanupStatus[] = [
    'completed',
    'failed',
    'paused',
    'wait',
    'delayed',
    'prioritized',
  ];

  for (const status of cleanupStatuses) {
    await queue.clean(0, 1_000, status);
  }
}

beforeAll(async () => {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();
  await app.listen(0, '127.0.0.1');

  const redisConnection = buildRedisConnectionFromUrl(getRedisUrl());
  const commandQueue = new Queue<OpenRoomCommand | CloseRoomCommand, unknown>(
    ROOM_GATEWAY_COMMANDS_QUEUE,
    {
      connection: redisConnection,
    },
  );
  const commandQueueEvents = new QueueEvents(ROOM_GATEWAY_COMMANDS_QUEUE, {
    connection: redisConnection,
  });
  const eventsQueue = new Queue<
    RoomHeartbeatGatewayEvent | RoomClosedGatewayEvent,
    unknown
  >(ROOM_GATEWAY_EVENTS_QUEUE, {
    connection: redisConnection,
  });

  await Promise.all([
    commandQueue.waitUntilReady(),
    commandQueueEvents.waitUntilReady(),
    eventsQueue.waitUntilReady(),
  ]);

  setE2ERuntime({
    app,
    port: getPortFromAppUrl(await app.getUrl()),
    jwtService: app.get(JwtService),
    commandQueue,
    commandQueueEvents,
    eventsQueue,
  });
});

afterEach(async () => {
  jest.restoreAllMocks();

  const { commandQueue, eventsQueue } = getE2ERuntime();
  await Promise.all([clearQueue(commandQueue), clearQueue(eventsQueue)]);
});

afterAll(async () => {
  const { app, commandQueue, commandQueueEvents, eventsQueue } =
    getE2ERuntime();

  await Promise.all([
    commandQueue.close(),
    commandQueueEvents.close(),
    eventsQueue.close(),
  ]);
  await app.close();
  clearE2ERuntime();
});
