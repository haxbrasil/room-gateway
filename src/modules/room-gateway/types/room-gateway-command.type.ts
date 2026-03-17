import { RoomInactiveReason } from '../enums/room-inactive-reason.enum';
import { CloseRoomCompletionState } from '../enums/close-room-completion-state.enum';
import { CloseRoomFailureCode } from '../enums/close-room-failure-code.enum';
import { OpenRoomCompletionState } from '../enums/open-room-completion-state.enum';
import { OpenRoomFailureCode } from '../enums/open-room-failure-code.enum';

export type RoomGeo = {
  code: string;
  lat: number;
  lon: number;
};

export type RoomProperties = {
  name: string;
  geo: RoomGeo;
  max_player_count: number;
  show_in_room_list: boolean;
  password?: string | null;
  no_player: boolean;
  player_count?: number | null;
  unlimited_player_count: boolean;
  fake_password: boolean | null;
};

export type OpenRoomCommand = {
  tenant: string;
  room_type: string;
  room_properties: RoomProperties;
  token?: string;
};

export type CloseRoomCommand = {
  tenant: string;
  room_uuid: string;
  reason: RoomInactiveReason;
};

export type OpenRoomCompletion =
  | {
      state: OpenRoomCompletionState.OPEN;
      room_uuid?: string;
      invite?: string;
    }
  | {
      state: OpenRoomCompletionState.FAILED;
      code: OpenRoomFailureCode | string;
      message?: string;
    };

export type CloseRoomCompletion =
  | {
      state: CloseRoomCompletionState.CLOSED;
    }
  | {
      state: CloseRoomCompletionState.FAILED;
      code: CloseRoomFailureCode | string;
      message?: string;
    };
