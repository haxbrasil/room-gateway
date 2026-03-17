import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT,
  RoomGatewayMessageType,
} from './constants/room-gateway-message-type.const';
import {
  RoomServerCapacity,
  RoomServerLocation,
  RoomServerSession,
} from './types/room-server-session.type';

type PendingCommand = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  socketId: string;
};

type RoomRoute = {
  tenant: string;
  socketId: string;
};

@Injectable()
export class RoomGatewayStateService {
  private readonly sessions = new Map<string, RoomServerSession>();
  private readonly roomRoutes = new Map<string, RoomRoute>();
  private readonly pendingCommands = new Map<string, PendingCommand>();

  registerSession(session: RoomServerSession): void {
    this.sessions.set(session.socket.id, session);
  }

  unregisterSession(socketId: string): void {
    this.sessions.delete(socketId);

    for (const [roomUuid, route] of this.roomRoutes.entries()) {
      if (route.socketId === socketId) {
        this.roomRoutes.delete(roomUuid);
      }
    }

    for (const [requestId, pending] of this.pendingCommands.entries()) {
      if (pending.socketId === socketId) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Room server disconnected'));
        this.pendingCommands.delete(requestId);
      }
    }
  }

  getSession(socketId: string): RoomServerSession | null {
    return this.sessions.get(socketId) ?? null;
  }

  updateCapacity(socketId: string, capacity: RoomServerCapacity): void {
    const session = this.sessions.get(socketId);

    if (!session) {
      return;
    }

    session.capacity = capacity;
  }

  updateSupportedRoomTypes(
    socketId: string,
    supportedRoomTypes: string[],
  ): void {
    const session = this.sessions.get(socketId);

    if (!session) {
      return;
    }

    session.supportedRoomTypes = new Set(supportedRoomTypes);
  }

  updateLocation(socketId: string, location: RoomServerLocation | null): void {
    const session = this.sessions.get(socketId);

    if (!session) {
      return;
    }

    session.location = location;
  }

  listTenantSessions(tenant: string): RoomServerSession[] {
    return [...this.sessions.values()].filter(
      (session) => session.tenant === tenant,
    );
  }

  setRoomRoute(roomUuid: string, tenant: string, socketId: string): void {
    this.roomRoutes.set(roomUuid, { tenant, socketId });
  }

  removeRoomRoute(roomUuid: string): void {
    this.roomRoutes.delete(roomUuid);
  }

  findRoomRoute(roomUuid: string): RoomRoute | null {
    return this.roomRoutes.get(roomUuid) ?? null;
  }

  findSessionByRoom(
    tenant: string,
    roomUuid: string,
  ): RoomServerSession | null {
    const route = this.roomRoutes.get(roomUuid);

    if (!route || route.tenant !== tenant) {
      return null;
    }

    return this.sessions.get(route.socketId) ?? null;
  }

  async dispatchCommand(
    session: RoomServerSession,
    type: RoomGatewayMessageType,
    payload: unknown,
    timeoutMs: number,
  ): Promise<unknown> {
    if (!session.socket.connected) {
      throw new Error('Room server is disconnected');
    }

    const requestId = randomUUID();

    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingCommands.delete(requestId);
        reject(new Error('Command dispatch timed out'));
      }, timeoutMs);

      this.pendingCommands.set(requestId, {
        resolve,
        reject,
        timeout,
        socketId: session.socket.id,
      });

      session.socket.emit(ROOM_GATEWAY_TO_SERVER_MESSAGE_EVENT, {
        type,
        request_id: requestId,
        payload,
      });
    });
  }

  resolvePendingCommand(requestId: string, payload: unknown): boolean {
    const pending = this.pendingCommands.get(requestId);

    if (!pending) {
      return false;
    }

    clearTimeout(pending.timeout);
    this.pendingCommands.delete(requestId);
    pending.resolve(payload);
    return true;
  }
}
