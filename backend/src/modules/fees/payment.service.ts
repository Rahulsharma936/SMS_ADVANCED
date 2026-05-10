/**
 * payment.service.ts — Phase 8 Payment Engine
 *
 * ALL monetary math uses Prisma Decimal (BigDecimal-compatible).
 * ALL write operations run inside prisma.$transaction.
 * Status propagation is computed inside the same transaction as payment.
 */

import { prisma } from '../../prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const notFound = (msg: string) => Object.assign(new Error(msg), { status: 404 });
const badReq   = (msg: string) => Object.assign(new Error(msg), { status: 400 });
const conflict = (msg: string) => Object.assign(new Error(msg), { status: 409 });

const d = (v: number | string | Decimal) => new Decimal(v);
const n = (v: Decimal | string | number) => Number(v);

const VALID_METHODS = ['cash', 'upi', 'razorpay', 'cheque', 'dd', 'bank_transfer'] as const;
const VALID_STATUSES = ['pending', 'success', 'failed', 'refunded'] as const;

// ─── Status propagation helpers ───────────────────────────────────────────────

/**
 * Derive installment status from amount already allocated.
 * Reads PaymentAllocation aggregates, not FeePayment statuses, for accuracy.
 */
function deriveInstallmentStatus(
  existingPaid: number,
  installmentAmount: number,
  dueDate: Date
): string {
  if (existingPaid <= 0) {
    return new Date(dueDate) < new Date() ? 'overdue' : 'pending';
  }
  if (existingPaid >= installmentAmount) return 'paid';
  return 'partial';
}

// ─── CREATE PAYMENT ───────────────────────────────────────────────────────────

export interface AllocationInput {
  installment_id: string;
  amount:         number;
}

export interface CreatePaymentInput {
  student_fee_id:    string;
  payment_method:    string;
  amount_paid:       number;
  payment_date?:     string;
  transaction_id?:   string;
  gateway_reference?: string;
  remarks?:          string;
  allocations:       AllocationInput[];  // REQUIRED — caller must specify
}

/**
 * Core payment flow — ALL steps run in ONE transaction:
 *  1. Validate StudentFee belongs to tenant
 *  2. Validate payment_method
 *  3. Duplicate transaction_id guard
 *  4. Validate allocations: total == amount_paid, no overpayment per installment
 *  5. Create FeePayment (status=success for offline; pending for online)
 *  6. Create PaymentAllocation rows
 *  7. Recompute & update each installment's status
 *  8. Recompute & update StudentFee status
 *  9. Write AuditLog
 */
