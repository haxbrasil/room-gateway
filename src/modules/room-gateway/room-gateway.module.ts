import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import {
  ROOM_GATEWAY_COMMANDS_QUEUE,
  ROOM_GATEWAY_EVENTS_QUEUE,
} from './constants/room-gateway-queue.const';
import { RoomGatewayAuthService } from './room-gateway-auth.service';
import { RoomGatewayCommandsProcessor } from './room-gateway-commands.processor';
import { RoomGatewayEventsPublisherService } from './room-gateway-events-publisher.service';
import { RoomGatewayService } from './room-gateway.service';
import { RoomGatewayStateService } from './room-gateway-state.service';
import { RoomGatewayWsGateway } from './room-gateway.ws-gateway';

@Module({
  imports: [
    JwtModule.register({}),
    BullModule.registerQueue(
      {
        name: ROOM_GATEWAY_COMMANDS_QUEUE,
      },
      {
        name: ROOM_GATEWAY_EVENTS_QUEUE,
      },
    ),
  ],
  providers: [
    RoomGatewayAuthService,
    RoomGatewayStateService,
    RoomGatewayService,
    RoomGatewayEventsPublisherService,
    RoomGatewayWsGateway,
    RoomGatewayCommandsProcessor,
  ],
})
export class RoomGatewayModule {}
