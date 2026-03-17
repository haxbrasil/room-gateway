import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  ROOM_GATEWAY_EVENTS_QUEUE,
  ROOM_GATEWAY_HEARTBEAT_EVENT_JOB,
  ROOM_GATEWAY_ROOM_CLOSED_EVENT_JOB,
} from './constants/room-gateway-queue.const';
import {
  RoomClosedGatewayEvent,
  RoomHeartbeatGatewayEvent,
} from './types/room-gateway-event.type';

@Injectable()
export class RoomGatewayEventsPublisherService {
  constructor(
    @InjectQueue(ROOM_GATEWAY_EVENTS_QUEUE)
    private readonly queue: Queue<
      RoomHeartbeatGatewayEvent | RoomClosedGatewayEvent,
      unknown,
      string
    >,
  ) {}

  async publishRoomHeartbeat(event: RoomHeartbeatGatewayEvent): Promise<void> {
    await this.queue.add(ROOM_GATEWAY_HEARTBEAT_EVENT_JOB, event);
  }

  async publishRoomClosed(event: RoomClosedGatewayEvent): Promise<void> {
    await this.queue.add(ROOM_GATEWAY_ROOM_CLOSED_EVENT_JOB, event);
  }
}
