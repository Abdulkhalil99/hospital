import { NotificationsRepository } from './notifications.repository';
import { sendSms }                 from './channels/sms.channel';
import { sendEmail }               from './channels/email.channel';
import { sendInApp }               from './channels/inapp.channel';
import { sendPush }                from './channels/push.channel';
import { logger }                  from '@/infrastructure/logger/logger';

const repo = new NotificationsRepository();

let isRunning = false;

async function processOne(job: {
  id:               string;
  channel_code:     string;
  user_id:          string | null;
  recipient_phone:  string | null;
  recipient_email:  string | null;
  rendered_subject: string | null;
  rendered_body:    string | null;
}): Promise<void> {
  const body = job.rendered_body ?? '';

  try {
    let result;

    switch (job.channel_code) {
      case 'sms':
        if (!job.recipient_phone) throw new Error('No phone number for SMS');
        result = await sendSms(job.recipient_phone, body);
        break;

      case 'email':
        if (!job.recipient_email) throw new Error('No email address for email');
        result = await sendEmail(
          job.recipient_email,
          job.rendered_subject ?? 'Notification from MediCore',
          body,
        );
        break;

      case 'inapp':
        if (!job.user_id) throw new Error('No user_id for in-app notification');
        result = await sendInApp(
          job.user_id,
          job.rendered_subject,
          body,
        );
        break;

      case 'push':
        // Device token lookup would be needed here
        result = { success: false, error: 'Push device token lookup not implemented' };
        break;

      default:
        throw new Error(`Unknown channel: ${job.channel_code}`);
    }

    if (result.success) {
      await repo.markSent(job.id, result.providerMessageId ?? 'ok');
    } else {
      await repo.markFailed(job.id, result.error ?? 'Delivery failed');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('Notification job failed', { jobId: job.id, channel: job.channel_code, error: msg });
    await repo.markFailed(job.id, msg);
  }
}

async function runBatch(): Promise<void> {
  if (isRunning) return;
  isRunning = true;

  try {
    const jobs = await repo.claimPendingJobs(20);
    if (jobs.length > 0) {
      logger.debug('Processing notification jobs', { count: jobs.length });
      await Promise.allSettled(jobs.map(processOne));
    }
  } catch (err: unknown) {
    logger.error('Notification worker batch error', {
      error: err instanceof Error ? err.message : String(err),
    });
  } finally {
    isRunning = false;
  }
}

export function startNotificationWorker(): void {
  // Run every 5 seconds — fast enough for most notifications
  setInterval(runBatch, 5000);
  runBatch();   // immediate first run
  logger.info('Notification worker started (polling every 5s)');
}
