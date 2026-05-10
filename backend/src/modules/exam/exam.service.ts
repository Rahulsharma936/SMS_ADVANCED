import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../../prisma/client';

// ─── Exam CRUD ───

export const createExam = async (tenantId: string, data: {
  name: string; academic_year: string; start_date?: string; end_date?: string; status?: string;
}) => {
  return prisma.exam.create({
    data: {
      tenant_id: tenantId,
      name: data.name,
      academic_year: data.academic_year,
      start_date: data.start_date ? new Date(data.start_date) : null,
      end_date: data.end_date ? new Date(data.end_date) : null,
      status: data.status || 'draft',
    },
  });
};

export const getExams = async (tenantId: string, status?: string) => {
  const where: any = { tenant_id: tenantId };
  if (status) where.status = status;
  return prisma.exam.findMany({
    where,
    include: {
      examSubjects: { include: { subject: { select: { id: true, name: true, code: true } } } },
      _count: { select: { studentExams: true } },
    },
    orderBy: { created_at: 'desc' },
  });
};

export const getExamById = async (tenantId: string, examId: string) => {
  const exam = await prisma.exam.findFirst({
    where: { id: examId, tenant_id: tenantId },
    include: {
      examSubjects: { include: { subject: { select: { id: true, name: true, code: true } } } },
      _count: { select: { studentExams: true } },
    },
  });
  if (!exam) throw { status: 404, message: 'Exam not found' };
  return exam;
};

export const updateExam = async (tenantId: string, examId: string, data: Partial<{
  name: string; academic_year: string; start_date: string; end_date: string; status: string;
}>) => {
  const exam = await prisma.exam.findFirst({ where: { id: examId, tenant_id: tenantId } });
  if (!exam) throw { status: 404, message: 'Exam not found' };
  return prisma.exam.update({
    where: { id: examId },
    data: {
      ...data,
      start_date: data.start_date ? new Date(data.start_date) : undefined,
      end_date: data.end_date ? new Date(data.end_date) : undefined,
    },
  });
};

// ─── Exam Subject Configuration ───

export const addExamSubjects = async (
  tenantId: string, examId: string,
  subjects: { subject_id: string; max_marks: number; passing_marks: number; weightage?: number }[]
) => {
  const exam = await prisma.exam.findFirst({ where: { id: examId, tenant_id: tenantId } });
  if (!exam) throw { status: 404, message: 'Exam not found' };

  // Verify all subjects belong to tenant
  const subjectIds = subjects.map(s => s.subject_id);
  const validSubjects = await prisma.subject.findMany({ where: { id: { in: subjectIds }, tenant_id: tenantId } });
  if (validSubjects.length !== subjectIds.length) throw { status: 400, message: 'One or more subjects not found in this tenant' };

  // Upsert exam subjects
  const results = await Promise.all(subjects.map(s =>
    prisma.examSubject.upsert({
      where: { exam_id_subject_id: { exam_id: examId, subject_id: s.subject_id } },
      create: { tenant_id: tenantId, exam_id: examId, subject_id: s.subject_id, max_marks: s.max_marks, passing_marks: s.passing_marks, weightage: s.weightage ?? 1 },
      update: { max_marks: s.max_marks, passing_marks: s.passing_marks, weightage: s.weightage ?? 1 },
      include: { subject: { select: { name: true, code: true } } },
    })
  ));
  return results;
};

// ─── Student Exam Registration (bulk for a class/section) ───

export const registerStudentsForExam = async (
  tenantId: string, examId: string, classId: string, sectionId: string
) => {
  const exam = await prisma.exam.findFirst({ where: { id: examId, tenant_id: tenantId } });
  if (!exam) throw { status: 404, message: 'Exam not found' };

  const students = await prisma.student.findMany({
    where: { class_id: classId, section_id: sectionId, tenant_id: tenantId, status: 'ACTIVE', deletedAt: null },
  });
  if (students.length === 0) throw { status: 404, message: 'No active students in this class/section' };

  const results = await Promise.all(students.map(student =>
    prisma.studentExam.upsert({
      where: { student_id_exam_id: { student_id: student.id, exam_id: examId } },
      create: { tenant_id: tenantId, student_id: student.id, exam_id: examId, class_id: classId, section_id: sectionId },
      update: {}, // Already registered, no change
    })
  ));
  return { registered: results.length, students: results };
};

