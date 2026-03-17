import { Socket } from 'socket.io-client';

export function waitForSocketEvent<T = unknown>(
  socket: Socket,
  eventName: string,
  timeoutMs = 3_000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, onEvent);
      reject(new Error(`Timed out waiting for socket event: ${eventName}`));
    }, timeoutMs);

    const onEvent = (payload: T) => {
      clearTimeout(timeout);
      socket.off(eventName, onEvent);
      resolve(payload);
    };

    socket.on(eventName, onEvent);
  });
}

export async function waitForSocketDisconnect(
  socket: Socket,
  timeoutMs = 3_000,
): Promise<string> {
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off('disconnect', onDisconnect);
      reject(new Error('Timed out waiting for disconnect'));
    }, timeoutMs);

    const onDisconnect = (reason: string) => {
      clearTimeout(timeout);
      socket.off('disconnect', onDisconnect);
      resolve(reason);
    };

    socket.on('disconnect', onDisconnect);
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
