import { prisma } from '../../prisma/client';
import bcrypt from 'bcrypt';

// ─── Types ───

interface CreateTeacherInput {
  tenant_id: string;
  employee_id: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  phone?: string;
  joining_date?: string;
  qualification?: string;
  experience_years?: number;
  specialization?: string;
  designation?: string;
}

interface UpdateTeacherInput {
  firstName?: string;
  lastName?: string;
  phone?: string;
  joining_date?: string;
  qualification?: string;
  experience_years?: number;
  specialization?: string;
  designation?: string;
  status?: string;
}

interface AssignClassTeacherInput {
  tenant_id: string;
  teacher_id: string;
  class_id: string;
  section_id: string;
}

// ─── Service Functions ───

/**
 * Create a Teacher with User linking flow:
 * 1. Check if User with this email already exists for the tenant
 * 2. If not → create User with "Teacher" role
 * 3. Create Teacher profile linked to User
 */
export const createTeacher = async (input: CreateTeacherInput) => {
  const {
    tenant_id, employee_id, firstName, lastName, email,
    password, phone, joining_date, qualification,
    experience_years, specialization, designation,
  } = input;

  // Step 1: Check if User already exists for this tenant + email
  let user = await prisma.user.findUnique({
    where: { tenant_id_email: { tenant_id, email } },
    include: { role: true },
  });

  // Step 2: If user doesn't exist, create one with Teacher role
  if (!user) {
    // Upsert the "Teacher" role for this tenant
    let role = await prisma.role.findFirst({
      where: { name: 'Teacher', tenant_id },
    });
    if (!role) {
      role = await prisma.role.create({
        data: { name: 'Teacher', tenant_id },
      });
    }

    const hashedPassword = await bcrypt.hash(password || 'Teacher@123', 10);

    user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        tenant_id,
        role_id: role.id,
      },
      include: { role: true },
    });
  }

  // Check if a teacher profile already exists for this user
  const existingTeacher = await prisma.teacher.findFirst({
    where: { user_id: user.id, tenant_id },
  });
  if (existingTeacher) {
    throw { status: 400, message: 'A teacher profile already exists for this user' };
  }

  // Step 3: Create Teacher profile linked to User
  const teacher = await prisma.teacher.create({
    data: {
      tenant_id,
      user_id: user.id,
      employee_id,
      firstName,
      lastName,
      phone: phone || null,
      joining_date: joining_date ? new Date(joining_date) : null,
      qualification: qualification || null,
      experience_years: experience_years ?? null,
      specialization: specialization || null,
      designation: designation || null,
    },
    include: {
      user: { select: { email: true, status: true } },
    },
  });

  return teacher;
};

/**
 * Get all teachers for a tenant with optional filters
 */
export const getTeachers = async (
  tenantId: string,
  filters?: { status?: string; search?: string; designation?: string }
) => {
  const where: any = { tenant_id: tenantId };

  if (filters?.status) {
    where.status = filters.status;
  }

  if (filters?.designation) {
    where.designation = filters.designation;
  }

  if (filters?.search) {
    const search = filters.search;
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { employee_id: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
    ];
  }

  const teachers = await prisma.teacher.findMany({
    where,
    include: {
      user: { select: { email: true, status: true } },
      teacherSubjects: {
        include: { subject: { select: { id: true, name: true, code: true } } },
      },
      classSubjectTeachers: {
        include: {
          class: { select: { name: true } },
          section: { select: { name: true } },
          subject: { select: { name: true } },
        },
      },
      classTeacherSections: {
        include: {
          class: { select: { name: true } },
        },
        where: { tenant_id: tenantId },
      },
    },
    orderBy: { firstName: 'asc' },
  });

  return teachers;
};

/**
 * Get a single teacher by ID with full profile:
 * personal details, assigned classes, subjects, timetable, workload summary
 */
export const getTeacherById = async (tenantId: string, teacherId: string) => {
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, tenant_id: tenantId },
    include: {
      user: { select: { email: true, status: true, createdAt: true } },
      teacherSubjects: {
        include: { subject: { select: { id: true, name: true, code: true } } },
      },
      classSubjectTeachers: {
        include: {
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
          subject: { select: { id: true, name: true, code: true } },
        },
      },
      classTeacherSections: {
        include: { class: { select: { id: true, name: true } } },
        where: { tenant_id: tenantId },
      },
      timetableSlots: {
        include: {
          subject: { select: { name: true, code: true } },
          timetable: {
            select: {
              day_of_week: true,
              class: { select: { name: true } },
              section: { select: { name: true } },
            },
          },
        },
        orderBy: [{ timetable: { day_of_week: 'asc' } }, { start_time: 'asc' }],
      },
    },
  });

  if (!teacher) return null;

  // Derive workload from timetable slots
  const workload = calculateWorkload(teacher.timetableSlots);

  return { ...teacher, workload };
};

/**
 * Update teacher profile fields (no auth fields)
 */
export const updateTeacher = async (
  tenantId: string,
  teacherId: string,
  data: UpdateTeacherInput
) => {
  const existing = await prisma.teacher.findFirst({
    where: { id: teacherId, tenant_id: tenantId },
  });

  if (!existing) {
    throw { status: 404, message: 'Teacher not found' };
  }

  const updateData: any = {};
  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.qualification !== undefined) updateData.qualification = data.qualification;
  if (data.experience_years !== undefined) updateData.experience_years = data.experience_years;
  if (data.specialization !== undefined) updateData.specialization = data.specialization;
  if (data.designation !== undefined) updateData.designation = data.designation;
  if (data.status !== undefined) {
    if (!['active', 'inactive', 'on_leave'].includes(data.status)) {
      throw { status: 400, message: 'Status must be one of: active, inactive, on_leave' };
    }
    updateData.status = data.status;
  }
  if (data.joining_date !== undefined) {
    updateData.joining_date = data.joining_date ? new Date(data.joining_date) : null;
  }

  const teacher = await prisma.teacher.update({
    where: { id: teacherId },
    data: updateData,
    include: {
      user: { select: { email: true, status: true } },
    },
  });

  return teacher;
};

