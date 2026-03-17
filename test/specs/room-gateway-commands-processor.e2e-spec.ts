import { Queue } from 'bullmq';
import { buildRedisConnectionFromUrl } from '../../src/common/queue/redis-connection.util';
import {
  ROOM_GATEWAY_CLOSE_ROOM_JOB,
  ROOM_GATEWAY_COMMANDS_QUEUE,
  ROOM_GATEWAY_OPEN_ROOM_JOB,
} from '../../src/modules/room-gateway/constants/room-gateway-queue.const';
import { CloseRoomCompletionState } from '../../src/modules/room-gateway/enums/close-room-completion-state.enum';
import { OpenRoomCompletionState } from '../../src/modules/room-gateway/enums/open-room-completion-state.enum';
import {
  closeRoomCommandFixture,
  openRoomCommandFixture,
  openRoomCommandWithoutFakePasswordFixture,
} from '../fixtures/room-gateway.fixture';
import {
  closeRoomResultEnvelopeFixture,
  openRoomResultEnvelopeFixture,
} from '../fixtures/ws-messages.fixture';
import { waitForJobCompletion } from '../support/queue-await.util';
import { getE2ERuntime } from '../support/runtime';
import { waitForSocketEvent } from '../support/socket-await.util';
import {
  connectRoomServerClient,
  emitServerHelloAndWait,
} from '../support/ws-app.util';
import {
  ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
  ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT,
} from '../../src/modules/room-gateway/constants/room-gateway-message-type.const';
import { Socket } from 'socket.io-client';

describe('RoomGatewayCommandsProcessor (e2e)', () => {
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

  function createRawCommandQueue(): Queue<
    Record<string, unknown>,
    unknown,
    string
  > {
    const redisUrl = process.env.REDIS_URL;

    if (!redisUrl) {
      throw new Error('Missing REDIS_URL for raw command queue');
    }

    return new Queue<Record<string, unknown>, unknown, string>(
      ROOM_GATEWAY_COMMANDS_QUEUE,
      {
        connection: buildRedisConnectionFromUrl(redisUrl),
      },
    );
  }

  it('processes open-room jobs from Redis and returns open completion', async () => {
    const { commandQueue, commandQueueEvents } = getE2ERuntime();
    const connection = await connectRoomServerClient();
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection);

    const job = await commandQueue.add(
      ROOM_GATEWAY_OPEN_ROOM_JOB,
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

    await expect(
      waitForJobCompletion(job, commandQueueEvents),
    ).resolves.toEqual({
      state: OpenRoomCompletionState.OPEN,
      room_uuid: '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      invite: 'ABC123',
    });
  });

  it('normalizes fake_password to null when the open-room job omits it', async () => {
    const { commandQueueEvents } = getE2ERuntime();
    const rawCommandQueue = createRawCommandQueue();
    const connection = await connectRoomServerClient();
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection);

    try {
      const job = await rawCommandQueue.add(
        ROOM_GATEWAY_OPEN_ROOM_JOB,
        openRoomCommandWithoutFakePasswordFixture(),
      );

      const emittedCommand = await waitForSocketEvent<{
        request_id: string;
        payload: {
          room_properties: {
            fake_password: boolean | null;
          };
        };
      }>(connection.socket, ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT);

      expect(emittedCommand.payload.room_properties.fake_password).toBeNull();

      connection.socket.emit(
        ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
        openRoomResultEnvelopeFixture({
          request_id: emittedCommand.request_id,
        }),
      );

      await expect(
        waitForJobCompletion(job, commandQueueEvents),
      ).resolves.toEqual(
        expect.objectContaining({
          state: OpenRoomCompletionState.OPEN,
        }),
      );
    } finally {
      await rawCommandQueue.close();
    }
  });

  it('processes close-room jobs from Redis and returns closed completion', async () => {
    const { commandQueue, commandQueueEvents } = getE2ERuntime();
    const connection = await connectRoomServerClient();
    sockets.push(connection.socket);
    await emitServerHelloAndWait(connection, {
      active_rooms: ['5b89f2b8-d425-4b34-b57d-341e7e6010f8'],
    });

    const job = await commandQueue.add(
      ROOM_GATEWAY_CLOSE_ROOM_JOB,
      closeRoomCommandFixture(),
    );

    const emittedCommand = await waitForSocketEvent<{
      request_id: string;
    }>(connection.socket, ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT);

    connection.socket.emit(
      ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
      closeRoomResultEnvelopeFixture({
        request_id: emittedCommand.request_id,
      }),
    );

    await expect(
      waitForJobCompletion(job, commandQueueEvents),
    ).resolves.toEqual({
      state: CloseRoomCompletionState.CLOSED,
    });
  });

  it('fails invalid open-room job payloads', async () => {
    const { commandQueueEvents } = getE2ERuntime();
    const rawCommandQueue = createRawCommandQueue();

    try {
      const job = await rawCommandQueue.add(ROOM_GATEWAY_OPEN_ROOM_JOB, {
        tenant: 'tenant-a',
      });

      await expect(
        waitForJobCompletion(job, commandQueueEvents),
      ).rejects.toThrow('Invalid open-room command payload');
    } finally {
      await rawCommandQueue.close();
    }
  });

  it('fails invalid close-room job payloads', async () => {
    const { commandQueueEvents } = getE2ERuntime();
    const rawCommandQueue = createRawCommandQueue();

    try {
      const job = await rawCommandQueue.add(ROOM_GATEWAY_CLOSE_ROOM_JOB, {
        tenant: 'tenant-a',
      });

      await expect(
        waitForJobCompletion(job, commandQueueEvents),
      ).rejects.toThrow('Invalid close-room command payload');
    } finally {
      await rawCommandQueue.close();
    }
  });

  it('fails unsupported command job names', async () => {
    const { commandQueueEvents } = getE2ERuntime();
    const rawCommandQueue = createRawCommandQueue();

    try {
      const job = await rawCommandQueue.add('unsupported-job', {});

      await expect(
        waitForJobCompletion(job, commandQueueEvents),
      ).rejects.toThrow('Unsupported command job: unsupported-job');
    } finally {
      await rawCommandQueue.close();
    }
  });
});