// ─── Bulk Marks Entry (transactional) ───

export const bulkEnterMarks = async (
  tenantId: string, examId: string,
  entries: { student_id: string; exam_subject_id: string; marks_obtained: number; is_absent?: boolean; remarks?: string }[]
) => {
  // Validate exam
  const exam = await prisma.exam.findFirst({ where: { id: examId, tenant_id: tenantId } });
  if (!exam) throw { status: 404, message: 'Exam not found' };

  // Validate all exam_subject_ids belong to this exam
  const examSubjectIds = [...new Set(entries.map(e => e.exam_subject_id))];
  const validExamSubjects = await prisma.examSubject.findMany({
    where: { id: { in: examSubjectIds }, exam_id: examId },
  });
  if (validExamSubjects.length !== examSubjectIds.length) {
    throw { status: 400, message: 'One or more exam subjects do not belong to this exam' };
  }
  const examSubjectMap = new Map(validExamSubjects.map(es => [es.id, es]));

  return prisma.$transaction(async (tx) => {
    const results = [];
    for (const entry of entries) {
      // Validate marks ≤ max_marks
      const examSubject = examSubjectMap.get(entry.exam_subject_id);
      if (!examSubject) continue;

      const maxMarks = Number(examSubject.max_marks);
      if (!entry.is_absent && entry.marks_obtained > maxMarks) {
        throw { status: 400, message: `Marks ${entry.marks_obtained} exceeds max marks ${maxMarks} for subject` };
      }
      if (!entry.is_absent && entry.marks_obtained < 0) {
        throw { status: 400, message: 'Marks cannot be negative' };
      }

      // Get student exam registration
      const studentExam = await tx.studentExam.findFirst({
        where: { student_id: entry.student_id, exam_id: examId, tenant_id: tenantId },
      });
      if (!studentExam) continue; // Skip unregistered students

      const result = await tx.marksEntry.upsert({
        where: { student_exam_id_exam_subject_id: { student_exam_id: studentExam.id, exam_subject_id: entry.exam_subject_id } },
        create: {
          tenant_id: tenantId,
          student_exam_id: studentExam.id,
          exam_subject_id: entry.exam_subject_id,
          marks_obtained: entry.is_absent ? 0 : entry.marks_obtained,
          is_absent: entry.is_absent ?? false,
          remarks: entry.remarks || null,
        },
        update: {
          marks_obtained: entry.is_absent ? 0 : entry.marks_obtained,
          is_absent: entry.is_absent ?? false,
          remarks: entry.remarks || null,
        },
      });
      results.push(result);
    }
    return { count: results.length, entries: results };
  });
};

// ─── Get marks for a student in an exam ───

export const getStudentMarks = async (tenantId: string, studentId: string, examId: string) => {
  const studentExam = await prisma.studentExam.findFirst({
    where: { student_id: studentId, exam_id: examId, tenant_id: tenantId },
    include: {
      student: { select: { firstName: true, lastName: true, admission_number: true, roll_number: true } },
      exam: { select: { name: true, academic_year: true, status: true } },
      marksEntries: {
        include: {
          examSubject: {
            include: { subject: { select: { name: true, code: true } } },
          },
        },
      },
      resultSummary: true,
    },
  });
  if (!studentExam) throw { status: 404, message: 'Student exam record not found' };
  return studentExam;
};

// ─── Grade determination (uses configurable GradeScale) ───

