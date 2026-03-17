import { Job } from 'bullmq';

export type RoomGatewayCommandJob = Pick<Job<unknown>, 'name' | 'data' | 'id'>;
