import { prisma } from '../../prisma/client';

// ─── Mark attendance (daily or period-wise, with transactions) ───

interface MarkAttendanceInput {
  tenant_id: string;
  class_id: string;
  section_id: string;
  date: string;
  period?: number | null;
  marked_by_id?: string;
  source?: string;
  records: { student_id: string; status: string; remarks?: string }[];
}

export const markAttendance = async (input: MarkAttendanceInput) => {
  const { tenant_id, class_id, section_id, date, period, marked_by_id, source, records } = input;

  // Verify section belongs to class + tenant
  const section = await prisma.section.findFirst({
    where: { id: section_id, class_id, tenant_id: tenant_id },
  });
  if (!section) throw { status: 404, message: 'Section not found for this class in this tenant' };

  // Use transaction for atomicity
  return prisma.$transaction(async (tx) => {
    // Find or create session
    let session = await tx.attendanceSession.findFirst({
      where: { tenant_id, class_id, section_id, date: new Date(date), period: period ?? null },
    });

    if (!session) {
      session = await tx.attendanceSession.create({
        data: {
          tenant_id, class_id, section_id,
          date: new Date(date),
          period: period ?? null,
          marked_by_id: marked_by_id || null,
          source: source || 'manual',
        },
      });
    } else {
      // Update marked_by if re-marking
      await tx.attendanceSession.update({
        where: { id: session.id },
        data: { marked_by_id: marked_by_id || session.marked_by_id },
      });
    }

    // Check for approved leaves to auto-mark as EXCUSED
    const sessionDate = new Date(date);
    const approvedLeaves = await tx.leaveApplication.findMany({
      where: {
        tenant_id,
        status: 'approved',
        from_date: { lte: sessionDate },
        to_date: { gte: sessionDate },
        student_id: { in: records.map(r => r.student_id) },
      },
    });
    const onLeaveStudentIds = new Set(approvedLeaves.map(l => l.student_id));

    // Upsert each record
    const results = await Promise.all(
      records.map((r) => {
        const finalStatus = onLeaveStudentIds.has(r.student_id) ? 'EXCUSED' : r.status;
        return tx.attendanceRecord.upsert({
          where: { session_id_student_id: { session_id: session!.id, student_id: r.student_id } },
          create: { tenant_id, session_id: session!.id, student_id: r.student_id, status: finalStatus, remarks: r.remarks || null },
          update: { status: finalStatus, remarks: r.remarks || null },
        });
      })
    );

    // Trigger absence notifications (fire and forget)
    const absentRecords = results.filter(r => r.status === 'ABSENT');
    if (absentRecords.length > 0) {
      triggerAbsenceNotifications(tenant_id, absentRecords.map(r => r.student_id), date).catch(console.error);
    }

    return { session_id: session.id, count: results.length };
  });
};

// ─── Get class attendance for a date ───

export const getClassAttendance = async (
  tenantId: string, classId: string, sectionId: string, date: string, period?: string
) => {
  const where: any = { tenant_id: tenantId, class_id: classId, section_id: sectionId, date: new Date(date) };
  if (period !== undefined && period !== '') {
    where.period = period === 'null' ? null : parseInt(period);
  }

  return prisma.attendanceSession.findMany({
    where,
    include: {
      records: {
        include: { student: { select: { id: true, firstName: true, lastName: true, roll_number: true, admission_number: true } } },
        orderBy: { student: { firstName: 'asc' } },
      },
      markedBy: { select: { firstName: true, lastName: true } },
    },
  });
};

// ─── Get student attendance history ───

export const getStudentAttendance = async (
  tenantId: string, studentId: string, fromDate?: string, toDate?: string
) => {
  const where: any = { tenant_id: tenantId, student_id: studentId };
  if (fromDate || toDate) {
    where.session = {};
    if (fromDate) where.session.date = { ...(where.session.date || {}), gte: new Date(fromDate) };
    if (toDate) where.session.date = { ...(where.session.date || {}), lte: new Date(toDate) };
  }

  const records = await prisma.attendanceRecord.findMany({
    where,
    include: { session: { select: { date: true, period: true, class_id: true, section_id: true } } },
    orderBy: { session: { date: 'desc' } },
  });

  // Calculate summary
  const total = records.length;
  const present = records.filter(r => r.status === 'PRESENT').length;
  const absent = records.filter(r => r.status === 'ABSENT').length;
  const late = records.filter(r => r.status === 'LATE').length;
  const excused = records.filter(r => r.status === 'EXCUSED').length;
  const percentage = total > 0 ? Math.round((present + late + excused) / total * 100) : 0;

  return { records, summary: { total, present, absent, late, excused, percentage } };
};

// ─── Class attendance report ───

export const getClassReport = async (
  tenantId: string, classId: string, sectionId: string, fromDate: string, toDate: string
) => {
  // Get all sessions in the range
  const sessions = await prisma.attendanceSession.findMany({
    where: {
      tenant_id: tenantId, class_id: classId, section_id: sectionId,
      date: { gte: new Date(fromDate), lte: new Date(toDate) },
      period: null, // Daily only for reports
    },
    include: {
      records: {
        include: { student: { select: { id: true, firstName: true, lastName: true, roll_number: true } } },
      },
    },
    orderBy: { date: 'asc' },
  });

  // Build per-student summary
  const studentMap = new Map<string, { name: string; roll: string | null; present: number; absent: number; late: number; excused: number; total: number }>();

  for (const session of sessions) {
    for (const record of session.records) {
      const key = record.student_id;
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          name: `${record.student.firstName} ${record.student.lastName}`,
          roll: record.student.roll_number, present: 0, absent: 0, late: 0, excused: 0, total: 0,
        });
      }
      const s = studentMap.get(key)!;
      s.total++;
      if (record.status === 'PRESENT') s.present++;
      else if (record.status === 'ABSENT') s.absent++;
      else if (record.status === 'LATE') s.late++;
      else if (record.status === 'EXCUSED') s.excused++;
    }
  }

  const report = Array.from(studentMap.entries()).map(([id, data]) => ({
    student_id: id, ...data,
    percentage: data.total > 0 ? Math.round((data.present + data.late + data.excused) / data.total * 100) : 0,
  }));

  return { totalSessions: sessions.length, report: report.sort((a, b) => (a.roll || '').localeCompare(b.roll || '')) };
};

