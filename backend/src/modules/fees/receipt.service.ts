/**
 * receipt.service.ts — Phase 9
 *
 * Receipt generation is idempotent — calling generate twice returns the same receipt.
 * Receipt numbers are: REC-{YEAR}-{6-digit-sequence} e.g. REC-2025-000042
 * Invoice numbers are: INV-{YEAR}-{6-digit-sequence}
 */

import { prisma } from '../../prisma/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const notFound = (msg: string) => Object.assign(new Error(msg), { status: 404 });
const badReq   = (msg: string) => Object.assign(new Error(msg), { status: 400 });
const n = (v: any): number => Number(v ?? 0);

async function nextSequence(tenantId: string, prefix: 'REC' | 'INV'): Promise<string> {
  const year = new Date().getFullYear();
  // Count existing records for this tenant+year to generate next sequence
  const pattern = `${prefix}-${year}-%`;
  if (prefix === 'REC') {
    const count = await prisma.feeReceipt.count({
      where: { tenant_id: tenantId, receipt_number: { startsWith: `${prefix}-${year}-` } },
    });
    return `${prefix}-${year}-${String(count + 1).padStart(6, '0')}`;
  } else {
    const count = await prisma.feeInvoice.count({
      where: { tenant_id: tenantId, invoice_number: { startsWith: `${prefix}-${year}-` } },
    });
    return `${prefix}-${year}-${String(count + 1).padStart(6, '0')}`;
  }
}

// ─── RECEIPT GENERATION ───────────────────────────────────────────────────────

export const generateReceipt = async (
  tenantId: string,
  userId:   string,
  paymentId: string
) => {
  const payment = await prisma.feePayment.findFirst({
    where:   { id: paymentId, tenant_id: tenantId },
    include: {
      receipt: true,
      allocations: {
        include: { installment: { select: { installment_name: true, amount: true, due_date: true } } },
      },
      student: { select: { id: true, firstName: true, lastName: true, admission_number: true } },
      studentFee: {
        include: {
          feeStructure: { select: { name: true, academic_year: true, currency: true } },
        },
      },
    },
  });

  if (!payment)             throw notFound('Payment not found');
  if (payment.status !== 'success') throw badReq('Receipt can only be generated for successful payments');

  // Idempotent: return existing receipt if already generated
  if (payment.receipt) {
    return payment.receipt;
  }

  const receiptNumber = await nextSequence(tenantId, 'REC');

  const receipt = await prisma.feeReceipt.create({
    data: {
      tenant_id:      tenantId,
      payment_id:     paymentId,
      receipt_number: receiptNumber,
      generated_by:   userId,
    },
    include: {
      payment: {
        include: {
          allocations: {
            include: { installment: { select: { installment_name: true, amount: true } } },
          },
          student: { select: { id: true, firstName: true, lastName: true, admission_number: true } },
          studentFee: {
            include: { feeStructure: { select: { name: true, academic_year: true, currency: true } } },
          },
        },
      },
    },
  });

  return receipt;
};

export const getReceiptById = async (tenantId: string, receiptId: string) => {
  const receipt = await prisma.feeReceipt.findFirst({
    where:   { id: receiptId, tenant_id: tenantId },
    include: {
      payment: {
        include: {
          allocations: {
            include: { installment: { select: { installment_name: true, amount: true, due_date: true } } },
          },
          student: { select: { id: true, firstName: true, lastName: true, admission_number: true } },
          studentFee: {
            include: { feeStructure: { select: { name: true, academic_year: true, currency: true } } },
          },
        },
      },
      generatedBy: { select: { id: true, email: true } },
    },
  });
  if (!receipt) throw notFound('Receipt not found');
  return receipt;
};

// ─── INVOICE GENERATION ───────────────────────────────────────────────────────

export const generateInvoice = async (
  tenantId:     string,
  studentFeeId: string
) => {
  const studentFee = await prisma.studentFee.findFirst({
    where:   { id: studentFeeId, tenant_id: tenantId },
    include: {
      installments:  { orderBy: { due_date: 'asc' } },
      feeStructure:  { select: { name: true, academic_year: true, currency: true } },
      student:       { select: { id: true, firstName: true, lastName: true, admission_number: true } },
    },
  });
  if (!studentFee) throw notFound('Student fee not found');

  // Derive total_due from unpaid/partial installments only
  const unpaid = studentFee.installments.filter(i => i.status !== 'paid');
  const totalDue = unpaid.reduce((s, i) => s + n(i.amount), 0);

  if (totalDue <= 0) throw badReq('All installments are already paid — no invoice needed');

  // Earliest upcoming due date
  const earliestDue = unpaid.sort(
    (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
  )[0]?.due_date ?? new Date();

  const invoiceNumber = await nextSequence(tenantId, 'INV');

  const invoice = await prisma.feeInvoice.create({
    data: {
      tenant_id:      tenantId,
      student_fee_id: studentFeeId,
      invoice_number: invoiceNumber,
      total_due:      totalDue,
      due_date:       earliestDue,
      status:         studentFee.status,
    },
    include: { studentFee: { include: { student: true, feeStructure: true } } },
  });

  return invoice;
};

export const getInvoicesByStudent = async (tenantId: string, studentId: string) => {
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenant_id: tenantId, deletedAt: null },
  });
  if (!student) throw notFound('Student not found');

  return prisma.feeInvoice.findMany({
    where:   { tenant_id: tenantId, studentFee: { student_id: studentId } },
    include: {
      studentFee: {
        select: { id: true, final_amount: true, status: true, feeStructure: { select: { name: true, academic_year: true, currency: true } } },
      },
    },
    orderBy: { generated_at: 'desc' },
  });
};
