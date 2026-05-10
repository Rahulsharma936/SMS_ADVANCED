import { prisma } from '../../prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

// ─── helpers ────────────────────────────────────────────────────────────────

const notFound = (msg: string) => Object.assign(new Error(msg), { status: 404 });
const badReq   = (msg: string) => Object.assign(new Error(msg), { status: 400 });

/** Convert Decimal/string/number to JS number safely */
const toNum = (v: Decimal | string | number): number => Number(v);

// ─── FEE STRUCTURE ──────────────────────────────────────────────────────────

export const createFeeStructure = async (
  tenantId: string,
  data: {
    name: string;
    academic_year: string;
    class_id?: string | null;
    currency?: string;
    is_active?: boolean;
  }
) => {
  return prisma.feeStructure.create({
    data: {
      tenant_id:     tenantId,
      name:          data.name,
      academic_year: data.academic_year,
      class_id:      data.class_id ?? null,
      currency:      data.currency ?? 'INR',
      is_active:     data.is_active ?? true,
    },
    include: { components: true, class: { select: { id: true, name: true } } },
  });
};

export const getFeeStructures = async (
  tenantId: string,
  academic_year?: string,
  class_id?: string
) => {
  return prisma.feeStructure.findMany({
    where: {
      tenant_id:     tenantId,
      ...(academic_year ? { academic_year } : {}),
      ...(class_id     ? { class_id }       : {}),
    },
    include: {
      components: true,
      class:      { select: { id: true, name: true } },
      _count:     { select: { studentFees: true } },
    },
    orderBy: { created_at: 'desc' },
  });
};

export const getFeeStructureById = async (tenantId: string, id: string) => {
  const structure = await prisma.feeStructure.findFirst({
    where: { id, tenant_id: tenantId },
    include: {
      components: true,
      class:      { select: { id: true, name: true } },
      _count:     { select: { studentFees: true } },
    },
  });
  if (!structure) throw notFound('Fee structure not found');
  return structure;
};

export const updateFeeStructure = async (
  tenantId: string,
  id: string,
  data: Partial<{
    name: string;
    academic_year: string;
    class_id: string | null;
    currency: string;
    is_active: boolean;
  }>
) => {
  const structure = await prisma.feeStructure.findFirst({ where: { id, tenant_id: tenantId } });
  if (!structure) throw notFound('Fee structure not found');

  return prisma.feeStructure.update({
    where: { id },
    data,
    include: { components: true },
  });
};

// ─── FEE COMPONENTS ─────────────────────────────────────────────────────────

export const addFeeComponents = async (
  tenantId: string,
  fee_structure_id: string,
  components: Array<{
    name: string;
    amount: number;
    tax_percentage?: number | null;
    is_optional?: boolean;
  }>
) => {
  const structure = await prisma.feeStructure.findFirst({
    where: { id: fee_structure_id, tenant_id: tenantId },
  });
  if (!structure) throw notFound('Fee structure not found');

  // Upsert pattern: delete existing + recreate (safe for builder UI)
  const created = await prisma.$transaction(
    components.map((c) =>
      prisma.feeComponent.create({
        data: {
          tenant_id:        tenantId,
          fee_structure_id,
          name:             c.name,
          amount:           new Decimal(c.amount),
          tax_percentage:   c.tax_percentage != null ? new Decimal(c.tax_percentage) : null,
          is_optional:      c.is_optional ?? false,
        },
      })
    )
  );
  return created;
};

export const deleteFeeComponent = async (tenantId: string, id: string) => {
  const comp = await prisma.feeComponent.findFirst({ where: { id, tenant_id: tenantId } });
  if (!comp) throw notFound('Fee component not found');
  return prisma.feeComponent.delete({ where: { id } });
};

// ─── DISCOUNTS ──────────────────────────────────────────────────────────────

export const createFeeDiscount = async (
  tenantId: string,
  data: { name: string; type: 'percentage' | 'fixed'; value: number; is_active?: boolean }
) => {
  if (!['percentage', 'fixed'].includes(data.type)) throw badReq('type must be percentage or fixed');
  if (data.type === 'percentage' && (data.value <= 0 || data.value > 100)) {
    throw badReq('Percentage discount must be between 0 and 100');
  }
  return prisma.feeDiscount.create({
    data: {
      tenant_id: tenantId,
      name:      data.name,
      type:      data.type,
      value:     new Decimal(data.value),
      is_active: data.is_active ?? true,
    },
  });
};

export const getFeeDiscounts = async (tenantId: string) => {
  return prisma.feeDiscount.findMany({
    where:   { tenant_id: tenantId },
    orderBy: { name: 'asc' },
  });
};

// ─── STUDENT FEE ASSIGNMENT ─────────────────────────────────────────────────