// ─── Absentee list for a specific date ───

export const getAbsenteeList = async (tenantId: string, date: string, classId?: string) => {
  const where: any = { tenant_id: tenantId, status: 'ABSENT', session: { date: new Date(date) } };
  if (classId) where.session.class_id = classId;

  return prisma.attendanceRecord.findMany({
    where,
    include: {
      student: { select: { firstName: true, lastName: true, admission_number: true, guardianContact: true, class: { select: { name: true } }, section: { select: { name: true } } } },
      session: { select: { date: true, period: true } },
    },
  });
};

// ─── Leave Management ───

export const applyLeave = async (tenantId: string, studentId: string, fromDate: string, toDate: string, reason: string) => {
  const student = await prisma.student.findFirst({ where: { id: studentId, tenant_id: tenantId } });
  if (!student) throw { status: 404, message: 'Student not found' };

  return prisma.leaveApplication.create({
    data: { tenant_id: tenantId, student_id: studentId, from_date: new Date(fromDate), to_date: new Date(toDate), reason },
    include: { student: { select: { firstName: true, lastName: true } } },
  });
};

export const updateLeaveStatus = async (tenantId: string, leaveId: string, status: string, approvedById?: string) => {
  const leave = await prisma.leaveApplication.findFirst({ where: { id: leaveId, tenant_id: tenantId } });
  if (!leave) throw { status: 404, message: 'Leave application not found' };

  const updated = await prisma.leaveApplication.update({
    where: { id: leaveId },
    data: { status, approved_by_id: approvedById || null },
    include: { student: { select: { firstName: true, lastName: true } } },
  });

  // If approved, auto-mark existing attendance records as EXCUSED for the leave period
  if (status === 'approved') {
    const sessions = await prisma.attendanceSession.findMany({
      where: { tenant_id: tenantId, date: { gte: leave.from_date, lte: leave.to_date } },
    });
    if (sessions.length > 0) {
      await prisma.attendanceRecord.updateMany({
        where: { session_id: { in: sessions.map(s => s.id) }, student_id: leave.student_id, status: 'ABSENT' },
        data: { status: 'EXCUSED' },
      });
    }
  }

  return updated;
};

export const getLeaves = async (tenantId: string, filters: { status?: string; student_id?: string; class_id?: string }) => {
  const where: any = { tenant_id: tenantId };
  if (filters.status) where.status = filters.status;
  if (filters.student_id) where.student_id = filters.student_id;

  return prisma.leaveApplication.findMany({
    where,
    include: {
      student: { select: { firstName: true, lastName: true, admission_number: true, class: { select: { name: true } }, section: { select: { name: true } } } },
      approvedBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { created_at: 'desc' },
  });
};

// ─── Biometric Sync ───

export const syncBiometricLogs = async (tenantId: string, logs: { student_id: string; timestamp: string; device_id?: string }[]) => {
  // Group logs by date + student to create attendance
  const dateGroups = new Map<string, Set<string>>();

  for (const log of logs) {
    // Store raw log
    await prisma.biometricLog.create({
      data: { tenant_id: tenantId, student_id: log.student_id, timestamp: new Date(log.timestamp), device_id: log.device_id || null },
    });

    const dateKey = new Date(log.timestamp).toISOString().split('T')[0];
    if (!dateGroups.has(dateKey)) dateGroups.set(dateKey, new Set());
    dateGroups.get(dateKey)!.add(log.student_id);
  }

  // For each date, mark students as present
  let processed = 0;
  for (const [dateStr, studentIds] of dateGroups) {
    for (const studentId of studentIds) {
      const student = await prisma.student.findFirst({
        where: { id: studentId, tenant_id: tenantId },
        select: { class_id: true, section_id: true },
      });
      if (!student) continue;

      try {
        await markAttendance({
          tenant_id: tenantId,
          class_id: student.class_id,
          section_id: student.section_id,
          date: dateStr,
          source: 'biometric',
          records: [{ student_id: studentId, status: 'PRESENT' }],
        });
        processed++;
      } catch { /* skip conflicts */ }
    }
  }

  // Mark logs as synced
  await prisma.biometricLog.updateMany({
    where: { tenant_id: tenantId, synced: false },
    data: { synced: true },
  });

  return { logsReceived: logs.length, studentsProcessed: processed };
};

// ─── Helper: Trigger absence notifications ───

async function triggerAbsenceNotifications(tenantId: string, studentIds: string[], date: string) {
  const students = await prisma.student.findMany({
    where: { id: { in: studentIds }, tenant_id: tenantId },
    select: { firstName: true, lastName: true, guardianContact: true, guardianEmail: true },
  });

  for (const student of students) {
    const recipient = student.guardianContact || student.guardianEmail;
    if (!recipient) continue;

    // Avoid duplicate notifications
    const existing = await prisma.notification.findFirst({
      where: { tenant_id: tenantId, type: 'absence_alert', recipient, message: { contains: date } },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        tenant_id: tenantId,
        type: 'absence_alert',
        title: 'Absence Alert',
        message: `${student.firstName} ${student.lastName} was marked absent on ${date}. Please contact the school for more information.`,
        recipient,
      },
    });
  }
}