async function determineGrade(tenantId: string, percentage: Decimal): Promise<{ grade: string | null; grade_point: Decimal | null }> {
  const pct = Number(percentage);
  const scales = await prisma.gradeScale.findMany({
    where: { tenant_id: tenantId },
    orderBy: { min_percent: 'desc' },
  });

  if (scales.length === 0) {
    // Fallback default grading if none configured
    if (pct >= 90) return { grade: 'A+', grade_point: new Decimal(4.0) };
    if (pct >= 80) return { grade: 'A', grade_point: new Decimal(3.7) };
    if (pct >= 70) return { grade: 'B', grade_point: new Decimal(3.0) };
    if (pct >= 60) return { grade: 'C', grade_point: new Decimal(2.0) };
    if (pct >= 33) return { grade: 'D', grade_point: new Decimal(1.0) };
    return { grade: 'F', grade_point: new Decimal(0.0) };
  }

  for (const scale of scales) {
    if (pct >= Number(scale.min_percent) && pct < Number(scale.max_percent)) {
      return { grade: scale.grade, grade_point: scale.grade_point };
    }
  }
  // Check last scale (100% edge)
  const topScale = scales[0];
  if (pct >= Number(topScale.max_percent)) return { grade: topScale.grade, grade_point: topScale.grade_point };
  return { grade: 'F', grade_point: new Decimal(0.0) };
}

// ─── Calculate results for an exam (class/section) ───

export const calculateResults = async (tenantId: string, examId: string, classId: string, sectionId: string) => {
  // Fetch all exam subjects to get max marks
  const examSubjects = await prisma.examSubject.findMany({
    where: { exam_id: examId, tenant_id: tenantId },
  });
  if (examSubjects.length === 0) throw { status: 400, message: 'No subjects configured for this exam' };

  const maxTotal = examSubjects.reduce((sum, es) => sum + Number(es.max_marks), 0);
  const passingSubjectMap = new Map(examSubjects.map(es => [es.id, Number(es.passing_marks)]));

  // Fetch all student exams for this class/section
  const studentExams = await prisma.studentExam.findMany({
    where: { exam_id: examId, class_id: classId, section_id: sectionId, tenant_id: tenantId },
    include: {
      marksEntries: { include: { examSubject: true } },
    },
  });

  if (studentExams.length === 0) throw { status: 404, message: 'No students registered for this exam in this class/section' };

  // Calculate totals + pass/fail
  const summaryData = studentExams.map(se => {
    const totalMarks = se.marksEntries.reduce((sum, me) => sum + Number(me.marks_obtained), 0);
    const percentage = maxTotal > 0 ? new Decimal((totalMarks / maxTotal) * 100).toDecimalPlaces(2) : new Decimal(0);

    // Student passes if they pass ALL subjects
    const isPass = se.marksEntries.every(me => {
      const passMark = passingSubjectMap.get(me.exam_subject_id) ?? 0;
      return !me.is_absent && Number(me.marks_obtained) >= passMark;
    });

    return { studentExam: se, totalMarks: new Decimal(totalMarks), maxTotal: new Decimal(maxTotal), percentage, isPass };
  });

  // Sort for ranking (descending total)
  summaryData.sort((a, b) => Number(b.totalMarks) - Number(a.totalMarks));

  // Assign ranks (handle ties — same marks = same rank, next rank skips)
  let currentRank = 1;
  for (let i = 0; i < summaryData.length; i++) {
    if (i > 0 && Number(summaryData[i].totalMarks) !== Number(summaryData[i - 1].totalMarks)) {
      currentRank = i + 1;
    }
    (summaryData[i] as any).rank_section = currentRank;
  }

  // Also compute class-level ranks (same section here, extend for multiple sections if needed)
  // For now rank_class = rank_section (can extend to aggregate across sections)

  // Persist results in transaction
  return prisma.$transaction(async (tx) => {
    const saved = [];
    for (const item of summaryData) {
      const { grade, grade_point } = await determineGrade(tenantId, item.percentage);
      const result = await tx.resultSummary.upsert({
        where: { student_exam_id: item.studentExam.id },
        create: {
          tenant_id: tenantId,
          student_exam_id: item.studentExam.id,
          total_marks: item.totalMarks,
          max_total: item.maxTotal,
          percentage: item.percentage,
          grade: grade || null,
          grade_point: grade_point || null,
          rank_section: (item as any).rank_section,
          rank_class: (item as any).rank_section, // Extend for multi-section ranking
          is_pass: item.isPass,
          calculated_at: new Date(),
        },
        update: {
          total_marks: item.totalMarks,
          max_total: item.maxTotal,
          percentage: item.percentage,
          grade: grade || null,
          grade_point: grade_point || null,
          rank_section: (item as any).rank_section,
          rank_class: (item as any).rank_section,
          is_pass: item.isPass,
          calculated_at: new Date(),
        },
      });
      saved.push(result);
    }
    return { calculated: saved.length, results: saved };
  });
};

