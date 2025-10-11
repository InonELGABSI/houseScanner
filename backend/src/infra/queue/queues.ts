import type { QueueOptions } from 'bullmq';

export const SCAN_QUEUE = 'scan-jobs';
type QueueConfig = Pick<QueueOptions, 'defaultJobOptions'>;

export const queueOptions: Record<string, QueueConfig> = {
  [SCAN_QUEUE]: {
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
      removeOnFail: false,
    },
  },
};
