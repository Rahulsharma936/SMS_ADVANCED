import { Response } from 'express';
import { prisma } from '../../prisma/client';
import { TenantRequest } from '../../middlewares/tenant.middleware';

export const createClass = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { name, description } = req.body;

    if (!name) {
      res.status(400).json({ error: 'Class name is required' });
      return;
    }

    const newClass = await prisma.class.create({
      data: { name, description, tenant_id: tenantId },
    });

    res.status(201).json({ message: 'Class created', class: newClass });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Class name already exists for this tenant' });
      return;
    }
    console.error('Create class error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getClasses = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;

    const classes = await prisma.class.findMany({
      where: { tenant_id: tenantId },
      include: {
        sections: { orderBy: { name: 'asc' } },
        _count: { select: { students: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ classes });
  } catch (error) {
    console.error('Get classes error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const createSection = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { class_id, name } = req.body;

    if (!class_id || !name) {
      res.status(400).json({ error: 'class_id and name are required' });
      return;
    }

    // Verify the class belongs to this tenant
    const existingClass = await prisma.class.findFirst({
      where: { id: class_id, tenant_id: tenantId },
    });

    if (!existingClass) {
      res.status(404).json({ error: 'Class not found in this tenant' });
      return;
    }

    const section = await prisma.section.create({
      data: { name, class_id, tenant_id: tenantId },
    });

    res.status(201).json({ message: 'Section created', section });
  } catch (error: any) {
    if (error.code === 'P2002') {
      res.status(400).json({ error: 'Section name already exists for this class' });
      return;
    }
    console.error('Create section error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};

export const getSections = async (req: TenantRequest, res: Response) => {
  try {
    const tenantId = req.tenantId!;
    const { class_id } = req.query;

    const where: any = { tenant_id: tenantId };
    if (class_id) where.class_id = class_id;

    const sections = await prisma.section.findMany({
      where,
      include: {
        class: true,
        _count: { select: { students: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.status(200).json({ sections });
  } catch (error) {
    console.error('Get sections error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};
