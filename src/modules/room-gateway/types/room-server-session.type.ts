import { RoomCapacityBucket } from '../enums/room-capacity-bucket.enum';

export type RoomServerSocket = {
  id: string;
  connected: boolean;
  emit(event: string, payload: unknown): boolean;
};

export type RoomServerLocation = {
  region?: string;
  lat?: number;
  lon?: number;
};

export type RoomServerCapacity = {
  [RoomCapacityBucket.PUBLIC]: number;
  [RoomCapacityBucket.PRIVATE]: number;
};

export type RoomServerSession = {
  socket: RoomServerSocket;
  tenant: string;
  serverId: string;
  supportedRoomTypes: Set<string>;
  capacity: RoomServerCapacity;
  location: RoomServerLocation | null;
};