/**
 * Core fee assignment flow (runs in a DB transaction):
 * 1. Validate student belongs to tenant
 * 2. Fetch FeeStructure + FeeComponents
 * 3. Calculate total from mandatory components
 * 4. Apply discounts (percentage first, then fixed), cap at total
 * 5. Create StudentFee record
 * 6. Attach StudentFeeDiscount records
 * 7. Generate installments if provided
 */
export const assignFeeToStudent = async (
  tenantId: string,
  data: {
    student_id:      string;
    fee_structure_id: string;
    discount_ids?:   string[];           // FeeDiscount ids to apply
    installments?:   Array<{             // optional installment plan
      installment_name: string;
      due_date:         string;
      amount:           number;
    }>;
  }
) => {
  // ── 1. Validate student ──
  const student = await prisma.student.findFirst({
    where: { id: data.student_id, tenant_id: tenantId, deletedAt: null },
    select: { id: true, firstName: true, lastName: true, admission_number: true },
  });
  if (!student) throw notFound('Student not found or does not belong to this tenant');

  // ── 2. Fetch structure + components ──
  const structure = await prisma.feeStructure.findFirst({
    where:   { id: data.fee_structure_id, tenant_id: tenantId, is_active: true },
    include: { components: true },
  });
  if (!structure) throw notFound('Active fee structure not found');

  // ── 3. Calculate total from mandatory (non-optional) components ──
  const mandatoryComponents = structure.components.filter((c) => !c.is_optional);
  let total = mandatoryComponents.reduce(
    (sum, c) => sum + toNum(c.amount),
    0
  );
  if (total <= 0) throw badReq('Fee structure has no mandatory components with valid amounts');

  // ── 4. Fetch discounts and compute discount_amount ──
  let discountAmount = 0;
  const appliedDiscounts: Array<{ discount: typeof discountsData[0]; applied_value: number }> = [];

  const discountsData = data.discount_ids?.length
    ? await prisma.feeDiscount.findMany({
        where: { id: { in: data.discount_ids }, tenant_id: tenantId, is_active: true },
      })
    : [];

  for (const disc of discountsData) {
    let applied = 0;
    if (disc.type === 'percentage') {
      applied = (total * toNum(disc.value)) / 100;
    } else {
      applied = toNum(disc.value);
    }
    discountAmount += applied;
    appliedDiscounts.push({ discount: disc, applied_value: applied });
  }

  // Cap discount at total
  if (discountAmount > total) discountAmount = total;
  const finalAmount = +(total - discountAmount).toFixed(2);
  discountAmount    = +discountAmount.toFixed(2);

  // ── 5. Validate installments if provided ──
  if (data.installments?.length) {
    const installmentTotal = data.installments.reduce((s, i) => s + i.amount, 0);
    const diff = Math.abs(installmentTotal - finalAmount);
    if (diff > 0.01) {
      throw badReq(
        `Installment total (${installmentTotal}) must equal final_amount (${finalAmount})`
      );
    }
    for (const inst of data.installments) {
      if (inst.amount <= 0) throw badReq('Each installment amount must be > 0');
    }
  }

  // ── 6. Run in transaction ──
  return prisma.$transaction(async (tx) => {
    // Create StudentFee
    const studentFee = await tx.studentFee.create({
      data: {
        tenant_id:        tenantId,
        student_id:       data.student_id,
        fee_structure_id: data.fee_structure_id,
        total_amount:     new Decimal(total),
        discount_amount:  new Decimal(discountAmount),
        final_amount:     new Decimal(finalAmount),
        status:           'pending',
      },
    });

    // Attach discounts
    if (appliedDiscounts.length > 0) {
      await tx.studentFeeDiscount.createMany({
        data: appliedDiscounts.map((d) => ({
          tenant_id:      tenantId,
          student_fee_id: studentFee.id,
          fee_discount_id: d.discount.id,
          applied_value:   new Decimal(d.applied_value),
        })),
      });
    }

    // Generate installments
    if (data.installments?.length) {
      await tx.feeInstallment.createMany({
        data: data.installments.map((inst) => ({
          tenant_id:        tenantId,
          student_fee_id:   studentFee.id,
          installment_name: inst.installment_name,
          due_date:         new Date(inst.due_date),
          amount:           new Decimal(inst.amount),
          status:           'pending',
        })),
      });
    }

    // Return fully populated record
    return tx.studentFee.findUnique({
      where:   { id: studentFee.id },
      include: {
        student:      { select: { id: true, firstName: true, lastName: true, admission_number: true } },
        feeStructure: { select: { id: true, name: true, academic_year: true, currency: true } },
        discounts:    { include: { feeDiscount: true } },
        installments: { orderBy: { due_date: 'asc' } },
      },
    });
  });
};

