import { Job, Queue, QueueEvents } from 'bullmq';
import { waitFor } from './wait-for.util';

export async function waitForJobCompletion<TData, TResult>(
  job: Job<TData, TResult, string>,
  queueEvents: QueueEvents,
  timeoutMs = 3_000,
): Promise<TResult> {
  await queueEvents.waitUntilReady();
  return await job.waitUntilFinished(queueEvents, timeoutMs);
}

export async function waitForWaitingJobs<TData, TResult>(
  queue: Queue<TData, TResult, string>,
  expectedCount = 1,
  timeoutMs = 3_000,
) {
  return await waitFor(
    async () => await queue.getWaiting(),
    (jobs) => jobs.length >= expectedCount,
    timeoutMs,
    20,
    `Timed out waiting for ${expectedCount} waiting queue jobs`,
  );
}
