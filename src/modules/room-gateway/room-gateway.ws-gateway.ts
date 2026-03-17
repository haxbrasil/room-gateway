import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { randomUUID } from 'node:crypto';
import { Server, Socket } from 'socket.io';
import { parseDto } from '../../common/dto/parse-dto.util';
import {
  RoomGatewayMessageType,
  ROOM_GATEWAY_SERVER_MESSAGE_EVENT,
} from './constants/room-gateway-message-type.const';
import { CapacityUpdateDto } from './dtos/capacity-update.dto';
import { RoomClosedDto } from './dtos/room-closed.dto';
import { RoomGatewayEnvelopeDto } from './dtos/room-gateway-envelope.dto';
import { RoomHeartbeatDto } from './dtos/room-heartbeat.dto';
import { ServerHelloDto } from './dtos/server-hello.dto';
import { SupportedRoomTypesUpdateDto } from './dtos/supported-room-types-update.dto';
import { RoomGatewayAuthService } from './room-gateway-auth.service';
import { RoomGatewayEventsPublisherService } from './room-gateway-events-publisher.service';
import { RoomGatewayStateService } from './room-gateway-state.service';
import { RoomCapacityBucket } from './enums/room-capacity-bucket.enum';
import { RoomInactiveReason } from './enums/room-inactive-reason.enum';

@WebSocketGateway({
  cors: true,
})
export class RoomGatewayWsGateway {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(RoomGatewayWsGateway.name);

  constructor(
    private readonly authService: RoomGatewayAuthService,
    private readonly stateService: RoomGatewayStateService,
    private readonly eventsPublisher: RoomGatewayEventsPublisherService,
  ) {}

  handleConnection(client: Socket): void {
    const token = this.extractToken(client);

    if (!token) {
      client.disconnect(true);
      return;
    }

    const claims = this.authService.validateAccessToken(token);

    if (!claims) {
      client.disconnect(true);
      return;
    }

    this.stateService.registerSession({
      socket: client,
      tenant: claims.tenant,
      serverId: claims.server_id,
      supportedRoomTypes: new Set(),
      capacity: {
        [RoomCapacityBucket.PUBLIC]: 0,
        [RoomCapacityBucket.PRIVATE]: 0,
      },
      location: null,
    });
  }

  handleDisconnect(client: Socket): void {
    this.stateService.unregisterSession(client.id);
  }

  @SubscribeMessage(ROOM_GATEWAY_SERVER_MESSAGE_EVENT)
  async onServerMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() rawMessage: unknown,
  ): Promise<void> {
    const envelope = parseDto(rawMessage, RoomGatewayEnvelopeDto);

    if (!envelope) {
      return;
    }

    const session = this.stateService.getSession(client.id);

    if (!session) {
      client.disconnect(true);
      return;
    }

    switch (envelope.type) {
      case RoomGatewayMessageType.SERVER_HELLO: {
        const payload = parseDto(envelope.payload, ServerHelloDto);

        if (!payload || payload.server_id !== session.serverId) {
          client.disconnect(true);
          return;
        }

        this.stateService.updateSupportedRoomTypes(
          client.id,
          payload.supported_room_types,
        );
        this.stateService.updateCapacity(client.id, payload.capacity);
        this.stateService.updateLocation(client.id, payload.location ?? null);

        if (payload.active_rooms) {
          for (const roomUuid of payload.active_rooms) {
            this.stateService.setRoomRoute(roomUuid, session.tenant, client.id);
          }
        }

        return;
      }

      case RoomGatewayMessageType.CAPACITY_UPDATE: {
        const payload = parseDto(envelope.payload, CapacityUpdateDto);

        if (!payload) {
          return;
        }

        this.stateService.updateCapacity(client.id, payload);
        return;
      }

      case RoomGatewayMessageType.SUPPORTED_ROOM_TYPES_UPDATE: {
        const payload = parseDto(envelope.payload, SupportedRoomTypesUpdateDto);

        if (!payload) {
          return;
        }

        this.stateService.updateSupportedRoomTypes(
          client.id,
          payload.supported_room_types,
        );
        return;
      }

      case RoomGatewayMessageType.ROOM_HEARTBEAT: {
        const payload = parseDto(envelope.payload, RoomHeartbeatDto);

        if (!payload) {
          return;
        }

        this.stateService.setRoomRoute(
          payload.room_uuid,
          session.tenant,
          client.id,
        );

        await this.eventsPublisher.publishRoomHeartbeat({
          event_id: randomUUID(),
          tenant: session.tenant,
          room_uuid: payload.room_uuid,
          timestamp: (payload.timestamp ?? new Date()).toISOString(),
        });
        return;
      }

      case RoomGatewayMessageType.ROOM_CLOSED: {
        const payload = parseDto(envelope.payload, RoomClosedDto);

        if (!payload) {
          return;
        }

        this.stateService.removeRoomRoute(payload.room_uuid);

        await this.eventsPublisher.publishRoomClosed({
          event_id: randomUUID(),
          tenant: session.tenant,
          room_uuid: payload.room_uuid,
          reason: payload.reason ?? RoomInactiveReason.CLOSED,
          timestamp: (payload.timestamp ?? new Date()).toISOString(),
          message: payload.message,
        });
        return;
      }

      case RoomGatewayMessageType.OPEN_ROOM_RESULT: {
        if (!envelope.request_id) {
          return;
        }

        this.stateService.resolvePendingCommand(
          envelope.request_id,
          envelope.payload,
        );
        return;
      }

      case RoomGatewayMessageType.CLOSE_ROOM_RESULT: {
        if (!envelope.request_id) {
          return;
        }

        this.stateService.resolvePendingCommand(
          envelope.request_id,
          envelope.payload,
        );
        return;
      }

      default:
        this.logger.warn(
          `Unsupported message type from room server: ${envelope.type}`,
        );
        return;
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : null;

    if (authToken) {
      return authToken;
    }

    const authorization = client.handshake.headers.authorization;

    if (!authorization || Array.isArray(authorization)) {
      return null;
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return null;
    }

    return token;
  }
}
