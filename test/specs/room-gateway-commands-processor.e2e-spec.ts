import {
  ROOM_GATEWAY_CLOSE_ROOM_JOB,
  ROOM_GATEWAY_OPEN_ROOM_JOB,
} from '../../src/modules/room-gateway/constants/room-gateway-queue.const';
import { CloseRoomCompletionState } from '../../src/modules/room-gateway/enums/close-room-completion-state.enum';
import { OpenRoomCompletionState } from '../../src/modules/room-gateway/enums/open-room-completion-state.enum';
import { RoomGatewayCommandsProcessor } from '../../src/modules/room-gateway/room-gateway-commands.processor';
import { RoomGatewayStateService } from '../../src/modules/room-gateway/room-gateway-state.service';
import { RoomGatewayService } from '../../src/modules/room-gateway/room-gateway.service';
import {
  closeRoomCommandFixture,
  openRoomCommandFixture,
  openRoomCommandWithoutFakePasswordFixture,
} from '../fixtures/room-gateway.fixture';
import { queueJobFixture } from '../fixtures/queue-job.fixture';

describe('RoomGatewayCommandsProcessor (e2e)', () => {
  function createProcessorWithSpies() {
    const service = new RoomGatewayService(new RoomGatewayStateService());
    const openSpy = jest
      .spyOn(service, 'handleOpenRoomCommand')
      .mockResolvedValue({
        state: OpenRoomCompletionState.FAILED,
        code: 'not_implemented',
      });
    const closeSpy = jest
      .spyOn(service, 'handleCloseRoomCommand')
      .mockResolvedValue({
        state: CloseRoomCompletionState.FAILED,
        code: 'not_implemented',
      });

    return {
      processor: new RoomGatewayCommandsProcessor(service),
      openSpy,
      closeSpy,
    };
  }

  it('dispatches open-room commands to service', async () => {
    const { processor, openSpy } = createProcessorWithSpies();
    const command = openRoomCommandFixture();

    await processor.process(
      queueJobFixture(ROOM_GATEWAY_OPEN_ROOM_JOB, command),
    );

    expect(openSpy).toHaveBeenCalledWith(command);
  });

  it('normalizes fake_password to null when open command omits it', async () => {
    const { processor, openSpy } = createProcessorWithSpies();

    await processor.process(
      queueJobFixture(
        ROOM_GATEWAY_OPEN_ROOM_JOB,
        openRoomCommandWithoutFakePasswordFixture(),
      ),
    );

    expect(openSpy).toHaveBeenCalledTimes(1);

    const calledWith = openSpy.mock.calls[0][0];
    expect(calledWith.room_properties.fake_password).toBeNull();
  });

  it('dispatches close-room commands to service', async () => {
    const { processor, closeSpy } = createProcessorWithSpies();
    const command = closeRoomCommandFixture();

    await processor.process(
      queueJobFixture(ROOM_GATEWAY_CLOSE_ROOM_JOB, command),
    );

    expect(closeSpy).toHaveBeenCalledWith(command);
  });

  it('throws for invalid open-room payload', async () => {
    const { processor } = createProcessorWithSpies();

    await expect(
      processor.process(
        queueJobFixture(ROOM_GATEWAY_OPEN_ROOM_JOB, {
          tenant: 'tenant-a',
        }),
      ),
    ).rejects.toThrow('Invalid open-room command payload');
  });

  it('throws for invalid close-room payload', async () => {
    const { processor } = createProcessorWithSpies();

    await expect(
      processor.process(
        queueJobFixture(ROOM_GATEWAY_CLOSE_ROOM_JOB, {
          tenant: 'tenant-a',
        }),
      ),
    ).rejects.toThrow('Invalid close-room command payload');
  });

  it('throws for unsupported job names', async () => {
    const { processor } = createProcessorWithSpies();

    await expect(
      processor.process(queueJobFixture('unsupported-job', {})),
    ).rejects.toThrow('Unsupported command job: unsupported-job');
  });
});
