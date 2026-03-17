import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Queue, QueueEvents } from 'bullmq';
import {
  CloseRoomCommand,
  OpenRoomCommand,
} from '../../src/modules/room-gateway/types/room-gateway-command.type';
import {
  RoomClosedGatewayEvent,
  RoomHeartbeatGatewayEvent,
} from '../../src/modules/room-gateway/types/room-gateway-event.type';

export type E2ERuntime = {
  app: INestApplication;
  port: number;
  jwtService: JwtService;
  commandQueue: Queue<OpenRoomCommand | CloseRoomCommand, unknown, string>;
  commandQueueEvents: QueueEvents;
  eventsQueue: Queue<
    RoomHeartbeatGatewayEvent | RoomClosedGatewayEvent,
    unknown,
    string
  >;
};

let runtime: E2ERuntime | null = null;

export function setE2ERuntime(value: E2ERuntime): void {
  runtime = value;
}

export function getE2ERuntime(): E2ERuntime {
  if (!runtime) {
    throw new Error('E2E runtime is not initialized');
  }

  return runtime;
}

export function clearE2ERuntime(): void {
  runtime = null;
}
