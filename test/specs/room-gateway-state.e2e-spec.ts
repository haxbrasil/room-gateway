import { RoomGatewayMessageType } from '../../src/modules/room-gateway/constants/room-gateway-message-type.const';
import { RoomCapacityBucket } from '../../src/modules/room-gateway/enums/room-capacity-bucket.enum';
import { RoomGatewayStateService } from '../../src/modules/room-gateway/room-gateway-state.service';
import { isObjectWithFields } from '../../src/common/data/object-field.util';
import {
  roomServerCapacityFixture,
  roomServerSessionFixture,
  roomServerSocketFixture,
} from '../fixtures/room-gateway.fixture';

describe('RoomGatewayStateService (e2e)', () => {
  let service: RoomGatewayStateService;

  beforeEach(() => {
    service = new RoomGatewayStateService();
  });

  it('registers and retrieves a session', () => {
    const session = roomServerSessionFixture();
    service.registerSession(session);

    expect(service.getSession(session.socket.id)).toBe(session);
  });

  it('unregisters a session and removes routed rooms', () => {
    const session = roomServerSessionFixture();
    service.registerSession(session);
    service.setRoomRoute(
      '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      'tenant-a',
      session.socket.id,
    );

    service.unregisterSession(session.socket.id);

    expect(service.getSession(session.socket.id)).toBeNull();
    expect(
      service.findRoomRoute('986e7556-c699-4f2e-89ca-f8ffb79f66c4'),
    ).toBeNull();
  });

  it('rejects all pending commands when a session disconnects', async () => {
    const socket = roomServerSocketFixture({ id: 'socket-disconnect' });
    const session = roomServerSessionFixture({
      socket,
    });
    service.registerSession(session);

    const pendingPromise = service.dispatchCommand(
      session,
      RoomGatewayMessageType.OPEN_ROOM_COMMAND,
      { room_type: '5v5' },
      1_000,
    );

    service.unregisterSession(socket.id);

    await expect(pendingPromise).rejects.toThrow('Room server disconnected');
  });

  it('updates capacity for existing sessions only', () => {
    const session = roomServerSessionFixture();
    service.registerSession(session);

    service.updateCapacity(
      session.socket.id,
      roomServerCapacityFixture({
        public: 7,
        private: 3,
      }),
    );
    service.updateCapacity(
      'unknown',
      roomServerCapacityFixture({ public: 99 }),
    );

    expect(service.getSession(session.socket.id)?.capacity).toEqual({
      [RoomCapacityBucket.PUBLIC]: 7,
      [RoomCapacityBucket.PRIVATE]: 3,
    });
  });

  it('updates supported room types and location for existing sessions', () => {
    const session = roomServerSessionFixture();
    service.registerSession(session);

    service.updateSupportedRoomTypes(session.socket.id, ['5v5', '7v7']);
    service.updateLocation(session.socket.id, {
      region: 'eu-west',
      lat: 10,
      lon: 11,
    });

    expect(service.getSession(session.socket.id)?.supportedRoomTypes).toEqual(
      new Set(['5v5', '7v7']),
    );
    expect(service.getSession(session.socket.id)?.location).toEqual({
      region: 'eu-west',
      lat: 10,
      lon: 11,
    });
  });

  it('lists sessions by tenant', () => {
    service.registerSession(roomServerSessionFixture({ tenant: 'tenant-a' }));
    service.registerSession(
      roomServerSessionFixture({
        socket: roomServerSocketFixture({ id: 'socket-b' }),
        tenant: 'tenant-b',
      }),
    );

    expect(service.listTenantSessions('tenant-a')).toHaveLength(1);
    expect(service.listTenantSessions('tenant-b')).toHaveLength(1);
    expect(service.listTenantSessions('tenant-c')).toHaveLength(0);
  });

  it('finds sessions by room route with tenant isolation', () => {
    const session = roomServerSessionFixture();
    service.registerSession(session);
    service.setRoomRoute(
      '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      'tenant-a',
      session.socket.id,
    );

    expect(
      service.findSessionByRoom(
        'tenant-a',
        '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      ),
    ).toBe(session);
    expect(
      service.findSessionByRoom(
        'tenant-b',
        '986e7556-c699-4f2e-89ca-f8ffb79f66c4',
      ),
    ).toBeNull();
  });

  it('dispatches commands and resolves when result arrives', async () => {
    const socket = roomServerSocketFixture();
    const session = roomServerSessionFixture({ socket });
    service.registerSession(session);

    const commandPromise = service.dispatchCommand(
      session,
      RoomGatewayMessageType.OPEN_ROOM_COMMAND,
      { room_type: '5v5' },
      1_000,
    );

    expect(socket.emit).toHaveBeenCalledWith(
      'gateway_message',
      expect.objectContaining({
        type: RoomGatewayMessageType.OPEN_ROOM_COMMAND,
      }),
    );

    const emittedEnvelope = socket.emit.mock.calls[0][1];

    if (
      !isObjectWithFields(emittedEnvelope, 'request_id') ||
      typeof emittedEnvelope.request_id !== 'string'
    ) {
      throw new Error('Expected emitted envelope with request_id');
    }

    const resolved = service.resolvePendingCommand(emittedEnvelope.request_id, {
      state: 'open',
    });

    expect(resolved).toBe(true);
    await expect(commandPromise).resolves.toEqual({ state: 'open' });
  });

  it('returns false when resolving unknown request id', () => {
    expect(service.resolvePendingCommand('unknown', { state: 'open' })).toBe(
      false,
    );
  });

  it('fails dispatch immediately if socket is disconnected', async () => {
    const session = roomServerSessionFixture({
      socket: roomServerSocketFixture({ connected: false }),
    });
    service.registerSession(session);

    await expect(
      service.dispatchCommand(
        session,
        RoomGatewayMessageType.OPEN_ROOM_COMMAND,
        {},
        100,
      ),
    ).rejects.toThrow('Room server is disconnected');
  });

  it('fails dispatch when command times out', async () => {
    const session = roomServerSessionFixture();
    service.registerSession(session);

    await expect(
      service.dispatchCommand(
        session,
        RoomGatewayMessageType.OPEN_ROOM_COMMAND,
        {},
        10,
      ),
    ).rejects.toThrow('Command dispatch timed out');
  });
});
