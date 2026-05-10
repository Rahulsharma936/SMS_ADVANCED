/**
 * reporting.service.ts — Phase 9
 *
 * All financial figures derive from actual FeePayment / PaymentAllocation / FeeInstallment data.
 * Uses grouped aggregation queries to avoid per-student loops.
 * NO manual total computation — all numbers come from the database.
 */

import { prisma } from '../../prisma/client';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const notFound = (msg: string) => Object.assign(new Error(msg), { status: 404 });
const n = (v: any): number => Number(v ?? 0);

// ─── COLLECTION ANALYTICS ────────────────────────────────────────────────────

export const getCollectionAnalytics = async (
  tenantId: string,
  from?: string,
  to?:   string
) => {
  const dateFilter: any = {};
  if (from) dateFilter.gte = new Date(from);
  if (to)   dateFilter.lte = new Date(to);

  // ── Total collected (successful payments only) ──
  const [collected, byMethod, monthlyRaw, installmentStats, feeStatusCounts] =
    await Promise.all([

      // 1. Total collected amount
      prisma.feePayment.aggregate({
        where: {
          tenant_id: tenantId,
          status:    'success',
          ...(from || to ? { payment_date: dateFilter } : {}),
        },
        _sum:   { amount_paid: true },
        _count: { id: true },
      }),

      // 2. Breakdown by payment method (grouped)
      prisma.feePayment.groupBy({
        by:    ['payment_method'],
        where: {
          tenant_id: tenantId,
          status:    'success',
          ...(from || to ? { payment_date: dateFilter } : {}),
        },
        _sum:   { amount_paid: true },
        _count: { id: true },
      }),

      // 3. Monthly collection trend (last 12 months)
      prisma.$queryRaw<Array<{ month: string; total: string; count: bigint }>>`
        SELECT
          TO_CHAR(payment_date, 'YYYY-MM') AS month,
          SUM(amount_paid)::TEXT           AS total,
          COUNT(*)                         AS count
        FROM fee_payments
        WHERE tenant_id = ${tenantId}
          AND status    = 'success'
          AND payment_date >= NOW() - INTERVAL '12 months'
        GROUP BY month
        ORDER BY month ASC
      `,

      // 4. Installment-level stats (pending/overdue/paid)
      prisma.feeInstallment.groupBy({
        by:    ['status'],
        where: { tenant_id: tenantId },
        _sum:   { amount: true },
        _count: { id: true },
      }),

      // 5. StudentFee status counts
      prisma.studentFee.groupBy({
        by:    ['status'],
        where: { tenant_id: tenantId },
        _sum:   { final_amount: true },
        _count: { id: true },
      }),
    ]);

  // Reshape installment stats
  const instMap: Record<string, { amount: number; count: number }> = {};
  for (const row of installmentStats) {
    instMap[row.status] = { amount: n(row._sum.amount), count: row._count.id };
  }

  // Reshape fee status
  const feeMap: Record<string, { amount: number; count: number }> = {};
  for (const row of feeStatusCounts) {
    feeMap[row.status] = { amount: n(row._sum.final_amount), count: row._count.id };
  }

  return {
    total_collected:      n(collected._sum.amount_paid),
    total_transactions:   collected._count.id,
    pending_amount:       instMap['pending']?.amount  ?? 0,
    overdue_amount:       instMap['overdue']?.amount  ?? 0,
    paid_installments:    instMap['paid']?.count      ?? 0,
    pending_installments: instMap['pending']?.count   ?? 0,
    overdue_installments: instMap['overdue']?.count   ?? 0,
    by_payment_method:    byMethod.map(r => ({
      method: r.payment_method,
      amount: n(r._sum.amount_paid),
      count:  r._count.id,
    })),
    monthly_trend: monthlyRaw.map(r => ({
      month:  r.month,
      amount: parseFloat(r.total),
      count:  Number(r.count),
    })),
    fee_status_summary: feeMap,
  };
};

// ─── COLLECTION SUMMARY (quick numbers) ──────────────────────────────────────

