import { RoomGatewayCommandJob } from '../../src/modules/room-gateway/types/room-gateway-command-job.type';

export function queueJobFixture(
  name: string,
  data: unknown,
  id = '1',
): RoomGatewayCommandJob {
  return {
    name,
    data,
    id,
  };
}
