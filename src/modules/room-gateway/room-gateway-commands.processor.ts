import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { parseDto } from '../../common/dto/parse-dto.util';
import {
  ROOM_GATEWAY_CLOSE_ROOM_JOB,
  ROOM_GATEWAY_COMMANDS_QUEUE,
  ROOM_GATEWAY_OPEN_ROOM_JOB,
} from './constants/room-gateway-queue.const';
import {
  CloseRoomCommandDto,
  OpenRoomCommandDto,
} from './dtos/open-room-command.dto';
import {
  CloseRoomCommand,
  OpenRoomCommand,
} from './types/room-gateway-command.type';
import { RoomGatewayCommandJob } from './types/room-gateway-command-job.type';
import { RoomGatewayService } from './room-gateway.service';

@Injectable()
@Processor(ROOM_GATEWAY_COMMANDS_QUEUE)
export class RoomGatewayCommandsProcessor extends WorkerHost {
  private readonly logger = new Logger(RoomGatewayCommandsProcessor.name);

  constructor(private readonly service: RoomGatewayService) {
    super();
  }

  async process(job: RoomGatewayCommandJob): Promise<unknown> {
    switch (job.name) {
      case ROOM_GATEWAY_OPEN_ROOM_JOB: {
        const command = parseDto(job.data, OpenRoomCommandDto);

        if (!command) {
          throw new Error('Invalid open-room command payload');
        }

        const normalizedCommand: OpenRoomCommand = {
          tenant: command.tenant,
          room_type: command.room_type,
          room_properties: {
            name: command.room_properties.name,
            geo: {
              code: command.room_properties.geo.code,
              lat: command.room_properties.geo.lat,
              lon: command.room_properties.geo.lon,
            },
            max_player_count: command.room_properties.max_player_count,
            show_in_room_list: command.room_properties.show_in_room_list,
            password: command.room_properties.password,
            no_player: command.room_properties.no_player,
            player_count: command.room_properties.player_count,
            unlimited_player_count:
              command.room_properties.unlimited_player_count,
            fake_password: command.room_properties.fake_password ?? null,
          },
          token: command.token,
        };

        return await this.service.handleOpenRoomCommand(normalizedCommand);
      }
      case ROOM_GATEWAY_CLOSE_ROOM_JOB: {
        const command = parseDto(job.data, CloseRoomCommandDto);

        if (!command) {
          throw new Error('Invalid close-room command payload');
        }

        const normalizedCommand: CloseRoomCommand = {
          tenant: command.tenant,
          room_uuid: command.room_uuid,
          reason: command.reason,
        };

        return await this.service.handleCloseRoomCommand(normalizedCommand);
      }
      default:
        throw new Error(`Unsupported command job: ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<unknown>, error: Error): void {
    this.logger.error(
      `Failed command job ${job.name} (${job.id})`,
      error.stack,
    );
  }
}
