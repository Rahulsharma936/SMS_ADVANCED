import { Response } from 'express';
import { prisma } from '../../prisma/client';
import { TenantRequest } from '../../middlewares/tenant.middleware';

// ─── Helper: Check time overlap ───
const timesOverlap = (startA: string, endA: string, startB: string, endB: string): boolean => {
  // Convert "HH:MM" to minutes for easy comparison
  const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const sA = toMin(startA), eA = toMin(endA), sB = toMin(startB), eB = toMin(endB);
  return sA < eB && sB < eA; // Overlap condition
};

// ─── Create Timetable ───

export const createTimetable = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { class_id, section_id, day_of_week } = req.body;

    if (!class_id || !section_id || !day_of_week) {
      res.status(400).json({ error: 'class_id, section_id, and day_of_week are required' });
      return;
    }

    const validDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    if (!validDays.includes(day_of_week)) {
      res.status(400).json({ error: `day_of_week must be one of: ${validDays.join(', ')}` });
      return;
    }

    const section = await prisma.section.findFirst({
      where: { id: section_id, class_id, tenant_id: tenantId },
    });
    if (!section) { res.status(404).json({ error: 'Section not found for this class' }); return; }

    const timetable = await prisma.timetable.create({
      data: { tenant_id: tenantId, class_id, section_id, day_of_week },
    });

    res.status(201).json({ message: 'Timetable created', timetable });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Timetable already exists for this class+section+day' });
      return;
    }
    console.error('Create timetable error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── Add Slot (with CONFLICT DETECTION) ───

export const addSlot = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { timetable_id, subject_id, teacher_id, start_time, end_time, period_number } = req.body;

    if (!timetable_id || !subject_id || !teacher_id || !start_time || !end_time) {
      res.status(400).json({ error: 'timetable_id, subject_id, teacher_id, start_time, and end_time are required' });
      return;
    }

    // Validate time format
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(start_time) || !timeRegex.test(end_time)) {
      res.status(400).json({ error: 'Time must be in HH:MM format (e.g. 09:00)' });
      return;
    }

    if (start_time >= end_time) {
      res.status(400).json({ error: 'start_time must be before end_time' });
      return;
    }

    // Get the timetable to know which day + class + section
    const timetable = await prisma.timetable.findFirst({
      where: { id: timetable_id, tenant_id: tenantId },
    });
    if (!timetable) { res.status(404).json({ error: 'Timetable not found' }); return; }

    // ─── CONFLICT CHECK 1: Class/Section slot overlap ───
    // Check if this timetable already has a slot overlapping this time
    const existingClassSlots = await prisma.timetableSlot.findMany({
      where: { timetable_id, tenant_id: tenantId },
    });
    const classConflict = existingClassSlots.find((s) =>
      timesOverlap(start_time, end_time, s.start_time, s.end_time)
    );
    if (classConflict) {
      res.status(409).json({
        error: `Class slot conflict: ${classConflict.start_time}-${classConflict.end_time} already occupied`,
        conflict: 'CLASS_OVERLAP',
      });
      return;
    }

    // ─── CONFLICT CHECK 2: Teacher availability ───
    // Find all timetables for the same day across ALL classes in this tenant
    const sameDayTimetables = await prisma.timetable.findMany({
      where: { tenant_id: tenantId, day_of_week: timetable.day_of_week },
      select: { id: true },
    });
    const sameDayIds = sameDayTimetables.map((t) => t.id);

    // Get all slots for this teacher on this day
    const teacherSlots = await prisma.timetableSlot.findMany({
      where: {
        tenant_id: tenantId,
        teacher_id,
        timetable_id: { in: sameDayIds },
      },
      include: {
        timetable: { select: { class_id: true, section_id: true, class: { select: { name: true } }, section: { select: { name: true } } } },
      },
    });

    const teacherConflict = teacherSlots.find((s) =>
      timesOverlap(start_time, end_time, s.start_time, s.end_time)
    );
    if (teacherConflict) {
      const tc = teacherConflict.timetable;
      res.status(409).json({
        error: `Teacher conflict: already assigned to ${tc.class.name}-${tc.section.name} at ${teacherConflict.start_time}-${teacherConflict.end_time}`,
        conflict: 'TEACHER_OVERLAP',
      });
      return;
    }

    // ─── No conflicts → create slot ───
    const slot = await prisma.timetableSlot.create({
      data: {
        tenant_id: tenantId,
        timetable_id,
        subject_id,
        teacher_id,
        start_time,
        end_time,
        period_number: period_number || null,
      },
      include: {
        subject: { select: { name: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
    });

    res.status(201).json({ message: 'Slot added (no conflicts)', slot });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(409).json({ error: 'Slot already exists for this time in this timetable' });
      return;
    }
    console.error('Add slot error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── Delete Slot ───

export const deleteSlot = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const existing = await prisma.timetableSlot.findFirst({ where: { id: req.params.slotId, tenant_id: tenantId } });
    if (!existing) { res.status(404).json({ error: 'Slot not found' }); return; }

    await prisma.timetableSlot.delete({ where: { id: req.params.slotId } });
    res.status(200).json({ message: 'Slot deleted' });
  } catch (error) {
    console.error('Delete slot error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── Get Timetable (full week or specific day) ───

export const getTimetable = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { class_id, section_id } = req.params;
    const { day_of_week } = req.query;

    if (!class_id || !section_id) {
      res.status(400).json({ error: 'class_id and section_id are required' });
      return;
    }

    const where: any = { tenant_id: tenantId, class_id, section_id };
    if (day_of_week) where.day_of_week = day_of_week;

    const timetables = await prisma.timetable.findMany({
      where,
      include: {
        class: { select: { name: true } },
        section: { select: { name: true } },
        slots: {
          include: {
            subject: { select: { name: true, code: true } },
            teacher: { select: { firstName: true, lastName: true } },
          },
          orderBy: { start_time: 'asc' },
        },
      },
      orderBy: { day_of_week: 'asc' },
    });

    res.status(200).json({ timetables });
  } catch (error) {
    console.error('Get timetable error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
