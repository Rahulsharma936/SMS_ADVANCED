import { Response } from 'express';
import { prisma } from '../../prisma/client';
import { TenantRequest } from '../../middlewares/tenant.middleware';

export const createMapping = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { class_id, section_id, subject_id, teacher_id } = req.body;

    if (!class_id || !section_id || !subject_id || !teacher_id) {
      res.status(400).json({ error: 'class_id, section_id, subject_id, and teacher_id are required' });
      return;
    }

    // Verify all entities belong to this tenant
    const [cls, section, subject, teacher] = await Promise.all([
      prisma.class.findFirst({ where: { id: class_id, tenant_id: tenantId } }),
      prisma.section.findFirst({ where: { id: section_id, class_id, tenant_id: tenantId } }),
      prisma.subject.findFirst({ where: { id: subject_id, tenant_id: tenantId } }),
      prisma.teacher.findFirst({ where: { id: teacher_id, tenant_id: tenantId } }),
    ]);

    if (!cls) { res.status(404).json({ error: 'Class not found' }); return; }
    if (!section) { res.status(404).json({ error: 'Section not found for this class' }); return; }
    if (!subject) { res.status(404).json({ error: 'Subject not found' }); return; }
    if (!teacher) { res.status(404).json({ error: 'Teacher not found' }); return; }

    const mapping = await prisma.classSubjectTeacher.create({
      data: { tenant_id: tenantId, class_id, section_id, subject_id, teacher_id },
      include: {
        class: { select: { name: true } },
        section: { select: { name: true } },
        subject: { select: { name: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
    });

    res.status(201).json({ message: 'Mapping created', mapping });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'This subject is already assigned to this class+section' });
      return;
    }
    console.error('Create mapping error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getMappings = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { class_id, section_id } = req.query;

    const where: any = { tenant_id: tenantId };
    if (class_id) where.class_id = class_id;
    if (section_id) where.section_id = section_id;

    const mappings = await prisma.classSubjectTeacher.findMany({
      where,
      include: {
        class: { select: { name: true } },
        section: { select: { name: true } },
        subject: { select: { name: true } },
        teacher: { select: { firstName: true, lastName: true } },
      },
    });

    res.status(200).json({ mappings });
  } catch (error) {
    console.error('Get mappings error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