export const getCollectionSummary = async (tenantId: string, academic_year?: string) => {
  // Filter by academic year via FeeStructure join if provided
  const sfWhere: any = { tenant_id: tenantId };
  if (academic_year) sfWhere.feeStructure = { academic_year };

  const [fees, payments] = await Promise.all([
    prisma.studentFee.aggregate({
      where: sfWhere,
      _sum: { total_amount: true, discount_amount: true, final_amount: true },
    }),
    prisma.feePayment.aggregate({
      where: { tenant_id: tenantId, status: 'success' },
      _sum:  { amount_paid: true },
    }),
  ]);

  const billed   = n(fees._sum.total_amount);
  const discount = n(fees._sum.discount_amount);
  const due      = n(fees._sum.final_amount);
  const paid     = n(payments._sum.amount_paid);

  return {
    total_billed:    billed,
    total_discount:  discount,
    net_due:         due,
    total_collected: paid,
    outstanding:     +(due - paid).toFixed(2),
    collection_rate: due > 0 ? +((paid / due) * 100).toFixed(1) : 0,
  };
};

// ─── PAYMENT METHOD SUMMARY ───────────────────────────────────────────────────

export const getPaymentMethodSummary = async (tenantId: string) => {
  const rows = await prisma.feePayment.groupBy({
    by:    ['payment_method', 'status'],
    where: { tenant_id: tenantId },
    _sum:   { amount_paid: true },
    _count: { id: true },
    orderBy: { payment_method: 'asc' },
  });

  return rows.map(r => ({
    method: r.payment_method,
    status: r.status,
    amount: n(r._sum.amount_paid),
    count:  r._count.id,
  }));
};

// ─── DEFAULTER LIST ───────────────────────────────────────────────────────────

export const getDefaulters = async (
  tenantId: string,
  class_id?: string,
  section_id?: string
) => {
  const now = new Date();

  // Find all overdue installments (due_date < now AND not paid)
  const overdueInstallments = await prisma.feeInstallment.findMany({
    where: {
      tenant_id: tenantId,
      due_date:  { lt: now },
      status:    { in: ['pending', 'overdue', 'partial'] },
      studentFee: {
        student: {
          deletedAt: null,
          ...(class_id   ? { class_id }   : {}),
          ...(section_id ? { section_id } : {}),
        },
      },
    },
    include: {
      studentFee: {
        include: {
          student: {
            include: {
              class:   { select: { id: true, name: true } },
              section: { select: { id: true, name: true } },
            },
          },
          feeStructure: { select: { name: true, academic_year: true, currency: true } },
        },
      },
    },
    orderBy: { due_date: 'asc' },
  });

  // Group by student, aggregate overdue amounts
  const studentMap = new Map<string, {
    student: any;
    overdue_count: number;
    overdue_amount: number;
    earliest_due: Date;
    installments: any[];
  }>();

  for (const inst of overdueInstallments) {
    const student = inst.studentFee.student;
    if (!student) continue; // filtered out by class/section
    if (!studentMap.has(student.id)) {
      studentMap.set(student.id, {
        student,
        overdue_count:  0,
        overdue_amount: 0,
        earliest_due:   inst.due_date,
        installments:   [],
      });
    }
    const entry = studentMap.get(student.id)!;
    entry.overdue_count  += 1;
    entry.overdue_amount += n(inst.amount);
    if (inst.due_date < entry.earliest_due) entry.earliest_due = inst.due_date;
    entry.installments.push({
      id:               inst.id,
      installment_name: inst.installment_name,
      due_date:         inst.due_date,
      amount:           n(inst.amount),
      status:           inst.status,
      fee_structure:    inst.studentFee.feeStructure,
    });
  }

  const defaulters = Array.from(studentMap.values())
    .map(d => ({ ...d, overdue_amount: +d.overdue_amount.toFixed(2) }))
    .sort((a, b) => b.overdue_amount - a.overdue_amount);

  return {
    defaulters,
    total_defaulters:     defaulters.length,
    total_overdue_amount: +defaulters.reduce((s, d) => s + d.overdue_amount, 0).toFixed(2),
  };
};

