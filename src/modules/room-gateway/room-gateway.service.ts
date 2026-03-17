import { Injectable } from '@nestjs/common';
import { parseDto } from '../../common/dto/parse-dto.util';
import { RoomGatewayMessageType } from './constants/room-gateway-message-type.const';
import { CloseRoomResultDto } from './dtos/close-room-result.dto';
import { OpenRoomResultDto } from './dtos/open-room-result.dto';
import { CloseRoomCompletionState } from './enums/close-room-completion-state.enum';
import { CloseRoomFailureCode } from './enums/close-room-failure-code.enum';
import { OpenRoomCompletionState } from './enums/open-room-completion-state.enum';
import { OpenRoomFailureCode } from './enums/open-room-failure-code.enum';
import { RoomCapacityBucket } from './enums/room-capacity-bucket.enum';
import { RoomGatewayStateService } from './room-gateway-state.service';
import {
  CloseRoomCommand,
  CloseRoomCompletion,
  OpenRoomCommand,
  OpenRoomCompletion,
} from './types/room-gateway-command.type';
import { RoomServerSession } from './types/room-server-session.type';

const OPEN_ROOM_TIMEOUT_MS = 15_000;
const CLOSE_ROOM_TIMEOUT_MS = 15_000;
const INVALID_OPEN_ROOM_RESULT_MESSAGE = 'Invalid open_room_result payload';
const INVALID_CLOSE_ROOM_RESULT_MESSAGE = 'Invalid close_room_result payload';

@Injectable()
export class RoomGatewayService {
  constructor(private readonly state: RoomGatewayStateService) {}

  async handleOpenRoomCommand(
    command: OpenRoomCommand,
  ): Promise<OpenRoomCompletion> {
    const tenantSessions = this.state.listTenantSessions(command.tenant);

    if (tenantSessions.length === 0) {
      return this.failOpenRoom(OpenRoomFailureCode.NO_SERVER_FOR_TENANT);
    }

    const typeMatchedSessions = tenantSessions.filter((session) =>
      session.supportedRoomTypes.has(command.room_type),
    );

    if (typeMatchedSessions.length === 0) {
      return this.failOpenRoom(OpenRoomFailureCode.UNSUPPORTED_ROOM_TYPE);
    }

    const capacityBucket = this.resolveCapacityBucket(command);
    const capacityMatchedSessions = typeMatchedSessions.filter(
      (session) => session.capacity[capacityBucket] > 0,
    );

    if (capacityMatchedSessions.length === 0) {
      return this.failOpenRoom(OpenRoomFailureCode.NO_CAPACITY_AVAILABLE);
    }

    const selectedSession = this.selectServerWithMostCapacity(
      capacityMatchedSessions,
      capacityBucket,
    );

    const commandResult = await this.dispatchOpenRoom(selectedSession, command);

    if (commandResult === null) {
      return this.failOpenRoom(OpenRoomFailureCode.DISPATCH_TIMEOUT);
    }

    const openResult = parseDto(commandResult, OpenRoomResultDto);

    if (!openResult) {
      return this.failOpenRoom(
        OpenRoomFailureCode.SERVER_REJECTED,
        INVALID_OPEN_ROOM_RESULT_MESSAGE,
      );
    }

    if (openResult.state === OpenRoomCompletionState.OPEN) {
      if (openResult.room_uuid) {
        this.state.setRoomRoute(
          openResult.room_uuid,
          command.tenant,
          selectedSession.socket.id,
        );
      }

      return {
        state: OpenRoomCompletionState.OPEN,
        room_uuid: openResult.room_uuid,
        invite: openResult.invite,
      };
    }

    return this.failOpenRoom(
      openResult.code ?? OpenRoomFailureCode.SERVER_REJECTED,
      openResult.message,
    );
  }

  async handleCloseRoomCommand(
    command: CloseRoomCommand,
  ): Promise<CloseRoomCompletion> {
    const targetSession = this.state.findSessionByRoom(
      command.tenant,
      command.room_uuid,
    );

    if (!targetSession) {
      return this.failCloseRoom(CloseRoomFailureCode.NO_SERVER_FOR_ROOM);
    }

    const commandResult = await this.dispatchCloseRoom(targetSession, command);

    if (commandResult === null) {
      return this.failCloseRoom(CloseRoomFailureCode.DISPATCH_TIMEOUT);
    }

    const closeResult = parseDto(commandResult, CloseRoomResultDto);

    if (!closeResult) {
      return this.failCloseRoom(
        CloseRoomFailureCode.SERVER_REJECTED,
        INVALID_CLOSE_ROOM_RESULT_MESSAGE,
      );
    }

    if (!closeResult.accepted) {
      return this.failCloseRoom(
        closeResult.code ?? CloseRoomFailureCode.SERVER_REJECTED,
        closeResult.message,
      );
    }

    this.state.removeRoomRoute(command.room_uuid);

    return {
      state: CloseRoomCompletionState.CLOSED,
    };
  }

  private resolveCapacityBucket(command: OpenRoomCommand): RoomCapacityBucket {
    return command.room_properties.show_in_room_list
      ? RoomCapacityBucket.PUBLIC
      : RoomCapacityBucket.PRIVATE;
  }

  private selectServerWithMostCapacity(
    sessions: RoomServerSession[],
    capacityBucket: RoomCapacityBucket,
  ): RoomServerSession {
    return [...sessions].sort((left, right) => {
      const byCapacity =
        right.capacity[capacityBucket] - left.capacity[capacityBucket];

      if (byCapacity !== 0) {
        return byCapacity;
      }

      return left.serverId.localeCompare(right.serverId);
    })[0];
  }

  private async dispatchOpenRoom(
    session: RoomServerSession,
    command: OpenRoomCommand,
  ): Promise<unknown> {
    try {
      return await this.state.dispatchCommand(
        session,
        RoomGatewayMessageType.OPEN_ROOM_COMMAND,
        {
          room_type: command.room_type,
          room_properties: command.room_properties,
          ...(command.token ? { token: command.token } : {}),
        },
        OPEN_ROOM_TIMEOUT_MS,
      );
    } catch {
      return null;
    }
  }

  private async dispatchCloseRoom(
    session: RoomServerSession,
    command: CloseRoomCommand,
  ): Promise<unknown> {
    try {
      return await this.state.dispatchCommand(
        session,
        RoomGatewayMessageType.CLOSE_ROOM_COMMAND,
        {
          room_uuid: command.room_uuid,
          reason: command.reason,
        },
        CLOSE_ROOM_TIMEOUT_MS,
      );
    } catch {
      return null;
    }
  }

  private failOpenRoom(
    code: OpenRoomFailureCode | string,
    message?: string,
  ): OpenRoomCompletion {
    return {
      state: OpenRoomCompletionState.FAILED,
      code,
      message,
    };
  }

  private failCloseRoom(
    code: CloseRoomFailureCode | string,
    message?: string,
  ): CloseRoomCompletion {
    return {
      state: CloseRoomCompletionState.FAILED,
      code,
      message,
    };
  }
}
