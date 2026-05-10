import { Response } from 'express';
import { prisma } from '../../prisma/client';
import { TenantRequest } from '../../middlewares/tenant.middleware';
import { createAuditLog } from '../../utils/audit.utils';
import * as XLSX from 'xlsx';

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const getCurrentAcademicYear = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  // Academic year starts in April (India) — adjust if needed
  return month >= 3 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const generateAdmissionNumber = async (tenantId: string): Promise<string> => {
  const academicYear = getCurrentAcademicYear();
  const yearShort = academicYear.split('-')[0].slice(-2) + academicYear.split('-')[1].slice(-2);

  // Get tenant code
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { code: true, name: true } });
  const tenantCode = tenant?.code || tenant?.name?.substring(0, 3).toUpperCase() || 'SMS';

  // Atomically increment the sequence
  const seq = await prisma.admissionSequence.upsert({
    where: { tenant_id_academic_year: { tenant_id: tenantId, academic_year: academicYear } },
    create: { tenant_id: tenantId, academic_year: academicYear, last_sequence: 1 },
    update: { last_sequence: { increment: 1 } },
  });

  return `${tenantCode}-${yearShort}-${String(seq.last_sequence).padStart(4, '0')}`;
};

// Soft delete filter — added to all queries
const notDeleted = { deletedAt: null };

// ─────────────────────────────────────────────
// 1. ADMISSION (CREATE)
// ─────────────────────────────────────────────

