import { Response } from 'express';
import { prisma } from '../../prisma/client';
import { TenantRequest } from '../../middlewares/tenant.middleware';

// ─── Create Syllabus ───

export const createSyllabus = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { subject_id, class_id, title, description, file_url, academic_year, topics } = req.body;

    if (!subject_id || !class_id || !title || !academic_year) {
      res.status(400).json({ error: 'subject_id, class_id, title, and academic_year are required' });
      return;
    }

    const syllabus = await prisma.syllabus.create({
      data: {
        tenant_id: tenantId,
        subject_id,
        class_id,
        title,
        description: description || null,
        file_url: file_url || null,
        academic_year,
        topics: topics?.length ? {
          create: topics.map((t: string, i: number) => ({
            tenant_id: tenantId,
            topic_name: t,
            order_index: i,
          })),
        } : undefined,
      },
      include: { topics: { orderBy: { order_index: 'asc' } }, subject: { select: { name: true } }, class: { select: { name: true } } },
    });

    res.status(201).json({ message: 'Syllabus created', syllabus });
  } catch (error: any) {
    if (error.code === 'P2002') { res.status(400).json({ error: 'Syllabus already exists for this subject + class + year' }); return; }
    console.error('Create syllabus error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── Get Syllabi ───

export const getSyllabi = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { class_id, subject_id, academic_year } = req.query;
    const where: any = { tenant_id: tenantId };
    if (class_id) where.class_id = class_id;
    if (subject_id) where.subject_id = subject_id;
    if (academic_year) where.academic_year = academic_year;

    const syllabi = await prisma.syllabus.findMany({
      where,
      include: {
        topics: { orderBy: { order_index: 'asc' } },
        subject: { select: { name: true, code: true } },
        class: { select: { name: true } },
      },
      orderBy: { title: 'asc' },
    });

    res.status(200).json({ syllabi });
  } catch (error) {
    console.error('Get syllabi error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

// ─── Add Topics to Syllabus ───

export const addTopics = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { id } = req.params;
    const { topics } = req.body;

    if (!topics?.length) { res.status(400).json({ error: 'topics array is required' }); return; }

    const syllabus = await prisma.syllabus.findFirst({ where: { id, tenant_id: tenantId } });
    if (!syllabus) { res.status(404).json({ error: 'Syllabus not found' }); return; }

    // Get current max order
    const maxOrder = await prisma.syllabusTopic.findFirst({
      where: { syllabus_id: id },
      orderBy: { order_index: 'desc' },
      select: { order_index: true },
    });
    const startIdx = (maxOrder?.order_index ?? -1) + 1;

    const created = await prisma.syllabusTopic.createMany({
      data: topics.map((t: string, i: number) => ({
        tenant_id: tenantId,
        syllabus_id: id,
        topic_name: t,
        order_index: startIdx + i,
      })),
    });

    res.status(201).json({ message: `${created.count} topics added` });
  } catch (error) {
    console.error('Add topics error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
