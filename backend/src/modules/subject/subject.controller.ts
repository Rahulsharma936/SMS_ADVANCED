import { Response } from 'express';
import { prisma } from '../../prisma/client';
import { TenantRequest } from '../../middlewares/tenant.middleware';

export const createSubject = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { name, code, type } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Subject name is required' });
      return;
    }

    const subject = await prisma.subject.create({
      data: { name, code: code || null, type: type || 'core', tenant_id: tenantId },
    });

    res.status(201).json({ message: 'Subject created', subject });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Subject name already exists for this tenant' });
      return;
    }
    console.error('Create subject error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getSubjects = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;

    const subjects = await prisma.subject.findMany({
      where: { tenant_id: tenantId },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ subjects });
  } catch (error) {
    console.error('Get subjects error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
