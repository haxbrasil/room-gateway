# Room Gateway

NestJS service that bridges:

- BullMQ commands from API (`room-gateway-commands`)
- WebSocket-connected Room Servers
- BullMQ events back to API (`room-gateway-events`)

## Queues

- `room-gateway-commands`
  - `open-room`
  - `close-room`
- `room-gateway-events`
  - `room-heartbeat`
  - `room-closed`

## Room Server auth

JWT claims required:

- `tenant`
- `service=room-server`
- `server_id`

## WebSocket protocol

Server sends `server_message` envelopes: `{ type, request_id?, payload }`.
Gateway sends `gateway_message` envelopes with command types:

- `open_room`
- `close_room`

Server pushes:

- `server_hello`
- `capacity_update`
- `supported_room_types_update`
- `room_heartbeat`
- `room_closed`
- `open_room_result`
- `close_room_result`

## Development

- Install: `pnpm install`
- Lint: `pnpm run lint`
- Build: `pnpm run build`
- E2E tests: `pnpm run test:e2e`

## Code Style

- Style guide: `docs/contribution/code-style-guide.md`
