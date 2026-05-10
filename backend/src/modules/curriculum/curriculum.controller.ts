import { Response } from 'express';
import { prisma } from '../../prisma/client';
import { TenantRequest } from '../../middlewares/tenant.middleware';

// ─── Update Curriculum Progress ───

export const updateProgress = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { subject_assignment_id, topic_id, completed, teacher_id } = req.body;

    if (!subject_assignment_id || !topic_id || completed === undefined || !teacher_id) {
      res.status(400).json({ error: 'subject_assignment_id, topic_id, completed, and teacher_id are required' });
      return;
    }

    const progress = await prisma.curriculumProgress.upsert({
      where: { subject_assignment_id_topic_id: { subject_assignment_id, topic_id } },
      create: {
        tenant_id: tenantId,
        subject_assignment_id,
        topic_id,
        completed,
        completed_at: completed ? new Date() : null,
        teacher_id,
      },
      update: {
        completed,
        completed_at: completed ? new Date() : null,
      },
    });

    res.status(200).json({ message: 'Progress updated', progress });
  } catch (error) {
    console.error('Update progress error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── Get Progress for a Subject Assignment ───

export const getProgress = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { subject_assignment_id } = req.query;

    if (!subject_assignment_id) {
      res.status(400).json({ error: 'subject_assignment_id query param is required' });
      return;
    }

    // Get the syllabus topics for this assignment
    const assignment = await prisma.classSubjectTeacher.findFirst({
      where: { id: subject_assignment_id as string, tenant_id: tenantId },
      include: { subject: true, class: true },
    });

    if (!assignment) { res.status(404).json({ error: 'Subject assignment not found' }); return; }

    // Find syllabus for this subject+class
    const syllabus = await prisma.syllabus.findFirst({
      where: { tenant_id: tenantId, subject_id: assignment.subject_id, class_id: assignment.class_id },
      include: { topics: { orderBy: { order_index: 'asc' } } },
    });

    if (!syllabus) {
      res.status(200).json({ topics: [], completed: 0, total: 0, percentage: 0 });
      return;
    }

    // Get progress records
    const progressRecords = await prisma.curriculumProgress.findMany({
      where: { tenant_id: tenantId, subject_assignment_id: subject_assignment_id as string },
    });
    const progressMap = new Map(progressRecords.map((p) => [p.topic_id, p]));

    const topics = syllabus.topics.map((t) => ({
      id: t.id,
      topic_name: t.topic_name,
      order_index: t.order_index,
      completed: progressMap.get(t.id)?.completed || false,
      completed_at: progressMap.get(t.id)?.completed_at || null,
    }));

    const completedCount = topics.filter((t) => t.completed).length;

    res.status(200).json({
      syllabus_title: syllabus.title,
      subject: assignment.subject.name,
      class: assignment.class.name,
      topics,
      completed: completedCount,
      total: topics.length,
      percentage: topics.length > 0 ? Math.round((completedCount / topics.length) * 100) : 0,
    });
  } catch (error) {
    console.error('Get progress error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
