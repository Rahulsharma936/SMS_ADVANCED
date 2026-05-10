/**
 * reminder.service.ts — Phase 9
 *
 * Logs reminder events per installment.
 * Deduplication: won't send same type reminder to same installment within 24h.
 * Actual SMS/email delivery is pluggable — service logs the event and returns.
 */

import { prisma } from '../../prisma/client';

const notFound = (msg: string) => Object.assign(new Error(msg), { status: 404 });
const badReq   = (msg: string) => Object.assign(new Error(msg), { status: 400 });

const VALID_TYPES = ['sms', 'email', 'whatsapp'] as const;
const DEDUP_WINDOW_HOURS = 24;

// ─── SEND REMINDER ───────────────────────────────────────────────────────────

export const sendReminder = async (
  tenantId:     string,
  studentId:    string,
  installmentId: string,
  type:         'sms' | 'email' | 'whatsapp',
  message?:     string
) => {
  if (!VALID_TYPES.includes(type)) throw badReq(`type must be one of: ${VALID_TYPES.join(', ')}`);

  const [student, installment] = await Promise.all([
    prisma.student.findFirst({
      where:   { id: studentId, tenant_id: tenantId, deletedAt: null },
      select:  { id: true, firstName: true, lastName: true, guardianContact: true, guardianEmail: true },
    }),
    prisma.feeInstallment.findFirst({
      where:   { id: installmentId, tenant_id: tenantId },
      include: { studentFee: { include: { feeStructure: { select: { name: true, currency: true } } } } },
    }),
  ]);

  if (!student)     throw notFound('Student not found');
  if (!installment) throw notFound('Installment not found');
  if (installment.status === 'paid') throw badReq('Installment is already paid — no reminder needed');

  // Deduplication: check if same type reminder was sent in the last 24h
  const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000);
  const recentLog = await prisma.reminderLog.findFirst({
    where: {
      tenant_id:      tenantId,
      student_id:     studentId,
      installment_id: installmentId,
      type,
      sent_at:        { gte: dedupCutoff },
    },
  });
  if (recentLog) throw badReq(`A ${type} reminder was already sent within the last ${DEDUP_WINDOW_HOURS} hours`);

  // Build message if not provided
  const auto_message = message || buildMessage(type, student, installment);

  // TODO: plug in actual SMS/email/WhatsApp provider here
  // e.g. await twilioClient.messages.create({ to: student.guardianContact, body: auto_message })

  const log = await prisma.reminderLog.create({
    data: {
      tenant_id:      tenantId,
      student_id:     studentId,
      installment_id: installmentId,
      type,
      message:        auto_message,
      status:         'sent',
    },
  });

  return { log, message: auto_message };
};

function buildMessage(type: string, student: any, installment: any): string {
  const name    = `${student.firstName} ${student.lastName}`;
  const amount  = Number(installment.amount).toFixed(2);
  const due     = new Date(installment.due_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const isOverdue = installment.status === 'overdue' || new Date(installment.due_date) < new Date();

  if (isOverdue) {
    return `Dear Parent/Guardian, fee installment "${installment.installment_name}" of ₹${amount} for ${name} was due on ${due} and is now OVERDUE. Please pay immediately.`;
  }
  return `Dear Parent/Guardian, fee installment "${installment.installment_name}" of ₹${amount} for ${name} is due on ${due}. Please pay on time.`;
}

// ─── SEND BULK REMINDERS (for all overdue in a tenant) ───────────────────────

export const sendBulkReminders = async (
  tenantId:   string,
  type:       'sms' | 'email' | 'whatsapp',
  class_id?:  string
) => {
  if (!VALID_TYPES.includes(type)) throw badReq(`type must be one of: ${VALID_TYPES.join(', ')}`);

  const now     = new Date();
  const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000);

  // Fetch all overdue/pending-past-due installments
  const overdueInstallments = await prisma.feeInstallment.findMany({
    where: {
      tenant_id: tenantId,
      status:    { in: ['pending', 'overdue', 'partial'] },
      due_date:  { lt: now },
      studentFee: {
        student: {
          deletedAt: null,
          ...(class_id ? { class_id } : {}),
        },
      },
    },
    include: {
      studentFee: {
        include: {
          student: {
            select: { id: true, firstName: true, lastName: true, guardianContact: true, guardianEmail: true },
          },
          feeStructure: { select: { name: true, currency: true } },
        },
      },
    },
  });

  // Fetch existing recent logs to deduplicate
  const recentLogs = await prisma.reminderLog.findMany({
    where: {
      tenant_id: tenantId,
      type,
      sent_at:   { gte: dedupCutoff },
    },
    select: { installment_id: true, student_id: true },
  });
  const alreadySent = new Set(recentLogs.map(l => `${l.student_id}:${l.installment_id}`));

  const toSend = overdueInstallments.filter(inst => {
    const student = inst.studentFee.student;
    if (!student) return false;
    return !alreadySent.has(`${student.id}:${inst.id}`);
  });

  if (toSend.length === 0) return { sent: 0, skipped: overdueInstallments.length - toSend.length };

  // Bulk-create reminder logs
  await prisma.reminderLog.createMany({
    data: toSend.map(inst => {
      const student = inst.studentFee.student!;
      return {
        tenant_id:      tenantId,
        student_id:     student.id,
        installment_id: inst.id,
        type,
        message:        buildMessage(type, student, inst),
        status:         'sent',
      };
    }),
  });

  return {
    sent:    toSend.length,
    skipped: overdueInstallments.length - toSend.length,
  };
};

// ─── GET REMINDER LOGS ────────────────────────────────────────────────────────

export const getReminderLogs = async (
  tenantId:  string,
  studentId?: string,
  type?:      string
) => {
  return prisma.reminderLog.findMany({
    where: {
      tenant_id:  tenantId,
      ...(studentId ? { student_id: studentId } : {}),
      ...(type      ? { type }                  : {}),
    },
    include: {
      student:     { select: { id: true, firstName: true, lastName: true, admission_number: true } },
      installment: { select: { id: true, installment_name: true, due_date: true, amount: true } },
    },
    orderBy: { sent_at: 'desc' },
    take: 200,
  });
};