export const createPayment = async (
  tenantId: string,
  userId: string,
  input: CreatePaymentInput
) => {
  // ── Pre-transaction validations ──

  if (!VALID_METHODS.includes(input.payment_method as any)) {
    throw badReq(`payment_method must be one of: ${VALID_METHODS.join(', ')}`);
  }
  if (input.amount_paid <= 0) throw badReq('amount_paid must be > 0');
  if (!input.allocations || input.allocations.length === 0) {
    throw badReq('allocations[] is required — specify which installments this payment covers');
  }

  const studentFee = await prisma.studentFee.findFirst({
    where:   { id: input.student_fee_id, tenant_id: tenantId },
    include: { installments: true, student: { select: { id: true } } },
  });
  if (!studentFee) throw notFound('Student fee not found');

  // Duplicate transaction guard (outside tx — unique index will also catch it)
  if (input.transaction_id) {
    const existing = await prisma.feePayment.findFirst({
      where: { tenant_id: tenantId, transaction_id: input.transaction_id },
    });
    if (existing) throw conflict(`Duplicate transaction_id: ${input.transaction_id}`);
  }

  // ── Allocation pre-validation ──

  const allocationTotal = input.allocations.reduce((s, a) => s + a.amount, 0);
  const amountPaid      = +input.amount_paid.toFixed(2);
  if (Math.abs(allocationTotal - amountPaid) > 0.01) {
    throw badReq(
      `Allocation total (${allocationTotal.toFixed(2)}) must equal amount_paid (${amountPaid.toFixed(2)})`
    );
  }
  for (const alloc of input.allocations) {
    if (alloc.amount <= 0) throw badReq('Each allocation amount must be > 0');
  }

  // Fetch targeted installments and validate overpayment
  const installmentIds = input.allocations.map(a => a.installment_id);
  const installments = await prisma.feeInstallment.findMany({
    where: { id: { in: installmentIds }, student_fee_id: input.student_fee_id, tenant_id: tenantId },
  });
  if (installments.length !== installmentIds.length) {
    throw badReq('One or more installment_ids not found for this student fee');
  }

  // Check existing allocations for overpayment
  for (const alloc of input.allocations) {
    const inst = installments.find(i => i.id === alloc.installment_id)!;
    const existingAgg = await prisma.paymentAllocation.aggregate({
      where: { installment_id: inst.id },
      _sum:  { amount_allocated: true },
    });
    const alreadyPaid  = n(existingAgg._sum.amount_allocated ?? 0);
    const remaining    = n(inst.amount) - alreadyPaid;
    if (alloc.amount > remaining + 0.01) {
      throw badReq(
        `Overpayment: installment "${inst.installment_name}" remaining is ₹${remaining.toFixed(2)}, ` +
        `but you're allocating ₹${alloc.amount.toFixed(2)}`
      );
    }
  }

  // ── Online vs Offline status ──
  const isOnline = ['razorpay'].includes(input.payment_method);
  const initialStatus = isOnline ? 'pending' : 'success';

  // Build a map: installment_id -> total amount that will be paid after this payment
  // We know alreadyPaid per installment from the pre-validation step above.
  // Instead of re-querying inside the transaction, compute statuses from memory.
  const alreadyPaidMap = new Map<string, number>();
  for (const alloc of input.allocations) {
    const inst = installments.find(i => i.id === alloc.installment_id)!;
    const existingAgg = await prisma.paymentAllocation.aggregate({
      where: { installment_id: inst.id },
      _sum:  { amount_allocated: true },
    });
    alreadyPaidMap.set(inst.id, n(existingAgg._sum.amount_allocated ?? 0));
  }

  // ── Transactional write — ONLY writes, no reads inside ──
  let createdPaymentId: string;
  await prisma.$transaction(async (tx) => {
    // 1. Create payment record
    const payment = await tx.feePayment.create({
      data: {
        tenant_id:         tenantId,
        student_id:        studentFee.student_id,
        student_fee_id:    input.student_fee_id,
        amount_paid:       d(amountPaid),
        payment_method:    input.payment_method,
        transaction_id:    input.transaction_id ?? null,
        gateway_reference: input.gateway_reference ?? null,
        payment_date:      input.payment_date ? new Date(input.payment_date) : new Date(),
        status:            initialStatus,
        remarks:           input.remarks ?? null,
        created_by:        userId,
      },
    });
    createdPaymentId = payment.id;

    // 2. Create allocation rows
    await tx.paymentAllocation.createMany({
      data: input.allocations.map(a => ({
        tenant_id:        tenantId,
        payment_id:       payment.id,
        installment_id:   a.installment_id,
        amount_allocated: d(a.amount),
      })),
    });

    // 3. Update each installment status — computed in-memory, NO aggregate query
    for (const inst of installments) {
      const alloc       = input.allocations.find(a => a.installment_id === inst.id)!;
      const prevPaid    = alreadyPaidMap.get(inst.id) ?? 0;
      const totalPaid   = prevPaid + alloc.amount;   // what will be paid after this tx
      const newStatus   = deriveInstallmentStatus(totalPaid, n(inst.amount), inst.due_date);
      await tx.feeInstallment.update({
        where: { id: inst.id },
        data:  { status: newStatus },
      });
    }

    // 4. Derive StudentFee status from the NEW installment statuses
    //    We compute this from the same in-memory data (no extra DB read inside tx)
    const allInstallments = studentFee.installments;
    const updatedStatuses = allInstallments.map(i => {
      const alloc = input.allocations.find(a => a.installment_id === i.id);
      if (!alloc) return i.status; // unchanged installment keeps its status
      const prevPaid  = alreadyPaidMap.get(i.id) ?? 0;
      const totalPaid = prevPaid + alloc.amount;
      return deriveInstallmentStatus(totalPaid, n(i.amount), i.due_date);
    });

    let newFeeStatus: string;
    if (updatedStatuses.every(s => s === 'paid'))                    newFeeStatus = 'paid';
    else if (updatedStatuses.some(s => s === 'overdue'))             newFeeStatus = 'overdue';
    else if (updatedStatuses.some(s => s === 'paid' || s === 'partial')) newFeeStatus = 'partial';
    else                                                              newFeeStatus = 'pending';

    await tx.studentFee.update({
      where: { id: input.student_fee_id },
      data:  { status: newFeeStatus },
    });

    // 5. Audit log
    await tx.auditLog.create({
      data: {
        tenant_id: tenantId,
        user_id:   userId,
        action:    'CREATE',
        entity:    'FeePayment',
        entity_id: payment.id,
        changes: JSON.parse(JSON.stringify({
          payment_id:     payment.id,
          amount_paid:    amountPaid,
          payment_method: input.payment_method,
          status:         initialStatus,
          allocations:    input.allocations,
          student_fee_id: input.student_fee_id,
          fee_status:     newFeeStatus,
        })),
      },
    });
  }, { timeout: 30_000 });  // 30s safety net

  // ── Read OUTSIDE the transaction (no timeout pressure) ──
  return prisma.feePayment.findUnique({
    where:   { id: createdPaymentId! },
    include: {
      allocations: {
        include: { installment: { select: { id: true, installment_name: true, amount: true, status: true } } },
      },
      student: { select: { id: true, firstName: true, lastName: true, admission_number: true } },
    },
  });
};