export const admitStudent = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const userId = req.user.id;
    const body = req.body;

    if (!body.firstName || !body.lastName || !body.class_id || !body.section_id) {
      res.status(400).json({ error: 'firstName, lastName, class_id, and section_id are required' });
      return;
    }

    // Verify class+section
    const section = await prisma.section.findFirst({
      where: { id: body.section_id, class_id: body.class_id, tenant_id: tenantId },
    });
    if (!section) { res.status(404).json({ error: 'Section not found for this class' }); return; }

    // Auto-generate admission number if not provided
    const admissionNumber = body.admission_number || await generateAdmissionNumber(tenantId);

    const student = await prisma.student.create({
      data: {
        tenant_id: tenantId,
        admission_number: admissionNumber,
        firstName: body.firstName,
        lastName: body.lastName,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        gender: body.gender || null,
        blood_group: body.blood_group || null,
        class_id: body.class_id,
        section_id: body.section_id,
        roll_number: body.roll_number || null,
        academic_year: body.academic_year || getCurrentAcademicYear(),
        fatherName: body.fatherName || null,
        motherName: body.motherName || null,
        guardianContact: body.guardianContact || null,
        guardianEmail: body.guardianEmail || null,
        addressLine: body.addressLine || null,
        city: body.city || null,
        state: body.state || null,
        postalCode: body.postalCode || null,
        allergies: body.allergies || null,
        chronicConditions: body.chronicConditions || null,
        emergencyNotes: body.emergencyNotes || null,
        transportRequired: body.transportRequired || false,
      },
      include: { class: { select: { name: true } }, section: { select: { name: true } } },
    });

    await createAuditLog(tenantId, userId, 'CREATE', 'Student', student.id, { after: student });

    res.status(201).json({ message: 'Student admitted successfully', student });
  } catch (error: any) {
    if (error.code === 'P2002') {
      const t = error.meta?.target;
      if (t?.includes('admission_number')) res.status(400).json({ error: 'Admission number already exists' });
      else if (t?.includes('roll_number')) res.status(400).json({ error: 'Roll number already exists in this class+section' });
      else res.status(400).json({ error: 'Duplicate entry' });
      return;
    }
    console.error('Admit student error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─────────────────────────────────────────────
// 2. LIST WITH SEARCH & FILTERS
// ─────────────────────────────────────────────

export const getStudents = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { class_id, section_id, status, gender, search, page = '1', limit = '50' } = req.query;

    const where: any = { tenant_id: tenantId, ...notDeleted };
    if (class_id) where.class_id = class_id;
    if (section_id) where.section_id = section_id;
    if (status) where.status = status;
    if (gender) where.gender = gender;
    if (search) {
      where.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { admission_number: { contains: search as string, mode: 'insensitive' } },
        { guardianContact: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const take = parseInt(limit as string);

    const [students, total] = await Promise.all([
      prisma.student.findMany({
        where,
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          user: { select: { email: true } },
        },
        orderBy: [{ class: { name: 'asc' } }, { firstName: 'asc' }],
        skip,
        take,
      }),
      prisma.student.count({ where }),
    ]);

    res.status(200).json({ students, total, page: parseInt(page as string), totalPages: Math.ceil(total / take) });
  } catch (error) {
    console.error('Get students error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─────────────────────────────────────────────
// 3. GET BY ID
// ─────────────────────────────────────────────

export const getStudentById = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const student = await prisma.student.findFirst({
      where: { id: req.params.id, tenant_id: tenantId, ...notDeleted },
      include: {
        class: true, section: true, user: { select: { email: true } },
        studentParents: { include: { parent: true } },
        documents: true,
        transfersFrom: { include: { old_class: true, new_class: true, old_section: true, new_section: true }, orderBy: { transferDate: 'desc' } },
      },
    });
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }
    res.status(200).json({ student });
  } catch (error) {
    console.error('Get student by id error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─────────────────────────────────────────────
// 4. UPDATE (PATCH)
// ─────────────────────────────────────────────

export const updateStudent = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const existing = await prisma.student.findFirst({ where: { id: req.params.id, tenant_id: tenantId, ...notDeleted } });
    if (!existing) { res.status(404).json({ error: 'Student not found' }); return; }

    const data: any = {};
    const allowedFields = [
      'firstName', 'lastName', 'dateOfBirth', 'gender', 'blood_group',
      'roll_number', 'fatherName', 'motherName', 'guardianContact', 'guardianEmail',
      'addressLine', 'city', 'state', 'postalCode', 'allergies', 'chronicConditions',
      'emergencyNotes', 'transportRequired', 'status',
    ];
    allowedFields.forEach((f) => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
    if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);

    const updated = await prisma.student.update({
      where: { id: req.params.id },
      data,
      include: { class: { select: { name: true } }, section: { select: { name: true } } },
    });

    await createAuditLog(tenantId, req.user.id, 'UPDATE', 'Student', updated.id, { before: existing, after: updated });
    res.status(200).json({ message: 'Student updated', student: updated });
  } catch (error: any) {
    if (error.code === 'P2002') { res.status(400).json({ error: 'Duplicate value detected' }); return; }
    console.error('Update student error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─────────────────────────────────────────────
// 5. SOFT DELETE
// ─────────────────────────────────────────────

export const deleteStudent = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const existing = await prisma.student.findFirst({ where: { id: req.params.id, tenant_id: tenantId, ...notDeleted } });
    if (!existing) { res.status(404).json({ error: 'Student not found' }); return; }

    await prisma.student.update({ where: { id: req.params.id }, data: { deletedAt: new Date(), status: 'WITHDRAWN' } });
    await createAuditLog(tenantId, req.user.id, 'DELETE', 'Student', req.params.id);
    res.status(200).json({ message: 'Student soft-deleted' });
  } catch (error) {
    console.error('Delete student error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─────────────────────────────────────────────
// 6. TRANSFER (CLASS/SECTION CHANGE)
// ─────────────────────────────────────────────

export const transferStudent = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const { new_class_id, new_section_id, reason } = req.body;

    if (!new_class_id || !new_section_id) {
      res.status(400).json({ error: 'new_class_id and new_section_id are required' });
      return;
    }

    const student = await prisma.student.findFirst({ where: { id, tenant_id: tenantId, ...notDeleted } });
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

    const newSection = await prisma.section.findFirst({ where: { id: new_section_id, class_id: new_class_id, tenant_id: tenantId } });
    if (!newSection) { res.status(404).json({ error: 'Target section not found' }); return; }

    // Transaction: create transfer record + update student
    const [transfer, updated] = await prisma.$transaction([
      prisma.transferHistory.create({
        data: {
          tenant_id: tenantId,
          student_id: id,
          old_class_id: student.class_id,
          old_section_id: student.section_id,
          new_class_id,
          new_section_id,
          reason: reason || null,
        },
      }),
      prisma.student.update({
        where: { id },
        data: { class_id: new_class_id, section_id: new_section_id, roll_number: null },
        include: { class: { select: { name: true } }, section: { select: { name: true } } },
      }),
    ]);

    await createAuditLog(tenantId, req.user.id, 'TRANSFER', 'Student', id, {
      from: { class_id: student.class_id, section_id: student.section_id },
      to: { class_id: new_class_id, section_id: new_section_id },
    });

    res.status(200).json({ message: 'Student transferred', student: updated, transfer });
  } catch (error) {
    console.error('Transfer student error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─────────────────────────────────────────────
// 7. BULK PROMOTE
// ─────────────────────────────────────────────

export const bulkPromote = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { from_class_id, from_section_id, to_class_id, to_section_id } = req.body;

    if (!from_class_id || !to_class_id || !to_section_id) {
      res.status(400).json({ error: 'from_class_id, to_class_id, and to_section_id are required' });
      return;
    }

    const where: any = { tenant_id: tenantId, class_id: from_class_id, status: 'ACTIVE', ...notDeleted };
    if (from_section_id) where.section_id = from_section_id;

    const students = await prisma.student.findMany({ where, select: { id: true, class_id: true, section_id: true } });

    if (students.length === 0) { res.status(400).json({ error: 'No students found to promote' }); return; }

    // Transaction: create transfer records + update all students
    await prisma.$transaction([
      prisma.transferHistory.createMany({
        data: students.map((s) => ({
          tenant_id: tenantId,
          student_id: s.id,
          old_class_id: s.class_id,
          old_section_id: s.section_id,
          new_class_id: to_class_id,
          new_section_id: to_section_id,
          reason: 'Bulk Promotion',
        })),
      }),
      prisma.student.updateMany({
        where: { id: { in: students.map((s) => s.id) } },
        data: { class_id: to_class_id, section_id: to_section_id, roll_number: null },
      }),
    ]);

    await createAuditLog(tenantId, req.user.id, 'PROMOTE', 'Student', 'BULK', {
      count: students.length,
      from: from_class_id,
      to: to_class_id,
    });

    res.status(200).json({ message: `${students.length} students promoted` });
  } catch (error) {
    console.error('Bulk promote error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─────────────────────────────────────────────
// 8. BULK STATUS UPDATE
// ─────────────────────────────────────────────

export const bulkStatusUpdate = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { student_ids, status } = req.body;

    if (!student_ids?.length || !status) {
      res.status(400).json({ error: 'student_ids array and status are required' });
      return;
    }

    const validStatuses = ['ACTIVE', 'INACTIVE', 'TRANSFERRED', 'GRADUATED', 'WITHDRAWN'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
      return;
    }

    const result = await prisma.student.updateMany({
      where: { id: { in: student_ids }, tenant_id: tenantId },
      data: { status },
    });

    await createAuditLog(tenantId, req.user.id, 'UPDATE', 'Student', 'BULK', { student_ids, status });
    res.status(200).json({ message: `${result.count} students updated to ${status}` });
  } catch (error) {
    console.error('Bulk status error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─────────────────────────────────────────────
// 9. BULK IMPORT (XLSX)
// ─────────────────────────────────────────────

export const bulkImport = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const file = req.file;

    if (!file) { res.status(400).json({ error: 'Excel file is required' }); return; }

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows: any[] = XLSX.utils.sheet_to_json(sheet);

    if (rows.length === 0) { res.status(400).json({ error: 'File is empty' }); return; }

    // Load classes and sections for validation
    const classes = await prisma.class.findMany({
      where: { tenant_id: tenantId },
      include: { sections: true },
    });
    const classMap = new Map(classes.map((c) => [c.name.toLowerCase(), c]));

    const successes: any[] = [];
    const failures: any[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 2; // Excel row (1-indexed + header)

      try {
        if (!row.firstName || !row.lastName || !row.className || !row.sectionName) {
          failures.push({ row: rowNum, reason: 'Missing required fields (firstName, lastName, className, sectionName)' });
          continue;
        }

        const cls = classMap.get((row.className as string).toLowerCase());
        if (!cls) { failures.push({ row: rowNum, reason: `Class "${row.className}" not found` }); continue; }

        const sec = cls.sections.find((s) => s.name.toLowerCase() === (row.sectionName as string).toLowerCase());
        if (!sec) { failures.push({ row: rowNum, reason: `Section "${row.sectionName}" not found in ${row.className}` }); continue; }

        const admNum = row.admission_number || await generateAdmissionNumber(tenantId);

        successes.push({
          tenant_id: tenantId,
          admission_number: admNum,
          firstName: row.firstName,
          lastName: row.lastName,
          dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : null,
          gender: row.gender || null,
          class_id: cls.id,
          section_id: sec.id,
          roll_number: row.roll_number?.toString() || null,
          fatherName: row.fatherName || null,
          guardianContact: row.guardianContact?.toString() || null,
          addressLine: row.addressLine || null,
          city: row.city || null,
          state: row.state || null,
          academic_year: getCurrentAcademicYear(),
        });
      } catch (err: any) {
        failures.push({ row: rowNum, reason: err.message });
      }
    }

    // Insert all valid rows in a transaction
    let insertedCount = 0;
    if (successes.length > 0) {
      const result = await prisma.student.createMany({ data: successes, skipDuplicates: true });
      insertedCount = result.count;
    }

    await createAuditLog(tenantId, req.user.id, 'CREATE', 'Student', 'BULK_IMPORT', {
      total: rows.length, inserted: insertedCount, failed: failures.length,
    });

    res.status(200).json({
      message: `Import complete: ${insertedCount} inserted, ${failures.length} failed`,
      inserted: insertedCount,
      failed: failures.length,
      failures,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─────────────────────────────────────────────
// 10. EXPORT (XLSX)
// ─────────────────────────────────────────────

export const exportStudents = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { class_id, section_id, status } = req.query;

    const where: any = { tenant_id: tenantId, ...notDeleted };
    if (class_id) where.class_id = class_id;
    if (section_id) where.section_id = section_id;
    if (status) where.status = status;

    const students = await prisma.student.findMany({
      where,
      include: { class: { select: { name: true } }, section: { select: { name: true } } },
      orderBy: [{ class: { name: 'asc' } }, { firstName: 'asc' }],
    });

    const rows = students.map((s) => ({
      'Admission #': s.admission_number,
      'First Name': s.firstName,
      'Last Name': s.lastName,
      'Class': s.class.name,
      'Section': s.section.name,
      'Roll #': s.roll_number || '',
      'Gender': s.gender || '',
      'DOB': s.dateOfBirth ? s.dateOfBirth.toISOString().split('T')[0] : '',
      'Father': s.fatherName || '',
      'Contact': s.guardianContact || '',
      'City': s.city || '',
      'Status': s.status,
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Students');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=students_export.xlsx');
    res.send(buf);
  } catch (error) {
    console.error('Export students error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─────────────────────────────────────────────
// 11. STATS (DASHBOARD)
// ─────────────────────────────────────────────

export const getStudentStats = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const base = { tenant_id: tenantId, ...notDeleted };

    const [total, byClass, byGender, byStatus] = await Promise.all([
      prisma.student.count({ where: base }),
      prisma.student.groupBy({ by: ['class_id'], where: base, _count: true }),
      prisma.student.groupBy({ by: ['gender'], where: base, _count: true }),
      prisma.student.groupBy({ by: ['status'], where: base, _count: true }),
    ]);

    // Resolve class names
    const classIds = byClass.map((c) => c.class_id);
    const classes = await prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true, name: true } });
    const classNameMap = new Map(classes.map((c) => [c.id, c.name]));

    res.status(200).json({
      total,
      byClass: byClass.map((c) => ({ className: classNameMap.get(c.class_id) || c.class_id, count: c._count })),
      byGender: byGender.map((g) => ({ gender: g.gender || 'Not specified', count: g._count })),
      byStatus: byStatus.map((s) => ({ status: s.status, count: s._count })),
    });
  } catch (error) {
    console.error('Get student stats error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─────────────────────────────────────────────
// 12. DOCUMENT UPLOAD
// ─────────────────────────────────────────────

export const uploadDocument = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const file = req.file;
    const docName = req.body.name || file?.originalname || 'Document';

    if (!file) { res.status(400).json({ error: 'File is required' }); return; }

    const student = await prisma.student.findFirst({ where: { id, tenant_id: tenantId, ...notDeleted } });
    if (!student) { res.status(404).json({ error: 'Student not found' }); return; }

    const doc = await prisma.studentDocument.create({
      data: {
        tenant_id: tenantId,
        student_id: id,
        name: docName,
        url: `/uploads/${file.filename}`,
      },
    });

    res.status(201).json({ message: 'Document uploaded', document: doc });
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