export const getStudentFees = async (tenantId: string, studentId: string) => {
  // Ensure student belongs to tenant
  const student = await prisma.student.findFirst({
    where: { id: studentId, tenant_id: tenantId, deletedAt: null },
  });
  if (!student) throw notFound('Student not found');

  const fees = await prisma.studentFee.findMany({
    where:   { student_id: studentId, tenant_id: tenantId },
    include: {
      feeStructure: { select: { id: true, name: true, academic_year: true, currency: true } },
      discounts:    { include: { feeDiscount: true } },
      installments: { orderBy: { due_date: 'asc' } },
    },
    orderBy: { assigned_at: 'desc' },
  });

  // Compute summary
  const summary = {
    total_assigned:  fees.reduce((s, f) => s + toNum(f.total_amount), 0),
    total_discount:  fees.reduce((s, f) => s + toNum(f.discount_amount), 0),
    total_final:     fees.reduce((s, f) => s + toNum(f.final_amount), 0),
    pending_count:   fees.filter((f) => f.status === 'pending').length,
    overdue_count:   fees.filter((f) => f.status === 'overdue').length,
  };

  return { fees, summary };
};

// ─── INSTALLMENTS ────────────────────────────────────────────────────────────

export const addInstallments = async (
  tenantId: string,
  studentFeeId: string,
  installments: Array<{ installment_name: string; due_date: string; amount: number }>
) => {
  const studentFee = await prisma.studentFee.findFirst({
    where:   { id: studentFeeId, tenant_id: tenantId },
    include: { installments: true },
  });
  if (!studentFee) throw notFound('Student fee not found');

  // Validate sum
  const existingTotal = studentFee.installments.reduce((s, i) => s + toNum(i.amount), 0);
  const newTotal      = installments.reduce((s, i) => s + i.amount, 0);
  const combinedTotal = existingTotal + newTotal;
  const diff = Math.abs(combinedTotal - toNum(studentFee.final_amount));
  if (diff > 0.01) {
    throw badReq(
      `Total installments (${combinedTotal.toFixed(2)}) must equal final_amount (${toNum(studentFee.final_amount).toFixed(2)})`
    );
  }

  return prisma.feeInstallment.createMany({
    data: installments.map((i) => ({
      tenant_id:        tenantId,
      student_fee_id:   studentFeeId,
      installment_name: i.installment_name,
      due_date:         new Date(i.due_date),
      amount:           new Decimal(i.amount),
      status:           'pending',
    })),
  });
};

export const getInstallments = async (tenantId: string, studentFeeId: string) => {
  const studentFee = await prisma.studentFee.findFirst({
    where: { id: studentFeeId, tenant_id: tenantId },
  });
  if (!studentFee) throw notFound('Student fee not found');

  const installments = await prisma.feeInstallment.findMany({
    where:   { student_fee_id: studentFeeId, tenant_id: tenantId },
    orderBy: { due_date: 'asc' },
  });

  const now = new Date();
  const summary = {
    total:   installments.reduce((s, i) => s + toNum(i.amount), 0),
    pending: installments.filter((i) => i.status === 'pending' && new Date(i.due_date) >= now).reduce((s, i) => s + toNum(i.amount), 0),
    overdue: installments.filter((i) => i.status === 'pending' && new Date(i.due_date) < now).reduce((s, i) => s + toNum(i.amount), 0),
    paid:    installments.filter((i) => i.status === 'paid').reduce((s, i) => s + toNum(i.amount), 0),
  };

  return { installments, summary };
};

// ─── FEE SUMMARY (dashboard helper) ─────────────────────────────────────────

export const getFeeSummary = async (tenantId: string, academic_year?: string) => {
  const where: any = { tenant_id: tenantId };
  if (academic_year) {
    where.feeStructure = { academic_year };
  }

  const fees = await prisma.studentFee.findMany({
    where,
    select: {
      status:          true,
      total_amount:    true,
      discount_amount: true,
      final_amount:    true,
    },
  });

  return {
    total_students_assigned: fees.length,
    total_billed:            +fees.reduce((s, f) => s + toNum(f.total_amount), 0).toFixed(2),
    total_discount:          +fees.reduce((s, f) => s + toNum(f.discount_amount), 0).toFixed(2),
    total_final:             +fees.reduce((s, f) => s + toNum(f.final_amount), 0).toFixed(2),
    by_status: {
      pending: fees.filter((f) => f.status === 'pending').length,
      partial: fees.filter((f) => f.status === 'partial').length,
      paid:    fees.filter((f) => f.status === 'paid').length,
      overdue: fees.filter((f) => f.status === 'overdue').length,
    },
  };
};