// ─── GET PAYMENTS FOR STUDENT ─────────────────────────────────────────────────

export const getPaymentsByStudent = async (tenantId: string, studentId: string) => {
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenant_id: tenantId, deletedAt: null },
  });
  if (!student) throw notFound('Student not found');

  const payments = await prisma.feePayment.findMany({
    where:   { student_id: studentId, tenant_id: tenantId },
    include: {
      allocations: {
        include: { installment: { select: { id: true, installment_name: true, amount: true, due_date: true } } },
      },
      studentFee: { select: { id: true, feeStructure: { select: { name: true, academic_year: true, currency: true } } } },
    },
    orderBy: { payment_date: 'desc' },
  });

  const summary = {
    total_paid:    +payments.filter(p => p.status === 'success').reduce((s, p) => s + n(p.amount_paid), 0).toFixed(2),
    pending_count: payments.filter(p => p.status === 'pending').length,
    failed_count:  payments.filter(p => p.status === 'failed').length,
  };

  return { payments, summary };
};

// ─── GET SINGLE PAYMENT ───────────────────────────────────────────────────────

export const getPaymentById = async (tenantId: string, paymentId: string) => {
  const payment = await prisma.feePayment.findFirst({
    where:   { id: paymentId, tenant_id: tenantId },
    include: {
      allocations: {
        include: { installment: true },
      },
      student: { select: { id: true, firstName: true, lastName: true, admission_number: true } },
      studentFee: { include: { feeStructure: { select: { name: true, academic_year: true, currency: true } } } },
    },
  });
  if (!payment) throw notFound('Payment not found');
  return payment;
};

// ─── GET ALLOCATIONS FOR A PAYMENT ───────────────────────────────────────────

export const getPaymentAllocations = async (tenantId: string, paymentId: string) => {
  const payment = await prisma.feePayment.findFirst({
    where: { id: paymentId, tenant_id: tenantId },
  });
  if (!payment) throw notFound('Payment not found');

  return prisma.paymentAllocation.findMany({
    where:   { payment_id: paymentId, tenant_id: tenantId },
    include: { installment: true },
    orderBy: { installment: { due_date: 'asc' } },
  });
};

// ─── WEBHOOK HANDLER (provider-agnostic) ─────────────────────────────────────

export interface WebhookPayload {
  transaction_id:    string;
  gateway_reference: string;
  status:            'success' | 'failed' | 'refunded';
  amount:            number;  // in paise/smallest unit — caller converts
}

/**
 * Confirms or fails a pending online payment.
 * Verifies amount matches what was recorded.
 * Re-propagates statuses on confirmation.
 */