// ─── STUDENT FEE LEDGER ───────────────────────────────────────────────────────

export const getStudentLedger = async (tenantId: string, studentId: string) => {
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenant_id: tenantId, deletedAt: null },
    include: {
      class:   { select: { name: true } },
      section: { select: { name: true } },
    },
  });
  if (!student) throw notFound('Student not found');

  const fees = await prisma.studentFee.findMany({
    where:   { student_id: studentId, tenant_id: tenantId },
    include: {
      feeStructure: { select: { name: true, academic_year: true, currency: true } },
      discounts:    { include: { feeDiscount: { select: { name: true, type: true } } } },
      installments: {
        orderBy:  { due_date: 'asc' },
        include:  { allocations: { include: { payment: { select: { payment_date: true, payment_method: true, status: true } } } } },
      },
      payments: {
        where:   { status: 'success' },
        orderBy: { payment_date: 'asc' },
        include: {
          allocations: {
            include: { installment: { select: { installment_name: true } } },
          },
          receipt: { select: { receipt_number: true } },
        },
      },
    },
    orderBy: { assigned_at: 'desc' },
  });

  const ledgerEntries = fees.map(fee => {
    const paidTotal = fee.payments.reduce((s, p) => s + n(p.amount_paid), 0);
    const balance   = n(fee.final_amount) - paidTotal;
    return {
      fee_id:        fee.id,
      structure:     fee.feeStructure,
      assigned_at:   fee.assigned_at,
      total_amount:  n(fee.total_amount),
      discount:      n(fee.discount_amount),
      final_amount:  n(fee.final_amount),
      paid_total:    +paidTotal.toFixed(2),
      balance:       +balance.toFixed(2),
      status:        fee.status,
      discounts:     fee.discounts,
      installments:  fee.installments.map(i => ({
        ...i,
        amount: n(i.amount),
        paid:   +i.allocations.reduce((s, a) => s + n(a.amount_allocated), 0).toFixed(2),
      })),
      payments: fee.payments,
    };
  });

  const totals = {
    total_due:       +ledgerEntries.reduce((s, e) => s + e.final_amount, 0).toFixed(2),
    total_paid:      +ledgerEntries.reduce((s, e) => s + e.paid_total, 0).toFixed(2),
    total_balance:   +ledgerEntries.reduce((s, e) => s + e.balance, 0).toFixed(2),
  };

  return { student, ledger: ledgerEntries, totals };
};

// ─── CLASS-WISE REVENUE ───────────────────────────────────────────────────────

export const getClassWiseRevenue = async (tenantId: string) => {
  // Use raw SQL for efficient join + aggregation
  const rows = await prisma.$queryRaw<Array<{
    class_id: string; class_name: string;
    total_billed: string; total_paid: string; student_count: bigint;
  }>>`
    SELECT
      c.id                           AS class_id,
      c.name                         AS class_name,
      COALESCE(SUM(sf.final_amount), 0)::TEXT AS total_billed,
      COALESCE((
        SELECT SUM(fp.amount_paid)
        FROM fee_payments fp
        INNER JOIN students s2 ON fp.student_id = s2.id
        WHERE s2.class_id = c.id AND fp.tenant_id = ${tenantId} AND fp.status = 'success'
      ), 0)::TEXT                    AS total_paid,
      COUNT(DISTINCT s.id)           AS student_count
    FROM classes c
    INNER JOIN students s  ON s.class_id = c.id AND s.tenant_id = ${tenantId} AND s."deletedAt" IS NULL
    LEFT  JOIN student_fees sf ON sf.student_id = s.id AND sf.tenant_id = ${tenantId}
    WHERE c.tenant_id = ${tenantId}
    GROUP BY c.id, c.name
    ORDER BY total_billed DESC
  `;

  return rows.map(r => ({
    class_id:      r.class_id,
    class_name:    r.class_name,
    student_count: Number(r.student_count),
    total_billed:  parseFloat(r.total_billed),
    total_paid:    parseFloat(r.total_paid),
    outstanding:   +(parseFloat(r.total_billed) - parseFloat(r.total_paid)).toFixed(2),
  }));
};