/**
 * Assign a teacher as class teacher for a section.
 * Constraint: One section can have only ONE class teacher.
 * Updates Section.class_teacher_id (existing schema field).
 */
export const assignClassTeacher = async (input: AssignClassTeacherInput) => {
  const { tenant_id, teacher_id, class_id, section_id } = input;

  // Verify teacher belongs to tenant
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacher_id, tenant_id },
  });
  if (!teacher) throw { status: 404, message: 'Teacher not found in this tenant' };

  // Verify section belongs to class and tenant
  const section = await prisma.section.findFirst({
    where: { id: section_id, class_id, tenant_id },
  });
  if (!section) throw { status: 404, message: 'Section not found for this class' };

  // Check if this section already has a class teacher assigned
  if (section.class_teacher_id && section.class_teacher_id !== teacher_id) {
    // Get current class teacher name for the error message
    const currentCT = await prisma.teacher.findUnique({
      where: { id: section.class_teacher_id },
      select: { firstName: true, lastName: true },
    });
    throw {
      status: 409,
      message: `Section already has a class teacher: ${currentCT?.firstName} ${currentCT?.lastName}. Remove them first.`,
    };
  }

  // Assign class teacher
  const updatedSection = await prisma.section.update({
    where: { id: section_id },
    data: { class_teacher_id: teacher_id },
    include: {
      class: { select: { name: true } },
      classTeacher: { select: { firstName: true, lastName: true } },
    },
  });

  return updatedSection;
};

/**
 * Assign a subject to a teacher (TeacherSubject mapping)
 * Reuses existing logic but in service layer
 */
export const assignSubjectToTeacher = async (
  tenantId: string,
  teacherId: string,
  subjectId: string
) => {
  // Verify teacher belongs to this tenant
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, tenant_id: tenantId },
  });
  if (!teacher) throw { status: 404, message: 'Teacher not found in this tenant' };

  // Verify subject belongs to this tenant
  const subject = await prisma.subject.findFirst({
    where: { id: subjectId, tenant_id: tenantId },
  });
  if (!subject) throw { status: 404, message: 'Subject not found in this tenant' };

  const mapping = await prisma.teacherSubject.create({
    data: { tenant_id: tenantId, teacher_id: teacherId, subject_id: subjectId },
    include: {
      teacher: { select: { firstName: true, lastName: true } },
      subject: { select: { name: true } },
    },
  });

  return mapping;
};

/**
 * Get teacher workload derived from timetable slots
 */
export const getTeacherWorkload = async (tenantId: string, teacherId: string) => {
  // Verify teacher
  const teacher = await prisma.teacher.findFirst({
    where: { id: teacherId, tenant_id: tenantId },
    select: { id: true, firstName: true, lastName: true, employee_id: true },
  });
  if (!teacher) throw { status: 404, message: 'Teacher not found' };

  // Get all timetable slots for this teacher
  const slots = await prisma.timetableSlot.findMany({
    where: { teacher_id: teacherId, tenant_id: tenantId },
    include: {
      subject: { select: { id: true, name: true, code: true } },
      timetable: {
        select: {
          day_of_week: true,
          class_id: true,
          section_id: true,
          class: { select: { name: true } },
          section: { select: { name: true } },
        },
      },
    },
  });

  const workload = calculateWorkload(slots);

  // Also get class teacher assignments
  const classTeacherOf = await prisma.section.findMany({
    where: { class_teacher_id: teacherId, tenant_id: tenantId },
    include: { class: { select: { name: true } } },
  });

  return {
    teacher,
    workload,
    classTeacherOf: classTeacherOf.map((s) => ({
      class: s.class.name,
      section: s.name,
    })),
  };
};

// ─── Helper: Calculate workload from timetable slots ───

function calculateWorkload(slots: any[]) {
  const totalPeriodsPerWeek = slots.length;

  // Group by subject
  const subjectMap = new Map<string, { name: string; count: number }>();
  slots.forEach((slot) => {
    const subName = slot.subject?.name || 'Unknown';
    const existing = subjectMap.get(subName);
    if (existing) {
      existing.count++;
    } else {
      subjectMap.set(subName, { name: subName, count: 1 });
    }
  });

  // Group by class+section
  const classMap = new Map<string, { className: string; section: string; count: number }>();
  slots.forEach((slot) => {
    const key = `${slot.timetable?.class?.name}-${slot.timetable?.section?.name}`;
    const existing = classMap.get(key);
    if (existing) {
      existing.count++;
    } else {
      classMap.set(key, {
        className: slot.timetable?.class?.name || 'Unknown',
        section: slot.timetable?.section?.name || '',
        count: 1,
      });
    }
  });

  // Group by day
  const dayMap = new Map<string, number>();
  slots.forEach((slot) => {
    const day = slot.timetable?.day_of_week || 'Unknown';
    dayMap.set(day, (dayMap.get(day) || 0) + 1);
  });

  return {
    totalPeriodsPerWeek,
    subjectsHandled: Array.from(subjectMap.values()),
    classesAssigned: Array.from(classMap.values()),
    periodsPerDay: Object.fromEntries(dayMap),
  };
}