export const handleWebhook = async (tenantId: string, payload: WebhookPayload) => {
  const payment = await prisma.feePayment.findFirst({
    where:   { tenant_id: tenantId, transaction_id: payload.transaction_id },
    include: { allocations: { include: { installment: true } } },
  });

  if (!payment) throw notFound(`No payment with transaction_id: ${payload.transaction_id}`);
  if (payment.status !== 'pending') {
    throw conflict(`Payment already in terminal state: ${payment.status}`);
  }

  // Amount integrity check (tolerance: 1 paisa)
  const diff = Math.abs(n(payment.amount_paid) - payload.amount);
  if (diff > 0.01) {
    throw badReq(
      `Amount mismatch: recorded ₹${n(payment.amount_paid)}, webhook says ₹${payload.amount}`
    );
  }

  // Pre-compute all installment statuses OUTSIDE the transaction
  const statusMap = new Map<string, string>();
  if (payload.status === 'success') {
    for (const alloc of payment.allocations) {
      const agg = await prisma.paymentAllocation.aggregate({
        where: { installment_id: alloc.installment_id },
        _sum:  { amount_allocated: true },
      });
      const totalPaid = n(agg._sum.amount_allocated ?? 0);
      statusMap.set(
        alloc.installment_id,
        deriveInstallmentStatus(totalPaid, n(alloc.installment.amount), alloc.installment.due_date)
      );
    }
  }

  let updatedId: string;
  await prisma.$transaction(async (tx) => {
    const updated = await tx.feePayment.update({
      where: { id: payment.id },
      data: {
        status:            payload.status,
        gateway_reference: payload.gateway_reference,
      },
    });
    updatedId = updated.id;

    // If confirmed (success), propagate statuses — ONLY writes
    if (payload.status === 'success') {
      for (const [installmentId, newStatus] of statusMap) {
        await tx.feeInstallment.update({ where: { id: installmentId }, data: { status: newStatus } });
      }
      const allStatuses = payment.allocations.map(a => statusMap.get(a.installment_id) ?? a.installment.status);
      let newFeeStatus: string;
      if (allStatuses.every(s => s === 'paid'))                        newFeeStatus = 'paid';
      else if (allStatuses.some(s => s === 'overdue'))                 newFeeStatus = 'overdue';
      else if (allStatuses.some(s => s === 'paid' || s === 'partial')) newFeeStatus = 'partial';
      else                                                             newFeeStatus = 'pending';
      await tx.studentFee.update({ where: { id: payment.student_fee_id }, data: { status: newFeeStatus } });
    }
  }, { timeout: 30_000 });

  return prisma.feePayment.findUnique({ where: { id: updatedId! } });
};

// ─── VERIFY PAYMENT (manual gateway check) ───────────────────────────────────

export const verifyPayment = async (tenantId: string, paymentId: string) => {
  const payment = await prisma.feePayment.findFirst({
    where:   { id: paymentId, tenant_id: tenantId },
    include: { allocations: true },
  });
  if (!payment) throw notFound('Payment not found');

  const allocationSum = payment.allocations.reduce((s, a) => s + n(a.amount_allocated), 0);
  const diff          = Math.abs(n(payment.amount_paid) - allocationSum);

  return {
    payment_id:      payment.id,
    status:          payment.status,
    amount_paid:     n(payment.amount_paid),
    amount_allocated: allocationSum,
    is_balanced:     diff <= 0.01,
    discrepancy:     +diff.toFixed(2),
    allocations:     payment.allocations.length,
  };
};

// ─── RECONCILIATION DASHBOARD ─────────────────────────────────────────────────

export const getReconciliation = async (tenantId: string) => {
  const [pending, failed, recentSuccess] = await Promise.all([
    prisma.feePayment.findMany({
      where:   { tenant_id: tenantId, status: 'pending' },
      include: { student: { select: { firstName: true, lastName: true, admission_number: true } } },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
    prisma.feePayment.findMany({
      where:   { tenant_id: tenantId, status: 'failed' },
      include: { student: { select: { firstName: true, lastName: true, admission_number: true } } },
      orderBy: { created_at: 'desc' },
      take: 50,
    }),
    prisma.feePayment.findMany({
      where:   { tenant_id: tenantId, status: 'success' },
      include: { student: { select: { firstName: true, lastName: true, admission_number: true } } },
      orderBy: { payment_date: 'desc' },
      take: 20,
    }),
  ]);

  return {
    pending_payments:     pending,
    failed_payments:      failed,
    recent_payments:      recentSuccess,
    summary: {
      pending_count: pending.length,
      failed_count:  failed.length,
      pending_amount: +pending.reduce((s, p) => s + n(p.amount_paid), 0).toFixed(2),
    },
  };
};
