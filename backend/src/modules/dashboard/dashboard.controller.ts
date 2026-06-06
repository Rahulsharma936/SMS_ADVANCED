import { Response } from 'express';
import { prisma } from '../../prisma/client';
import { TenantRequest } from '../../middlewares/tenant.middleware';

// ─── P2B: Dashboard Summary Endpoint ───────────────────────────────────────
// Consolidates 6+ individual API calls into 1 optimized query batch.
// Returns only the data shapes the dashboard actually renders.

export const getDashboardSummary = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;

    // All queries run in parallel — single await barrier
    const [
      studentTotal,
      studentsByStatus,
      teacherCount,
      classCount,
      subjectCount,
      feeSummary,
      recentExams,
      recentStudents,
    ] = await Promise.all([
      // 1. Student total
      prisma.student.count({ where: { tenant_id: tenantId, deletedAt: null } }),

      // 2. Students by status
      prisma.student.groupBy({
        by: ['status'],
        where: { tenant_id: tenantId, deletedAt: null },
        _count: true,
      }),

      // 3. Teacher count
      prisma.teacher.count({ where: { tenant_id: tenantId } }),

      // 4. Class count
      prisma.class.count({ where: { tenant_id: tenantId } }),

      // 5. Subject count
      prisma.subject.count({ where: { tenant_id: tenantId } }),

      // 6. Fee summary (aggregated at DB level where possible)
      prisma.studentFee.groupBy({
        by: ['status'],
        where: { tenant_id: tenantId },
        _count: true,
        _sum: { final_amount: true, total_amount: true, discount_amount: true },
      }),

      // 7. Recent exams (only 4, minimal fields)
      prisma.exam.findMany({
        where: { tenant_id: tenantId },
        select: {
          id: true, name: true, status: true,
          start_date: true, academic_year: true,
        },
        orderBy: { created_at: 'desc' },
        take: 6,
      }),

      // 8. Recent students (only 5)
      prisma.student.findMany({
        where: { tenant_id: tenantId, deletedAt: null },
        select: {
          id: true, firstName: true, lastName: true, createdAt: true,
          class: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    // Shape fee summary
    const feeByStatus: Record<string, number> = { pending: 0, partial: 0, paid: 0, overdue: 0 };
    let totalFinal = 0;
    let totalBilled = 0;
    for (const row of feeSummary) {
      feeByStatus[row.status] = row._count;
      totalFinal += Number(row._sum.final_amount || 0);
      totalBilled += Number(row._sum.total_amount || 0);
    }

    res.status(200).json({
      students: {
        total: studentTotal,
        byStatus: studentsByStatus.map(s => ({ status: s.status, count: s._count })),
      },
      teachers: { count: teacherCount },
      classes: { count: classCount },
      subjects: { count: subjectCount },
      fees: {
        total_final: +totalFinal.toFixed(2),
        total_billed: +totalBilled.toFixed(2),
        by_status: feeByStatus,
      },
      exams: recentExams,
      recentStudents,
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
