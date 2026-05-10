/**
 * notification.queue.ts — Phase 10
 *
 * Queue-first architecture: controllers enqueue jobs, this service processes them.
 * Providers are pluggable via the CHANNEL_PROCESSORS map.
 * NOT tightly coupled to any SMS/email provider — each channel is a swappable fn.
 *
 * Future: replace processQueue() polling with a real job queue (BullMQ / pg-boss).
 */

import { prisma } from '../../prisma/client';

// ─── Channel processor stubs ─────────────────────────────────────────────────
// Each channel processor receives a queue job and returns a result.
// Swap in real providers without touching the queue logic.

type ProcessorResult = { success: boolean; response?: any; error?: string };

const processors: Record<string, (job: any) => Promise<ProcessorResult>> = {
  in_app: async (job) => {
    // In-app notifications are written to InAppNotification table directly on enqueue.
    // Nothing to do at process time — just mark as sent.
    return { success: true, response: { channel: 'in_app', handled: 'at_enqueue' } };
  },

  email: async (job) => {
    // TODO: plug in SendGrid / SES / Nodemailer here
    // e.g. await sgMail.send({ to: job.recipient, subject: job.title, text: job.message });
    console.log(`[Queue:email] Would send to ${job.recipient}: ${job.title}`);
    return { success: true, response: { provider: 'stub', channel: 'email' } };
  },

  sms: async (job) => {
    // TODO: plug in Twilio / Fast2SMS here
    console.log(`[Queue:sms] Would SMS to ${job.recipient}: ${job.message}`);
    return { success: true, response: { provider: 'stub', channel: 'sms' } };
  },

  whatsapp: async (job) => {
    // TODO: plug in WhatsApp Business API here
    console.log(`[Queue:whatsapp] Would WhatsApp to ${job.recipient}: ${job.message}`);
    return { success: true, response: { provider: 'stub', channel: 'whatsapp' } };
  },

  push: async (job) => {
    // TODO: plug in FCM / APNS here
    console.log(`[Queue:push] Would push to ${job.recipient}: ${job.title}`);
    return { success: true, response: { provider: 'stub', channel: 'push' } };
  },
};

// ─── ENQUEUE ─────────────────────────────────────────────────────────────────

export interface EnqueueOptions {
  tenant_id:     string;
  type:          string;
  channel:       string;
  recipient:     string;
  title:         string;
  message:       string;
  ref_id?:       string;
  scheduled_at?: Date;
}

export const enqueueNotification = async (opts: EnqueueOptions) => {
  return prisma.notificationQueue.create({
    data: {
      tenant_id:    opts.tenant_id,
      type:         opts.type,
      channel:      opts.channel,
      recipient:    opts.recipient,
      title:        opts.title,
      message:      opts.message,
      ref_id:       opts.ref_id ?? null,
      scheduled_at: opts.scheduled_at ?? new Date(),
      status:       'queued',
    },
  });
};

export const enqueueBatch = async (jobs: EnqueueOptions[]) => {
  if (jobs.length === 0) return { count: 0 };
  return prisma.notificationQueue.createMany({
    data: jobs.map(j => ({
      tenant_id:    j.tenant_id,
      type:         j.type,
      channel:      j.channel,
      recipient:    j.recipient,
      title:        j.title,
      message:      j.message,
      ref_id:       j.ref_id ?? null,
      scheduled_at: j.scheduled_at ?? new Date(),
      status:       'queued',
    })),
  });
};

// ─── PROCESS (worker) ─────────────────────────────────────────────────────────
// Call this from a cron job / worker endpoint. Processes up to `batchSize` queued jobs.

export const processQueue = async (tenantId?: string, batchSize = 50) => {
  const now = new Date();

  const jobs = await prisma.notificationQueue.findMany({
    where: {
      status:       { in: ['queued'] },
      scheduled_at: { lte: now },
      retry_count:  { lt: 3 },  // max_retries default
      ...(tenantId ? { tenant_id: tenantId } : {}),
    },
    orderBy: { scheduled_at: 'asc' },
    take: batchSize,
  });

  let sent = 0, failed = 0;

  for (const job of jobs) {
    // Mark processing
    await prisma.notificationQueue.update({
      where: { id: job.id },
      data:  { status: 'processing' },
    });

    const processor = processors[job.channel] ?? processors['email'];
    try {
      const result = await processor(job);

      await prisma.$transaction([
        prisma.notificationQueue.update({
          where: { id: job.id },
          data: {
            status:           result.success ? 'sent' : 'failed',
            processed_at:     new Date(),
            provider_response: result.response ?? null,
            retry_count:      result.success ? job.retry_count : job.retry_count + 1,
          },
        }),
        prisma.notificationDeliveryLog.create({
          data: {
            queue_id: job.id,
            status:   result.success ? 'sent' : 'failed',
            response: result.response ?? null,
          },
        }),
      ]);

      result.success ? sent++ : failed++;
    } catch (err: any) {
      const isMaxRetry = job.retry_count + 1 >= job.max_retries;
      await prisma.$transaction([
        prisma.notificationQueue.update({
          where: { id: job.id },
          data: {
            status:      isMaxRetry ? 'failed' : 'queued',
            retry_count: job.retry_count + 1,
          },
        }),
        prisma.notificationDeliveryLog.create({
          data: {
            queue_id: job.id,
            status:   'failed',
            response: { error: err.message },
          },
        }),
      ]);
      failed++;
    }
  }

  return { processed: jobs.length, sent, failed };
};

// ─── QUEUE STATUS ─────────────────────────────────────────────────────────────

export const getQueueStatus = async (tenantId: string) => {
  const [byStatus, byChannel, recentFailed] = await Promise.all([
    prisma.notificationQueue.groupBy({
      by:    ['status'],
      where: { tenant_id: tenantId },
      _count: { id: true },
    }),
    prisma.notificationQueue.groupBy({
      by:    ['channel'],
      where: { tenant_id: tenantId, status: { in: ['queued', 'processing'] } },
      _count: { id: true },
    }),
    prisma.notificationQueue.findMany({
      where:   { tenant_id: tenantId, status: 'failed' },
      orderBy: { processed_at: 'desc' },
      take: 10,
      select: { id: true, channel: true, recipient: true, title: true, retry_count: true, processed_at: true },
    }),
  ]);

  return {
    by_status:     byStatus.map(r => ({ status: r.status, count: r._count.id })),
    by_channel:    byChannel.map(r => ({ channel: r.channel, count: r._count.id })),
    recent_failed: recentFailed,
  };
};