// ─── Get results for a student ───

export const getStudentResult = async (tenantId: string, studentId: string, examId: string) => {
  const studentExam = await prisma.studentExam.findFirst({
    where: { student_id: studentId, exam_id: examId, tenant_id: tenantId },
    include: {
      student: { select: { firstName: true, lastName: true, admission_number: true, roll_number: true } },
      exam: { select: { name: true, academic_year: true } },
      marksEntries: {
        include: { examSubject: { include: { subject: { select: { name: true, code: true } } } } },
      },
      resultSummary: true,
      class: { select: { name: true } },
      section: { select: { name: true } },
    },
  });
  if (!studentExam) throw { status: 404, message: 'No result found for this student and exam' };
  return studentExam;
};

// ─── Get class results summary ───

export const getClassResults = async (tenantId: string, examId: string, classId: string, sectionId?: string) => {
  const where: any = { exam_id: examId, tenant_id: tenantId, class_id: classId };
  if (sectionId) where.section_id = sectionId;

  return prisma.studentExam.findMany({
    where,
    include: {
      student: { select: { id: true, firstName: true, lastName: true, roll_number: true, admission_number: true } },
      resultSummary: true,
      section: { select: { name: true } },
    },
    orderBy: { resultSummary: { rank_section: 'asc' } },
  });
};

// ─── Generate Report Card ───

export const generateReportCard = async (tenantId: string, studentId: string, examId: string) => {
  const studentExam = await getStudentResult(tenantId, studentId, examId);
  if (!studentExam.resultSummary) throw { status: 400, message: 'Results not calculated yet. Run calculate results first.' };

  // Upsert report card record
  const reportCard = await prisma.reportCard.upsert({
    where: { student_exam_id: studentExam.id },
    create: { tenant_id: tenantId, student_exam_id: studentExam.id, generated_at: new Date() },
    update: { generated_at: new Date() },
  });

  // Return full structured data (PDF-ready)
  return {
    reportCard,
    student: studentExam.student,
    class: studentExam.class,
    section: studentExam.section,
    exam: studentExam.exam,
    subjects: studentExam.marksEntries.map(me => ({
      subject: me.examSubject.subject.name,
      code: me.examSubject.subject.code,
      max_marks: Number(me.examSubject.max_marks),
      passing_marks: Number(me.examSubject.passing_marks),
      marks_obtained: Number(me.marks_obtained),
      is_absent: me.is_absent,
      percentage: Number(me.examSubject.max_marks) > 0
        ? Math.round((Number(me.marks_obtained) / Number(me.examSubject.max_marks)) * 100)
        : 0,
    })),
    result: {
      total_marks: Number(studentExam.resultSummary.total_marks),
      max_total: Number(studentExam.resultSummary.max_total),
      percentage: Number(studentExam.resultSummary.percentage),
      grade: studentExam.resultSummary.grade,
      grade_point: studentExam.resultSummary.grade_point ? Number(studentExam.resultSummary.grade_point) : null,
      rank_class: studentExam.resultSummary.rank_class,
      rank_section: studentExam.resultSummary.rank_section,
      is_pass: studentExam.resultSummary.is_pass,
    },
  };
};

// ─── Grade Scale Management ───

export const getGradeScales = async (tenantId: string) => {
  return prisma.gradeScale.findMany({ where: { tenant_id: tenantId }, orderBy: { min_percent: 'desc' } });
};

export const upsertGradeScales = async (tenantId: string, scales: {
  grade: string; min_percent: number; max_percent: number; name: string; grade_point?: number; remark?: string;
}[]) => {
  return prisma.$transaction(
    scales.map(s =>
      prisma.gradeScale.upsert({
        where: { tenant_id_grade: { tenant_id: tenantId, grade: s.grade } },
        create: { tenant_id: tenantId, ...s, min_percent: s.min_percent, max_percent: s.max_percent },
        update: { min_percent: s.min_percent, max_percent: s.max_percent, name: s.name, grade_point: s.grade_point, remark: s.remark },
      })
    )
  );
};
